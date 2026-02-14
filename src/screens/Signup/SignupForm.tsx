import {useRef, useState} from 'react'
import {type TextInput, View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {webLinks} from '#/lib/constants'
import {createFullHandle, validateServiceHandle} from '#/lib/strings/handles'
import {logger} from '#/logger'
import {
  checkHandleAvailability,
  useHandleAvailabilityQuery,
} from '#/state/queries/handle-availability'
import {useSignupContext} from '#/screens/Signup/state'
import {atoms as a, native, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as DateField from '#/components/forms/DateField'
import {type DateFieldRef} from '#/components/forms/DateField/types'
import {FormError} from '#/components/forms/FormError'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {useThrottledValue} from '#/components/hooks/useThrottledValue'
import {At_Stroke2_Corner0_Rounded as AtIcon} from '#/components/icons/At'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Envelope_Stroke2_Corner0_Rounded as Envelope} from '#/components/icons/Envelope'
import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import {InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'

export function SignupForm({onPressBack}: {onPressBack: () => void}) {
  const {_} = useLingui()
  const ax = useAnalytics()
  const t = useTheme()
  const {state, dispatch} = useSignupContext()
  const isNextLoading = useThrottledValue(state.isLoading, 500)

  const [handle, setHandle] = useState(state.handle)
  const emailRef = useRef<string>(state.email)
  const passwordRef = useRef<string>(state.password)
  const confirmPasswordRef = useRef<string>(state.confirmPassword)

  const emailInputRef = useRef<TextInput>(null)
  const passwordInputRef = useRef<TextInput>(null)
  const confirmPasswordInputRef = useRef<TextInput>(null)
  const birthdateInputRef = useRef<DateFieldRef>(null)

  const validCheck = validateServiceHandle(handle, state.userDomain)

  const {
    enabled: queryEnabled,
    query: {data: isHandleAvailable, isPending},
  } = useHandleAvailabilityQuery({
    username: handle,
    serviceDid: state.serviceDescription?.did ?? 'UNKNOWN',
    serviceDomain: state.userDomain,
    birthDate: state.dateOfBirth.toISOString(),
    enabled: validCheck.overall,
  })

  const isHandleTaken =
    !isPending &&
    queryEnabled &&
    isHandleAvailable &&
    !isHandleAvailable.available
  const handleFieldInvalid =
    isHandleTaken ||
    !validCheck.frontLengthNotTooLong ||
    !validCheck.handleChars ||
    !validCheck.hyphenStartOrEnd ||
    !validCheck.totalLength

  const onSubmitPress = async () => {
    const trimmedHandle = handle.trim()

    dispatch({type: 'setHandle', value: trimmedHandle})
    dispatch({type: 'setEmail', value: emailRef.current})
    dispatch({type: 'setPassword', value: passwordRef.current})
    dispatch({type: 'setConfirmPassword', value: confirmPasswordRef.current})

    if (!validCheck.overall) {
      return
    }

    dispatch({type: 'setIsLoading', value: true})

    try {
      const {available: handleAvailable} = await checkHandleAvailability(
        createFullHandle(trimmedHandle, state.userDomain),
        state.serviceDescription?.did ?? 'UNKNOWN',
        {},
      )

      if (!handleAvailable) {
        ax.metric('signup:handleTaken', {typeahead: false})
        dispatch({
          type: 'setError',
          value: _(msg`That username is already taken`),
          field: 'handle',
        })
        dispatch({type: 'setIsLoading', value: false})
        return
      }
    } catch (error) {
      logger.error('Failed to check handle availability on submit', {
        safeMessage: error,
      })
      // let them pass on error
    }

    dispatch({type: 'setIsLoading', value: false})

    dispatch({
      type: 'submit',
      task: {mutableProcessed: false},
    })
  }

  return (
    <View style={[a.gap_md, a.pt_lg]}>
      <FormError error={state.error} />

      {/* Handle */}
      <View>
        <TextField.LabelText>
          <Trans>Handle</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={handleFieldInvalid}>
          <TextField.Icon icon={AtIcon} />
          <TextField.Input
            testID="handleInput"
            onChangeText={val => {
              if (state.error && state.errorField === 'handle') {
                dispatch({type: 'clearError'})
              }
              setHandle(val.toLocaleLowerCase())
            }}
            label={_(msg`Enter your username`)}
            value={handle}
            keyboardType="ascii-capable"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            autoComplete="off"
            returnKeyType="next"
            submitBehavior={native('submit')}
            onSubmitEditing={native(() => emailInputRef.current?.focus())}
          />
          {isHandleAvailable?.available && (
            <CheckIcon
              testID="handleAvailableCheck"
              style={[{color: t.palette.positive_500}, a.z_20]}
            />
          )}
        </TextField.Root>
        {isHandleTaken && validCheck.overall && (
          <Text style={[a.text_sm, a.mt_xs, {color: t.palette.negative_500}]}>
            <Trans>
              {createFullHandle(handle, state.userDomain)} is not available
            </Trans>
          </Text>
        )}
        {(!validCheck.handleChars || !validCheck.hyphenStartOrEnd) &&
          handle.length > 0 && (
            <Text style={[a.text_sm, a.mt_xs, {color: t.palette.negative_500}]}>
              {!validCheck.hyphenStartOrEnd ? (
                <Trans>Username cannot begin or end with a hyphen</Trans>
              ) : (
                <Trans>
                  Username must only contain letters (a-z), numbers, and hyphens
                </Trans>
              )}
            </Text>
          )}
        {(!validCheck.frontLengthNotTooLong || !validCheck.totalLength) &&
          handle.length > 0 && (
            <Text style={[a.text_sm, a.mt_xs, {color: t.palette.negative_500}]}>
              <Trans>Username is too long</Trans>
            </Text>
          )}
      </View>

      {/* Email */}
      <View>
        <TextField.LabelText>
          <Trans>Email</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={state.errorField === 'email'}>
          <TextField.Icon icon={Envelope} />
          <TextField.Input
            testID="emailInput"
            inputRef={emailInputRef}
            onChangeText={value => {
              emailRef.current = value.trim()
              if (state.errorField === 'email') {
                dispatch({type: 'clearError'})
              }
            }}
            label={_(msg`you@example.com`)}
            defaultValue={state.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            submitBehavior={native('submit')}
            onSubmitEditing={native(() => passwordInputRef.current?.focus())}
          />
        </TextField.Root>
      </View>

      {/* Password */}
      <View>
        <TextField.LabelText>
          <Trans>Password</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={state.errorField === 'password'}>
          <TextField.Icon icon={Lock} />
          <TextField.Input
            testID="passwordInput"
            inputRef={passwordInputRef}
            onChangeText={value => {
              passwordRef.current = value
              if (state.errorField === 'password') {
                dispatch({type: 'clearError'})
              }
            }}
            label={_(msg`Minimum 8 characters`)}
            defaultValue={state.password}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            returnKeyType="next"
            submitBehavior={native('submit')}
            onSubmitEditing={native(() =>
              confirmPasswordInputRef.current?.focus(),
            )}
            passwordRules="minlength: 8;"
          />
        </TextField.Root>
      </View>

      {/* Confirm Password */}
      <View>
        <TextField.LabelText>
          <Trans>Confirm Password</Trans>
        </TextField.LabelText>
        <TextField.Root isInvalid={state.errorField === 'confirm-password'}>
          <TextField.Icon icon={Lock} />
          <TextField.Input
            testID="confirmPasswordInput"
            inputRef={confirmPasswordInputRef}
            onChangeText={value => {
              confirmPasswordRef.current = value
              if (state.errorField === 'confirm-password') {
                dispatch({type: 'clearError'})
              }
            }}
            label={_(msg`Confirm your password`)}
            defaultValue={state.confirmPassword}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            returnKeyType="next"
            submitBehavior={native('blurAndSubmit')}
            onSubmitEditing={native(() => birthdateInputRef.current?.focus())}
          />
        </TextField.Root>
      </View>

      {/* Date of Birth */}
      <View>
        <DateField.LabelText>
          <Trans>Your birth date</Trans>
        </DateField.LabelText>
        <DateField.DateField
          testID="date"
          inputRef={birthdateInputRef}
          value={state.dateOfBirth}
          onChangeDate={date => {
            dispatch({
              type: 'setDateOfBirth',
              value: new Date(date),
            })
          }}
          label={_(msg`Date of birth`)}
          accessibilityHint={_(msg`Select your date of birth`)}
          maximumDate={new Date()}
        />
      </View>

      {/* Terms of Service */}
      <View style={[a.mt_xs]}>
        <Toggle.Item
          name="tos"
          label={_(msg`I agree to the Terms of Service and Privacy Policy`)}
          value={state.tosAccepted}
          onChange={selected =>
            dispatch({type: 'setTosAccepted', value: selected})
          }
          style={[a.gap_md]}>
          <Toggle.Checkbox />
          <Text style={[a.flex_1, a.leading_snug, t.atoms.text]}>
            <Trans>
              I agree to the{' '}
              <InlineLinkText
                label={_(msg`Terms of Service`)}
                to={webLinks.tos}
                style={[a.font_bold]}>
                Terms of Service
              </InlineLinkText>{' '}
              and{' '}
              <InlineLinkText
                label={_(msg`Privacy Policy`)}
                to={webLinks.privacy}
                style={[a.font_bold]}>
                Privacy Policy
              </InlineLinkText>
            </Trans>
          </Text>
        </Toggle.Item>
      </View>

      {/* Submit */}
      <View style={[a.pt_md, a.gap_md]}>
        <Button
          testID="signupSubmitBtn"
          label={_(msg`Agree and get started`)}
          variant="solid"
          color="primary"
          size="large"
          onPress={() => void onSubmitPress()}>
          <ButtonText>
            <Trans>Agree and get started</Trans>
          </ButtonText>
          {isNextLoading && <Loader size="xs" style={{color: 'white'}} />}
        </Button>
      </View>

      {/* Already have an account */}
      <View style={[a.flex_row, a.justify_center, a.pt_md]}>
        <Text style={[t.atoms.text_contrast_medium]}>
          <Trans>Already have an account?</Trans>{' '}
          <InlineLinkText
            label={_(msg`Log in`)}
            to="/"
            onPress={e => {
              e.preventDefault()
              onPressBack()
            }}
            style={[a.font_bold]}>
            <Trans>Log in</Trans>
          </InlineLinkText>
        </Text>
      </View>
    </View>
  )
}
