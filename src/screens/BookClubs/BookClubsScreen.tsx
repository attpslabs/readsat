import {ScrollView, View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useFocusEffect, useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {useBookClubsQuery} from '#/state/queries/bookclubs'
import {useSession} from '#/state/session'
import {useSetMinimalShellMode} from '#/state/shell'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {PlusSmall_Stroke2_Corner0_Rounded as Plus} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {BookClubCard} from './BookClubCard'

export function BookClubsScreen() {
  const t = useTheme()
  const {_} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const setMinimalShellMode = useSetMinimalShellMode()
  const {hasSession} = useSession()

  const {data: clubs, isLoading, error, refetch} = useBookClubsQuery()

  useFocusEffect(() => {
    setMinimalShellMode(false)
  })

  const onPressCreate = () => {
    navigation.navigate('CreateBookClub')
  }

  return (
    <Layout.Screen>
      <View
        style={[
          a.relative,
          a.z_10,
          web({
            position: 'sticky',
            top: 0,
          }),
        ]}>
        <Layout.Center style={t.atoms.bg}>
          <Layout.Header.Outer>
            <Layout.Header.BackButton />
            <Layout.Header.Content align="left">
              <Layout.Header.TitleText>
                <Trans>Bookclubs</Trans>
              </Layout.Header.TitleText>
            </Layout.Header.Content>
            <Layout.Header.Slot>
              {hasSession && (
                <Button
                  label={_(msg`Start a bookclub`)}
                  size="small"
                  variant="ghost"
                  color="primary"
                  shape="round"
                  onPress={onPressCreate}>
                  <ButtonIcon icon={Plus} size="lg" />
                </Button>
              )}
            </Layout.Header.Slot>
          </Layout.Header.Outer>
        </Layout.Center>
      </View>

      <Layout.Center>
        <ScrollView contentContainerStyle={[a.p_lg, a.gap_lg]}>
          {isLoading ? (
            <View style={[a.align_center, a.py_5xl]}>
              <Loader size="xl" />
            </View>
          ) : error ? (
            <View style={[a.align_center, a.py_5xl, a.gap_md]}>
              <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                <Trans>Failed to load bookclubs</Trans>
              </Text>
              <Button
                label={_(msg`Retry`)}
                size="small"
                color="secondary"
                onPress={() => refetch()}>
                <ButtonText>
                  <Trans>Retry</Trans>
                </ButtonText>
              </Button>
            </View>
          ) : clubs && clubs.length > 0 ? (
            clubs.map(club => <BookClubCard key={club.rkey} club={club} />)
          ) : (
            <View style={[a.align_center, a.py_5xl, a.gap_md]}>
              <Text style={[a.text_lg, t.atoms.text_contrast_medium]}>
                <Trans>No bookclubs yet</Trans>
              </Text>
              {hasSession && (
                <Button
                  label={_(msg`Start a bookclub`)}
                  size="large"
                  color="primary"
                  onPress={onPressCreate}>
                  <ButtonIcon icon={Plus} />
                  <ButtonText>
                    <Trans>Start a Bookclub</Trans>
                  </ButtonText>
                </Button>
              )}
            </View>
          )}
        </ScrollView>
      </Layout.Center>
    </Layout.Screen>
  )
}
