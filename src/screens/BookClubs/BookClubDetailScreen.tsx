import {Image, View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useFocusEffect, useNavigation} from '@react-navigation/native'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
  type NavigationProp,
} from '#/lib/routes/types'
import {useBookClubChat} from '#/state/freeq'
import {useBookClubQuery, useMyMembershipQuery} from '#/state/queries/bookclubs'
import {useProfileQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {useSetMinimalShellMode} from '#/state/shell'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {BookClubChat} from './BookClubChat'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'BookClubDetail'>

export function BookClubDetailScreen({route}: Props) {
  const {rkey} = route.params
  const t = useTheme()
  const {_} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const setMinimalShellMode = useSetMinimalShellMode()
  const {currentAccount} = useSession()

  useFocusEffect(() => {
    setMinimalShellMode(false)
  })

  const {data: club, isLoading, error, refetch} = useBookClubQuery(rkey)
  const isAdmin = currentAccount?.did === club?.record.admin
  const {data: isMember, isLoading: isMembershipLoading} = useMyMembershipQuery(
    club?.uri ?? '',
  )
  const hasAccess = isAdmin || isMember === true

  const {data: adminProfile} = useProfileQuery({
    did: club?.record.admin ?? '',
  })

  const book = club?.currentBook?.record

  // Validate rkey to prevent IRC command injection via channel name
  const safeRkey = rkey.replace(/[^a-zA-Z0-9_-]/g, '')
  const channelName = `#bookclub-${safeRkey}`
  const {
    status: chatStatus,
    messages,
    members,
    error: chatError,
    isOp,
    sendMessage,
    loadMoreHistory,
    kickUser,
    grantOp,
    revokeOp,
  } = useBookClubChat(channelName, hasAccess, isAdmin)

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
        {isLoading || isMembershipLoading ? (
          <View style={[a.flex_1, a.align_center, a.justify_center]}>
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
        ) : club && !hasAccess ? (
          <View
            style={[
              a.flex_1,
              a.align_center,
              a.justify_center,
              a.gap_md,
              a.p_xl,
            ]}>
            <Text style={[a.text_lg, a.font_bold, t.atoms.text]}>
              <Trans>Members only</Trans>
            </Text>
            <Text
              style={[a.text_md, t.atoms.text_contrast_medium, a.text_center]}>
              <Trans>
                You need to be a member of this bookclub to view it.
              </Trans>
            </Text>
            <Button
              label={_(msg`Go back`)}
              size="large"
              color="primary"
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack()
                } else {
                  navigation.navigate('BookClubs')
                }
              }}>
              <ButtonText>
                <Trans>Go back</Trans>
              </ButtonText>
            </Button>
          </View>
        ) : club ? (
          <View style={[a.flex_1]}>
            {/* Club header with book info */}
            <View
              style={[
                a.flex_row,
                a.gap_lg,
                a.p_lg,
                t.atoms.border_contrast_low,
                {borderBottomWidth: 1},
              ]}>
              {/* Book cover */}
              {book?.bookCover ? (
                <Image
                  source={{uri: book.bookCover}}
                  style={[
                    {width: 60, height: 90},
                    a.rounded_sm,
                    {backgroundColor: t.palette.contrast_50},
                  ]}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  style={[
                    {width: 60, height: 90},
                    a.rounded_sm,
                    {backgroundColor: t.palette.contrast_100},
                    a.align_center,
                    a.justify_center,
                  ]}>
                  <Text style={{fontSize: 28}}>📖</Text>
                </View>
              )}

              {/* Club + book details */}
              <View style={[a.flex_1, a.gap_xs]}>
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
                    <Text style={[a.text_md, a.font_bold, t.atoms.text]}>
                      {book.bookTitle}
                    </Text>
                    {book.bookAuthors && (
                      <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                        {book.bookAuthors.split('\t').join(', ')}
                      </Text>
                    )}
                  </>
                )}

                {/* Admin info */}
                <View style={[a.flex_row, a.align_center, a.gap_xs, a.mt_2xs]}>
                  {adminProfile ? (
                    <PreviewableUserAvatar
                      size={20}
                      avatar={adminProfile.avatar}
                      profile={adminProfile}
                    />
                  ) : (
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: t.palette.contrast_100,
                      }}
                    />
                  )}
                  <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                    {adminProfile?.displayName || club.record.admin}
                  </Text>
                </View>
              </View>
            </View>

            {/* Chat area */}
            <BookClubChat
              status={chatStatus}
              messages={messages}
              members={members}
              error={chatError}
              isOp={isOp}
              myNick={currentAccount?.handle.replace(/\./g, '_') ?? ''}
              sendMessage={sendMessage}
              loadMoreHistory={loadMoreHistory}
              onKick={kickUser}
              onGrantOp={grantOp}
              onRevokeOp={revokeOp}
            />
          </View>
        ) : null}
      </View>
    </Layout.Screen>
  )
}
