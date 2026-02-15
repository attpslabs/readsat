import {useQuery} from '@tanstack/react-query'

import {loadTileContent} from '#/lib/tiles/loader'
import {getTileHandle} from '#/lib/tiles/resolve'
import {type TileManifest, type TileMaslRecord} from '#/lib/tiles/types'
import {STALE} from '#/state/queries'
import {useAgent} from '#/state/session'

const TILE_COLLECTION = 'ing.dasl.masl'
const TILE_RKEY = 'goodreads'

const RQKEY_ROOT = 'tile'
export const RQKEY_DID = (handle: string) => [RQKEY_ROOT, 'did', handle]
export const RQKEY_MANIFEST = (did: string) => [RQKEY_ROOT, 'manifest', did]
export const RQKEY_CONTENT = (did: string) => [RQKEY_ROOT, 'content', did]

/**
 * Resolve a DID to its PDS service endpoint via the DID document.
 */
async function resolvePdsUrl(did: string): Promise<string> {
  const url = did.startsWith('did:plc:')
    ? `https://plc.directory/${did}`
    : `https://${did.replace('did:web:', '')}/.well-known/did.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to resolve DID: ${res.status}`)
  const doc = await res.json()
  const pds = doc.service?.find(
    (s: {id: string; type: string}) => s.type === 'AtprotoPersonalDataServer',
  )
  if (!pds?.serviceEndpoint) throw new Error('No PDS found in DID document')
  return pds.serviceEndpoint.replace(/\/$/, '')
}

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
        const record = res.data.value as unknown as TileMaslRecord
        const tile = record.tile
        if (!tile?.name || !tile?.resources?.['/']) return null
        return tile
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
  return useQuery<string>({
    queryKey: RQKEY_CONTENT(did ?? ''),
    queryFn: async () => {
      const pdsUrl = await resolvePdsUrl(did!)
      return loadTileContent(manifest!, did!, pdsUrl)
    },
    staleTime: STALE.HOURS.ONE,
    enabled: !!manifest && !!did,
    retry: 1,
  })
}
