import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {usePinnedBookClubs} from '#/state/preferences/pinned-bookclubs'
import {
  useBookClubQuery,
  useCancelJoinRequestMutation,
  useJoinBookClubMutation,
  useMyJoinRequestQuery,
} from '#/state/queries/bookclubs'
import {useProfileQuery} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {EditBookClubDialog} from '#/screens/BookClubs/EditBookClubDialog'
import {PendingRequests} from '#/screens/BookClubs/PendingRequests'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {
  Pin_Filled_Corner0_Rounded as PinFilled,
  Pin_Stroke2_Corner0_Rounded as PinOutline,
} from '#/components/icons/Pin'
import {SettingsGear2_Stroke2_Corner0_Rounded as SettingsIcon} from '#/components/icons/SettingsGear2'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

export function BookClubSidebar({rkey}: {rkey: string}) {
  const t = useTheme()
  const {_} = useLingui()
  const {hasSession, currentAccount} = useSession()
  const {isPinned, pin, unpin} = usePinnedBookClubs()
  const pinned = isPinned(rkey)
  const {data: club, isLoading} = useBookClubQuery(rkey)
  const editControl = Dialog.useDialogControl()

  const onTogglePin = () => {
    if (pinned) {
      unpin(rkey)
    } else {
      pin(rkey)
    }
  }

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

  if (isLoading) {
    return (
      <View style={[a.align_center, a.py_xl]}>
        <Loader size="lg" />
      </View>
    )
  }

  if (!club) return null

  return (
    <View style={[a.gap_lg]}>
      {/* Club info section */}
      <View
        style={[
          a.gap_sm,
          a.p_md,
          a.rounded_md,
          t.atoms.bg,
          a.border,
          t.atoms.border_contrast_low,
        ]}>
        <View style={[a.flex_row, a.align_center, a.justify_between]}>
          <Text
            style={[a.text_md, a.font_bold, t.atoms.text, a.flex_1]}
            numberOfLines={2}>
            {club.record.name}
          </Text>
          {isAdmin && (
            <Button
              label={_(msg`Club settings`)}
              size="small"
              variant="ghost"
              color="secondary"
              shape="round"
              onPress={() => editControl.open()}>
              <ButtonIcon icon={SettingsIcon} />
            </Button>
          )}
        </View>

        {/* Admin */}
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          {adminProfile ? (
            <PreviewableUserAvatar
              size={28}
              avatar={adminProfile.avatar}
              profile={adminProfile}
            />
          ) : (
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: t.palette.contrast_100,
              }}
            />
          )}
          <View>
            <Text style={[a.text_sm, t.atoms.text]} numberOfLines={1}>
              {adminProfile?.displayName || club.record.admin}
            </Text>
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              <Trans>Admin</Trans>
            </Text>
          </View>
        </View>

        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          {_(msg`1 member`)}
        </Text>

        {/* Pin / Unpin button */}
        {hasSession && (
          <Button
            label={pinned ? _(msg`Unpin club`) : _(msg`Pin club`)}
            size="small"
            color={pinned ? 'secondary' : 'primary'}
            onPress={onTogglePin}>
            <ButtonIcon icon={pinned ? PinFilled : PinOutline} />
            <ButtonText>
              {pinned ? <Trans>Unpin</Trans> : <Trans>Pin to sidebar</Trans>}
            </ButtonText>
          </Button>
        )}

        {/* Join / Cancel button */}
        {hasSession && !isAdmin && (
          <View>
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
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>You created this club</Trans>
          </Text>
        )}
      </View>

      {/* Pending requests (admin only) */}
      {isAdmin && (
        <View
          style={[
            a.p_md,
            a.rounded_md,
            t.atoms.bg,
            a.border,
            t.atoms.border_contrast_low,
          ]}>
          <PendingRequests clubUri={club.uri} />
        </View>
      )}

      {isAdmin && <EditBookClubDialog control={editControl} club={club} />}
    </View>
  )
}
