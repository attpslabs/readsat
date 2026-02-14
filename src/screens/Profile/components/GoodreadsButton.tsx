import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {useGoodreadsQuery} from '#/state/queries/goodreads'
import {atoms as a, useTheme} from '#/alf'
import {ArrowTopRight_Stroke2_Corner0_Rounded as ArrowTopRightIcon} from '#/components/icons/Arrow'
import {Globe_Stroke2_Corner0_Rounded as GlobeIcon} from '#/components/icons/Globe'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'

export function GoodreadsButton({did}: {did: string}) {
  const t = useTheme()
  const {_} = useLingui()
  const {data: goodreadsUrl} = useGoodreadsQuery({did})

  if (!goodreadsUrl) {
    return null
  }

  return (
    <Link
      to={goodreadsUrl}
      label={_(msg`Open Goodreads profile`)}
      overridePresentation={false}
      shouldProxy={false}
      style={[
        t.atoms.bg_contrast_50,
        a.rounded_full,
        a.self_start,
        {padding: 6},
      ]}>
      <GlobeIcon style={[t.atoms.text]} width={16} />
      <Text style={[a.text_sm, a.font_medium, a.ml_xs]}>
        <Trans>Goodreads</Trans>
      </Text>
      <ArrowTopRightIcon style={[t.atoms.text, a.mx_2xs]} width={14} />
    </Link>
  )
}
