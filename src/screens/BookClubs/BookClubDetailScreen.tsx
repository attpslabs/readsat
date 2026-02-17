import {Image, View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useFocusEffect} from '@react-navigation/native'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {
  useBookClubQuery,
  useCancelJoinRequestMutation,
  useJoinBookClubMutation,
  useMyJoinRequestQuery,
} from '#/state/queries/bookclubs'
import {useProfileQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {useSetMinimalShellMode} from '#/state/shell'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {EmojiArc_Stroke2_Corner0_Rounded as EmojiSmile} from '#/components/icons/Emoji'
import {PaperPlane_Stroke2_Corner0_Rounded as PaperPlane} from '#/components/icons/PaperPlane'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'BookClubDetail'>

export function BookClubDetailScreen({route}: Props) {
  const {rkey} = route.params
  const t = useTheme()
  const {_} = useLingui()
  const setMinimalShellMode = useSetMinimalShellMode()
  const {hasSession, currentAccount} = useSession()

  useFocusEffect(() => {
    setMinimalShellMode(false)
  })

  const {data: club, isLoading, error, refetch} = useBookClubQuery(rkey)
  const isAdmin = currentAccount?.did === club?.record.admin

  const {data: adminProfile} = useProfileQuery({
    did: club?.record.admin ?? '',
  })

  const {data: myRequest, isLoading: isLoadingRequest} = useMyJoinRequestQuery(
    club?.uri ?? '',
  )
  const joinMutation = useJoinBookClubMutation()
  const cancelMutation = useCancelJoinRequestMutation()

  const hasPendingRequest = myRequest !== null && myRequest !== undefined
  const isActionPending =
    joinMutation.isPending || cancelMutation.isPending || isLoadingRequest

  const onRequestToJoin = async () => {
    if (!club) return
    try {
      await joinMutation.mutateAsync({clubUri: club.uri})
    } catch {
      // handled by mutation
    }
  }

  const onCancelRequest = async () => {
    if (!myRequest || !club) return
    try {
      await cancelMutation.mutateAsync({
        clubUri: club.uri,
        rkey: myRequest.rkey,
      })
    } catch {
      // handled by mutation
    }
  }

  const book = club?.currentBook?.record

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content align="left">
          <Layout.Header.TitleText>
            {club?.record.name ?? ''}
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>

      <View style={[a.flex_1]}>
        <Layout.Content contentContainerStyle={[a.flex_1]}>
          <Layout.Center style={[a.flex_1]}>
            {isLoading ? (
              <View style={[a.p_xl, a.align_center]}>
                <Loader size="xl" />
              </View>
            ) : error ? (
              <View style={[a.p_xl, a.align_center, a.gap_md]}>
                <Text
                  style={[a.text_md, t.atoms.text_contrast_medium]}
                  onPress={() => refetch()}>
                  <Trans>Couldn't load bookclub. Tap to retry.</Trans>
                </Text>
              </View>
            ) : club ? (
              <View style={[a.flex_1]}>
                {/* Club header with book info */}
                <View style={[a.flex_row, a.gap_lg, a.p_lg]}>
                  {/* Book cover */}
                  {book?.bookCover ? (
                    <Image
                      source={{uri: book.bookCover}}
                      style={[
                        {width: 84, height: 126},
                        a.rounded_sm,
                        {backgroundColor: t.palette.contrast_50},
                      ]}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View
                      style={[
                        {width: 84, height: 126},
                        a.rounded_sm,
                        {backgroundColor: t.palette.contrast_100},
                        a.align_center,
                        a.justify_center,
                      ]}>
                      <Text style={{fontSize: 34}}>📖</Text>
                    </View>
                  )}

                  {/* Club + book details */}
                  <View style={[a.flex_1, a.gap_sm]}>
                    <Text
                      style={[
                        a.text_xs,
                        a.font_bold,
                        t.atoms.text_contrast_medium,
                        {textTransform: 'uppercase', letterSpacing: 0.5},
                      ]}>
                      <Trans>Currently reading</Trans>
                    </Text>
                    {book && (
                      <>
                        <Text style={[a.text_lg, a.font_bold, t.atoms.text]}>
                          {book.bookTitle}
                        </Text>
                        {book.bookAuthors && (
                          <Text
                            style={[a.text_sm, t.atoms.text_contrast_medium]}>
                            {book.bookAuthors.split('\t').join(', ')}
                          </Text>
                        )}
                      </>
                    )}

                    {/* Admin info */}
                    <View
                      style={[a.flex_row, a.align_center, a.gap_sm, a.mt_xs]}>
                      {adminProfile ? (
                        <PreviewableUserAvatar
                          size={24}
                          avatar={adminProfile.avatar}
                          profile={adminProfile}
                        />
                      ) : (
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: t.palette.contrast_100,
                          }}
                        />
                      )}
                      <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                        {adminProfile?.displayName || club.record.admin}
                      </Text>
                    </View>

                    {/* Join / Cancel button */}
                    {hasSession && !isAdmin && (
                      <View style={[a.mt_sm]}>
                        {hasPendingRequest ? (
                          <Button
                            label={_(msg`Cancel request`)}
                            size="small"
                            color="secondary"
                            disabled={isActionPending}
                            onPress={onCancelRequest}>
                            {cancelMutation.isPending ? (
                              <Loader size="md" />
                            ) : (
                              <ButtonText>
                                <Trans>Remove request</Trans>
                              </ButtonText>
                            )}
                          </Button>
                        ) : (
                          <Button
                            label={_(msg`Request to join`)}
                            size="small"
                            color="primary"
                            disabled={isActionPending}
                            onPress={onRequestToJoin}>
                            {joinMutation.isPending ? (
                              <Loader size="md" />
                            ) : (
                              <ButtonText>
                                <Trans>Request to join</Trans>
                              </ButtonText>
                            )}
                          </Button>
                        )}
                      </View>
                    )}

                    {isAdmin && (
                      <Text
                        style={[
                          a.text_xs,
                          t.atoms.text_contrast_medium,
                          a.mt_sm,
                        ]}>
                        <Trans>You created this club</Trans>
                      </Text>
                    )}
                  </View>
                </View>

                {/* Chat area */}
                <View style={[a.flex_1, a.align_center, a.justify_center]}>
                  <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                    <Trans>Chat coming soon</Trans>
                  </Text>
                </View>
              </View>
            ) : null}
          </Layout.Center>
        </Layout.Content>

        {/* Disabled chat input - pinned to bottom */}
        {club && (
          <Layout.Center>
            <View style={[a.p_sm, {opacity: 0.5}]}>
              <View
                style={[
                  a.flex_row,
                  a.align_center,
                  t.atoms.bg_contrast_25,
                  {
                    paddingRight: a.p_sm.padding - 2,
                    paddingLeft: a.p_sm.padding - 2,
                    borderWidth: 1,
                    borderRadius: 23,
                    borderColor: 'transparent',
                    height: 46,
                  },
                ]}>
                <View
                  style={[
                    a.rounded_full,
                    a.align_center,
                    a.justify_center,
                    {height: 30, width: 30},
                  ]}>
                  <EmojiSmile
                    size="lg"
                    style={[t.atoms.text_contrast_medium]}
                  />
                </View>
                <View style={[a.flex_1, a.px_sm]}>
                  <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                    {_(msg`Write a message`)}
                  </Text>
                </View>
                <View
                  style={[
                    a.rounded_full,
                    a.align_center,
                    a.justify_center,
                    {
                      height: 30,
                      width: 30,
                      backgroundColor: t.palette.primary_500,
                      opacity: 0.5,
                    },
                  ]}>
                  <PaperPlane
                    fill={t.palette.white}
                    style={[a.relative, {left: 1}]}
                  />
                </View>
              </View>
            </View>
          </Layout.Center>
        )}
      </View>
    </Layout.Screen>
  )
}
