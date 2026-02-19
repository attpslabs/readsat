import {useQuery} from '@tanstack/react-query'

import {PUBLIC_BSKY_SERVICE} from '#/lib/constants'
import {loadTileContent} from '#/lib/tiles/loader'
import {getTileHandle} from '#/lib/tiles/resolve'
import {type TileManifest, type TileMaslRecord} from '#/lib/tiles/types'
import {STALE} from '#/state/queries'

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

/**
 * Resolve a handle to a DID via the public API.
 * Uses the public appview instead of the session agent so it works
 * regardless of which PDS the logged-in user is on.
 */
async function resolveHandlePublic(handle: string): Promise<string> {
  const url = `${PUBLIC_BSKY_SERVICE}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to resolve handle: ${res.status}`)
  const data = await res.json()
  return data.did
}

/**
 * Fetch an AT Protocol record via the public API.
 */
async function getRecordPublic(
  repo: string,
  collection: string,
  rkey: string,
): Promise<unknown> {
  const url = `${PUBLIC_BSKY_SERVICE}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(repo)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch record: ${res.status}`)
  const data = await res.json()
  return data.value
}

function useTileQuery({did}: {did: string | undefined}) {
  return useQuery<TileManifest | null>({
    queryKey: RQKEY_MANIFEST(did ?? ''),
    queryFn: async () => {
      try {
        const value = await getRecordPublic(did!, TILE_COLLECTION, TILE_RKEY)
        const record = value as TileMaslRecord
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

  const {data: did} = useQuery({
    queryKey: RQKEY_DID(handle ?? ''),
    queryFn: async () => {
      return resolveHandlePublic(handle!)
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
