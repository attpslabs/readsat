import {useMemo, useRef, useState} from 'react'
import {
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  type TextInput,
  View,
} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import debounce from 'lodash.debounce'

import {
  type BookClubEntry,
  useAddBookToClubMutation,
  useUpdateBookClubMutation,
} from '#/state/queries/bookclubs'
import {
  formatAuthors,
  type HiveBook,
  useSearchBooksQuery,
} from '#/state/queries/bookhive'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {SearchInput} from '#/components/forms/SearchInput'
import * as TextField from '#/components/forms/TextField'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'

export function EditBookClubDialog({
  control,
  club,
}: {
  control: Dialog.DialogControlProps
  club: BookClubEntry
}) {
  const {_} = useLingui()
  const cancelControl = Prompt.usePromptControl()
  const [dirty, setDirty] = useState(false)

  const onPressCancel = () => {
    if (dirty) {
      cancelControl.open()
    } else {
      control.close()
    }
  }

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{preventDismiss: dirty}}
      webOptions={{
        onBackgroundPress: () => {
          if (dirty) {
            cancelControl.open()
          } else {
            control.close()
          }
        },
      }}>
      <DialogInner
        club={club}
        control={control}
        setDirty={setDirty}
        onPressCancel={onPressCancel}
      />
      <Prompt.Basic
        control={cancelControl}
        title={_(msg`Discard changes?`)}
        description={_(msg`Are you sure you want to discard your changes?`)}
        onConfirm={() => control.close()}
        confirmButtonCta={_(msg`Discard`)}
        cancelButtonCta={_(msg`Keep editing`)}
        confirmButtonColor="negative"
      />
    </Dialog.Outer>
  )
}

function DialogInner({
  club,
  control,
  setDirty,
  onPressCancel,
}: {
  club: BookClubEntry
  control: Dialog.DialogControlProps
  setDirty: (dirty: boolean) => void
  onPressCancel: () => void
}) {
  const t = useTheme()
  const {_} = useLingui()
  const textInput = useRef<TextInput>(null)

  const [clubName, setClubName] = useState(club.record.name)
  const [selectedBook, setSelectedBook] = useState<HiveBook | null>(null)
  const [searchText, setSearchText] = useState('')
  const [query, setQuery] = useState('')
  const [isChangingBook, setIsChangingBook] = useState(false)

  const updateMutation = useUpdateBookClubMutation()
  const addBookMutation = useAddBookToClubMutation()

  const currentBook = club.currentBook?.record
  const hasBookChange = selectedBook !== null
  const hasNameChange = clubName.trim() !== club.record.name
  const canSave = clubName.trim().length > 0 && (hasNameChange || hasBookChange)

  const isSearching = query.trim().length > 0
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

  const onChangeClubName = (text: string) => {
    setClubName(text)
    setDirty(text.trim() !== club.record.name || hasBookChange)
  }

  const onChangeSearchText = (text: string) => {
    setSearchText(text)
    debouncedSetQuery(text)
  }

  const onClearSearch = () => {
    setSearchText('')
    setQuery('')
    textInput.current?.focus()
  }

  const onSubmitSearch = () => {
    setQuery(searchText)
  }

  const onSelectBook = (book: HiveBook) => {
    setSelectedBook(book)
    setIsChangingBook(false)
    setSearchText('')
    setQuery('')
    setDirty(true)
    Keyboard.dismiss()
  }

  const onStartChangeBook = () => {
    setIsChangingBook(true)
  }

  const onCancelChangeBook = () => {
    setIsChangingBook(false)
    setSearchText('')
    setQuery('')
  }

  const onSave = async () => {
    try {
      if (hasNameChange) {
        await updateMutation.mutateAsync({
          rkey: club.rkey,
          name: clubName.trim(),
        })
      }
      if (hasBookChange && selectedBook) {
        await addBookMutation.mutateAsync({
          clubUri: club.uri,
          bookTitle: selectedBook.title,
          bookAuthors: selectedBook.authors,
          bookCover: selectedBook.cover || selectedBook.thumbnail,
          bookHiveId: selectedBook.id,
        })
      }
      control.close()
    } catch {
      // errors handled by mutations
    }
  }

  const isSaving = updateMutation.isPending || addBookMutation.isPending

  return (
    <Dialog.ScrollableInner
      label={_(msg`Edit bookclub`)}
      header={
        <Dialog.Header
          renderLeft={() => (
            <Button
              label={_(msg`Cancel`)}
              size="small"
              variant="ghost"
              color="secondary"
              onPress={onPressCancel}>
              <ButtonText>
                <Trans>Cancel</Trans>
              </ButtonText>
            </Button>
          )}
          renderRight={() => (
            <Button
              label={_(msg`Save`)}
              size="small"
              color="primary"
              disabled={!canSave || isSaving}
              onPress={onSave}>
              {isSaving ? (
                <Loader size="md" />
              ) : (
                <ButtonText>
                  <Trans>Save</Trans>
                </ButtonText>
              )}
            </Button>
          )}>
          <Dialog.HeaderText>
            <Trans>Edit bookclub</Trans>
          </Dialog.HeaderText>
        </Dialog.Header>
      }>
      <View style={[a.gap_xl]}>
        {/* Club Name */}
        <View style={[a.gap_xs]}>
          <TextField.LabelText>
            <Trans>Club name</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <Dialog.Input
              defaultValue={clubName}
              onChangeText={onChangeClubName}
              label={_(msg`Club name`)}
              placeholder={_(msg`e.g. Romance Readers United`)}
              autoCapitalize="words"
            />
          </TextField.Root>
        </View>

        {/* Current Book */}
        <View style={[a.gap_xs]}>
          <TextField.LabelText>
            <Trans>Currently reading</Trans>
          </TextField.LabelText>

          {isChangingBook ? (
            <View style={[a.gap_sm]}>
              <SearchInput
                ref={textInput}
                value={searchText}
                onChangeText={onChangeSearchText}
                onClearText={onClearSearch}
                onSubmitEditing={onSubmitSearch}
                placeholder={_(msg`Search books...`)}
              />

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
                        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                          <Trans>Failed to search books</Trans>
                        </Text>
                      </View>
                    ) : searchBooks.length === 0 ? (
                      <View style={[a.p_lg, a.align_center]}>
                        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                          <Trans>No books found</Trans>
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

              <Button
                label={_(msg`Cancel`)}
                size="small"
                variant="ghost"
                color="secondary"
                onPress={onCancelChangeBook}>
                <ButtonText>
                  <Trans>Cancel</Trans>
                </ButtonText>
              </Button>
            </View>
          ) : (
            <View style={[a.gap_sm]}>
              {/* Show selected new book or current book */}
              {selectedBook ? (
                <BookPreview
                  title={selectedBook.title}
                  authors={selectedBook.authors}
                  cover={selectedBook.cover || selectedBook.thumbnail}
                />
              ) : currentBook ? (
                <BookPreview
                  title={currentBook.bookTitle}
                  authors={currentBook.bookAuthors}
                  cover={currentBook.bookCover}
                />
              ) : (
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  <Trans>No book selected</Trans>
                </Text>
              )}

              <Button
                label={_(msg`Change book`)}
                size="small"
                color="secondary"
                onPress={onStartChangeBook}>
                <ButtonText>
                  <Trans>Change book</Trans>
                </ButtonText>
              </Button>
            </View>
          )}
        </View>

        {(updateMutation.isError || addBookMutation.isError) && (
          <Text style={[a.text_sm, {color: t.palette.negative_400}]}>
            <Trans>Failed to save changes. Please try again.</Trans>
          </Text>
        )}
      </View>
    </Dialog.ScrollableInner>
  )
}

function BookPreview({
  title,
  authors,
  cover,
}: {
  title: string
  authors?: string
  cover?: string
}) {
  const t = useTheme()

  return (
    <View
      style={[
        a.flex_row,
        a.gap_md,
        a.p_md,
        a.rounded_md,
        t.atoms.bg_contrast_25,
      ]}>
      {cover ? (
        <Image
          source={{uri: cover}}
          style={{width: 60, height: 90}}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[
            {width: 60, height: 90, backgroundColor: t.palette.contrast_100},
            a.align_center,
            a.justify_center,
          ]}>
          <Text style={{fontSize: 24}}>📖</Text>
        </View>
      )}
      <View style={[a.flex_1, a.justify_center, a.gap_xs]}>
        <Text style={[a.text_md, a.font_bold, t.atoms.text]} numberOfLines={2}>
          {title}
        </Text>
        {authors && (
          <Text
            style={[a.text_sm, t.atoms.text_contrast_medium]}
            numberOfLines={1}>
            {formatAuthors(authors)}
          </Text>
        )}
      </View>
    </View>
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
