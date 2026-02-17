import React from 'react'

import * as persisted from '#/state/persisted'

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

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [pinnedRkeys, setPinnedRkeys] = React.useState<string[]>(
    persisted.get('pinnedBookClubs') ?? [],
  )

  React.useEffect(() => {
    return persisted.onUpdate('pinnedBookClubs', next => {
      setPinnedRkeys(next ?? [])
    })
  }, [])

  const pin = (rkey: string) => {
    const next = [...pinnedRkeys, rkey]
    setPinnedRkeys(next)
    persisted.write('pinnedBookClubs', next)
  }

  const unpin = (rkey: string) => {
    const next = pinnedRkeys.filter(r => r !== rkey)
    setPinnedRkeys(next)
    persisted.write('pinnedBookClubs', next)
  }

  const isPinned = (rkey: string) => {
    return pinnedRkeys.includes(rkey)
  }

  const value = React.useMemo(
    () => ({pinnedRkeys, pin, unpin, isPinned}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pinnedRkeys],
  )

  return <stateContext.Provider value={value}>{children}</stateContext.Provider>
}

export function usePinnedBookClubs() {
  return React.useContext(stateContext)
}
