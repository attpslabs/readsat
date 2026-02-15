import {Image, Pressable, View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {
  formatAuthors,
  formatRating,
  type HiveBook,
} from '#/state/queries/bookhive'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

export function BookCard({book}: {book: HiveBook}) {
  const t = useTheme()
  const {_} = useLingui()
  const navigation = useNavigation<NavigationProp>()

  const onPress = () => {
    navigation.navigate('BookDetail', {hiveId: book.id})
  }

  const authors = formatAuthors(book.authors)
  const rating = formatRating(book.rating)
  const ratingsCount = book.ratingsCount?.toLocaleString() ?? '0'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={_(msg`${book.title} by ${authors}`)}
      accessibilityHint={_(msg`Opens book details`)}
      onPress={onPress}
      style={({pressed}) => [
        a.flex_row,
        a.gap_md,
        a.p_lg,
        a.border_b,
        t.atoms.border_contrast_low,
        t.atoms.bg,
        pressed && {opacity: 0.7},
      ]}>
      {book.cover || book.thumbnail ? (
        <Image
          source={{uri: book.cover || book.thumbnail}}
          style={[
            {width: 80, height: 120},
            a.rounded_sm,
            {backgroundColor: t.palette.contrast_50},
          ]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[
            {width: 80, height: 120},
            a.rounded_sm,
            {backgroundColor: t.palette.contrast_100},
            a.align_center,
            a.justify_center,
          ]}>
          <Text style={[{fontSize: 32}]}>📖</Text>
        </View>
      )}

      <View style={[a.flex_1, a.justify_center, a.gap_xs]}>
        <Text style={[a.text_md, a.font_bold, t.atoms.text]} numberOfLines={2}>
          {book.title}
        </Text>
        <Text
          style={[a.text_sm, t.atoms.text_contrast_medium]}
          numberOfLines={1}>
          {authors}
        </Text>
        {book.rating != null && (
          <View style={[a.flex_row, a.align_center, a.gap_xs]}>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              ⭐ {rating}
            </Text>
            <Text style={[a.text_xs, t.atoms.text_contrast_low]}>
              ({ratingsCount})
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  )
}

export function BookCardSkeleton() {
  const t = useTheme()

  return (
    <View
      style={[
        a.flex_row,
        a.gap_md,
        a.p_lg,
        a.border_b,
        t.atoms.border_contrast_low,
      ]}>
      <View
        style={[
          {width: 80, height: 120},
          a.rounded_sm,
          {backgroundColor: t.palette.contrast_50},
        ]}
      />
      <View style={[a.flex_1, a.justify_center, a.gap_sm]}>
        <View
          style={[
            {width: '70%', height: 14},
            a.rounded_xs,
            {backgroundColor: t.palette.contrast_50},
          ]}
        />
        <View
          style={[
            {width: '50%', height: 12},
            a.rounded_xs,
            {backgroundColor: t.palette.contrast_50},
          ]}
        />
        <View
          style={[
            {width: '30%', height: 12},
            a.rounded_xs,
            {backgroundColor: t.palette.contrast_50},
          ]}
        />
      </View>
    </View>
  )
}
