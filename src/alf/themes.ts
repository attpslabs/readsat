import {
  createTheme,
  DEFAULT_PALETTE,
  DEFAULT_SUBDUED_PALETTE,
  invertPalette,
} from '@bsky.app/alf'

export const BRAND_DARK = '#423b30'
export const BRAND_LIGHT = '#f9ecdb'

const BRAND_PRIMARY_OVERRIDES = {
  primary_25: '#fefcf9',
  primary_50: '#fdf8f0',
  primary_100: '#fbf3e5',
  primary_200: '#f9ecdb',
  primary_300: '#e0d4c4',
  primary_400: '#c7bcad',
  primary_500: '#423b30',
  primary_600: '#3a3429',
  primary_700: '#332e25',
  primary_800: '#2b2620',
  primary_900: '#24201a',
  primary_950: '#1c1814',
  primary_975: '#14110e',
} as const

const DARK_CONTRAST_OVERRIDES = {
  contrast_0: '#26221b',
  contrast_25: '#2e2a23',
  contrast_50: '#37322a',
  contrast_100: '#4a4338',
  contrast_200: '#625a4d',
  contrast_300: '#78705f',
  contrast_400: '#8e8572',
  contrast_500: '#a49b87',
  contrast_600: '#b5ab98',
  contrast_700: '#c7bcad',
  contrast_800: '#d4cab9',
  contrast_900: '#e0d4c4',
  contrast_950: '#ece2d2',
  contrast_975: '#f9ecdb',
  contrast_1000: '#f9ecdb',
} as const

const DIM_CONTRAST_OVERRIDES = {
  contrast_0: '#423b30',
  contrast_25: '#4a4338',
  contrast_50: '#524b3f',
  contrast_100: '#625a4d',
  contrast_200: '#78705f',
  contrast_300: '#8e8572',
  contrast_400: '#a49b87',
  contrast_500: '#b5ab98',
  contrast_600: '#c7bcad',
  contrast_700: '#d4cab9',
  contrast_800: '#e0d4c4',
  contrast_900: '#ece2d2',
  contrast_950: '#f3ebe0',
  contrast_975: '#f9ecdb',
  contrast_1000: '#f9ecdb',
} as const

const LIGHT_CONTRAST_OVERRIDES = {
  contrast_0: '#f9ecdb',
  contrast_25: '#f3ebe0',
  contrast_50: '#ece2d2',
  contrast_100: '#e0d4c4',
  contrast_200: '#d4cab9',
  contrast_300: '#c7bcad',
  contrast_400: '#b5ab98',
  contrast_500: '#a49b87',
  contrast_600: '#8e8572',
  contrast_700: '#78705f',
  contrast_800: '#625a4d',
  contrast_900: '#524b3f',
  contrast_950: '#4a4338',
  contrast_975: '#423b30',
  contrast_1000: '#423b30',
} as const

const CUSTOM_PALETTE = {
  ...DEFAULT_PALETTE,
  ...BRAND_PRIMARY_OVERRIDES,
  ...LIGHT_CONTRAST_OVERRIDES,
}

const CUSTOM_SUBDUED_PALETTE = {
  ...DEFAULT_SUBDUED_PALETTE,
  ...BRAND_PRIMARY_OVERRIDES,
  ...LIGHT_CONTRAST_OVERRIDES,
}

const DEFAULT_THEMES = {
  light: createTheme({
    scheme: 'light',
    name: 'light',
    palette: CUSTOM_PALETTE,
  }),
  dark: createTheme({
    scheme: 'dark',
    name: 'dark',
    palette: {
      ...invertPalette(CUSTOM_PALETTE),
      ...DARK_CONTRAST_OVERRIDES,
      primary_500: '#f9ecdb',
    },
    options: {shadowOpacity: 0.4},
  }),
  dim: createTheme({
    scheme: 'dark',
    name: 'dim',
    palette: {
      ...invertPalette(CUSTOM_SUBDUED_PALETTE),
      ...DIM_CONTRAST_OVERRIDES,
      primary_500: '#f9ecdb',
    },
    options: {shadowOpacity: 0.4},
  }),
}

export const themes = {
  lightPalette: DEFAULT_THEMES.light.palette,
  darkPalette: DEFAULT_THEMES.dark.palette,
  dimPalette: DEFAULT_THEMES.dim.palette,
  light: DEFAULT_THEMES.light,
  dark: DEFAULT_THEMES.dark,
  dim: DEFAULT_THEMES.dim,
}

/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const lightPalette = DEFAULT_THEMES.light.palette
/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const darkPalette = DEFAULT_THEMES.dark.palette
/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const dimPalette = DEFAULT_THEMES.dim.palette
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const light = DEFAULT_THEMES.light
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const dark = DEFAULT_THEMES.dark
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const dim = DEFAULT_THEMES.dim
