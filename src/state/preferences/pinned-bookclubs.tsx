import React from 'react'

import * as persisted from '#/state/persisted'
import {useSession} from '#/state/session'

type PinnedMap = Record<string, string[]>

interface PinnedBookClubsState {
  pinnedRkeys: string[]
  pin: (rkey: string) => void
  unpin: (rkey: string) => void
  isPinned: (rkey: string) => boolean
}

const stateContext = React.createContext<PinnedBookClubsState>({
  pinnedRkeys: [],
  pin: () => {},
  unpin: () => {},
  isPinned: () => false,
})
stateContext.displayName = 'PinnedBookClubsStateContext'

function readMap(): PinnedMap {
  const raw = persisted.get('pinnedBookClubs')
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as PinnedMap
  }
  return {}
}

export function Provider({children}: React.PropsWithChildren<{}>) {
  const {currentAccount} = useSession()
  const did = currentAccount?.did ?? ''

  const [pinnedMap, setPinnedMap] = React.useState<PinnedMap>(readMap)

  React.useEffect(() => {
    return persisted.onUpdate('pinnedBookClubs', next => {
      if (next && typeof next === 'object' && !Array.isArray(next)) {
        setPinnedMap(next as PinnedMap)
      } else {
        setPinnedMap({})
      }
    })
  }, [])

  const pinnedRkeys = did ? (pinnedMap[did] ?? []) : []

  const pin = (rkey: string) => {
    if (!did) return
    const currentForDid = pinnedMap[did] ?? []
    const next = {...pinnedMap, [did]: [...currentForDid, rkey]}
    setPinnedMap(next)
    persisted.write('pinnedBookClubs', next)
  }

  const unpin = (rkey: string) => {
    if (!did) return
    const currentForDid = pinnedMap[did] ?? []
    const next = {...pinnedMap, [did]: currentForDid.filter(r => r !== rkey)}
    setPinnedMap(next)
    persisted.write('pinnedBookClubs', next)
  }

  const isPinned = (rkey: string) => {
    return pinnedRkeys.includes(rkey)
  }

  const value = React.useMemo(
    () => ({pinnedRkeys, pin, unpin, isPinned}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pinnedRkeys, did],
  )

  return <stateContext.Provider value={value}>{children}</stateContext.Provider>
}

export function usePinnedBookClubs() {
  return React.useContext(stateContext)
}
