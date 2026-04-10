import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import type {ChatMember} from '#/lib/freeq/types'
import {useProfileQuery} from '#/state/queries/profile'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Text} from '#/components/Typography'

export function BookClubMemberList({
  control,
  members,
  isOp,
  myNick,
  onKick,
  onGrantOp,
  onRevokeOp,
}: {
  control: Dialog.DialogControlProps
  members: Map<string, ChatMember>
  isOp: boolean
  myNick: string
  onKick: (nick: string) => void
  onGrantOp: (nick: string) => void
  onRevokeOp: (nick: string) => void
}) {
  const {_} = useLingui()

  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner label={_(msg`Chat members`)}>
        <Dialog.Header>
          <Dialog.HeaderText>
            <Trans>Members ({members.size})</Trans>
          </Dialog.HeaderText>
        </Dialog.Header>

        <View style={[a.gap_xs, a.mt_md]}>
          {Array.from(members.values()).map(member => (
            <MemberRow
              key={member.nick}
              member={member}
              isOp={isOp}
              isMe={member.nick.toLowerCase() === myNick.toLowerCase()}
              onKick={onKick}
              onGrantOp={onGrantOp}
              onRevokeOp={onRevokeOp}
            />
          ))}
        </View>

        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function MemberRow({
  member,
  isOp,
  isMe,
  onKick,
  onGrantOp,
  onRevokeOp,
}: {
  member: ChatMember
  isOp: boolean
  isMe: boolean
  onKick: (nick: string) => void
  onGrantOp: (nick: string) => void
  onRevokeOp: (nick: string) => void
}) {
  const t = useTheme()
  const {_} = useLingui()

  const {data: profile} = useProfileQuery({
    did: member.did ?? '',
  })

  const displayName = profile?.displayName || member.nick

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.py_sm,
        a.px_sm,
        a.rounded_sm,
      ]}>
      {profile ? (
        <PreviewableUserAvatar
          size={36}
          avatar={profile.avatar}
          profile={profile}
        />
      ) : (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: t.palette.contrast_100,
          }}
        />
      )}

      <View style={[a.flex_1]}>
        <View style={[a.flex_row, a.align_center, a.gap_xs]}>
          <Text style={[a.text_md, a.font_bold, t.atoms.text]}>
            {displayName}
          </Text>
          {member.isFounder && (
            <View
              style={[
                a.px_xs,
                a.rounded_xs,
                {backgroundColor: t.palette.primary_100},
              ]}>
              <Text
                style={[
                  a.text_xs,
                  a.font_bold,
                  {color: t.palette.primary_600},
                ]}>
                <Trans>Founder</Trans>
              </Text>
            </View>
          )}
          {member.isOp && !member.isFounder && (
            <View
              style={[
                a.px_xs,
                a.rounded_xs,
                {backgroundColor: t.palette.contrast_100},
              ]}>
              <Text
                style={[a.text_xs, a.font_bold, t.atoms.text_contrast_medium]}>
                <Trans>Admin</Trans>
              </Text>
            </View>
          )}
        </View>
        {member.did && (
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {member.nick}
          </Text>
        )}
      </View>

      {/* Admin actions — only show for ops, not for self or founder */}
      {isOp && !isMe && !member.isFounder && (
        <View style={[a.flex_row, a.gap_xs]}>
          {member.isOp ? (
            <Button
              label={_(msg`Demote`)}
              size="tiny"
              color="secondary"
              onPress={() => onRevokeOp(member.nick)}>
              <ButtonText>
                <Trans>Demote</Trans>
              </ButtonText>
            </Button>
          ) : (
            <Button
              label={_(msg`Promote`)}
              size="tiny"
              color="secondary"
              onPress={() => onGrantOp(member.nick)}>
              <ButtonText>
                <Trans>Promote</Trans>
              </ButtonText>
            </Button>
          )}
          <Button
            label={_(msg`Remove`)}
            size="tiny"
            color="negative"
            onPress={() => onKick(member.nick)}>
            <ButtonText>
              <Trans>Remove</Trans>
            </ButtonText>
          </Button>
        </View>
      )}
    </View>
  )
}
