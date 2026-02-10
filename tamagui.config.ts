import { createTamagui, createFont } from 'tamagui';
import { tokens, animations, light, dark } from '@draftcrick/ui';

/**
 * tami·draft — Tamagui Configuration
 * Fonts: DM Sans (body) + DM Mono (data/stats)
 * Theme: warm off-whites + earthy cricket-pitch greens
 *
 * Uses tokens & themes from @draftcrick/ui for consistency
 * across mobile, web, and shared UI components.
 */

const dmSansFont = createFont({
  family: "'DM Sans', sans-serif",
  size: { 1: 11, 2: 12, 3: 13, 4: 14, 5: 16, 6: 18, 7: 20, 8: 24, 9: 30 },
  lineHeight: { 1: 16, 2: 18, 3: 20, 4: 22, 5: 24, 6: 28, 7: 30, 8: 32, 9: 38 },
  weight: { 4: '400', 5: '500', 6: '600', 7: '700' },
  letterSpacing: { 1: 0, 4: 0, 7: -0.3, 8: -0.5, 9: -0.8 },
  face: {
    400: { normal: 'DMSans_400Regular' },
    500: { normal: 'DMSans_500Medium' },
    600: { normal: 'DMSans_600SemiBold' },
    700: { normal: 'DMSans_700Bold' },
  },
});

const dmMonoFont = createFont({
  family: "'DM Mono', monospace",
  size: { 1: 9, 2: 10, 3: 11, 4: 12, 5: 13, 6: 14, 7: 16, 8: 18, 9: 22 },
  lineHeight: { 1: 14, 2: 16, 3: 17, 4: 18, 5: 20, 6: 22, 7: 24, 8: 28, 9: 30 },
  weight: { 4: '400', 5: '500' },
  letterSpacing: { 1: 0.5, 4: 0.3, 7: 0, 8: -0.3, 9: -0.5 },
  face: {
    400: { normal: 'DMMono_400Regular' },
    500: { normal: 'DMMono_500Medium' },
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
    light,
    dark,
  },
  animations,
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
