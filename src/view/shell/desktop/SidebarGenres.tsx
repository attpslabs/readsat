import {Pressable, View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {useBookGenreFilter} from '#/state/preferences/book-genre-filter'
import {useGenresQuery} from '#/state/queries/bookhive'
import {atoms as a, useTheme} from '#/alf'
import {Hashtag_Stroke2_Corner0_Rounded as HashtagIcon} from '#/components/icons/Hashtag'
import {Text} from '#/components/Typography'

const GENRE_LIMIT = 20

export function SidebarGenres() {
  const t = useTheme()
  const {_} = useLingui()
  const {data: genres, isLoading, error} = useGenresQuery()
  const {selectedGenre, setSelectedGenre} = useBookGenreFilter()

  // Only hide if the API returned an empty list. Keep showing skeletons
  // while the query retries on API failure so the sidebar doesn't vanish.
  if (!isLoading && !error && genres?.length === 0) return null

  return (
    <View style={[a.p_lg, a.rounded_md, a.border, t.atoms.border_contrast_low]}>
      <View style={[a.flex_row, a.align_center, a.gap_xs, a.pb_md]}>
        <HashtagIcon width={16} height={16} fill={t.atoms.text.color} />
        <Text style={[a.flex_1, a.text_md, a.font_semi_bold, t.atoms.text]}>
          <Trans>Genres</Trans>
        </Text>
        {selectedGenre && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={_(msg`Clear genre filter`)}
            accessibilityHint={_(msg`Removes the genre filter`)}
            onPress={() => setSelectedGenre(null)}>
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              <Trans>Clear</Trans>
            </Text>
          </Pressable>
        )}
      </View>

      <View style={[a.gap_xs]}>
        {isLoading || (error && !genres)
          ? Array(8)
              .fill(0)
              .map((_n, i) => (
                <View key={i} style={[a.flex_row, a.align_center, a.gap_sm]}>
                  <View
                    style={[
                      a.rounded_xs,
                      t.atoms.bg_contrast_50,
                      {height: 14, width: i % 2 === 0 ? 80 : 100},
                    ]}
                  />
                </View>
              ))
          : !genres
            ? null
            : genres.slice(0, GENRE_LIMIT).map(item => {
                const isSelected = selectedGenre === item.genre
                return (
                  <Pressable
                    key={item.genre}
                    accessibilityRole="button"
                    accessibilityLabel={_(msg`Filter by ${item.genre}`)}
                    accessibilityHint={_(msg`Shows books in this genre`)}
                    accessibilityState={{selected: isSelected}}
                    onPress={() =>
                      setSelectedGenre(isSelected ? null : item.genre)
                    }
                    style={[a.flex_row, a.align_center, a.gap_xs, a.py_2xs]}>
                    <Text
                      style={[
                        a.text_sm,
                        a.leading_snug,
                        isSelected
                          ? [t.atoms.text, a.font_bold]
                          : t.atoms.text_contrast_medium,
                      ]}
                      numberOfLines={1}>
                      {item.genre}
                    </Text>
                    <Text
                      style={[
                        a.text_xs,
                        a.leading_snug,
                        t.atoms.text_contrast_low,
                      ]}>
                      ({item.count})
                    </Text>
                  </Pressable>
                )
              })}
      </View>
    </View>
  )
}
