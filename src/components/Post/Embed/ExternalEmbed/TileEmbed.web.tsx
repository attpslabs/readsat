import React, {useEffect, useRef, useState} from 'react'
import {View} from 'react-native'

import {type TileManifest} from '#/lib/tiles/types'
import {useTileContentQuery} from '#/state/queries/tile'
import {atoms as a, useTheme} from '#/alf'
import {Loader} from '#/components/Loader'

export function TileEmbed({
  manifest,
  did,
}: {
  manifest: TileManifest
  did: string
}) {
  const t = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Lazy load: only fetch tile content when scrolled into view
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      {threshold: 0.1},
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const {
    data: html,
    isLoading,
    isError,
  } = useTileContentQuery(
    isVisible ? manifest : undefined,
    isVisible ? did : undefined,
  )

  const sizing = manifest.sizing || {width: 1, height: 1}
  const aspectRatio = sizing.width / sizing.height

  // Create blob URL from HTML content
  const blobUrl = React.useMemo(() => {
    if (!html) return null
    const blob = new Blob([html], {type: 'text/html'})
    return URL.createObjectURL(blob)
  }, [html])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  if (isError) return null

  return (
    <div ref={containerRef} style={{width: '100%'}}>
      {isLoading || !blobUrl ? (
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
      ) : (
        <View
          style={[
            {aspectRatio},
            a.w_full,
            a.overflow_hidden,
            a.rounded_md,
            a.border,
            t.atoms.border_contrast_low,
          ]}>
          <iframe
            src={blobUrl}
            sandbox="allow-scripts allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
            }}
            title={manifest.name}
            referrerPolicy="no-referrer"
          />
        </View>
      )}
    </div>
  )
}
