import {useCallback, useRef, useState} from 'react'
import {
  FlatList,
  type ListRenderItemInfo,
  Pressable,
  TextInput,
  View,
} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import type {ChatMember, ChatMessage, ConnectionStatus} from '#/lib/freeq/types'
import {useProfileQuery} from '#/state/queries/profile'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group'
import {PaperPlane_Stroke2_Corner0_Rounded as PaperPlane} from '#/components/icons/PaperPlane'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {BookClubMemberList} from './BookClubMemberList'

export function BookClubChat({
  status,
  messages,
  members,
  error,
  isOp,
  myNick,
  sendMessage,
  loadMoreHistory,
  onKick,
  onGrantOp,
  onRevokeOp,
}: {
  status: ConnectionStatus
  messages: ChatMessage[]
  members: Map<string, ChatMember>
  error: string | null
  isOp: boolean
  myNick: string
  sendMessage: (text: string) => void
  loadMoreHistory: () => void
  onKick: (nick: string) => void
  onGrantOp: (nick: string) => void
  onRevokeOp: (nick: string) => void
}) {
  const t = useTheme()
  const {_} = useLingui()
  const [inputText, setInputText] = useState('')
  const flatListRef = useRef<FlatList>(null)
  const inputRef = useRef<TextInput>(null)
  const memberListControl = Dialog.useDialogControl()

  const onSubmit = useCallback(() => {
    const text = inputText.trim()
    if (!text) return
    sendMessage(text)
    setInputText('')
  }, [inputText, sendMessage])

  const renderMessage = useCallback(
    ({item}: ListRenderItemInfo<ChatMessage>) => {
      return <ChatMessageItem message={item} />
    },
    [],
  )

  const keyExtractor = useCallback((item: ChatMessage) => item.id, [])

  if (status === 'disconnected' || status === 'connecting') {
    return (
      <View style={[a.flex_1, a.align_center, a.justify_center, a.gap_sm]}>
        <Loader size="lg" />
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>Connecting to chat...</Trans>
        </Text>
      </View>
    )
  }

  if (status === 'authenticating') {
    return (
      <View style={[a.flex_1, a.align_center, a.justify_center, a.gap_sm]}>
        <Loader size="lg" />
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>Authenticating...</Trans>
        </Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={[a.flex_1, a.align_center, a.justify_center, a.gap_sm]}>
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>{error}</Text>
      </View>
    )
  }

  return (
    <View style={[a.flex_1]}>
      {/* Member count bar */}
      {members.size > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={_(msg`View members`)}
          accessibilityHint={_(msg`Opens the member list`)}
          onPress={() => memberListControl.open()}
          style={[
            a.flex_row,
            a.align_center,
            a.gap_xs,
            a.px_md,
            a.py_xs,
            t.atoms.bg_contrast_25,
            t.atoms.border_contrast_low,
            {borderBottomWidth: 1},
          ]}>
          <GroupIcon size="sm" style={[t.atoms.text_contrast_medium]} />
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {members.size}{' '}
            {members.size === 1 ? (
              <Trans>member online</Trans>
            ) : (
              <Trans>members online</Trans>
            )}
          </Text>
        </Pressable>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        inverted
        contentContainerStyle={[a.px_md, a.py_sm]}
        onEndReached={loadMoreHistory}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={[a.flex_1, a.align_center, a.justify_center, a.py_2xl]}>
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              <Trans>No messages yet. Start the conversation!</Trans>
            </Text>
          </View>
        }
      />

      {/* Message input */}
      <View style={[a.px_sm, a.pb_sm, a.pt_xs]}>
        <View
          style={[
            a.flex_row,
            a.align_center,
            t.atoms.bg_contrast_25,
            {
              paddingRight: 4,
              paddingLeft: 12,
              borderWidth: 1,
              borderRadius: 23,
              borderColor: t.palette.contrast_100,
              minHeight: 46,
            },
          ]}>
          <TextInput
            ref={inputRef}
            accessibilityRole="none"
            accessibilityLabel={_(msg`Write a message`)}
            accessibilityHint={_(msg`Type your message here`)}
            style={[a.flex_1, a.text_md, t.atoms.text, {paddingVertical: 10}]}
            placeholder={_(msg`Write a message...`)}
            placeholderTextColor={t.palette.contrast_500}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={onSubmit}
            multiline
            blurOnSubmit={false}
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={_(msg`Send message`)}
            accessibilityHint={_(msg`Sends your message to the chat`)}
            onPress={onSubmit}
            style={[
              a.rounded_full,
              a.align_center,
              a.justify_center,
              {
                height: 30,
                width: 30,
                backgroundColor: inputText.trim()
                  ? t.palette.primary_500
                  : t.palette.contrast_200,
              },
            ]}>
            <PaperPlane
              fill={inputText.trim() ? t.palette.white : t.palette.contrast_400}
              style={[a.relative, {left: 1}]}
            />
          </Pressable>
        </View>
      </View>

      <BookClubMemberList
        control={memberListControl}
        members={members}
        isOp={isOp}
        myNick={myNick}
        onKick={onKick}
        onGrantOp={onGrantOp}
        onRevokeOp={onRevokeOp}
      />
    </View>
  )
}

function ChatMessageItem({message}: {message: ChatMessage}) {
  const t = useTheme()

  const {data: profile} = useProfileQuery({
    did: message.fromDid ?? '',
  })

  const displayName = profile?.displayName || message.from
  const timeStr = message.timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (message.isSelf) {
    return (
      <View style={[a.flex_row, a.justify_end, a.mb_sm]}>
        <View
          style={[
            {
              maxWidth: '75%',
              backgroundColor: t.palette.primary_500,
              borderRadius: 16,
              borderBottomRightRadius: 4,
            },
            a.px_md,
            a.py_sm,
          ]}>
          <Text style={[a.text_md, {color: t.palette.white}]}>
            {message.text}
          </Text>
          <Text
            style={[
              a.text_xs,
              {color: t.palette.white, opacity: 0.7},
              a.mt_2xs,
              a.text_right,
            ]}>
            {timeStr}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[a.flex_row, a.gap_sm, a.mb_sm]}>
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
      <View
        style={[
          {
            maxWidth: '75%',
            backgroundColor: t.palette.contrast_50,
            borderRadius: 16,
            borderBottomLeftRadius: 4,
          },
          a.px_md,
          a.py_sm,
        ]}>
        <Text style={[a.text_xs, a.font_bold, t.atoms.text_contrast_medium]}>
          {displayName}
        </Text>
        <Text style={[a.text_md, t.atoms.text, a.mt_2xs]}>{message.text}</Text>
        <Text style={[a.text_xs, t.atoms.text_contrast_low, a.mt_2xs]}>
          {timeStr}
        </Text>
      </View>
    </View>
  )
}
