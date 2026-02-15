import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query'

import {STALE} from '#/state/queries'

// BookHive API is proxied through a CORS-enabled Cloudflare Worker.
// In development, run the worker locally: cd workers/bookhive-proxy && npx wrangler dev
const BOOKHIVE_BASE = __DEV__
  ? 'http://localhost:8787/xrpc'
  : 'https://bookhive-proxy.attps.workers.dev/xrpc'
const PAGE_LIMIT = 25

export interface BookActivity {
  type: 'started' | 'finished' | 'review' | 'rated'
  userDid: string
  userHandle: string
}

export interface HiveBook {
  id: string
  title: string
  authors: string
  thumbnail: string
  cover?: string
  description?: string
  rating?: number
  ratingsCount?: number
  source?: string
  sourceUrl?: string
  sourceId?: string
  genres?: string
  series?: string
  meta?: string
  identifiers?: {
    hiveId: string
    isbn10?: string
    isbn13?: string
    goodreadsId?: string
  }
  activity?: BookActivity[]
  createdAt: string
  updatedAt: string
}

export interface BookDetailResponse {
  book: HiveBook
  reviews: unknown[]
  comments: unknown[]
  activity: BookActivity[]
}

export interface BookMeta {
  publisher?: string
  publicationYear?: string
  numPages?: string
  isbn?: string
  isbn13?: string
  language?: string
  authorBio?: string
}

export function parseBookMeta(meta: string | null | undefined): BookMeta {
  if (!meta) return {}
  try {
    return JSON.parse(meta)
  } catch {
    return {}
  }
}

export function parseBookSeries(
  series: string | null | undefined,
): {name: string; position?: string} | null {
  if (!series) return null
  try {
    return JSON.parse(series)
  } catch {
    return null
  }
}

export function formatAuthors(authors: string): string {
  return authors.split('\t').join(', ')
}

export function formatRating(rating: number | undefined): string {
  if (rating == null) return '0.0'
  return (rating / 1000).toFixed(1)
}

export function groupBookActivity(activity: BookActivity[]): {
  reading: BookActivity[]
  read: BookActivity[]
} {
  const seenReading = new Set<string>()
  const seenRead = new Set<string>()
  const reading: BookActivity[] = []
  const read: BookActivity[] = []

  for (const a of activity) {
    if (a.type === 'started') {
      if (!seenReading.has(a.userDid)) {
        seenReading.add(a.userDid)
        reading.push(a)
      }
    } else {
      if (!seenRead.has(a.userDid)) {
        seenRead.add(a.userDid)
        read.push(a)
      }
    }
  }

  return {reading, read}
}

// Query keys
const RQKEY_ROOT = 'bookhive'
export const RQKEY_SEARCH = (query: string) => [RQKEY_ROOT, 'search', query]
export const RQKEY_BOOK = (hiveId: string) => [RQKEY_ROOT, 'book', hiveId]

async function fetchSearchBooks(
  query: string,
  offset: number,
): Promise<HiveBook[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(PAGE_LIMIT),
    offset: String(offset),
  })
  const res = await fetch(
    `${BOOKHIVE_BASE}/buzz.bookhive.searchBooks?${params}`,
  )
  if (!res.ok) {
    throw new Error(`BookHive search failed: ${res.status}`)
  }
  const data = await res.json()
  return data.books
}

async function fetchBookDetail(hiveId: string): Promise<BookDetailResponse> {
  const params = new URLSearchParams({id: hiveId})
  const res = await fetch(`${BOOKHIVE_BASE}/buzz.bookhive.getBook?${params}`)
  if (!res.ok) {
    throw new Error(`BookHive getBook failed: ${res.status}`)
  }
  return res.json()
}

export function useSearchBooksQuery(query?: string) {
  const q = query?.trim() || ''

  return useInfiniteQuery({
    queryKey: RQKEY_SEARCH(q),
    queryFn: async ({pageParam}) => {
      const books = await fetchSearchBooks(q, pageParam)
      return {books, offset: pageParam}
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.books.length < PAGE_LIMIT) return undefined
      return lastPageParam + PAGE_LIMIT
    },
    staleTime: STALE.MINUTES.FIVE,
    placeholderData: keepPreviousData,
    enabled: q.length > 0,
  })
}

export function useBookDetailQuery(hiveId: string) {
  return useQuery({
    queryKey: RQKEY_BOOK(hiveId),
    queryFn: () => fetchBookDetail(hiveId),
    staleTime: STALE.MINUTES.FIVE,
    enabled: !!hiveId,
  })
}
