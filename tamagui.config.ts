import { createTamagui, createFont, createTokens } from 'tamagui';

/**
 * tami·draft — Tamagui Configuration
 * Fonts: DM Sans (body) + DM Mono (data/stats)
 * Theme: warm off-whites + earthy cricket-pitch greens
 */

const dmSansFont = createFont({
  family: "'DM Sans', sans-serif",
  size: { 1: 11, 2: 12, 3: 13, 4: 14, 5: 16, 6: 18, 7: 20, 8: 24, 9: 30 },
  lineHeight: { 1: 16, 2: 18, 3: 20, 4: 22, 5: 24, 6: 28, 7: 30, 8: 32, 9: 38 },
  weight: { 4: '400', 5: '500', 6: '600', 7: '700' },
  letterSpacing: { 1: 0, 4: 0, 7: -0.3, 8: -0.5, 9: -0.8 },
});

const dmMonoFont = createFont({
  family: "'DM Mono', monospace",
  size: { 1: 9, 2: 10, 3: 11, 4: 12, 5: 13, 6: 14, 7: 16, 8: 18, 9: 22 },
  lineHeight: { 1: 14, 2: 16, 3: 17, 4: 18, 5: 20, 6: 22, 7: 24, 8: 28, 9: 30 },
  weight: { 4: '400', 5: '500' },
  letterSpacing: { 1: 0.5, 4: 0.3, 7: 0, 8: -0.3, 9: -0.5 },
});

const tokens = createTokens({
  size: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, true: 16, 5: 20, 6: 24, 7: 32, 8: 48, 9: 64, 10: 96, 11: 128 },
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, true: 16, 5: 20, 6: 24, 7: 32, 8: 48, 9: 64, 10: 96, 11: 128 },
  radius: { 0: 0, 1: 4, 2: 6, 3: 10, 4: 12, 5: 14, 6: 16, 7: 20, 8: 24, true: 12, round: 1000 },
  zIndex: { 0: 0, 1: 100, 2: 200, 3: 300, 4: 400, 5: 500 },
  color: {
    warmWhite: '#F7F5F0',
    cream: '#F0EDE8',
    sand: '#E5E1DA',
    sandDark: '#D0CBC2',
    charcoalDeep: '#111210',
    charcoal: '#1C1D1B',
    charcoalLight: '#252624',
    charcoalBorder: '#333432',
    accent: '#3D9968',
    accentHover: '#5DB882',
    accentDark: '#2A7A5A',
    accentLight: '#E8F5EE',
    accentLightDark: '#1A2E22',
    cricket: '#B8862D',
    cricketLight: '#FDF5E6',
    cricketDark: '#D4A43D',
    hatch: '#C25A3A',
    hatchDark: '#E08060',
    success: '#30A46C',
    warning: '#F5A623',
    error: '#E5484D',
    white: '#FFFFFF',
    black: '#000000',
  },
});

export const tamaguiConfig = createTamagui({
  fonts: {
    heading: dmSansFont,
    body: dmSansFont,
    mono: dmMonoFont,
  },
  tokens,
  themes: {
    light: {
      bg: '#F7F5F0',
      bgSecondary: '#EFECEA',
      color: '#1A1A1A',
      colorHover: '#000000',
      border: '#E5E1DA',
      borderHover: '#D0CBC2',
      brand: '#3D9968',
      brandHover: '#5DB882',
      surface: '#FFFFFF',
      surfaceHover: '#F0EDE8',
      surfaceElevated: '#FFFFFF',
      red: '#E5484D',
      redHover: '#D03E42',
      accent: '#3D9968',
      accentHover: '#5DB882',
      success: '#30A46C',
      warning: '#F5A623',
      shadowColor: 'rgba(0, 0, 0, 0.06)',
    },
    dark: {
      bg: '#111210',
      bgSecondary: '#252624',
      color: '#EDECEA',
      colorHover: '#FFFFFF',
      border: '#333432',
      borderHover: '#444543',
      brand: '#5DB882',
      brandHover: '#7BCFA0',
      surface: '#1C1D1B',
      surfaceHover: '#252624',
      surfaceElevated: '#252624',
      red: '#E5484D',
      redHover: '#F06060',
      accent: '#5DB882',
      accentHover: '#7BCFA0',
      success: '#30A46C',
      warning: '#F5A623',
      shadowColor: 'rgba(0, 0, 0, 0.3)',
    },
  },
  shorthands: {
    f: 'flex',
    ai: 'alignItems',
    jc: 'justifyContent',
    p: 'padding',
    px: 'paddingHorizontal',
    py: 'paddingVertical',
    pt: 'paddingTop',
    pb: 'paddingBottom',
    pl: 'paddingLeft',
    pr: 'paddingRight',
    m: 'margin',
    mx: 'marginHorizontal',
    my: 'marginVertical',
    mt: 'marginTop',
    mb: 'marginBottom',
    ml: 'marginLeft',
    mr: 'marginRight',
    h: 'height',
    w: 'width',
    br: 'borderRadius',
    bw: 'borderWidth',
    bc: 'borderColor',
    bg: 'backgroundColor',
    zi: 'zIndex',
    pos: 'position',
    t: 'top',
    b: 'bottom',
    l: 'left',
    r: 'right',
    als: 'alignSelf',
    ls: 'letterSpacing',
    lh: 'lineHeight',
    maw: 'maxWidth',
    miw: 'minWidth',
    mah: 'maxHeight',
    mih: 'minHeight',
    btw: 'borderTopWidth',
    bbw: 'borderBottomWidth',
    blw: 'borderLeftWidth',
    brw: 'borderRightWidth',
    fd: 'flexDirection',
    fw: 'flexWrap',
  },
  settings: {
    allowedStyleValues: 'somewhat-strict',
    autocompleteSpecificTokens: 'except-special',
  },
});

export type AppConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
