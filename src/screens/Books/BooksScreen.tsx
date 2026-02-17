import {useMemo, useRef, useState} from 'react'
import {Pressable, type TextInput, View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useFocusEffect} from '@react-navigation/native'
import debounce from 'lodash.debounce'

import {useBookGenreFilter} from '#/state/preferences/book-genre-filter'
import {type HiveBook, useSearchBooksQuery} from '#/state/queries/bookhive'
import {useSetMinimalShellMode} from '#/state/shell'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme, web} from '#/alf'
import {SearchInput} from '#/components/forms/SearchInput'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {BookCard, BookCardSkeleton} from './BookCard'
import {POPULAR_BOOKS} from './popularBooks'

type FeedItem =
  | {type: 'header'; key: string; title: string}
  | {type: 'book'; key: string; book: HiveBook}
  | {type: 'loading'; key: string}
  | {type: 'loadingMore'; key: string}
  | {type: 'empty'; key: string}
  | {type: 'error'; key: string; message: string}

export function BooksScreen() {
  const t = useTheme()
  const {_} = useLingui()
  const setMinimalShellMode = useSetMinimalShellMode()
  const textInput = useRef<TextInput>(null)
  const [searchText, setSearchText] = useState('')
  const [query, setQuery] = useState('')
  const {selectedGenre, setSelectedGenre} = useBookGenreFilter()

  const isSearching = query.trim().length > 0
  const isFiltering = isSearching || selectedGenre !== null

  useFocusEffect(() => {
    setMinimalShellMode(false)
  })

  const {
    data,
    isFetching,
    isFetched,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useSearchBooksQuery(
    isFiltering ? query || undefined : undefined,
    selectedGenre ?? undefined,
  )

  const debouncedSetQuery = useMemo(
    () => debounce((q: string) => setQuery(q), 500),
    [],
  )

  const onChangeText = (text: string) => {
    setSearchText(text)
    debouncedSetQuery(text)
  }

  const onClearText = () => {
    setSearchText('')
    setQuery('')
    textInput.current?.focus()
  }

  const onSubmit = () => {
    setQuery(searchText)
  }

  const searchBooks = useMemo(
    () => data?.pages.flatMap(page => page.books) ?? [],
    [data],
  )

  const items = useMemo(() => {
    const result: FeedItem[] = []

    // When not filtering, show static popular books
    if (!isFiltering) {
      result.push({
        type: 'header',
        key: 'popular-header',
        title: _(msg`Popular`),
      })
      for (const book of POPULAR_BOOKS) {
        result.push({type: 'book', key: book.id, book})
      }
      return result
    }

    // Filter/search mode
    if (!isFetched && isFetching) {
      for (let i = 0; i < 8; i++) {
        result.push({type: 'loading', key: `loading-${i}`})
      }
      return result
    }

    if (error) {
      result.push({
        type: 'error',
        key: 'error',
        message: _(msg`Couldn't load books. Tap to retry.`),
      })
      return result
    }

    if (isFetched && searchBooks.length === 0) {
      result.push({type: 'empty', key: 'empty'})
      return result
    }

    if (selectedGenre && !isSearching) {
      result.push({
        type: 'header',
        key: 'genre-header',
        title: selectedGenre,
      })
    }

    for (const book of searchBooks) {
      result.push({type: 'book', key: book.id, book})
    }

    if (isFetchingNextPage) {
      result.push({type: 'loadingMore', key: 'loadingMore'})
    }

    return result
  }, [
    isFiltering,
    isSearching,
    selectedGenre,
    isFetched,
    isFetching,
    isFetchingNextPage,
    error,
    searchBooks,
    _,
  ])

  const onEndReached = () => {
    if (!isFiltering || isFetching || !hasNextPage || error) return
    fetchNextPage()
  }

  const renderItem = ({item}: {item: FeedItem}) => {
    switch (item.type) {
      case 'header':
        return (
          <View style={[a.px_lg, a.pt_lg, a.pb_sm]}>
            <Text style={[a.text_lg, a.font_bold, t.atoms.text]}>
              {item.title}
            </Text>
          </View>
        )
      case 'book':
        return <BookCard book={item.book} />
      case 'loading':
        return <BookCardSkeleton />
      case 'loadingMore':
        return (
          <View style={[a.p_lg, a.align_center]}>
            <Loader size="xl" />
          </View>
        )
      case 'empty':
        return (
          <View style={[a.p_xl, a.align_center]}>
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              {selectedGenre && !isSearching ? (
                <Trans>No books found in this genre</Trans>
              ) : (
                <Trans>No books match your search</Trans>
              )}
            </Text>
          </View>
        )
      case 'error':
        return (
          <View style={[a.p_xl, a.align_center]}>
            <Text
              style={[a.text_md, t.atoms.text_contrast_medium]}
              onPress={() => refetch()}>
              {item.message}
            </Text>
          </View>
        )
    }
  }

  return (
    <Layout.Screen>
      <View
        style={[
          a.relative,
          a.z_10,
          web({
            position: 'sticky',
            top: 0,
          }),
        ]}>
        <Layout.Center style={t.atoms.bg}>
          <Layout.Header.Outer noBottomBorder>
            <Layout.Header.BackButton />
            <Layout.Header.Content align="left">
              <Layout.Header.TitleText>
                <Trans>Books</Trans>
              </Layout.Header.TitleText>
            </Layout.Header.Content>
            <Layout.Header.Slot />
          </Layout.Header.Outer>
          <View style={[a.px_lg, a.pt_xs, a.pb_sm]}>
            <SearchInput
              ref={textInput}
              value={searchText}
              onChangeText={onChangeText}
              onClearText={onClearText}
              onSubmitEditing={onSubmit}
              placeholder={_(msg`Search books...`)}
            />
          </View>
          {selectedGenre && (
            <View style={[a.px_lg, a.pb_sm, a.flex_row, a.align_center]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={_(msg`Clear genre filter`)}
                accessibilityHint={_(msg`Removes the genre filter`)}
                onPress={() => setSelectedGenre(null)}
                style={[
                  a.flex_row,
                  a.align_center,
                  a.gap_xs,
                  a.px_sm,
                  a.py_2xs,
                  a.rounded_full,
                  t.atoms.bg_contrast_50,
                ]}>
                <Text style={[a.text_sm, a.font_bold, t.atoms.text]}>
                  {selectedGenre}
                </Text>
                <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                  &times;
                </Text>
              </Pressable>
            </View>
          )}
        </Layout.Center>
      </View>

      <List
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.key}
        onEndReached={onEndReached}
        onEndReachedThreshold={2}
        refreshing={isFiltering && isFetching && isFetched}
        onRefresh={isFiltering ? () => refetch() : undefined}
        desktopFixedHeight
        sideBorders={IS_WEB}
      />
    </Layout.Screen>
  )
}
