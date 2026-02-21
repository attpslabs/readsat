import React, {useEffect} from 'react'
import {View} from 'react-native'
import {WebView} from 'react-native-webview'

import {type TileManifest} from '#/lib/tiles/types'
import {useTileContentQuery} from '#/state/queries/tile'
import {EventStopper} from '#/view/com/util/EventStopper'
import {atoms as a, useTheme} from '#/alf'
import {Loader} from '#/components/Loader'

export function TileEmbed({
  manifest,
  did,
  onError,
}: {
  manifest: TileManifest
  did: string
  onError?: () => void
}) {
  const t = useTheme()
  const {data: html, isLoading, isError} = useTileContentQuery(manifest, did)

  const sizing = manifest.sizing || {width: 1, height: 1}
  const aspectRatio = sizing.width / sizing.height

  useEffect(() => {
    if (isError) {
      onError?.()
    }
  }, [isError, onError])

  if (isError) return null

  if (isLoading || !html) {
    return (
      <View
        style={[
          {aspectRatio},
          a.w_full,
          a.align_center,
          a.justify_center,
          t.atoms.bg_contrast_25,
          a.rounded_md,
          a.overflow_hidden,
        ]}>
        <Loader size="xl" />
      </View>
    )
  }

  return (
    <EventStopper>
      <View
        style={[
          {aspectRatio},
          a.w_full,
          a.overflow_hidden,
          a.rounded_md,
          a.border,
          t.atoms.border_contrast_low,
        ]}>
        <WebView
          source={{html, baseUrl: 'about:blank'}}
          originWhitelist={['about:blank']}
          javaScriptEnabled={true}
          incognito={true}
          bounces={false}
          scrollEnabled={false}
          onShouldStartLoadWithRequest={() => false}
          setSupportMultipleWindows={false}
          mediaPlaybackRequiresUserAction={true}
          style={{
            flex: 1,
            backgroundColor:
              manifest.background_color || t.atoms.bg.backgroundColor,
          }}
        />
      </View>
    </EventStopper>
  )
}
