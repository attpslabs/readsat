import {useMemo, useRef, useState} from 'react'
import {
  Image,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  type TextInput,
  View,
} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useFocusEffect, useNavigation} from '@react-navigation/native'
import debounce from 'lodash.debounce'

import {type NavigationProp} from '#/lib/routes/types'
import {
  useAddBookToClubMutation,
  useCreateBookClubMutation,
} from '#/state/queries/bookclubs'
import {
  formatAuthors,
  type HiveBook,
  useSearchBooksQuery,
} from '#/state/queries/bookhive'
import {useSetMinimalShellMode} from '#/state/shell'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {SearchInput} from '#/components/forms/SearchInput'
import * as TextField from '#/components/forms/TextField'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

export function CreateBookClubScreen() {
  const t = useTheme()
  const {_} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const setMinimalShellMode = useSetMinimalShellMode()

  const [clubName, setClubName] = useState('')
  const [selectedBook, setSelectedBook] = useState<HiveBook | null>(null)
  const [searchText, setSearchText] = useState('')
  const [query, setQuery] = useState('')
  const textInput = useRef<TextInput>(null)

  const createMutation = useCreateBookClubMutation()
  const addBookMutation = useAddBookToClubMutation()

  const isSearching = query.trim().length > 0

  useFocusEffect(() => {
    setMinimalShellMode(false)
  })

  const {data, isFetching, isFetched, error} = useSearchBooksQuery(
    isSearching ? query : undefined,
  )

  const searchBooks = useMemo(
    () => data?.pages.flatMap(page => page.books) ?? [],
    [data],
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

  const onSelectBook = (book: HiveBook) => {
    setSelectedBook(book)
    setSearchText('')
    setQuery('')
    Keyboard.dismiss()
  }

  const onDeselectBook = () => {
    setSelectedBook(null)
  }

  const canCreate = clubName.trim().length > 0 && selectedBook !== null

  const onCreateClub = async () => {
    if (!canCreate || !selectedBook) return

    try {
      // 1. Create the club record (name + admin only)
      const club = await createMutation.mutateAsync({
        name: clubName.trim(),
      })

      // 2. Add the first book as a separate record
      await addBookMutation.mutateAsync({
        clubUri: club.uri,
        bookTitle: selectedBook.title,
        bookAuthors: selectedBook.authors,
        bookCover: selectedBook.cover || selectedBook.thumbnail,
        bookHiveId: selectedBook.id,
      })

      navigation.navigate('BookClubs')
    } catch {
      // error handled by mutation
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
          <Layout.Header.Outer>
            <Layout.Header.BackButton />
            <Layout.Header.Content align="left">
              <Layout.Header.TitleText>
                <Trans>Start a Bookclub</Trans>
              </Layout.Header.TitleText>
            </Layout.Header.Content>
            <Layout.Header.Slot />
          </Layout.Header.Outer>
        </Layout.Center>
      </View>

      <Layout.Center>
        <ScrollView
          contentContainerStyle={[a.p_lg, a.gap_lg]}
          keyboardShouldPersistTaps="handled">
          {/* Club Name */}
          <View style={[a.gap_xs]}>
            <TextField.LabelText>
              <Trans>Club name</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Input
                label={_(msg`Club name`)}
                placeholder={_(msg`e.g. Romance Readers United`)}
                defaultValue={clubName}
                onChangeText={setClubName}
                autoCapitalize="words"
              />
            </TextField.Root>
          </View>

          {/* Book Selection */}
          <View style={[a.gap_xs]}>
            <TextField.LabelText>
              <Trans>Select the first book to discuss</Trans>
            </TextField.LabelText>

            {selectedBook ? (
              <View
                style={[
                  a.flex_row,
                  a.gap_md,
                  a.p_md,
                  a.rounded_md,
                  t.atoms.bg_contrast_25,
                ]}>
                {(selectedBook.cover || selectedBook.thumbnail) && (
                  <Image
                    source={{uri: selectedBook.cover || selectedBook.thumbnail}}
                    style={{width: 60, height: 90}}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                )}
                <View style={[a.flex_1, a.justify_center, a.gap_xs]}>
                  <Text
                    style={[a.text_md, a.font_bold, t.atoms.text]}
                    numberOfLines={2}>
                    {selectedBook.title}
                  </Text>
                  <Text
                    style={[a.text_sm, t.atoms.text_contrast_medium]}
                    numberOfLines={1}>
                    {formatAuthors(selectedBook.authors)}
                  </Text>
                </View>
                <Button
                  label={_(msg`Remove book`)}
                  size="small"
                  variant="ghost"
                  color="negative"
                  onPress={onDeselectBook}>
                  <ButtonText>
                    <Trans>Remove</Trans>
                  </ButtonText>
                </Button>
              </View>
            ) : (
              <>
                <SearchInput
                  ref={textInput}
                  value={searchText}
                  onChangeText={onChangeText}
                  onClearText={onClearText}
                  onSubmitEditing={onSubmit}
                  placeholder={_(msg`Search books...`)}
                />

                {/* Search Results */}
                {isSearching && (
                  <View
                    style={[
                      a.rounded_md,
                      a.overflow_hidden,
                      a.border,
                      t.atoms.border_contrast_low,
                      {maxHeight: 300},
                    ]}>
                    <ScrollView nestedScrollEnabled>
                      {!isFetched && isFetching ? (
                        <View style={[a.p_lg, a.align_center]}>
                          <Loader size="lg" />
                        </View>
                      ) : error ? (
                        <View style={[a.p_lg, a.align_center]}>
                          <Text
                            style={[a.text_sm, t.atoms.text_contrast_medium]}>
                            <Trans>Failed to search books</Trans>
                          </Text>
                        </View>
                      ) : searchBooks.length === 0 ? (
                        <View style={[a.p_lg, a.align_center, a.gap_sm]}>
                          <Text
                            style={[a.text_sm, t.atoms.text_contrast_medium]}>
                            <Trans>No books found</Trans>
                          </Text>
                          <Text
                            style={[a.text_sm, {color: t.palette.primary_500}]}
                            onPress={() =>
                              Linking.openURL('https://bookhive.buzz/import')
                            }>
                            <Trans>
                              Import your Goodreads/StoryGraph library
                            </Trans>
                          </Text>
                        </View>
                      ) : (
                        searchBooks.map(book => (
                          <BookSearchResult
                            key={book.id}
                            book={book}
                            onSelect={onSelectBook}
                          />
                        ))
                      )}
                    </ScrollView>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Create Button */}
          <Button
            label={_(msg`Create bookclub`)}
            size="large"
            color="primary"
            disabled={
              !canCreate ||
              createMutation.isPending ||
              addBookMutation.isPending
            }
            onPress={onCreateClub}>
            {createMutation.isPending || addBookMutation.isPending ? (
              <Loader size="md" />
            ) : (
              <ButtonText>
                <Trans>Create Bookclub</Trans>
              </ButtonText>
            )}
          </Button>

          {(createMutation.isError || addBookMutation.isError) && (
            <Text style={[a.text_sm, {color: t.palette.negative_400}]}>
              <Trans>Failed to create bookclub. Please try again.</Trans>
            </Text>
          )}
        </ScrollView>
      </Layout.Center>
    </Layout.Screen>
  )
}

function BookSearchResult({
  book,
  onSelect,
}: {
  book: HiveBook
  onSelect: (book: HiveBook) => void
}) {
  const t = useTheme()
  const {_} = useLingui()
  const authors = formatAuthors(book.authors)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={_(msg`Select ${book.title}`)}
      accessibilityHint=""
      onPress={() => onSelect(book)}
      style={({pressed}) => [
        a.flex_row,
        a.gap_sm,
        a.p_sm,
        a.border_b,
        t.atoms.border_contrast_low,
        t.atoms.bg,
        pressed && {opacity: 0.7},
      ]}>
      {book.cover || book.thumbnail ? (
        <Image
          source={{uri: book.cover || book.thumbnail}}
          style={{width: 40, height: 60}}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[
            {width: 40, height: 60, backgroundColor: t.palette.contrast_100},
            a.align_center,
            a.justify_center,
          ]}>
          <Text style={{fontSize: 20}}>📖</Text>
        </View>
      )}
      <View style={[a.flex_1, a.justify_center, a.gap_2xs]}>
        <Text style={[a.text_sm, a.font_bold, t.atoms.text]} numberOfLines={1}>
          {book.title}
        </Text>
        <Text
          style={[a.text_xs, t.atoms.text_contrast_medium]}
          numberOfLines={1}>
          {authors}
        </Text>
      </View>
    </Pressable>
  )
}
