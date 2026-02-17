import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {
  type BookClubMemberEntry,
  useApproveMemberMutation,
  useDenyMemberMutation,
  usePendingMembersQuery,
} from '#/state/queries/bookclubs'
import {useProfileQuery} from '#/state/queries/profile'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

export function PendingRequests({clubUri}: {clubUri: string}) {
  const t = useTheme()
  const {data: members, isLoading} = usePendingMembersQuery(clubUri, true)

  return (
    <View style={[a.gap_sm, a.mt_md]}>
      <Text style={[a.text_sm, a.font_bold, t.atoms.text]}>
        <Trans>Pending Requests</Trans>
      </Text>
      {isLoading ? (
        <Loader size="md" />
      ) : !members?.length ? (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>No pending requests</Trans>
        </Text>
      ) : (
        members.map(member => (
          <PendingMemberRow
            key={member.rkey}
            member={member}
            clubUri={clubUri}
          />
        ))
      )}
    </View>
  )
}

function PendingMemberRow({
  member,
  clubUri,
}: {
  member: BookClubMemberEntry
  clubUri: string
}) {
  const t = useTheme()
  const {_} = useLingui()
  const {data: profile} = useProfileQuery({did: member.record.did ?? ''})
  const approveMutation = useApproveMemberMutation()
  const denyMutation = useDenyMemberMutation()
  const isPending = approveMutation.isPending || denyMutation.isPending

  const onApprove = async () => {
    try {
      await approveMutation.mutateAsync({clubUri, rkey: member.rkey})
    } catch {
      // handled by mutation
    }
  }

  const onDeny = async () => {
    try {
      await denyMutation.mutateAsync({clubUri, rkey: member.rkey})
    } catch {
      // handled by mutation
    }
  }

  return (
    <View style={[a.flex_row, a.align_center, a.gap_sm]}>
      {profile ? (
        <PreviewableUserAvatar
          size={32}
          avatar={profile.avatar}
          profile={profile}
        />
      ) : (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: t.palette.contrast_100,
          }}
        />
      )}
      <View style={[a.flex_1]}>
        <Text style={[a.text_sm, t.atoms.text]} numberOfLines={1}>
          {profile?.displayName || member.record.handle}
        </Text>
        <Text
          style={[a.text_xs, t.atoms.text_contrast_medium]}
          numberOfLines={1}>
          @{member.record.handle}
        </Text>
      </View>
      <View style={[a.flex_row, a.gap_xs]}>
        <Button
          label={_(msg`Approve`)}
          size="tiny"
          color="primary"
          disabled={isPending}
          onPress={onApprove}>
          {approveMutation.isPending ? (
            <Loader size="sm" />
          ) : (
            <ButtonText>
              <Trans>Approve</Trans>
            </ButtonText>
          )}
        </Button>
        <Button
          label={_(msg`Deny`)}
          size="tiny"
          color="negative"
          disabled={isPending}
          onPress={onDeny}>
          {denyMutation.isPending ? (
            <Loader size="sm" />
          ) : (
            <ButtonText>
              <Trans>Deny</Trans>
            </ButtonText>
          )}
        </Button>
      </View>
    </View>
  )
}
