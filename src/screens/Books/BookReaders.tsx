import {View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {type BookActivity, groupBookActivity} from '#/state/queries/bookhive'
import {useProfilesQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

export function BookReaders({
  activity,
  limit = 5,
}: {
  activity: BookActivity[]
  limit?: number
}) {
  const t = useTheme()
  const {_} = useLingui()
  const {hasSession} = useSession()

  const {reading, read} = groupBookActivity(activity)

  const limitedReading = limit > 0 ? reading.slice(0, limit) : reading
  const limitedRead = limit > 0 ? read.slice(0, limit) : read
  const extraReading = reading.length - limitedReading.length
  const extraRead = read.length - limitedRead.length

  const allHandles = [
    ...limitedReading.map(a => a.userHandle),
    ...limitedRead.map(a => a.userHandle),
  ]

  const {data: profilesData} = useProfilesQuery({
    handles: hasSession ? allHandles : [],
  })

  const profileMap = new Map(
    profilesData?.profiles?.map(p => [p.handle, p]) ?? [],
  )

  if (limitedReading.length === 0 && limitedRead.length === 0) {
    return null
  }

  return (
    <View style={[a.flex_row, a.gap_lg, a.pt_sm]}>
      {limitedReading.length > 0 && (
        <View style={[a.gap_2xs, {width: 120}]}>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {_(msg`Reading`)}
          </Text>
          <View style={[a.flex_row, a.align_center]}>
            {limitedReading.map((entry, i) => {
              const profile = profileMap.get(entry.userHandle)
              return (
                <View
                  key={entry.userDid}
                  style={[i > 0 && {marginLeft: -8}, {zIndex: 100 - i}]}>
                  {profile ? (
                    <PreviewableUserAvatar
                      size={24}
                      avatar={profile.avatar}
                      profile={profile}
                    />
                  ) : (
                    <View
                      style={[
                        {
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: t.palette.contrast_100,
                        },
                      ]}
                    />
                  )}
                </View>
              )
            })}
            {extraReading > 0 && (
              <Text
                style={[
                  a.text_xs,
                  t.atoms.text_contrast_medium,
                  {marginLeft: 4},
                ]}>
                +{extraReading}
              </Text>
            )}
          </View>
        </View>
      )}

      {limitedRead.length > 0 && (
        <View style={[a.gap_2xs]}>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {_(msg`Read`)}
          </Text>
          <View style={[a.flex_row, a.align_center]}>
            {limitedRead.map((entry, i) => {
              const profile = profileMap.get(entry.userHandle)
              return (
                <View
                  key={entry.userDid}
                  style={[i > 0 && {marginLeft: -8}, {zIndex: 100 - i}]}>
                  {profile ? (
                    <PreviewableUserAvatar
                      size={24}
                      avatar={profile.avatar}
                      profile={profile}
                    />
                  ) : (
                    <View
                      style={[
                        {
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: t.palette.contrast_100,
                        },
                      ]}
                    />
                  )}
                </View>
              )
            })}
            {extraRead > 0 && (
              <Text
                style={[
                  a.text_xs,
                  t.atoms.text_contrast_medium,
                  {marginLeft: 4},
                ]}>
                +{extraRead}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
