import {Image, View} from 'react-native'
import {Trans} from '@lingui/macro'
import {useFocusEffect} from '@react-navigation/native'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {
  formatAuthors,
  formatRating,
  parseBookMeta,
  parseBookSeries,
  useBookDetailQuery,
} from '#/state/queries/bookhive'
import {useSetMinimalShellMode} from '#/state/shell'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {H1, Text} from '#/components/Typography'
import {BookReaders} from './BookReaders'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'BookDetail'>

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function BookDetailScreen({route}: Props) {
  const {hiveId} = route.params
  const t = useTheme()
  const setMinimalShellMode = useSetMinimalShellMode()

  useFocusEffect(() => {
    setMinimalShellMode(false)
  })

  const {data, isFetching, error, refetch} = useBookDetailQuery(hiveId)

  const book = data?.book
  const activity = data?.activity ?? []
  const meta = parseBookMeta(book?.meta)
  const series = parseBookSeries(book?.series)
  const authors = book ? formatAuthors(book.authors) : ''
  const rating = formatRating(book?.rating)
  const ratingsCount = book?.ratingsCount?.toLocaleString() ?? '0'

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content align="left">
          <Layout.Header.TitleText>{book?.title ?? ''}</Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>

      <Layout.Content>
        <Layout.Center>
          {isFetching && !book ? (
            <View style={[a.p_xl, a.align_center]}>
              <Loader size="xl" />
            </View>
          ) : error ? (
            <View style={[a.p_xl, a.align_center]}>
              <Text
                style={[a.text_md, t.atoms.text_contrast_medium]}
                onPress={() => refetch()}>
                <Trans>Couldn't load book details. Tap to retry.</Trans>
              </Text>
            </View>
          ) : book ? (
            <View style={[a.p_lg, a.gap_lg]}>
              {/* Cover */}
              <View style={[a.align_center]}>
                {(book.cover || book.thumbnail) && (
                  <Image
                    source={{uri: book.cover || book.thumbnail}}
                    style={[
                      {width: 200, height: 300},
                      {backgroundColor: t.palette.contrast_50},
                    ]}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                )}
              </View>

              {/* Title & Authors */}
              <View style={[a.gap_xs]}>
                <H1 style={[a.text_xl, a.font_bold, t.atoms.text]}>
                  {book.title}
                </H1>
                <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                  {authors}
                </Text>
              </View>

              {/* Rating */}
              {book.rating != null && (
                <View style={[a.flex_row, a.align_center, a.gap_sm]}>
                  <Text style={[a.text_lg, t.atoms.text]}>⭐ {rating}</Text>
                  <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                    ({ratingsCount} ratings)
                  </Text>
                </View>
              )}

              {/* Community */}
              {activity.length > 0 && (
                <View style={[a.gap_xs]}>
                  <Text style={[a.text_md, a.font_bold, t.atoms.text]}>
                    <Trans>Community</Trans>
                  </Text>
                  <BookReaders activity={activity} limit={0} />
                </View>
              )}

              {/* Series */}
              {series && (
                <View
                  style={[
                    a.px_md,
                    a.py_sm,
                    a.rounded_sm,
                    {backgroundColor: t.palette.contrast_25},
                  ]}>
                  <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                    <Trans>
                      Series: {series.name}
                      {series.position ? ` #${series.position}` : ''}
                    </Trans>
                  </Text>
                </View>
              )}

              {/* Description */}
              {book.description && (
                <View style={[a.gap_xs]}>
                  <Text style={[a.text_md, a.font_bold, t.atoms.text]}>
                    <Trans>Description</Trans>
                  </Text>
                  <Text style={[a.text_sm, t.atoms.text, {lineHeight: 22}]}>
                    {stripHtml(book.description)}
                  </Text>
                </View>
              )}

              {/* Metadata */}
              {(meta.publisher ||
                meta.publicationYear ||
                meta.numPages ||
                meta.isbn13 ||
                meta.isbn) && (
                <View style={[a.gap_xs]}>
                  <Text style={[a.text_md, a.font_bold, t.atoms.text]}>
                    <Trans>Details</Trans>
                  </Text>
                  <View style={[a.gap_xs]}>
                    {meta.publisher && (
                      <MetadataRow label="Publisher" value={meta.publisher} />
                    )}
                    {meta.publicationYear && (
                      <MetadataRow label="Year" value={meta.publicationYear} />
                    )}
                    {meta.numPages && (
                      <MetadataRow label="Pages" value={meta.numPages} />
                    )}
                    {(meta.isbn13 || meta.isbn) && (
                      <MetadataRow
                        label="ISBN"
                        value={meta.isbn13 || meta.isbn || ''}
                      />
                    )}
                  </View>
                </View>
              )}
            </View>
          ) : null}
        </Layout.Center>
      </Layout.Content>
    </Layout.Screen>
  )
}

function MetadataRow({label, value}: {label: string; value: string}) {
  const t = useTheme()
  return (
    <View style={[a.flex_row, a.gap_sm]}>
      <Text style={[a.text_sm, a.font_bold, t.atoms.text_contrast_medium]}>
        {label}:
      </Text>
      <Text style={[a.text_sm, t.atoms.text]}>{value}</Text>
    </View>
  )
}
