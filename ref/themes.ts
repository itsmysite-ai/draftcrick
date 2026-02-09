import { createV5Theme, defaultChildrenThemes } from '@tamagui/config/v5'
import { v5ComponentThemes } from '@tamagui/themes/v5'
import { yellow, yellowDark, red, redDark, green, greenDark } from '@tamagui/colors'

// ─────────────────────────────────────────────────────────────────────────────
// tami·draft — Cricket Fantasy Drafting App Theme
// ─────────────────────────────────────────────────────────────────────────────
// Palette direction: warm off-whites + earthy greens (cricket pitch) in light,
// deep charcoal-greens in dark. Accent is a rich teal-green that feels sporty
// but approachable. Retro-modern vibe: soft, readable, not eye-watering.
// ─────────────────────────────────────────────────────────────────────────────

// Base palettes — warm neutral gray with a slight green undertone
// 12 steps: background → foreground
const darkPalette = [
  'hsla(160, 8%, 4%, 1)',    // 1  - deepest bg
  'hsla(160, 8%, 8%, 1)',    // 2  - card bg
  'hsla(160, 8%, 13%, 1)',   // 3  - subtle surface
  'hsla(160, 8%, 18%, 1)',   // 4  - borders
  'hsla(160, 8%, 23%, 1)',   // 5  - hover states
  'hsla(160, 8%, 30%, 1)',   // 6  - muted elements
  'hsla(160, 8%, 38%, 1)',   // 7  - placeholder text
  'hsla(160, 8%, 48%, 1)',   // 8  - secondary text
  'hsla(160, 8%, 56%, 1)',   // 9  - primary text muted
  'hsla(160, 8%, 65%, 1)',   // 10 - primary text
  'hsla(160, 6%, 93%, 1)',   // 11 - high contrast text
  'hsla(160, 6%, 98%, 1)',   // 12 - pure foreground
]

const lightPalette = [
  'hsla(40, 20%, 97%, 1)',   // 1  - warm off-white bg (#F7F5F2 feel)
  'hsla(40, 16%, 94%, 1)',   // 2  - subtle surface (cards)
  'hsla(40, 12%, 90%, 1)',   // 3  - borders, dividers
  'hsla(40, 10%, 85%, 1)',   // 4  - input borders
  'hsla(40, 8%, 78%, 1)',    // 5  - hover borders
  'hsla(40, 6%, 70%, 1)',    // 6  - disabled text
  'hsla(40, 5%, 60%, 1)',    // 7  - placeholder text
  'hsla(40, 4%, 50%, 1)',    // 8  - secondary text
  'hsla(40, 4%, 40%, 1)',    // 9  - muted body text
  'hsla(40, 4%, 30%, 1)',    // 10 - body text
  'hsla(40, 6%, 12%, 1)',    // 11 - headings
  'hsla(40, 8%, 4%, 1)',     // 12 - pure foreground
]

// ─────────────────────────────────────────────────────────────────────────────
// Accent: Cricket Pitch Green — a saturated but earthy teal-green
// Used for: draft buttons, active states, sport badges, progress bars
// ─────────────────────────────────────────────────────────────────────────────
const accentLight = {
  accent1:  'hsla(158, 45%, 28%, 1)',  // darkest — pressed states
  accent2:  'hsla(158, 45%, 31%, 1)',
  accent3:  'hsla(158, 45%, 34%, 1)',
  accent4:  'hsla(158, 45%, 37%, 1)',
  accent5:  'hsla(158, 45%, 40%, 1)',  // primary button bg
  accent6:  'hsla(158, 45%, 44%, 1)',
  accent7:  'hsla(158, 42%, 48%, 1)',
  accent8:  'hsla(158, 40%, 52%, 1)',  // hover
  accent9:  'hsla(158, 38%, 56%, 1)',
  accent10: 'hsla(158, 36%, 62%, 1)',  // lightest interactive
  accent11: 'hsla(158, 40%, 94%, 1)',  // tinted background
  accent12: 'hsla(158, 40%, 97%, 1)',  // barely there tint
}

const accentDark = {
  accent1:  'hsla(158, 40%, 22%, 1)',
  accent2:  'hsla(158, 40%, 26%, 1)',
  accent3:  'hsla(158, 42%, 30%, 1)',
  accent4:  'hsla(158, 42%, 34%, 1)',
  accent5:  'hsla(158, 44%, 38%, 1)',
  accent6:  'hsla(158, 44%, 42%, 1)',
  accent7:  'hsla(158, 42%, 48%, 1)',
  accent8:  'hsla(158, 40%, 54%, 1)',
  accent9:  'hsla(158, 38%, 60%, 1)',
  accent10: 'hsla(158, 36%, 66%, 1)',
  accent11: 'hsla(158, 30%, 88%, 1)',
  accent12: 'hsla(158, 30%, 94%, 1)',
}

// ─────────────────────────────────────────────────────────────────────────────
// Semantic children themes
// ─────────────────────────────────────────────────────────────────────────────
// "cricket" — a warm amber/gold for cricket-specific highlights
//   (batting avg badges, run rates, top performer highlights)
const cricketLight = {
  color1:  'hsla(36, 70%, 35%, 1)',
  color2:  'hsla(36, 70%, 38%, 1)',
  color3:  'hsla(36, 68%, 42%, 1)',
  color4:  'hsla(36, 66%, 46%, 1)',
  color5:  'hsla(36, 64%, 50%, 1)',
  color6:  'hsla(36, 62%, 54%, 1)',
  color7:  'hsla(36, 58%, 60%, 1)',
  color8:  'hsla(36, 54%, 66%, 1)',
  color9:  'hsla(36, 50%, 72%, 1)',
  color10: 'hsla(36, 46%, 78%, 1)',
  color11: 'hsla(36, 50%, 94%, 1)',
  color12: 'hsla(36, 50%, 97%, 1)',
}

const cricketDark = {
  color1:  'hsla(36, 60%, 28%, 1)',
  color2:  'hsla(36, 60%, 32%, 1)',
  color3:  'hsla(36, 58%, 36%, 1)',
  color4:  'hsla(36, 56%, 40%, 1)',
  color5:  'hsla(36, 54%, 44%, 1)',
  color6:  'hsla(36, 52%, 48%, 1)',
  color7:  'hsla(36, 48%, 54%, 1)',
  color8:  'hsla(36, 44%, 60%, 1)',
  color9:  'hsla(36, 40%, 66%, 1)',
  color10: 'hsla(36, 36%, 72%, 1)',
  color11: 'hsla(36, 40%, 88%, 1)',
  color12: 'hsla(36, 40%, 94%, 1)',
}

// "hatch" — coral/salmon for the egg-hatch animation and draft-action CTA
const hatchLight = {
  color1:  'hsla(12, 65%, 42%, 1)',
  color2:  'hsla(12, 65%, 45%, 1)',
  color3:  'hsla(12, 62%, 48%, 1)',
  color4:  'hsla(12, 60%, 52%, 1)',
  color5:  'hsla(12, 58%, 55%, 1)',
  color6:  'hsla(12, 55%, 60%, 1)',
  color7:  'hsla(12, 50%, 65%, 1)',
  color8:  'hsla(12, 45%, 70%, 1)',
  color9:  'hsla(12, 40%, 76%, 1)',
  color10: 'hsla(12, 35%, 82%, 1)',
  color11: 'hsla(12, 50%, 94%, 1)',
  color12: 'hsla(12, 50%, 97%, 1)',
}

const hatchDark = {
  color1:  'hsla(12, 55%, 34%, 1)',
  color2:  'hsla(12, 55%, 38%, 1)',
  color3:  'hsla(12, 52%, 42%, 1)',
  color4:  'hsla(12, 50%, 46%, 1)',
  color5:  'hsla(12, 48%, 50%, 1)',
  color6:  'hsla(12, 46%, 54%, 1)',
  color7:  'hsla(12, 42%, 60%, 1)',
  color8:  'hsla(12, 38%, 66%, 1)',
  color9:  'hsla(12, 34%, 72%, 1)',
  color10: 'hsla(12, 30%, 78%, 1)',
  color11: 'hsla(12, 40%, 88%, 1)',
  color12: 'hsla(12, 40%, 94%, 1)',
}

// ─────────────────────────────────────────────────────────────────────────────
// Build themes
// ─────────────────────────────────────────────────────────────────────────────
const builtThemes = createV5Theme({
  darkPalette,
  lightPalette,
  componentThemes: v5ComponentThemes,
  childrenThemes: {
    // Include all default Tamagui color sub-themes
    ...defaultChildrenThemes,

    // Primary accent — cricket pitch green
    accent: {
      light: accentLight,
      dark: accentDark,
    },

    // Cricket-specific highlight — warm amber/gold
    cricket: {
      light: cricketLight,
      dark: cricketDark,
    },

    // Hatch/draft action — coral
    hatch: {
      light: hatchLight,
      dark: hatchDark,
    },

    // Standard semantic themes
    warning: {
      light: yellow,
      dark: yellowDark,
    },
    error: {
      light: red,
      dark: redDark,
    },
    success: {
      light: green,
      dark: greenDark,
    },
  },
})

export type Themes = typeof builtThemes

// The process.env conditional saves client-side bundle size by leaving out
// themes JS. Tamagui hydrates themes from CSS back into JS automatically.
// Requires Vite, Next, or Webpack plugin. Otherwise export builtThemes directly.
export const themes: Themes =
  process.env.TAMAGUI_ENVIRONMENT === 'client' &&
  process.env.NODE_ENV === 'production'
    ? ({} as any)
    : (builtThemes as any)
