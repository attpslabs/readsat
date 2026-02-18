import {useRef, useState} from 'react'
import {Keyboard, type TextInput, View} from 'react-native'
import {ComAtprotoServerCreateSession} from '@atproto/api'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {useRequestNotificationsPermission} from '#/lib/notifications/notifications'
import {cleanError, isNetworkError} from '#/lib/strings/errors'
import {resolveServiceFromHandle} from '#/lib/strings/handles'
import {logger} from '#/logger'
import {useSetHasCheckedForStarterPack} from '#/state/preferences/used-starter-packs'
import {useSessionApi} from '#/state/session'
import {startOAuthSignIn} from '#/state/session/oauth-client'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {atoms as a, ios, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {FormError} from '#/components/forms/FormError'
import * as TextField from '#/components/forms/TextField'
import {At_Stroke2_Corner0_Rounded as At} from '#/components/icons/At'
import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import {Ticket_Stroke2_Corner0_Rounded as Ticket} from '#/components/icons/Ticket'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {IS_IOS, IS_WEB} from '#/env'
import {FormContainer} from './FormContainer'

export const LoginForm = ({
  error,
  initialHandle,
  setError,
  onPressBack,
  onPressForgotPassword,
  onAttemptSuccess,
  onAttemptFailed,
}: {
  error: string
  initialHandle: string
  setError: (v: string) => void
  onPressBack: () => void
  onPressForgotPassword: () => void
  onAttemptSuccess: () => void
  onAttemptFailed: () => void
}) => {
  const t = useTheme()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isOAuthProcessing, setIsOAuthProcessing] = useState(false)
  const [isOAuthExpanded, setIsOAuthExpanded] = useState(false)
  const [oauthHandle, setOAuthHandle] = useState('')
  const oauthInputRef = useRef<TextInput>(null)
  const [errorField, setErrorField] = useState<
    'none' | 'identifier' | 'password' | '2fa'
  >('none')
  const [isAuthFactorTokenNeeded, setIsAuthFactorTokenNeeded] = useState(false)
  const identifierValueRef = useRef<string>(initialHandle || '')
  const passwordValueRef = useRef<string>('')
  const [authFactorToken, setAuthFactorToken] = useState('')
  const identifierRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)
  const hasFocusedOnce = useRef<boolean>(false)
  const {_} = useLingui()
  const {login} = useSessionApi()
  const requestNotificationsPermission = useRequestNotificationsPermission()
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const setHasCheckedForStarterPack = useSetHasCheckedForStarterPack()

  const onPressNext = async () => {
    if (isProcessing) return
    Keyboard.dismiss()
    setError('')
    setErrorField('none')

    const identifier = identifierValueRef.current.toLowerCase().trim()
    const password = passwordValueRef.current

    if (!identifier) {
      setError(_(msg`Please enter your username`))
      setErrorField('identifier')
      return
    }

    if (!password) {
      setError(_(msg`Please enter your password`))
      setErrorField('password')
      return
    }

    setIsProcessing(true)

    try {
      // Auto-detect PDS from handle and expand bare usernames
      let fullIdent = identifier
      if (
        !identifier.includes('@') && // not an email
        !identifier.includes('.') // not a domain
      ) {
        fullIdent = `${identifier}.self.surf`
      }
      const service = resolveServiceFromHandle(fullIdent)

      await login(
        {
          service,
          identifier: fullIdent,
          password,
          authFactorToken: authFactorToken.trim(),
        },
        'LoginForm',
      )
      onAttemptSuccess()
      setShowLoggedOut(false)
      setHasCheckedForStarterPack(true)
      requestNotificationsPermission('Login')
    } catch (e: any) {
      const errMsg = e.toString()
      setIsProcessing(false)
      if (
        e instanceof ComAtprotoServerCreateSession.AuthFactorTokenRequiredError
      ) {
        setIsAuthFactorTokenNeeded(true)
      } else {
        onAttemptFailed()
        if (errMsg.includes('Token is invalid')) {
          logger.debug('Failed to login due to invalid 2fa token', {
            error: errMsg,
          })
          setError(_(msg`Invalid 2FA confirmation code.`))
          setErrorField('2fa')
        } else if (
          errMsg.includes('Authentication Required') ||
          errMsg.includes('Invalid identifier or password')
        ) {
          logger.debug('Failed to login due to invalid credentials', {
            error: errMsg,
          })
          setError(_(msg`Incorrect username or password`))
        } else if (isNetworkError(e)) {
          logger.warn('Failed to login due to network error', {error: errMsg})
          setError(
            _(
              msg`Unable to contact your service. Please check your Internet connection.`,
            ),
          )
        } else {
          logger.warn('Failed to login', {error: errMsg})
          setError(cleanError(errMsg))
        }
      }
    }
  }

  const handleOAuthSignIn = async () => {
    if (isProcessing || isOAuthProcessing) return

    if (!isOAuthExpanded) {
      setIsOAuthExpanded(true)
      setTimeout(() => oauthInputRef.current?.focus(), 100)
      return
    }

    setIsOAuthProcessing(true)
    setError('')

    try {
      const handle = oauthHandle.trim() || undefined
      await startOAuthSignIn(handle)
      // Never resolves — browser navigates away
    } catch (e: any) {
      setIsOAuthProcessing(false)
      logger.error('OAuth sign in failed', {safeMessage: e?.message})
      setError(_(msg`Failed to start sign in. Please try again.`))
    }
  }

  return (
    <FormContainer testID="loginForm" titleText={<Trans>Log in</Trans>}>
      {IS_WEB && (
        <View>
          {!isOAuthExpanded ? (
            <Button
              testID="oauthSignInButton"
              label={_(msg`Sign in with Bluesky`)}
              accessibilityHint={_(
                msg`Opens Bluesky authorization page to sign in`,
              )}
              color="primary"
              size="large"
              onPress={handleOAuthSignIn}
              disabled={isProcessing}>
              <ButtonText>
                <Trans>Sign in with Bluesky</Trans>
              </ButtonText>
            </Button>
          ) : (
            <View style={[a.flex_row, a.gap_sm]}>
              <View style={[a.flex_1]}>
                <TextField.Root>
                  <TextField.Icon icon={At} />
                  <TextField.Input
                    testID="oauthHandleInput"
                    inputRef={oauthInputRef}
                    label={_(msg`you.bsky.social`)}
                    placeholder="you.bsky.social"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    returnKeyType="go"
                    value={oauthHandle}
                    onChangeText={setOAuthHandle}
                    onSubmitEditing={handleOAuthSignIn}
                    editable={!isOAuthProcessing}
                  />
                </TextField.Root>
              </View>
              <Button
                testID="oauthSubmitButton"
                label={_(msg`Sign in`)}
                color="primary"
                size="large"
                onPress={handleOAuthSignIn}
                disabled={isOAuthProcessing}>
                <ButtonText>
                  <Trans>Sign in</Trans>
                </ButtonText>
                {isOAuthProcessing && <ButtonIcon icon={Loader} />}
              </Button>
            </View>
          )}
        </View>
      )}
      {IS_WEB && (
        <View style={[a.flex_row, a.align_center, a.gap_md]}>
          <View style={[a.flex_1, a.border_b, t.atoms.border_contrast_low]} />
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>or</Trans>
          </Text>
          <View style={[a.flex_1, a.border_b, t.atoms.border_contrast_low]} />
        </View>
      )}
      <View>
        <TextField.LabelText>
          <Trans>Account</Trans>
        </TextField.LabelText>
        <View style={[a.gap_sm]}>
          <TextField.Root isInvalid={errorField === 'identifier'}>
            <TextField.Icon icon={At} />
            <TextField.Input
              testID="loginUsernameInput"
              inputRef={identifierRef}
              label={_(msg`Username or email address`)}
              autoCapitalize="none"
              autoFocus={!IS_IOS}
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="next"
              textContentType="username"
              defaultValue={initialHandle || ''}
              onChangeText={v => {
                identifierValueRef.current = v
                if (errorField) setErrorField('none')
              }}
              onSubmitEditing={() => {
                passwordRef.current?.focus()
              }}
              blurOnSubmit={false} // prevents flickering due to onSubmitEditing going to next field
              editable={!isProcessing}
              accessibilityHint={_(
                msg`Enter the username or email address you used when you created your account`,
              )}
            />
          </TextField.Root>

          <TextField.Root isInvalid={errorField === 'password'}>
            <TextField.Icon icon={Lock} />
            <TextField.Input
              testID="loginPasswordInput"
              inputRef={passwordRef}
              label={_(msg`Password`)}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              returnKeyType="done"
              enablesReturnKeyAutomatically={true}
              secureTextEntry={true}
              clearButtonMode="while-editing"
              onChangeText={v => {
                passwordValueRef.current = v
                if (errorField) setErrorField('none')
              }}
              onSubmitEditing={onPressNext}
              blurOnSubmit={false} // HACK: https://github.com/facebook/react-native/issues/21911#issuecomment-558343069 Keyboard blur behavior is now handled in onSubmitEditing
              editable={!isProcessing}
              accessibilityHint={_(msg`Enter your password`)}
              onLayout={ios(() => {
                if (hasFocusedOnce.current) return
                hasFocusedOnce.current = true
                // kinda dumb, but if we use `autoFocus` to focus
                // the username input, it happens before the password
                // input gets rendered. this breaks the password autofill
                // on iOS (it only does the username part). delaying
                // it until both inputs are rendered fixes the autofill -sfn
                identifierRef.current?.focus()
              })}
            />
            <Button
              testID="forgotPasswordButton"
              onPress={onPressForgotPassword}
              label={_(msg`Forgot password?`)}
              accessibilityHint={_(msg`Opens password reset form`)}
              variant="solid"
              color="secondary"
              style={[
                a.rounded_sm,
                // t.atoms.bg_contrast_100,
                {marginLeft: 'auto', left: 6, padding: 6},
                a.z_10,
              ]}>
              <ButtonText>
                <Trans>Forgot?</Trans>
              </ButtonText>
            </Button>
          </TextField.Root>
        </View>
      </View>
      {isAuthFactorTokenNeeded && (
        <View>
          <TextField.LabelText>
            <Trans>2FA Confirmation</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={errorField === '2fa'}>
            <TextField.Icon icon={Ticket} />
            <TextField.Input
              testID="loginAuthFactorTokenInput"
              label={_(msg`Confirmation code`)}
              autoCapitalize="none"
              autoFocus
              autoCorrect={false}
              autoComplete="one-time-code"
              returnKeyType="done"
              blurOnSubmit={false} // prevents flickering due to onSubmitEditing going to next field
              value={authFactorToken} // controlled input due to uncontrolled input not receiving pasted values properly
              onChangeText={text => {
                setAuthFactorToken(text)
                if (errorField) setErrorField('none')
              }}
              onSubmitEditing={onPressNext}
              editable={!isProcessing}
              accessibilityHint={_(
                msg`Input the code which has been emailed to you`,
              )}
              style={{
                textTransform: authFactorToken === '' ? 'none' : 'uppercase',
              }}
            />
          </TextField.Root>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium, a.mt_sm]}>
            <Trans>
              Check your email for a sign in code and enter it here.
            </Trans>
          </Text>
        </View>
      )}
      <FormError error={error} />
      <View style={[a.pt_md, web([a.justify_between, a.flex_row])]}>
        {IS_WEB && (
          <Button
            label={_(msg`Back`)}
            color="secondary"
            size="large"
            onPress={onPressBack}>
            <ButtonText>
              <Trans>Back</Trans>
            </ButtonText>
          </Button>
        )}
        <Button
          testID="loginNextButton"
          label={_(msg`Log in`)}
          accessibilityHint={_(msg`Navigates to the next screen`)}
          color="primary"
          size="large"
          onPress={onPressNext}>
          <ButtonText>
            <Trans>Log in</Trans>
          </ButtonText>
          {isProcessing && <ButtonIcon icon={Loader} />}
        </Button>
      </View>
    </FormContainer>
  )
}
