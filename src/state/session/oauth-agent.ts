import {Agent} from '@atproto/api'
import {type OAuthSession} from '@atproto/oauth-client-browser'

import {BLUESKY_PROXY_HEADER, BSKY_SERVICE} from '#/lib/constants'
import {prefetchAgeAssuranceData} from '#/ageAssurance/data'
import {features} from '#/analytics'
import {configureModerationForAccount} from './moderation'
import {type SessionAccount} from './types'

export async function createAgentFromOAuthSession(
  oauthSession: OAuthSession,
): Promise<{agent: Agent; account: SessionAccount}> {
  const agent = new Agent(oauthSession)
  agent.configureProxy(BLUESKY_PROXY_HEADER.get())

  const {data: sessionInfo} = await agent.com.atproto.server.getSession()

  const account: SessionAccount = {
    service: oauthSession.serverMetadata.issuer,
    did: sessionInfo.did,
    handle: sessionInfo.handle,
    email: sessionInfo.email,
    emailConfirmed: sessionInfo.emailConfirmed || false,
    emailAuthFactor: sessionInfo.emailAuthFactor || false,
    refreshJwt: undefined,
    accessJwt: undefined,
    signupQueued: false,
    active: sessionInfo.active ?? true,
    status: sessionInfo.status as string | undefined,
    pdsUrl: undefined,
    isSelfHosted: !oauthSession.serverMetadata.issuer.startsWith(BSKY_SERVICE),
    isOAuth: true,
  }

  const gates = features.refresh({strategy: 'prefer-fresh-gates'})
  const moderation = configureModerationForAccount(agent as any, account)
  const aa = prefetchAgeAssuranceData({agent: agent as any})

  await Promise.all([gates, moderation, aa])

  return {agent, account}
}
