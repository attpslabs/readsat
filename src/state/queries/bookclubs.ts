import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {READS_AT_ACCOUNT_DID} from '#/lib/constants'
import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {useAgent, useSession} from '#/state/session'

const BOOKCLUB_COLLECTION = 'at.reads.bookclub'
const BOOKCLUB_BOOK_COLLECTION = 'at.reads.bookclub.book'
const BOOKCLUB_MEMBER_COLLECTION = 'at.reads.bookclub.member'

const BOOKCLUB_API = 'https://bookclub-api.attps.workers.dev'

const RQKEY_ROOT = 'bookclubs'
export const RQKEY_LIST = () => [RQKEY_ROOT, 'list']
export const RQKEY_BOOKS = (clubUri: string) => [RQKEY_ROOT, 'books', clubUri]
export const RQKEY_MY_REQUEST = (clubUri: string) => [
  RQKEY_ROOT,
  'my-request',
  clubUri,
]
export const RQKEY_PENDING_MEMBERS = (clubUri: string) => [
  RQKEY_ROOT,
  'pending-members',
  clubUri,
]
export const RQKEY_MY_MEMBERSHIP = (clubUri: string) => [
  RQKEY_ROOT,
  'my-membership',
  clubUri,
]
export const RQKEY_DETAIL = (rkey: string) => [RQKEY_ROOT, 'detail', rkey]

/**
 * at.reads.bookclub — the club itself
 */
export interface BookClubRecord {
  [key: string]: unknown
  $type: typeof BOOKCLUB_COLLECTION
  name: string
  admin: string
  createdBy: string
  createdAt: string
}

/**
 * at.reads.bookclub.book — a book being discussed (append-only log)
 * Each record represents one book discussion period.
 * The rkey encodes ordering (e.g. timestamp-based TID).
 */
export interface BookClubBookRecord {
  [key: string]: unknown
  $type: typeof BOOKCLUB_BOOK_COLLECTION
  club: string // AT URI of the bookclub
  bookTitle: string
  bookAuthors?: string
  bookCover?: string
  bookHiveId?: string
  startedAt: string // when this book discussion started
}

/**
 * at.reads.bookclub.member — join request (on user's PDS + mirrored to reads.at)
 */
export interface BookClubMemberRecord {
  [key: string]: unknown
  $type: typeof BOOKCLUB_MEMBER_COLLECTION
  club: string // AT URI of the bookclub
  did?: string // requester's DID (present on mirrored records)
  status: 'pending' | 'approved' | 'denied'
  handle: string
  createdAt: string
}

export interface BookClubBookEntry {
  uri: string
  rkey: string
  record: BookClubBookRecord
}

export interface BookClubEntry {
  uri: string
  rkey: string
  record: BookClubRecord
  /** The current (most recent) book, fetched alongside the club */
  currentBook?: BookClubBookEntry
}

export interface BookClubMemberEntry {
  uri: string
  rkey: string
  record: BookClubMemberRecord
}

/**
 * Helper: call the bookclub-api worker with the user's session token.
 */
async function callBookclubApi(
  path: string,
  body: Record<string, unknown>,
  accessJwt: string,
  pdsUrl?: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BOOKCLUB_API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessJwt}`,
    },
    body: JSON.stringify({...body, pdsUrl}),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {error?: string}
    throw new Error(data.error || `API error: ${res.status}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

/**
 * List ALL bookclubs from the reads.at service account repo.
 * This is a public read — no auth needed.
 * Also fetches the most recent book for each club.
 */
export function useBookClubsQuery() {
  const agent = useAgent()

  return useQuery<BookClubEntry[]>({
    queryKey: RQKEY_LIST(),
    queryFn: async () => {
      // Fetch all clubs from the reads.at repo
      const clubsRes = await agent.com.atproto.repo.listRecords({
        repo: READS_AT_ACCOUNT_DID,
        collection: BOOKCLUB_COLLECTION,
        limit: 100,
      })

      // Fetch all book records from the reads.at repo
      const booksRes = await agent.com.atproto.repo.listRecords({
        repo: READS_AT_ACCOUNT_DID,
        collection: BOOKCLUB_BOOK_COLLECTION,
        limit: 100,
        reverse: true, // newest first
      })

      const allBooks = booksRes.data.records.map(r => ({
        uri: r.uri,
        rkey: r.uri.split('/').pop()!,
        record: r.value as BookClubBookRecord,
      }))

      return clubsRes.data.records.map(record => {
        const clubUri = record.uri
        // Find the most recent book for this club (list is newest-first)
        const currentBook = allBooks.find(b => b.record.club === clubUri)

        return {
          uri: clubUri,
          rkey: clubUri.split('/').pop()!,
          record: record.value as BookClubRecord,
          currentBook,
        }
      })
    },
    staleTime: STALE.MINUTES.ONE,
  })
}

/**
 * Fetch a single bookclub by rkey from the reads.at service account repo.
 */
export function useBookClubQuery(rkey: string) {
  const agent = useAgent()

  return useQuery<BookClubEntry | null>({
    queryKey: RQKEY_DETAIL(rkey),
    queryFn: async () => {
      const res = await agent.com.atproto.repo.getRecord({
        repo: READS_AT_ACCOUNT_DID,
        collection: BOOKCLUB_COLLECTION,
        rkey,
      })

      const clubUri = res.data.uri

      // Fetch the most recent book for this club
      const booksRes = await agent.com.atproto.repo.listRecords({
        repo: READS_AT_ACCOUNT_DID,
        collection: BOOKCLUB_BOOK_COLLECTION,
        limit: 100,
        reverse: true,
      })
      const currentBook = booksRes.data.records
        .map(r => ({
          uri: r.uri,
          rkey: r.uri.split('/').pop()!,
          record: r.value as BookClubBookRecord,
        }))
        .find(b => b.record.club === clubUri)

      return {
        uri: clubUri,
        rkey,
        record: res.data.value as BookClubRecord,
        currentBook,
      }
    },
    staleTime: STALE.MINUTES.ONE,
    enabled: !!rkey,
  })
}

/**
 * Fetch all books for a specific club (full history, oldest first).
 */
export function useClubBooksQuery(clubUri: string) {
  const agent = useAgent()

  return useQuery<BookClubBookEntry[]>({
    queryKey: RQKEY_BOOKS(clubUri),
    queryFn: async () => {
      const res = await agent.com.atproto.repo.listRecords({
        repo: READS_AT_ACCOUNT_DID,
        collection: BOOKCLUB_BOOK_COLLECTION,
        limit: 100,
      })
      return res.data.records
        .map(r => ({
          uri: r.uri,
          rkey: r.uri.split('/').pop()!,
          record: r.value as BookClubBookRecord,
        }))
        .filter(b => b.record.club === clubUri)
        .sort(
          (a, b) =>
            new Date(a.record.startedAt).getTime() -
            new Date(b.record.startedAt).getTime(),
        )
    },
    staleTime: STALE.MINUTES.ONE,
    enabled: !!clubUri,
  })
}

/**
 * Create a bookclub via the bookclub-api worker.
 * The worker writes the record to the reads.at service repo.
 */
export function useCreateBookClubMutation() {
  const agent = useAgent()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()

  return useMutation<BookClubEntry, Error, {name: string}>({
    mutationFn: async ({name}) => {
      const accessJwt = agent.session?.accessJwt
      if (!accessJwt) throw new Error('Not logged in')

      const data = await callBookclubApi(
        '/club',
        {name},
        accessJwt,
        currentAccount?.pdsUrl,
      )
      return {
        uri: data.uri as string,
        rkey: data.rkey as string,
        record: data.record as BookClubRecord,
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: RQKEY_LIST()})
    },
    onError: error => {
      logger.error('Failed to create book club', {safeMessage: error})
    },
  })
}

/**
 * Update a bookclub's name via the bookclub-api worker.
 */
export function useUpdateBookClubMutation() {
  const agent = useAgent()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()

  return useMutation<void, Error, {rkey: string; name: string}>({
    mutationFn: async ({rkey, name}) => {
      const accessJwt = agent.session?.accessJwt
      if (!accessJwt) throw new Error('Not logged in')

      await callBookclubApi(
        '/club/update',
        {rkey, name},
        accessJwt,
        currentAccount?.pdsUrl,
      )
    },
    onSuccess: (_, {rkey}) => {
      void queryClient.invalidateQueries({queryKey: RQKEY_LIST()})
      void queryClient.invalidateQueries({queryKey: RQKEY_DETAIL(rkey)})
    },
    onError: error => {
      logger.error('Failed to update book club', {safeMessage: error})
    },
  })
}

/**
 * Add a new book to a club's discussion log via the bookclub-api worker.
 * This never overwrites previous books — each is a new record.
 */
export function useAddBookToClubMutation() {
  const agent = useAgent()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()

  return useMutation<
    BookClubBookEntry,
    Error,
    {
      clubUri: string
      bookTitle: string
      bookAuthors?: string
      bookCover?: string
      bookHiveId?: string
    }
  >({
    mutationFn: async ({
      clubUri,
      bookTitle,
      bookAuthors,
      bookCover,
      bookHiveId,
    }) => {
      const accessJwt = agent.session?.accessJwt
      if (!accessJwt) throw new Error('Not logged in')

      const data = await callBookclubApi(
        '/book',
        {clubUri, bookTitle, bookAuthors, bookCover, bookHiveId},
        accessJwt,
        currentAccount?.pdsUrl,
      )
      return {
        uri: data.uri as string,
        rkey: data.rkey as string,
        record: data.record as BookClubBookRecord,
      }
    },
    onSuccess: (_, {clubUri}) => {
      const clubRkey = clubUri.split('/').pop()!
      void queryClient.invalidateQueries({queryKey: RQKEY_LIST()})
      void queryClient.invalidateQueries({queryKey: RQKEY_BOOKS(clubUri)})
      void queryClient.invalidateQueries({queryKey: RQKEY_DETAIL(clubRkey)})
    },
    onError: error => {
      logger.error('Failed to add book to club', {safeMessage: error})
    },
  })
}

/**
 * Check if the current user has a pending join request for a club
 */
export function useMyJoinRequestQuery(clubUri: string) {
  const agent = useAgent()
  const {currentAccount} = useSession()

  return useQuery<{uri: string; rkey: string} | null>({
    queryKey: RQKEY_MY_REQUEST(clubUri),
    queryFn: async () => {
      if (!currentAccount) return null
      try {
        const res = await agent.com.atproto.repo.listRecords({
          repo: currentAccount.did,
          collection: BOOKCLUB_MEMBER_COLLECTION,
          limit: 100,
        })
        const match = res.data.records.find(r => {
          const val = r.value as BookClubMemberRecord
          return val.club === clubUri && val.status === 'pending'
        })
        if (match) {
          return {uri: match.uri, rkey: match.uri.split('/').pop()!}
        }
        return null
      } catch {
        return null
      }
    },
    staleTime: STALE.MINUTES.ONE,
    enabled: !!currentAccount && !!clubUri,
  })
}

/**
 * Check if the current user is an approved member of a club.
 * Looks for a member record with status === 'approved' on the user's PDS.
 */
export function useMyMembershipQuery(clubUri: string) {
  const agent = useAgent()
  const {currentAccount} = useSession()

  return useQuery<boolean>({
    queryKey: RQKEY_MY_MEMBERSHIP(clubUri),
    queryFn: async () => {
      if (!currentAccount) return false
      try {
        const res = await agent.com.atproto.repo.listRecords({
          repo: currentAccount.did,
          collection: BOOKCLUB_MEMBER_COLLECTION,
          limit: 100,
        })
        return res.data.records.some(r => {
          const val = r.value as BookClubMemberRecord
          return val.club === clubUri && val.status === 'approved'
        })
      } catch {
        return false
      }
    },
    staleTime: STALE.MINUTES.ONE,
    enabled: !!currentAccount && !!clubUri,
  })
}

/**
 * Request to join a book club — creates a pending member record on the user's PDS
 * and mirrors it to the reads.at repo so the admin can discover it.
 */
export function useJoinBookClubMutation() {
  const agent = useAgent()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()

  return useMutation<{uri: string; rkey: string}, Error, {clubUri: string}>({
    mutationFn: async ({clubUri}) => {
      if (!currentAccount) throw new Error('Not logged in')
      const accessJwt = agent.session?.accessJwt
      if (!accessJwt) throw new Error('Not logged in')

      const record: BookClubMemberRecord = {
        $type: BOOKCLUB_MEMBER_COLLECTION,
        club: clubUri,
        status: 'pending',
        handle: currentAccount.handle,
        createdAt: new Date().toISOString(),
      }

      // Write to user's own PDS
      const res = await agent.com.atproto.repo.createRecord({
        repo: currentAccount.did,
        collection: BOOKCLUB_MEMBER_COLLECTION,
        record,
      })

      // Mirror to reads.at repo via worker (best-effort)
      try {
        await callBookclubApi(
          '/member/request',
          {clubUri, handle: currentAccount.handle},
          accessJwt,
          currentAccount.pdsUrl,
        )
      } catch (e) {
        logger.error('Failed to mirror join request', {safeMessage: e})
      }

      return {
        uri: res.data.uri,
        rkey: res.data.uri.split('/').pop()!,
      }
    },
    onSuccess: (_, {clubUri}) => {
      void queryClient.invalidateQueries({queryKey: RQKEY_MY_REQUEST(clubUri)})
      void queryClient.invalidateQueries({
        queryKey: RQKEY_PENDING_MEMBERS(clubUri),
      })
    },
    onError: error => {
      logger.error('Failed to request to join book club', {
        safeMessage: error,
      })
    },
  })
}

/**
 * Cancel a join request — deletes from user's PDS and the mirrored reads.at record.
 */
export function useCancelJoinRequestMutation() {
  const agent = useAgent()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()

  return useMutation<void, Error, {clubUri: string; rkey: string}>({
    mutationFn: async ({clubUri, rkey}) => {
      if (!currentAccount) throw new Error('Not logged in')
      const accessJwt = agent.session?.accessJwt
      if (!accessJwt) throw new Error('Not logged in')

      // Delete from user's own PDS
      await agent.com.atproto.repo.deleteRecord({
        repo: currentAccount.did,
        collection: BOOKCLUB_MEMBER_COLLECTION,
        rkey,
      })

      // Find and cancel the mirrored record on reads.at (best-effort)
      try {
        // List member records from reads.at to find the mirror
        const mirrorRes = await agent.com.atproto.repo.listRecords({
          repo: READS_AT_ACCOUNT_DID,
          collection: BOOKCLUB_MEMBER_COLLECTION,
          limit: 100,
        })
        const mirror = mirrorRes.data.records.find(r => {
          const val = r.value as BookClubMemberRecord
          return (
            val.club === clubUri &&
            val.did === currentAccount.did &&
            val.status === 'pending'
          )
        })
        if (mirror) {
          const mirrorRkey = mirror.uri.split('/').pop()!
          await callBookclubApi(
            '/member/cancel',
            {clubUri, rkey: mirrorRkey},
            accessJwt,
            currentAccount.pdsUrl,
          )
        }
      } catch (e) {
        logger.error('Failed to cancel mirrored join request', {
          safeMessage: e,
        })
      }
    },
    onSuccess: (_, {clubUri}) => {
      void queryClient.invalidateQueries({queryKey: RQKEY_MY_REQUEST(clubUri)})
      void queryClient.invalidateQueries({
        queryKey: RQKEY_PENDING_MEMBERS(clubUri),
      })
    },
    onError: error => {
      logger.error('Failed to cancel join request', {safeMessage: error})
    },
  })
}

/**
 * Fetch pending member requests for a club from the reads.at mirror repo.
 * Only useful for the club admin.
 */
export function usePendingMembersQuery(clubUri: string, isAdmin: boolean) {
  const agent = useAgent()

  return useQuery<BookClubMemberEntry[]>({
    queryKey: RQKEY_PENDING_MEMBERS(clubUri),
    queryFn: async () => {
      const res = await agent.com.atproto.repo.listRecords({
        repo: READS_AT_ACCOUNT_DID,
        collection: BOOKCLUB_MEMBER_COLLECTION,
        limit: 100,
      })
      return res.data.records
        .map(r => ({
          uri: r.uri,
          rkey: r.uri.split('/').pop()!,
          record: r.value as BookClubMemberRecord,
        }))
        .filter(m => m.record.club === clubUri && m.record.status === 'pending')
    },
    staleTime: STALE.MINUTES.ONE,
    enabled: !!clubUri && isAdmin,
  })
}

/**
 * Admin approves a pending member request via the worker.
 */
export function useApproveMemberMutation() {
  const agent = useAgent()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()

  return useMutation<void, Error, {clubUri: string; rkey: string}>({
    mutationFn: async ({rkey}) => {
      const accessJwt = agent.session?.accessJwt
      if (!accessJwt) throw new Error('Not logged in')

      await callBookclubApi(
        '/member/approve',
        {rkey},
        accessJwt,
        currentAccount?.pdsUrl,
      )
    },
    onSuccess: (_, {clubUri}) => {
      void queryClient.invalidateQueries({
        queryKey: RQKEY_PENDING_MEMBERS(clubUri),
      })
    },
    onError: error => {
      logger.error('Failed to approve member', {safeMessage: error})
    },
  })
}

/**
 * Admin denies a pending member request via the worker.
 */
export function useDenyMemberMutation() {
  const agent = useAgent()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()

  return useMutation<void, Error, {clubUri: string; rkey: string}>({
    mutationFn: async ({rkey}) => {
      const accessJwt = agent.session?.accessJwt
      if (!accessJwt) throw new Error('Not logged in')

      await callBookclubApi(
        '/member/deny',
        {rkey},
        accessJwt,
        currentAccount?.pdsUrl,
      )
    },
    onSuccess: (_, {clubUri}) => {
      void queryClient.invalidateQueries({
        queryKey: RQKEY_PENDING_MEMBERS(clubUri),
      })
    },
    onError: error => {
      logger.error('Failed to deny member', {safeMessage: error})
    },
  })
}
