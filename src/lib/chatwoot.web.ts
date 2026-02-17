/**
 * Chatwoot live chat integration for web.
 * Loads the SDK script and provides a toggle function.
 */

const CHATWOOT_BASE_URL = 'https://support.linkna.me'
const CHATWOOT_WEBSITE_TOKEN = '8khMEdJ9nSepcxm3A5jbiTRP'

let sdkLoaded = false
let sdkReady = false

// Pre-configure Chatwoot to hide the default launcher bubble
;(window as any).chatwootSettings = {
  hideMessageBubble: true,
  position: 'right',
}

function loadScript(): void {
  if (sdkLoaded) return
  sdkLoaded = true

  const g = document.createElement('script')
  g.src = CHATWOOT_BASE_URL + '/packs/js/sdk.js'
  g.async = true
  g.onload = () => {
    ;(window as any).chatwootSDK.run({
      websiteToken: CHATWOOT_WEBSITE_TOKEN,
      baseUrl: CHATWOOT_BASE_URL,
    })
  }
  document.head.appendChild(g)

  window.addEventListener('chatwoot:ready', () => {
    sdkReady = true
    ;(window as any).$chatwoot?.toggleBubbleVisibility('hide')
  })
}

export function useChatwoot() {
  if (!sdkLoaded) {
    loadScript()
  }

  return {
    toggle: () => {
      if (sdkReady && (window as any).$chatwoot) {
        ;(window as any).$chatwoot.toggle()
      }
    },
  }
}
