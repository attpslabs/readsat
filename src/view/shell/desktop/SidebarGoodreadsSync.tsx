import {useState} from 'react'
import {View} from 'react-native'
import {msg, plural, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {
  useGoodreadsMutation,
  useGoodreadsQuery,
} from '#/state/queries/goodreads'
import {
  extractGoodreadsUserId,
  useGoodreadsSyncMutation,
} from '#/state/queries/goodreads-rss'
import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as SyncIcon} from '#/components/icons/ArrowRotate'
import {Globe_Stroke2_Corner0_Rounded as GlobeIcon} from '#/components/icons/Globe'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

export function SidebarGoodreadsSync() {
  const t = useTheme()
  const {_} = useLingui()
  const {hasSession, currentAccount} = useSession()
  const {data: goodreadsUrl, isLoading: isLoadingUrl} = useGoodreadsQuery({
    did: currentAccount?.did,
  })
  const goodreadsMutation = useGoodreadsMutation()
  const syncMutation = useGoodreadsSyncMutation()

  const [urlInput, setUrlInput] = useState('')
  const [showUrlForm, setShowUrlForm] = useState(false)

  if (!hasSession || !currentAccount) return null
  if (isLoadingUrl) return null

  const hasUrl = !!goodreadsUrl

  const urlInputInvalid =
    urlInput.trim() !== '' &&
    !urlInput.startsWith('https://goodreads.com/') &&
    !urlInput.startsWith('https://www.goodreads.com/')

  const canSaveUrl =
    urlInput.trim() !== '' &&
    !urlInputInvalid &&
    extractGoodreadsUserId(urlInput) !== null

  const onSaveUrl = async () => {
    if (!canSaveUrl) return
    try {
      await goodreadsMutation.mutateAsync({
        did: currentAccount.did,
        url: urlInput.trim(),
      })
      setShowUrlForm(false)
      setUrlInput('')
      Toast.show(_(msg`Goodreads profile saved`))
    } catch {
      Toast.show(_(msg`Failed to save Goodreads profile`), {type: 'error'})
    }
  }

  const onSync = async () => {
    if (!goodreadsUrl) return
    try {
      const result = await syncMutation.mutateAsync({
        goodreadsUrl,
      })
      if (result.notFound.length > 0) {
        Toast.show(
          _(
            msg`Synced ${result.synced} books. ${result.notFound.length} not found in catalog — we'll import them soon!`,
          ),
        )
      } else {
        Toast.show(
          _(
            plural(result.synced, {
              one: 'Synced # book from Goodreads',
              other: 'Synced # books from Goodreads',
            }),
          ),
        )
      }
    } catch {
      Toast.show(_(msg`Sync failed. Please try again.`), {type: 'error'})
    }
  }

  return (
    <View style={[a.p_lg, a.rounded_md, a.border, t.atoms.border_contrast_low]}>
      <View style={[a.flex_row, a.align_center, a.gap_xs, a.pb_md]}>
        <GlobeIcon width={16} height={16} fill={t.atoms.text.color} />
        <Text style={[a.flex_1, a.text_md, a.font_semi_bold, t.atoms.text]}>
          <Trans>Goodreads Sync</Trans>
        </Text>
      </View>

      {hasUrl ? (
        <View style={[a.gap_sm]}>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>
              Sync your latest shelves from Goodreads to keep your library up to
              date.
            </Trans>
          </Text>
          <Button
            label={_(msg`Sync from Goodreads`)}
            onPress={onSync}
            color="primary"
            size="small"
            disabled={syncMutation.isPending}>
            {syncMutation.isPending ? (
              <Loader size="sm" />
            ) : (
              <ButtonIcon icon={SyncIcon} />
            )}
            <ButtonText>
              {syncMutation.isPending ? (
                <Trans>Syncing...</Trans>
              ) : (
                <Trans>Sync from Goodreads</Trans>
              )}
            </ButtonText>
          </Button>
        </View>
      ) : showUrlForm ? (
        <View style={[a.gap_sm]}>
          <TextField.LabelText>
            <Trans>Goodreads Profile URL</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <TextField.Input
              label={_(msg`Goodreads profile URL`)}
              placeholder="https://goodreads.com/user/show/..."
              defaultValue={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </TextField.Root>
          {urlInputInvalid && (
            <Text style={[a.text_xs, {color: t.palette.negative_400}]}>
              <Trans>Must be a goodreads.com URL</Trans>
            </Text>
          )}
          <View style={[a.flex_row, a.gap_sm]}>
            <Button
              label={_(msg`Save`)}
              onPress={onSaveUrl}
              color="primary"
              size="small"
              disabled={!canSaveUrl || goodreadsMutation.isPending}>
              {goodreadsMutation.isPending ? (
                <Loader size="sm" />
              ) : (
                <ButtonText>
                  <Trans>Save</Trans>
                </ButtonText>
              )}
            </Button>
            <Button
              label={_(msg`Cancel`)}
              onPress={() => {
                setShowUrlForm(false)
                setUrlInput('')
              }}
              color="secondary"
              size="small"
              variant="ghost">
              <ButtonText>
                <Trans>Cancel</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>
      ) : (
        <View style={[a.gap_sm]}>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>Add your Goodreads profile to sync your bookshelves.</Trans>
          </Text>
          <Button
            label={_(msg`Add Goodreads profile`)}
            onPress={() => setShowUrlForm(true)}
            color="secondary"
            size="small">
            <ButtonIcon icon={GlobeIcon} />
            <ButtonText>
              <Trans>Add Goodreads Profile</Trans>
            </ButtonText>
          </Button>
        </View>
      )}
    </View>
  )
}
