import {useMutation, useQueryClient} from '@tanstack/react-query'

import {logger} from '#/logger'
import {useAgent, useSession} from '#/state/session'

const GOODREADS_RSS_PROXY = 'https://goodreads-rss-proxy.attps.workers.dev'

const BOOKHIVE_BASE = 'https://bookhive-proxy.attps.workers.dev/xrpc'

const BOOK_COLLECTION = 'buzz.bookhive.book'

export interface GoodreadsRssBook {
  goodreadsId: string
  title: string
  author: string
  isbn: string
  rating: number
  imageUrl: string
  shelf: string
  dateAdded: string
  dateRead: string
}

interface BookhiveMatch {
  hiveId: string
  title: string
  authors: string
  cover?: string
}

export interface SyncResult {
  synced: number
  notFound: GoodreadsRssBook[]
  total: number
}

const SHELF_TO_STATUS: Record<string, string> = {
  'currently-reading': 'buzz.bookhive.defs#reading',
  read: 'buzz.bookhive.defs#finished',
  'to-read': 'buzz.bookhive.defs#wantToRead',
}

const SHELVES = ['currently-reading', 'read', 'to-read'] as const

/**
 * Extract the numeric Goodreads user ID from a profile URL.
 * Supports:
 *   https://goodreads.com/user/show/12345
 *   https://www.goodreads.com/user/show/12345-name
 *   https://goodreads.com/review/list/12345
 */
export function extractGoodreadsUserId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.endsWith('goodreads.com')) {
      return null
    }
    // Match /user/show/12345 or /review/list/12345
    const match = parsed.pathname.match(/\/(?:user\/show|review\/list)\/(\d+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

async function fetchShelf(
  userId: string,
  shelf: string,
): Promise<GoodreadsRssBook[]> {
  const params = new URLSearchParams({userId, shelf})
  const res = await fetch(`${GOODREADS_RSS_PROXY}/rss?${params}`)
  if (!res.ok) {
    throw new Error(`RSS fetch failed for shelf ${shelf}: ${res.status}`)
  }
  const data = await res.json()
  return data.books ?? []
}

async function lookupBookByGoodreadsId(
  goodreadsId: string,
): Promise<BookhiveMatch | null> {
  try {
    const params = new URLSearchParams({goodreadsId})
    const res = await fetch(`${BOOKHIVE_BASE}/buzz.bookhive.getBook?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.book) return null
    return {
      hiveId: data.book.identifiers?.hiveId ?? data.book.id,
      title: data.book.title,
      authors: data.book.authors,
      cover: data.book.cover ?? data.book.thumbnail,
    }
  } catch {
    return null
  }
}

async function reportMissingBooks(
  books: GoodreadsRssBook[],
  userHandle?: string,
) {
  try {
    await fetch(`${GOODREADS_RSS_PROXY}/report-missing`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        books: books.map(b => ({
          title: b.title,
          author: b.author,
          goodreadsId: b.goodreadsId,
        })),
        userHandle,
      }),
    })
  } catch {
    // Non-critical, don't block sync
  }
}

export function useGoodreadsSyncMutation() {
  const agent = useAgent()
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()

  return useMutation<SyncResult, Error, {goodreadsUrl: string}>({
    mutationFn: async ({goodreadsUrl}) => {
      if (!currentAccount) {
        throw new Error('Not logged in')
      }

      const userId = extractGoodreadsUserId(goodreadsUrl)
      if (!userId) {
        throw new Error('Could not extract Goodreads user ID from URL')
      }

      // Fetch all three shelves in parallel
      const shelfResults = await Promise.all(
        SHELVES.map(async shelf => {
          try {
            const books = await fetchShelf(userId, shelf)
            return books.map(book => ({...book, shelf}))
          } catch (err) {
            logger.warn(`Failed to fetch shelf ${shelf}`, {
              safeMessage: err,
            })
            return []
          }
        }),
      )

      const allBooks = shelfResults.flat()
      let synced = 0
      const notFound: GoodreadsRssBook[] = []

      // Process each book
      for (const book of allBooks) {
        const match = await lookupBookByGoodreadsId(book.goodreadsId)

        if (!match) {
          notFound.push(book)
          continue
        }

        const status = SHELF_TO_STATUS[book.shelf]
        if (!status) continue

        // Use deterministic rkey based on goodreadsId for deduplication
        const rkey = `gr-${book.goodreadsId}`

        const record: Record<string, unknown> = {
          $type: BOOK_COLLECTION,
          title: match.title,
          authors: match.authors,
          hiveId: match.hiveId,
          status,
          createdAt: book.dateAdded || new Date().toISOString(),
        }

        if (book.rating > 0) {
          // Goodreads uses 1-5, BookHive uses 1-10
          record.stars = book.rating * 2
        }

        if (
          book.dateRead &&
          book.dateRead.trim() !== '' &&
          status === 'buzz.bookhive.defs#finished'
        ) {
          record.finishedAt = book.dateRead
        }

        try {
          await agent.com.atproto.repo.putRecord({
            repo: currentAccount.did,
            collection: BOOK_COLLECTION,
            rkey,
            record,
          })
          synced++
        } catch (err) {
          logger.warn(`Failed to write book record for ${book.title}`, {
            safeMessage: err,
          })
        }
      }

      // Report unmatched books to Discord
      if (notFound.length > 0) {
        await reportMissingBooks(notFound, currentAccount.handle)
      }

      return {synced, notFound, total: allBooks.length}
    },
    onSuccess: () => {
      // Invalidate any book-related queries so UI refreshes
      void queryClient.invalidateQueries({queryKey: ['bookhive']})
    },
    onError: error => {
      logger.error('Goodreads RSS sync failed', {safeMessage: error})
    },
  })
}
