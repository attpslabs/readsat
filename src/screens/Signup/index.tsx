import {useEffect, useReducer} from 'react'
import {AppState, type AppStateStatus, View} from 'react-native'
import Animated, {FadeIn} from 'react-native-reanimated'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {useServiceQuery} from '#/state/queries/service'
import {LoggedOutLayout} from '#/view/com/util/layouts/LoggedOutLayout'
import {SignupForm} from '#/screens/Signup/SignupForm'
import {
  initialState,
  reducer,
  SignupContext,
  useSubmitSignup,
} from '#/screens/Signup/state'
import {atoms as a, native, useBreakpoints} from '#/alf'
import {Loader} from '#/components/Loader'
import {useAnalytics} from '#/analytics'

export function Signup({onPressBack}: {onPressBack: () => void}) {
  const ax = useAnalytics()
  const {_} = useLingui()
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    analytics: ax,
  })
  const {gtMobile} = useBreakpoints()
  const submit = useSubmitSignup()

  useEffect(() => {
    dispatch({
      type: 'setAnalytics',
      value: ax,
    })
  }, [ax])

  const {
    data: serviceInfo,
    isFetching,
    isError,
  } = useServiceQuery(state.serviceUrl)

  useEffect(() => {
    if (isFetching) {
      dispatch({type: 'setIsLoading', value: true})
    } else if (!isFetching) {
      dispatch({type: 'setIsLoading', value: false})
    }
  }, [isFetching])

  useEffect(() => {
    if (isError) {
      dispatch({type: 'setServiceDescription', value: undefined})
      dispatch({
        type: 'setError',
        value: _(
          msg`Unable to contact your service. Please check your Internet connection.`,
        ),
      })
    } else if (serviceInfo) {
      dispatch({type: 'setServiceDescription', value: serviceInfo})
      dispatch({type: 'setError', value: ''})
    }
  }, [_, serviceInfo, isError])

  useEffect(() => {
    if (state.pendingSubmit) {
      if (!state.pendingSubmit.mutableProcessed) {
        state.pendingSubmit.mutableProcessed = true
        submit(state, dispatch)
      }
    }
  }, [state, dispatch, submit])

  // Track app backgrounding during signup
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'background') {
          dispatch({type: 'incrementBackgroundCount'})
        }
      },
    )

    return () => subscription.remove()
  }, [])

  return (
    <Animated.View exiting={native(FadeIn.duration(90))} style={a.flex_1}>
      <SignupContext.Provider value={{state, dispatch}}>
        <LoggedOutLayout
          leadin=""
          title={_(msg`Create Account`)}
          description={_(msg`We're so excited to have you join us!`)}
          scrollable>
          <View testID="createAccount" style={a.flex_1}>
            <View
              style={[
                a.flex_1,
                a.px_xl,
                a.pt_2xl,
                !gtMobile && {paddingBottom: 100},
              ]}>
              {isFetching ? (
                <View style={[a.align_center, a.py_xl]}>
                  <Loader size="xl" />
                </View>
              ) : state.serviceDescription ? (
                <SignupForm onPressBack={onPressBack} />
              ) : undefined}
            </View>
          </View>
        </LoggedOutLayout>
      </SignupContext.Provider>
    </Animated.View>
  )
}
