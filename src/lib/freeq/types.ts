/**
 * Types for the freeq IRC chat client.
 */

export interface ChatMessage {
  id: string
  from: string
  fromDid?: string
  text: string
  timestamp: Date
  isSelf: boolean
  replyTo?: string
  editOf?: string
  deleted?: boolean
  reactions?: Map<string, Set<string>>
}

export interface ChatMember {
  nick: string
  did?: string
  isOp: boolean
  isFounder: boolean
}

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'

export interface FreeqClientEvents {
  onStatusChange: (status: ConnectionStatus) => void
  onMessage: (channel: string, message: ChatMessage) => void
  onMessageEdit: (channel: string, msgId: string, newText: string) => void
  onMessageDelete: (channel: string, msgId: string) => void
  onReaction: (
    channel: string,
    msgId: string,
    emoji: string,
    from: string,
  ) => void
  onMembersUpdate: (channel: string, members: Map<string, ChatMember>) => void
  onTyping: (channel: string, nick: string, active: boolean) => void
  onHistoryBatch: (channel: string, messages: ChatMessage[]) => void
  onError: (message: string) => void
}
