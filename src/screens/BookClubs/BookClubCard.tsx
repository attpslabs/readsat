import {Image, Pressable, View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {type BookClubEntry} from '#/state/queries/bookclubs'
import {useProfileQuery} from '#/state/queries/profile'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

export function BookClubCard({club}: {club: BookClubEntry}) {
  const t = useTheme()
  const {_} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {record, currentBook} = club
  const book = currentBook?.record

  const {data: adminProfile} = useProfileQuery({did: record.admin})

  const onPress = () => {
    navigation.navigate('BookClubDetail', {rkey: club.rkey})
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={_(msg`Open ${record.name}`)}
      accessibilityHint=""
      onPress={onPress}
      style={[
        a.flex_row,
        a.gap_lg,
        a.p_lg,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
        t.atoms.bg,
      ]}>
      {/* Left: Book Cover + info */}
      <View style={[a.gap_2xs]}>
        <Text
          style={[
            a.text_xs,
            a.font_bold,
            t.atoms.text_contrast_medium,
            {textTransform: 'uppercase', letterSpacing: 0.5},
          ]}>
          <Trans>Currently reading</Trans>
        </Text>
        {book?.bookCover ? (
          <Image
            source={{uri: book.bookCover}}
            style={[
              {width: 100, height: 150},
              a.rounded_sm,
              {backgroundColor: t.palette.contrast_50},
            ]}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View
            style={[
              {width: 100, height: 150},
              a.rounded_sm,
              {backgroundColor: t.palette.contrast_100},
              a.align_center,
              a.justify_center,
            ]}>
            <Text style={{fontSize: 36}}>📖</Text>
          </View>
        )}
        {book && (
          <View style={[a.gap_2xs, {width: 100}]}>
            <Text
              style={[a.text_xs, a.font_bold, t.atoms.text]}
              numberOfLines={2}>
              {book.bookTitle}
            </Text>
            {book.bookAuthors && (
              <Text
                style={[a.text_xs, t.atoms.text_contrast_medium]}
                numberOfLines={1}>
                {book.bookAuthors.split('\t').join(', ')}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Right: Club info */}
      <View style={[a.flex_1, a.justify_between]}>
        <View style={[a.gap_xs]}>
          {/* Club Name */}
          <Text
            style={[a.text_lg, a.font_bold, t.atoms.text]}
            numberOfLines={2}>
            {record.name}
          </Text>

          {/* Members */}
          <View style={[a.gap_2xs, a.mt_xs]}>
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              {_(msg`1 member`)}
            </Text>
            <View style={[a.flex_row, a.align_center]}>
              {adminProfile ? (
                <PreviewableUserAvatar
                  size={28}
                  avatar={adminProfile.avatar}
                  profile={adminProfile}
                />
              ) : (
                <View
                  style={[
                    {
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: t.palette.contrast_100,
                    },
                  ]}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  )
}
