import { createTokens } from "tamagui";

/**
 * tami·draft Design Tokens
 *
 * Palette: warm off-whites + earthy greens (cricket pitch) in light,
 * deep charcoal-greens in dark. Accent is a rich teal-green.
 * Typography: DM Sans (body) + DM Mono (data/stats).
 */

export const tokens = createTokens({
  color: {
    // ── Base palette (light) ──
    warmWhite: "#F7F5F0",
    cream: "#F0EDE8",
    sand: "#E5E1DA",
    sandDark: "#D0CBC2",

    // ── Base palette (dark) ──
    charcoalDeep: "#111210",
    charcoal: "#1C1D1B",
    charcoalLight: "#252624",
    charcoalBorder: "#333432",

    // ── Accent: Cricket Pitch Green ──
    accent: "#3D9968",
    accentHover: "#5DB882",
    accentDark: "#2A7A5A",
    accentLight: "#E8F5EE",
    accentLightDark: "#1A2E22", // dark mode tinted bg

    // ── Cricket: Warm Amber/Gold ──
    cricket: "#B8862D",
    cricketLight: "#FDF5E6",
    cricketDark: "#D4A43D",
    cricketLightDark: "#2A2210",

    // ── Hatch: Coral/Salmon ──
    hatch: "#C25A3A",
    hatchDark: "#E08060",

    // ── Role colors (light mode) ──
    roleBatBg: "#B8862D",
    roleBatText: "#FDF5E6",
    roleBatLightBg: "#FDF5E6",
    roleBatLightText: "#B8862D",
    roleBowlBg: "#3D9968",
    roleBowlText: "#E8F5EE",
    roleBowlLightBg: "#E8F5EE",
    roleBowlLightText: "#3D9968",
    roleArBg: "#4A5DB5",
    roleArText: "#E8ECF8",
    roleArLightBg: "#EEF0F8",
    roleArLightText: "#4A5DB5",
    roleWkBg: "#7B5EA7",
    roleWkText: "#F0ECF8",
    roleWkLightBg: "#F0EEF5",
    roleWkLightText: "#7B5EA7",

    // ── Role colors (dark mode) ──
    roleBatBgDark: "#9A7225",
    roleBatLightBgDark: "#2A2210",
    roleBatLightTextDark: "#D4A43D",
    roleBowlBgDark: "#2E7A52",
    roleBowlLightBgDark: "#1A2E22",
    roleBowlLightTextDark: "#5DB882",
    roleArBgDark: "#3A4A95",
    roleArTextDark: "#D8DEF5",
    roleArLightBgDark: "#1A1E30",
    roleArLightTextDark: "#8090D0",
    roleWkBgDark: "#634A8A",
    roleWkTextDark: "#E8DEF5",
    roleWkLightBgDark: "#221A30",
    roleWkLightTextDark: "#A088CC",

    // ── Semantic ──
    success: "#30A46C",
    warning: "#F5A623",
    error: "#E5484D",
    errorLight: "rgba(229, 72, 77, 0.15)",
    info: "#3B82F6",
    live: "#E5484D",
    liveGlow: "rgba(229, 72, 77, 0.3)",

    // ── Neutrals ──
    white: "#FFFFFF",
    black: "#000000",
    transparent: "transparent",
  },

  space: {
    true: 16,
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
    true: 16,
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
    true: 8,
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
    true: 100,
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500,
  },
});
