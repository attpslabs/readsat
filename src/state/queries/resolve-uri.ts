import {AtUri} from '@atproto/api'
import {
  type QueryClient,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'

import {expandHandle} from '#/lib/strings/handles'
import {STALE} from '#/state/queries'
import {useAgent} from '#/state/session'
import {useUnstableProfileViewCache} from './profile'

const RQKEY_ROOT = 'resolved-did'
export const RQKEY = (didOrHandle: string) => [RQKEY_ROOT, didOrHandle]

type UriUseQueryResult = UseQueryResult<{did: string; uri: string}, Error>
export function useResolveUriQuery(uri: string | undefined): UriUseQueryResult {
  const urip = new AtUri(uri || '')
  const res = useResolveDidQuery(urip.host)
  if (res.data) {
    // @ts-expect-error TODO new-sdk-migration
    urip.host = res.data
    return {
      ...res,
      data: {did: urip.host, uri: urip.toString()},
    } as UriUseQueryResult
  }
  return res as UriUseQueryResult
}

export function useResolveDidQuery(didOrHandle: string | undefined) {
  const agent = useAgent()
  const {getUnstableProfile} = useUnstableProfileViewCache()
  const expanded = didOrHandle ? expandHandle(didOrHandle) : undefined

  return useQuery<string, Error>({
    staleTime: STALE.HOURS.ONE,
    queryKey: RQKEY(expanded ?? ''),
    queryFn: async () => {
      if (!expanded) return ''
      if (expanded.startsWith('did:')) return expanded

      const res = await agent.resolveHandle({handle: expanded})
      return res.data.did
    },
    initialData: () => {
      if (!expanded) return
      const profile =
        getUnstableProfile(expanded) ||
        (didOrHandle !== expanded
          ? getUnstableProfile(didOrHandle!)
          : undefined)
      return profile?.did
    },
    enabled: !!expanded,
  })
}

export function precacheResolvedUri(
  queryClient: QueryClient,
  handle: string,
  did: string,
) {
  const expanded = expandHandle(handle)
  queryClient.setQueryData<string>(RQKEY(expanded), did)
}
