/**
 * Freeq chat state management for book club group chat.
 *
 * Provides a hook that manages WebSocket connection to freeq,
 * SASL authentication, channel join, and message state.
 */

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {FREEQ_WS_URL} from '#/lib/constants'
import {FreeqClient} from '#/lib/freeq/client'
import type {ChatMember, ChatMessage, ConnectionStatus} from '#/lib/freeq/types'
import {useSession} from '#/state/session'

/**
 * Hook for book club chat. Manages connection, auth, channel join,
 * and returns messages + send function.
 *
 * @param channelName - IRC channel name like "#bookclub-abc123"
 * @param enabled - Whether to connect (false when user doesn't have access)
 * @param isAdmin - Whether current user is the book club admin (auto-sets invite-only)
 */
export function useBookClubChat(
  channelName: string,
  enabled: boolean,
  isAdmin?: boolean,
) {
  const {currentAccount} = useSession()
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [members, setMembers] = useState<Map<string, ChatMember>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const clientRef = useRef<FreeqClient | null>(null)
  const channelRef = useRef(channelName)
  channelRef.current = channelName
  const isAdminRef = useRef(isAdmin)
  isAdminRef.current = isAdmin

  useEffect(() => {
    if (!enabled || !currentAccount?.did) return

    const accessJwt = currentAccount.accessJwt
    const pdsUrl = currentAccount.pdsUrl
    if (!accessJwt || !pdsUrl) return

    const client = new FreeqClient(FREEQ_WS_URL, {
      onStatusChange: s => {
        setStatus(s)
        if (s === 'connected') {
          client.joinChannel(channelRef.current)
          // Admin auto-sets invite-only mode on join
          if (isAdminRef.current) {
            client.setInviteOnly(channelRef.current, true)
          }
        }
      },
      onMessage: (_channel, message) => {
        setMessages(prev => [...prev, message])
      },
      onMessageEdit: (_channel, msgId, newText) => {
        setMessages(prev =>
          prev.map(m => (m.id === msgId ? {...m, text: newText} : m)),
        )
      },
      onMessageDelete: (_channel, msgId) => {
        setMessages(prev =>
          prev.map(m => (m.id === msgId ? {...m, deleted: true} : m)),
        )
      },
      onReaction: (_channel, msgId, emoji, from) => {
        setMessages(prev =>
          prev.map(m => {
            if (m.id !== msgId) return m
            const reactions = new Map(m.reactions || new Map())
            const set = new Set(reactions.get(emoji) || new Set())
            set.add(from)
            reactions.set(emoji, set)
            return {...m, reactions}
          }),
        )
      },
      onMembersUpdate: (_channel, memberMap) => {
        setMembers(new Map(memberMap))
      },
      onTyping: () => {},
      onHistoryBatch: (_channel, batchMessages) => {
        setMessages(prev => [...batchMessages, ...prev])
      },
      onError: msg => {
        setError(msg)
      },
    })

    clientRef.current = client

    client.connect({
      did: currentAccount.did,
      accessJwt,
      pdsUrl,
      handle: currentAccount.handle,
    })

    return () => {
      client.disconnect()
      clientRef.current = null
    }
  }, [
    enabled,
    currentAccount?.did,
    currentAccount?.accessJwt,
    currentAccount?.pdsUrl,
    currentAccount?.handle,
  ])

  // Derive whether current user is an operator
  const myNick = clientRef.current?.getNick() ?? ''
  const isOp = useMemo(() => {
    if (!myNick) return false
    const me = members.get(myNick.toLowerCase())
    return me?.isOp || me?.isFounder || false
  }, [members, myNick])

  const sendMessage = useCallback(
    (text: string) => {
      clientRef.current?.sendMessage(channelName, text)
    },
    [channelName],
  )

  const sendReaction = useCallback(
    (msgId: string, emoji: string) => {
      clientRef.current?.sendReaction(channelName, emoji, msgId)
    },
    [channelName],
  )

  const sendReply = useCallback(
    (replyToMsgId: string, text: string) => {
      clientRef.current?.sendReply(channelName, replyToMsgId, text)
    },
    [channelName],
  )

  const loadMoreHistory = useCallback(() => {
    if (messages.length > 0) {
      const oldest = messages[0]
      clientRef.current?.requestHistory(
        channelName,
        oldest.timestamp.toISOString(),
      )
    }
  }, [channelName, messages])

  // ── Admin actions (require op status) ──

  const inviteUser = useCallback(
    (nick: string) => {
      if (!isOp) return
      clientRef.current?.inviteUser(channelName, nick)
    },
    [channelName, isOp],
  )

  const kickUser = useCallback(
    (nick: string, reason?: string) => {
      if (!isOp) return
      clientRef.current?.kickUser(channelName, nick, reason)
    },
    [channelName, isOp],
  )

  const grantOp = useCallback(
    (nick: string) => {
      if (!isOp) return
      clientRef.current?.grantOp(channelName, nick)
    },
    [channelName, isOp],
  )

  const revokeOp = useCallback(
    (nick: string) => {
      if (!isOp) return
      clientRef.current?.revokeOp(channelName, nick)
    },
    [channelName, isOp],
  )

  const setInviteOnly = useCallback(
    (inviteOnly: boolean) => {
      if (!isOp) return
      clientRef.current?.setInviteOnly(channelName, inviteOnly)
    },
    [channelName, isOp],
  )

  const visibleMessages = messages.filter(m => !m.deleted)

  return {
    status,
    messages: visibleMessages,
    members,
    error,
    isOp,
    sendMessage,
    sendReaction,
    sendReply,
    loadMoreHistory,
    inviteUser,
    kickUser,
    grantOp,
    revokeOp,
    setInviteOnly,
  }
}
