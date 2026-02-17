import React from 'react'

interface BookGenreFilterState {
  selectedGenre: string | null
  setSelectedGenre: (genre: string | null) => void
}

const stateContext = React.createContext<BookGenreFilterState>({
  selectedGenre: null,
  setSelectedGenre: () => {},
})
stateContext.displayName = 'BookGenreFilterContext'

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [selectedGenre, setSelectedGenre] = React.useState<string | null>(null)

  const value = React.useMemo(
    () => ({selectedGenre, setSelectedGenre}),
    [selectedGenre],
  )

  return <stateContext.Provider value={value}>{children}</stateContext.Provider>
}

export function useBookGenreFilter() {
  return React.useContext(stateContext)
}
