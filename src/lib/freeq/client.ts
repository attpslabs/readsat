/**
 * Freeq IRC client for book club group chat.
 *
 * Handles WebSocket connection, SASL ATPROTO-CHALLENGE auth with PDS session,
 * and translates IRC events into typed callbacks. Stripped down from
 * freeq-app/src/irc/client.ts — no E2EE, no broker auth, no signing.
 */

import {format, parse, prefixNick} from './parser'
import {Transport, type TransportState} from './transport'
import type {ChatMember, ChatMessage, FreeqClientEvents} from './types'

interface AuthCredentials {
  did: string
  accessJwt: string
  pdsUrl: string
  handle: string
}

interface BatchState {
  channel: string
  messages: ChatMessage[]
}

export class FreeqClient {
  private transport: Transport | null = null
  private nick = ''
  private did = ''
  private ackedCaps = new Set<string>()
  private auth: AuthCredentials | null = null
  private events: FreeqClientEvents
  private url: string
  private members = new Map<string, Map<string, ChatMember>>()
  private batches = new Map<string, BatchState>()
  private founderDids = new Map<string, string>()

  constructor(url: string, events: FreeqClientEvents) {
    this.url = url
    this.events = events
  }

  connect(auth: AuthCredentials) {
    this.auth = auth
    // Sanitize nick: replace dots, strip invalid IRC nick chars, limit length
    this.nick = auth.handle
      .replace(/\./g, '_')
      .replace(/[^a-zA-Z0-9_\-\[\]\\^`{|}]/g, '_')
      .slice(0, 30)
    this.did = auth.did

    if (this.transport) {
      this.transport.disconnect()
      this.transport = null
    }

    let lineQueue: Promise<void> = Promise.resolve()
    const serializedHandleLine = (line: string) => {
      lineQueue = lineQueue
        .then(() => this.handleLine(line))
        .catch(e => console.error('[freeq] line handler error:', e))
    }

    this.transport = new Transport({
      url: this.url,
      onLine: serializedHandleLine,
      onStateChange: (s: TransportState) => {
        if (s === 'connected') {
          this.ackedCaps = new Set()
          this.events.onStatusChange('authenticating')
          this.raw('CAP LS 302')
          this.raw(format('NICK', [this.nick]))
          this.raw(
            format('USER', [
              this.sanitize(this.did),
              '0',
              '*',
              this.sanitize(auth.handle),
            ]),
          )
        } else if (s === 'disconnected') {
          this.events.onStatusChange('disconnected')
        } else {
          this.events.onStatusChange('connecting')
        }
      },
    })
    this.transport.connect()
  }

  disconnect() {
    this.transport?.disconnect()
    this.transport = null
    this.nick = ''
    this.ackedCaps = new Set()
    this.auth = null
    this.members.clear()
    this.batches.clear()
  }

  joinChannel(channel: string) {
    this.raw(format('JOIN', [this.sanitize(channel)]))
  }

  partChannel(channel: string) {
    this.raw(format('PART', [this.sanitize(channel)]))
    this.members.delete(channel.toLowerCase())
  }

  sendMessage(channel: string, text: string) {
    const safeText = this.sanitize(text)
    this.raw(format('PRIVMSG', [this.sanitize(channel), safeText]))
    // If no echo-message cap, add local echo
    if (!this.ackedCaps.has('echo-message')) {
      this.events.onMessage(channel, {
        id: this.generateId(),
        from: this.nick,
        fromDid: this.did,
        text: safeText,
        timestamp: new Date(),
        isSelf: true,
      })
    }
  }

  sendReply(channel: string, replyToMsgId: string, text: string) {
    this.raw(
      format('PRIVMSG', [this.sanitize(channel), this.sanitize(text)], {
        '+reply': this.sanitize(replyToMsgId),
      }),
    )
  }

  sendEdit(channel: string, originalMsgId: string, newText: string) {
    this.raw(
      format('PRIVMSG', [this.sanitize(channel), this.sanitize(newText)], {
        '+draft/edit': this.sanitize(originalMsgId),
      }),
    )
  }

  sendDelete(channel: string, msgId: string) {
    this.raw(
      format('TAGMSG', [this.sanitize(channel)], {
        '+draft/delete': this.sanitize(msgId),
      }),
    )
  }

  sendReaction(channel: string, emoji: string, msgId: string) {
    const safeChannel = this.sanitize(channel)
    const safeMsgId = this.sanitize(msgId)
    const safeEmoji = this.sanitize(emoji)
    this.raw(
      format('TAGMSG', [safeChannel], {
        '+react': safeEmoji,
        '+reply': safeMsgId,
      }),
    )
    this.events.onReaction(channel, msgId, emoji, this.nick)
  }

  sendTyping(channel: string, active: boolean) {
    this.raw(
      format('TAGMSG', [this.sanitize(channel)], {
        '+typing': active ? 'active' : 'done',
      }),
    )
  }

  requestHistory(channel: string, before?: string) {
    const safeChannel = this.sanitize(channel)
    if (before) {
      this.raw(
        format('CHATHISTORY', [
          'BEFORE',
          safeChannel,
          `timestamp=${this.sanitize(before)}`,
          '50',
        ]),
      )
    } else {
      this.raw(format('CHATHISTORY', ['LATEST', safeChannel, '*', '50']))
    }
  }

  getNick(): string {
    return this.nick
  }

  isConnected(): boolean {
    return this.ackedCaps.size > 0
  }

  // ── Admin / Channel Management ──

  inviteUser(channel: string, nick: string) {
    this.raw(format('INVITE', [this.sanitize(nick), this.sanitize(channel)]))
  }

  kickUser(channel: string, nick: string, reason?: string) {
    this.raw(
      format('KICK', [
        this.sanitize(channel),
        this.sanitize(nick),
        this.sanitize(reason || 'removed'),
      ]),
    )
  }

  setInviteOnly(channel: string, enabled: boolean) {
    this.raw(format('MODE', [this.sanitize(channel), enabled ? '+i' : '-i']))
  }

  grantOp(channel: string, nick: string) {
    this.raw(
      format('MODE', [this.sanitize(channel), '+o', this.sanitize(nick)]),
    )
  }

  revokeOp(channel: string, nick: string) {
    this.raw(
      format('MODE', [this.sanitize(channel), '-o', this.sanitize(nick)]),
    )
  }

  setTopic(channel: string, topic: string) {
    const safeTopic = this.sanitize(topic).slice(0, 300)
    this.raw(format('TOPIC', [this.sanitize(channel), safeTopic]))
  }

  // ── Internals ──

  private raw(line: string) {
    this.transport?.send(line)
  }

  /**
   * Strip CR/LF from user input to prevent IRC command injection.
   * A newline in user input would let an attacker inject additional
   * IRC commands on the wire.
   */
  private sanitize(input: string): string {
    return input.replace(/[\r\n]/g, '')
  }

  private generateId(): string {
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  private handleLine(rawLine: string) {
    const msg = parse(rawLine)
    const from = prefixNick(msg.prefix)

    switch (msg.command) {
      case 'CAP':
        this.handleCap(msg)
        break

      case 'AUTHENTICATE':
        this.handleAuthenticate(msg)
        break

      case '900': // RPL_LOGGEDIN
        break

      case '903': // RPL_SASLSUCCESS
        this.raw('CAP END')
        break

      case '904': // ERR_SASLFAIL
        this.events.onError('Authentication failed')
        this.raw('CAP END')
        break

      case 'PING':
        this.raw(`PONG :${msg.params[0] || ''}`)
        break

      case '001': {
        // RPL_WELCOME — registration complete
        const serverNick = msg.params[0] || this.nick
        this.nick = serverNick
        this.events.onStatusChange('connected')
        break
      }

      case '433': // Nick in use
        this.nick += '_'
        this.raw(`NICK ${this.nick}`)
        break

      case 'JOIN': {
        const channel = msg.params[0]
        const account = msg.params[1] // extended-join DID
        const joinDid = account && account !== '*' ? account : undefined
        const channelLower = channel.toLowerCase()

        if (!this.members.has(channelLower)) {
          this.members.set(channelLower, new Map())
        }

        const memberMap = this.members.get(channelLower)!
        memberMap.set(from.toLowerCase(), {
          nick: from,
          did: joinDid,
          isOp: false,
          isFounder: joinDid === this.founderDids.get(channelLower),
        })
        this.events.onMembersUpdate(channel, new Map(memberMap))
        break
      }

      case 'PART': {
        const channel = msg.params[0]
        const channelLower = channel.toLowerCase()
        const memberMap = this.members.get(channelLower)
        if (memberMap) {
          memberMap.delete(from.toLowerCase())
          this.events.onMembersUpdate(channel, new Map(memberMap))
        }
        break
      }

      case 'QUIT': {
        // Remove from all channels
        for (const [ch, memberMap] of this.members) {
          if (memberMap.delete(from.toLowerCase())) {
            this.events.onMembersUpdate(ch, new Map(memberMap))
          }
        }
        break
      }

      case 'KICK': {
        const channel = msg.params[0]
        const kicked = msg.params[1]
        const channelLower = channel.toLowerCase()
        const memberMap = this.members.get(channelLower)
        if (memberMap) {
          memberMap.delete(kicked.toLowerCase())
          this.events.onMembersUpdate(channel, new Map(memberMap))
        }
        break
      }

      case 'PRIVMSG': {
        const target = msg.params[0]
        const text = msg.params[1] || ''
        const isSelf = from.toLowerCase() === this.nick.toLowerCase()

        // Handle edits
        const editOf = msg.tags['+draft/edit']
        if (editOf) {
          this.events.onMessageEdit(target, editOf, text)
          break
        }

        const message: ChatMessage = {
          id: msg.tags['msgid'] || this.generateId(),
          from,
          fromDid: msg.tags['account'] || undefined,
          text,
          timestamp: msg.tags['time'] ? new Date(msg.tags['time']) : new Date(),
          isSelf,
          replyTo: msg.tags['+reply'],
        }

        // Parse reactions from CHATHISTORY
        const reactionsTag = msg.tags['+freeq.at/reactions']
        if (reactionsTag && message.id) {
          message.reactions = new Map()
          for (const part of reactionsTag.split(';')) {
            const [emoji, nicks] = part.split(':')
            if (emoji && nicks) {
              const set = new Set<string>()
              for (const n of nicks.split(',')) {
                if (n) set.add(n)
              }
              message.reactions.set(emoji, set)
            }
          }
        }

        // If part of a batch, buffer it
        const batchId = msg.tags['batch']
        if (batchId && this.batches.has(batchId)) {
          this.batches.get(batchId)!.messages.push(message)
          break
        }

        this.events.onMessage(target, message)
        break
      }

      case 'TAGMSG': {
        const target = msg.params[0]

        const deleteOf = msg.tags['+draft/delete']
        if (deleteOf) {
          this.events.onMessageDelete(target, deleteOf)
          break
        }

        const reaction = msg.tags['+react']
        if (reaction) {
          const reactTarget = msg.tags['+reply']
          if (reactTarget) {
            this.events.onReaction(target, reactTarget, reaction, from)
          }
        }

        const typing = msg.tags['+typing']
        if (typing) {
          this.events.onTyping(target, from, typing === 'active')
        }
        break
      }

      case '353': {
        // NAMES list
        const channel = msg.params[2]
        const channelLower = channel.toLowerCase()
        const nicks = (msg.params[3] || '').split(' ').filter(Boolean)

        if (!this.members.has(channelLower)) {
          this.members.set(channelLower, new Map())
        }
        const memberMap = this.members.get(channelLower)!

        for (const n of nicks) {
          const prefixMatch = n.match(/^([@%+]+)/)
          const prefixes = prefixMatch ? prefixMatch[1] : ''
          const bare = n.slice(prefixes.length)
          const isOp = prefixes.includes('@')
          memberMap.set(bare.toLowerCase(), {
            nick: bare,
            isOp,
            isFounder: false,
          })
        }
        break
      }

      case '366': {
        // End of NAMES
        const channel = msg.params[1]
        const channelLower = channel.toLowerCase()
        const memberMap = this.members.get(channelLower)
        if (memberMap) {
          this.events.onMembersUpdate(channel, new Map(memberMap))
        }
        // Request history after joining
        this.requestHistory(channel)
        break
      }

      case 'MODE': {
        const target = msg.params[0]
        if (target.startsWith('#') || target.startsWith('&')) {
          const modeStr = msg.params[1] || ''
          const argsWithParam = new Set(['o', 'h', 'v', 'k', 'b'])
          let adding = true
          let argIdx = 2
          const channelLower = target.toLowerCase()
          const memberMap = this.members.get(channelLower)

          for (const ch of modeStr) {
            if (ch === '+') {
              adding = true
              continue
            }
            if (ch === '-') {
              adding = false
              continue
            }
            const modeArg = argsWithParam.has(ch)
              ? msg.params[argIdx++]
              : undefined
            if (ch === 'o' && modeArg && memberMap) {
              const member = memberMap.get(modeArg.toLowerCase())
              if (member) {
                member.isOp = adding
                this.events.onMembersUpdate(target, new Map(memberMap))
              }
            }
          }
        }
        break
      }

      case 'BATCH': {
        const ref = msg.params[0]
        if (ref.startsWith('+')) {
          const batchId = ref.slice(1)
          const channel = msg.params[2] || ''
          this.batches.set(batchId, {channel, messages: []})
        } else if (ref.startsWith('-')) {
          const batchId = ref.slice(1)
          const batch = this.batches.get(batchId)
          if (batch && batch.messages.length > 0) {
            this.events.onHistoryBatch(batch.channel, batch.messages)
          }
          this.batches.delete(batchId)
        }
        break
      }

      case '473':
        this.events.onError(
          `Cannot join ${msg.params[1] || ''} — channel is invite only`,
        )
        break

      case '474':
        this.events.onError(
          `Cannot join ${msg.params[1] || ''} — you are banned`,
        )
        break

      default:
        break
    }
  }

  private handleCap(msg: import('./parser').IRCMessage) {
    const sub = msg.params[1]

    if (sub === 'LS') {
      const available = (msg.params[msg.params.length - 1] || '').split(' ')
      const wanted = [
        'message-tags',
        'server-time',
        'echo-message',
        'multi-prefix',
        'extended-join',
        'batch',
        'draft/chathistory',
      ]
      if (this.auth) {
        wanted.push('sasl')
      }
      const toReq = wanted.filter(c => available.includes(c))
      if (toReq.length > 0) {
        this.raw(`CAP REQ :${toReq.join(' ')}`)
      } else {
        this.raw('CAP END')
      }
    } else if (sub === 'ACK') {
      const acked = (msg.params[msg.params.length - 1] || '').split(' ')
      for (const c of acked) this.ackedCaps.add(c)
      if (this.ackedCaps.has('sasl') && this.auth) {
        this.raw('AUTHENTICATE ATPROTO-CHALLENGE')
      } else {
        this.raw('CAP END')
      }
    } else if (sub === 'NAK') {
      this.raw('CAP END')
    }
  }

  private handleAuthenticate(msg: import('./parser').IRCMessage) {
    const payload = msg.params[0]
    if (!payload || payload === '+') return
    if (!this.auth) return

    // Decode challenge
    let challengeJson: string
    try {
      challengeJson = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    } catch {
      this.events.onError('Failed to decode SASL challenge')
      this.raw('AUTHENTICATE *')
      return
    }

    let challenge: {session_id: string; nonce: string; timestamp: number}
    try {
      challenge = JSON.parse(challengeJson)
    } catch {
      this.events.onError('Invalid SASL challenge format')
      this.raw('AUTHENTICATE *')
      return
    }

    // Build response with PDS session method
    const response = {
      did: this.auth.did,
      method: 'pds-session',
      signature: this.auth.accessJwt,
      pds_url: this.auth.pdsUrl,
      challenge_nonce: challenge.nonce,
    }

    const responseStr = btoa(JSON.stringify(response))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Send in 400-char chunks (IRC line length limit)
    for (let i = 0; i < responseStr.length; i += 400) {
      this.raw(`AUTHENTICATE ${responseStr.slice(i, i + 400)}`)
    }
    // If the response was an exact multiple of 400, send empty to signal end
    if (responseStr.length % 400 === 0) {
      this.raw('AUTHENTICATE +')
    }
  }
}
