import {useQuery} from '@tanstack/react-query'

import {loadTileContent} from '#/lib/tiles/loader'
import {getTileHandle} from '#/lib/tiles/resolve'
import {type TileManifest} from '#/lib/tiles/types'
import {STALE} from '#/state/queries'
import {useAgent} from '#/state/session'

const TILE_COLLECTION = 'ing.dasl.masl'
const TILE_RKEY = 'goodreads'

const RQKEY_ROOT = 'tile'
export const RQKEY_DID = (handle: string) => [RQKEY_ROOT, 'did', handle]
export const RQKEY_MANIFEST = (did: string) => [RQKEY_ROOT, 'manifest', did]
export const RQKEY_CONTENT = (did: string) => [RQKEY_ROOT, 'content', did]

function useTileQuery({did}: {did: string | undefined}) {
  const agent = useAgent()

  return useQuery<TileManifest | null>({
    queryKey: RQKEY_MANIFEST(did ?? ''),
    queryFn: async () => {
      try {
        const res = await agent.com.atproto.repo.getRecord({
          repo: did!,
          collection: TILE_COLLECTION,
          rkey: TILE_RKEY,
        })
        const value = res.data.value as unknown as TileManifest
        if (!value.name || !value.resources?.['/']) return null
        return value
      } catch {
        return null
      }
    },
    staleTime: STALE.HOURS.ONE,
    enabled: !!did,
    retry: false,
  })
}

export function useTileForUrl(url: string) {
  const handle = getTileHandle(url)
  const agent = useAgent()

  const {data: did} = useQuery({
    queryKey: RQKEY_DID(handle ?? ''),
    queryFn: async () => {
      const res = await agent.resolveHandle({handle: handle!})
      return res.data.did
    },
    staleTime: STALE.INFINITY,
    enabled: !!handle,
    retry: false,
  })

  const tileQuery = useTileQuery({did})

  return {
    manifest: tileQuery.data ?? undefined,
    did,
    isLoading: tileQuery.isLoading,
    isError: tileQuery.isError,
  }
}

export function useTileContentQuery(
  manifest: TileManifest | undefined,
  did: string | undefined,
) {
  const agent = useAgent()
  const serviceUrl = agent.serviceUrl.toString().replace(/\/$/, '')

  return useQuery<string>({
    queryKey: RQKEY_CONTENT(did ?? ''),
    queryFn: () => loadTileContent(manifest!, did!, serviceUrl),
    staleTime: STALE.HOURS.ONE,
    enabled: !!manifest && !!did,
    retry: 1,
  })
}
