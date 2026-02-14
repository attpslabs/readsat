import React, {useCallback} from 'react'
import {LayoutAnimation} from 'react-native'
import {type ComAtprotoServerDescribeServer} from '@atproto/api'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import * as EmailValidator from 'email-validator'

import {DEFAULT_SERVICE} from '#/lib/constants'
import {cleanError} from '#/lib/strings/errors'
import {createFullHandle} from '#/lib/strings/handles'
import {getAge} from '#/lib/strings/time'
import {useSessionApi} from '#/state/session'
import {useOnboardingDispatch} from '#/state/shell'
import {type AnalyticsContextType, useAnalytics} from '#/analytics'

export type ServiceDescription = ComAtprotoServerDescribeServer.OutputSchema

const DEFAULT_DATE = new Date(Date.now() - 60e3 * 60 * 24 * 365 * 20) // default to 20 years ago

type SubmitTask = {
  mutableProcessed: boolean // OK to mutate assuming it's never read in render.
}

type ErrorField =
  | 'email'
  | 'handle'
  | 'password'
  | 'confirm-password'
  | 'date-of-birth'

export type SignupState = {
  analytics?: AnalyticsContextType

  serviceUrl: string
  serviceDescription?: ServiceDescription
  userDomain: string
  dateOfBirth: Date
  email: string
  password: string
  confirmPassword: string
  handle: string
  tosAccepted: boolean

  error: string
  errorField?: ErrorField
  isLoading: boolean

  pendingSubmit: null | SubmitTask

  // Tracking
  signupStartTime: number
  fieldErrors: Record<ErrorField, number>
  backgroundCount: number
}

export type SignupAction =
  | {type: 'setAnalytics'; value: AnalyticsContextType}
  | {type: 'setServiceUrl'; value: string}
  | {type: 'setServiceDescription'; value: ServiceDescription | undefined}
  | {type: 'setEmail'; value: string}
  | {type: 'setPassword'; value: string}
  | {type: 'setConfirmPassword'; value: string}
  | {type: 'setDateOfBirth'; value: Date}
  | {type: 'setHandle'; value: string}
  | {type: 'setTosAccepted'; value: boolean}
  | {type: 'setError'; value: string; field?: ErrorField}
  | {type: 'clearError'}
  | {type: 'setIsLoading'; value: boolean}
  | {type: 'submit'; task: SubmitTask}
  | {type: 'incrementBackgroundCount'}

export const initialState: SignupState = {
  analytics: undefined,

  serviceUrl: DEFAULT_SERVICE,
  serviceDescription: undefined,
  userDomain: '',
  dateOfBirth: DEFAULT_DATE,
  email: '',
  password: '',
  confirmPassword: '',
  handle: '',
  tosAccepted: false,

  error: '',
  errorField: undefined,
  isLoading: false,

  pendingSubmit: null,

  // Tracking
  signupStartTime: Date.now(),
  fieldErrors: {
    email: 0,
    handle: 0,
    password: 0,
    'confirm-password': 0,
    'date-of-birth': 0,
  },
  backgroundCount: 0,
}

export function is13(date: Date) {
  return getAge(date) >= 13
}

export function is18(date: Date) {
  return getAge(date) >= 18
}

export function reducer(s: SignupState, a: SignupAction): SignupState {
  let next = {...s}

  switch (a.type) {
    case 'setAnalytics': {
      next.analytics = a.value
      break
    }
    case 'setServiceUrl': {
      next.serviceUrl = a.value
      break
    }
    case 'setServiceDescription': {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)

      next.serviceDescription = a.value
      next.userDomain = a.value?.availableUserDomains[0] ?? ''
      next.isLoading = false
      break
    }

    case 'setEmail': {
      next.email = a.value
      break
    }
    case 'setPassword': {
      next.password = a.value
      break
    }
    case 'setConfirmPassword': {
      next.confirmPassword = a.value
      break
    }
    case 'setDateOfBirth': {
      next.dateOfBirth = a.value
      break
    }
    case 'setHandle': {
      next.handle = a.value
      break
    }
    case 'setTosAccepted': {
      next.tosAccepted = a.value
      break
    }
    case 'setIsLoading': {
      next.isLoading = a.value
      break
    }
    case 'setError': {
      next.error = a.value
      next.errorField = a.field

      // Track field errors
      if (a.field) {
        next.fieldErrors[a.field] = (next.fieldErrors[a.field] || 0) + 1

        // Log the field error
        s.analytics?.metric('signup:fieldError', {
          field: a.field,
          errorCount: next.fieldErrors[a.field],
          errorMessage: a.value,
          activeStep: 0,
        })
      }
      break
    }
    case 'clearError': {
      next.error = ''
      next.errorField = undefined
      break
    }
    case 'submit': {
      next.pendingSubmit = a.task
      break
    }
    case 'incrementBackgroundCount': {
      next.backgroundCount = s.backgroundCount + 1

      // Log background/foreground event during signup
      s.analytics?.metric('signup:backgrounded', {
        activeStep: 0,
        backgroundCount: next.backgroundCount,
      })
      break
    }
  }

  s.analytics?.logger.debug('signup', next)

  return next
}

interface IContext {
  state: SignupState
  dispatch: React.Dispatch<SignupAction>
}
export const SignupContext = React.createContext<IContext>({} as IContext)
SignupContext.displayName = 'SignupContext'
export const useSignupContext = () => React.useContext(SignupContext)

export function useSubmitSignup() {
  const ax = useAnalytics()
  const {_} = useLingui()
  const {createAccount} = useSessionApi()
  const onboardingDispatch = useOnboardingDispatch()

  return useCallback(
    async (state: SignupState, dispatch: (action: SignupAction) => void) => {
      if (!state.handle) {
        return dispatch({
          type: 'setError',
          value: _(msg`Please choose your handle.`),
          field: 'handle',
        })
      }
      if (!state.email) {
        return dispatch({
          type: 'setError',
          value: _(msg`Please enter your email.`),
          field: 'email',
        })
      }
      if (!EmailValidator.validate(state.email)) {
        return dispatch({
          type: 'setError',
          value: _(msg`Your email appears to be invalid.`),
          field: 'email',
        })
      }
      if (!state.password) {
        return dispatch({
          type: 'setError',
          value: _(msg`Please choose your password.`),
          field: 'password',
        })
      }
      if (state.password.length < 8) {
        return dispatch({
          type: 'setError',
          value: _(msg`Your password must be at least 8 characters long.`),
          field: 'password',
        })
      }
      if (state.confirmPassword !== state.password) {
        return dispatch({
          type: 'setError',
          value: _(msg`Passwords do not match.`),
          field: 'confirm-password',
        })
      }
      if (!is13(state.dateOfBirth)) {
        return dispatch({
          type: 'setError',
          value: _(
            msg`You must be 13 years of age or older to create an account.`,
          ),
          field: 'date-of-birth',
        })
      }
      if (!state.tosAccepted) {
        return dispatch({
          type: 'setError',
          value: _(
            msg`You must agree to the Terms of Service and Privacy Policy.`,
          ),
        })
      }
      dispatch({type: 'setError', value: ''})
      dispatch({type: 'setIsLoading', value: true})

      try {
        await createAccount(
          {
            service: state.serviceUrl,
            email: state.email,
            handle: createFullHandle(state.handle, state.userDomain),
            password: state.password,
            birthDate: state.dateOfBirth,
          },
          {
            signupDuration: Date.now() - state.signupStartTime,
            fieldErrorsTotal: Object.values(state.fieldErrors).reduce(
              (a, b) => a + b,
              0,
            ),
            backgroundCount: state.backgroundCount,
          },
        )

        /*
         * Must happen last so that if the user has multiple tabs open and
         * createAccount fails, one tab is not stuck in onboarding — Eric
         */
        onboardingDispatch({type: 'start'})
      } catch (e: any) {
        const errMsg = e.toString()
        const error = cleanError(errMsg)
        const isHandleError = error.toLowerCase().includes('handle')

        dispatch({type: 'setIsLoading', value: false})
        dispatch({
          type: 'setError',
          value: error,
          field: isHandleError ? 'handle' : undefined,
        })

        ax.logger.error('Signup Flow Error', {
          errorMessage: error,
          registrationHandle: state.handle,
        })
      } finally {
        dispatch({type: 'setIsLoading', value: false})
      }
    },
    [_, onboardingDispatch, createAccount],
  )
}
