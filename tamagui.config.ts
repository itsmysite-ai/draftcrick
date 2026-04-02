import { createTamagui, createFont } from 'tamagui';
// Import theme modules directly to avoid loading reanimated-dependent components
import { tokens } from './packages/ui/src/theme/tokens';
import { animations } from './packages/ui/src/theme/animations';
import { light, dark, cricket_light, cricket_dark, f1_light, f1_dark } from './packages/ui/src/theme/themes';

/**
 * draftplay.ai — Tamagui Configuration
 *
 * Single config with all sport fonts registered:
 * - Cricket: $body/$heading (DM Sans) + $mono (DM Mono)
 * - F1: $f1Body/$f1Heading (Titillium Web) + $f1Mono (Space Mono)
 *
 * Font switching is handled by the sport-aware Text wrapper component
 * which remaps $body→$f1Body and $mono→$f1Mono when sport is F1.
 */

// ─── Shared size/lineHeight scales (identical across sports) ──────────
// Named aliases (sm/md/lg) map to numeric tokens so Tamagui's useButton
// can resolve font sizes when our Button variants use size="sm"/"md"/"lg"
const bodySize = { 1: 11, 2: 12, 3: 13, 4: 14, 5: 16, 6: 18, 7: 20, 8: 24, 9: 30, sm: 12, md: 14, lg: 16 } as Record<string, number>;
const bodyLineHeight = { 1: 16, 2: 18, 3: 20, 4: 22, 5: 24, 6: 28, 7: 30, 8: 32, 9: 38, sm: 18, md: 22, lg: 24 } as Record<string, number>;
const monoSize = { 1: 9, 2: 10, 3: 11, 4: 12, 5: 13, 6: 14, 7: 16, 8: 18, 9: 22, sm: 11, md: 13, lg: 15 } as Record<string, number>;
const monoLineHeight = { 1: 14, 2: 16, 3: 17, 4: 18, 5: 20, 6: 22, 7: 24, 8: 28, 9: 30, sm: 17, md: 20, lg: 22 } as Record<string, number>;

// ─── Cricket fonts — DM Sans + DM Mono ───────────────────────────────
const dmSansFont = createFont({
  family: "DMSans_400Regular",
  size: bodySize,
  lineHeight: bodyLineHeight,
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
  family: "DMMono_400Regular",
  size: monoSize,
  lineHeight: monoLineHeight,
  weight: { 4: '400', 5: '500' },
  letterSpacing: { 1: 0.5, 4: 0.3, 7: 0, 8: -0.3, 9: -0.5 },
  face: {
    400: { normal: 'DMMono_400Regular' },
    500: { normal: 'DMMono_500Medium' },
  },
});

// ─── F1 fonts — Titillium Web (official F1 body font) + Space Mono ───
const titilliumWebFont = createFont({
  family: "TitilliumWeb_400Regular",
  size: bodySize,
  lineHeight: bodyLineHeight,
  weight: { 4: '400', 6: '600', 7: '700', 9: '900' },
  letterSpacing: { 1: 0.2, 4: 0, 7: -0.3, 8: -0.5, 9: -0.8 },
  face: {
    400: { normal: 'TitilliumWeb_400Regular', italic: 'TitilliumWeb_400Regular_Italic' },
    600: { normal: 'TitilliumWeb_600SemiBold', italic: 'TitilliumWeb_600SemiBold_Italic' },
    700: { normal: 'TitilliumWeb_700Bold', italic: 'TitilliumWeb_700Bold_Italic' },
    900: { normal: 'TitilliumWeb_900Black' },
  },
});

const spaceMonoFont = createFont({
  family: "SpaceMono_400Regular",
  size: monoSize,
  lineHeight: monoLineHeight,
  weight: { 4: '400', 7: '700' },
  letterSpacing: { 1: 0.8, 4: 0.5, 7: 0.2, 8: 0, 9: -0.3 },
  face: {
    400: { normal: 'SpaceMono_400Regular', italic: 'SpaceMono_400Regular_Italic' },
    700: { normal: 'SpaceMono_700Bold', italic: 'SpaceMono_700Bold_Italic' },
  },
});

export const tamaguiConfig = createTamagui({
  fonts: {
    // Cricket (default)
    heading: dmSansFont,
    body: dmSansFont,
    mono: dmMonoFont,
    // F1 — Titillium Web (body/heading) + Space Mono (labels/stats)
    f1Heading: titilliumWebFont,
    f1Body: titilliumWebFont,
    f1Mono: spaceMonoFont,
  },
  tokens,
  themes: { light, dark, cricket_light, cricket_dark, f1_light, f1_dark },
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
