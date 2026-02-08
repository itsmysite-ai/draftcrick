import { createTokens } from "tamagui";

/**
 * DraftCrick design tokens — "CrickUI" design system
 *
 * Color palette from PLAN.md:
 * - Primary: Deep Navy #0A1628
 * - Accent: Electric Green #00F5A0
 * - Secondary: Golden Amber #FFB800
 * - Danger: Coral Red #FF4D4F
 * - Surface: Warm White #F8F9FA / Charcoal #1A2332
 */

export const tokens = createTokens({
  color: {
    // Primary palette
    navy: "#0A1628",
    navyLight: "#0E1D35",
    navyLighter: "#152642",

    // Accent
    green: "#00F5A0",
    greenLight: "#33F7B3",
    greenDark: "#00C880",

    // Secondary
    amber: "#FFB800",
    amberLight: "#FFC933",
    amberDark: "#CC9300",

    // Danger
    red: "#FF4D4F",
    redLight: "#FF7A7C",
    redDark: "#CC3E40",

    // Neutrals
    white: "#FFFFFF",
    warmWhite: "#F8F9FA",
    gray50: "#F1F3F5",
    gray100: "#E9ECEF",
    gray200: "#DEE2E6",
    gray300: "#CED4DA",
    gray400: "#ADB5BD",
    gray500: "#6C757D",
    gray600: "#495057",
    gray700: "#343A40",
    gray800: "#212529",
    charcoal: "#1A2332",
    charcoalLight: "#243044",
    black: "#000000",

    // Semantic
    success: "#00F5A0",
    warning: "#FFB800",
    error: "#FF4D4F",
    info: "#3B82F6",

    // Live indicators
    live: "#FF4D4F",
    liveGlow: "rgba(255, 77, 79, 0.3)",
  },

  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    12: 48,
    16: 64,
    20: 80,
  },

  size: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    12: 48,
    16: 64,
    20: 80,
  },

  radius: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    round: 9999,
  },

  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500,
  },
});
