import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {logger} from '#/logger'
import {STALE} from '#/state/queries'
import {useAgent} from '#/state/session'

const GOODREADS_COLLECTION = 'at.reads.goodreads'
const GOODREADS_RKEY = 'self'

const RQKEY_ROOT = 'goodreads'
export const RQKEY = (did: string) => [RQKEY_ROOT, did]

export function useGoodreadsQuery({did}: {did: string | undefined}) {
  const agent = useAgent()

  return useQuery<string | null>({
    queryKey: RQKEY(did ?? ''),
    queryFn: async () => {
      try {
        const res = await agent.com.atproto.repo.getRecord({
          repo: did!,
          collection: GOODREADS_COLLECTION,
          rkey: GOODREADS_RKEY,
        })
        const value = res.data.value as {url?: string}
        return value?.url ?? null
      } catch {
        return null
      }
    },
    staleTime: STALE.MINUTES.FIVE,
    enabled: !!did,
  })
}

export function useGoodreadsMutation() {
  const agent = useAgent()
  const queryClient = useQueryClient()

  return useMutation<void, Error, {did: string; url: string | null}>({
    mutationFn: async ({did, url}) => {
      if (url) {
        await agent.com.atproto.repo.putRecord({
          repo: did,
          collection: GOODREADS_COLLECTION,
          rkey: GOODREADS_RKEY,
          record: {
            $type: GOODREADS_COLLECTION,
            url,
          },
        })
      } else {
        try {
          await agent.com.atproto.repo.deleteRecord({
            repo: did,
            collection: GOODREADS_COLLECTION,
            rkey: GOODREADS_RKEY,
          })
        } catch {
          // Record may not exist, that's fine
        }
      }
    },
    onSuccess: (_, {did}) => {
      void queryClient.invalidateQueries({queryKey: RQKEY(did)})
    },
    onError: error => {
      logger.error('Failed to update Goodreads URL', {safeMessage: error})
    },
  })
}
