/**
 * tami·draft Design System — Mobile
 * Warm off-whites + earthy greens. Retro-modern fusion.
 * Fonts: DM Sans (body) + DM Mono (data/stats).
 */

// ---------------------------------------------------------------------------
// Font families — loaded via expo-font in root layout
// ---------------------------------------------------------------------------
export const FontFamily = {
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodySemiBold: "DMSans_600SemiBold",
  bodyBold: "DMSans_700Bold",
  heading: "DMSans_700Bold",
  headingBold: "DMSans_700Bold",
  mono: "DMMono_400Regular",
  monoMedium: "DMMono_500Medium",
} as const;

// ---------------------------------------------------------------------------
// Colors — tami·draft dark mode (default for mobile)
// ---------------------------------------------------------------------------
export const Colors = {
  // Backgrounds
  bg: "#111210",
  bgLight: "#1C1D1B",
  bgSurface: "#1C1D1B",
  bgSurfaceHover: "#252624",
  bgSurfacePress: "#2E2F2D",
  bgSurfaceAlt: "#252624",

  // Primary accent — Cricket Pitch Green
  accent: "#5DB882",
  accentDark: "#3D9968",
  accentMuted: "rgba(93, 184, 130, 0.1)",
  accentLight: "#1A2E22",

  // Cricket: Warm Amber
  cricket: "#D4A43D",
  cricketLight: "#2A2210",
  amber: "#D4A43D",
  amberMuted: "rgba(212, 164, 61, 0.1)",

  // Hatch: Coral
  hatch: "#E08060",

  // Secondary accents
  gold: "#D4A43D",
  cyan: "#5DA8B8",
  purple: "#A088CC",
  blue: "#4A5DB5",

  // Status
  red: "#E5484D",
  redMuted: "rgba(229, 72, 77, 0.12)",

  // Text
  text: "#EDECEA",
  textSecondary: "#9A9894",
  textTertiary: "#5E5D5A",
  textInverse: "#111210",

  // Borders
  border: "#333432",
  borderSubtle: "#252624",

  // Misc
  overlay: "rgba(0, 0, 0, 0.55)",
} as const;

// ---------------------------------------------------------------------------
// Light mode colors
// ---------------------------------------------------------------------------
export const ColorsLight = {
  bg: "#F7F5F0",
  bgLight: "#F0EDE8",
  bgSurface: "#FFFFFF",
  bgSurfaceHover: "#F0EDE8",
  bgSurfacePress: "#E5E1DA",
  bgSurfaceAlt: "#EFECEA",

  accent: "#3D9968",
  accentDark: "#2A7A5A",
  accentMuted: "rgba(61, 153, 104, 0.08)",
  accentLight: "#E8F5EE",

  cricket: "#B8862D",
  cricketLight: "#FDF5E6",
  amber: "#B8862D",
  amberMuted: "rgba(184, 134, 45, 0.1)",

  hatch: "#C25A3A",

  gold: "#B8862D",
  cyan: "#3D8A9C",
  purple: "#7B5EA7",
  blue: "#4A5DB5",

  red: "#E5484D",
  redMuted: "rgba(229, 72, 77, 0.1)",

  text: "#1A1A1A",
  textSecondary: "#8A8580",
  textTertiary: "#B5B0A8",
  textInverse: "#F7F5F0",

  border: "#E5E1DA",
  borderSubtle: "#EFECEA",

  overlay: "rgba(0, 0, 0, 0.35)",
} as const;

// ---------------------------------------------------------------------------
// Gradients — warm, earthy
// ---------------------------------------------------------------------------
export const Gradients = {
  heroWash: ["rgba(93, 184, 130, 0.04)", "transparent"] as const,
  accent: ["#3D9968", "#5DB882"] as const,
  live: ["#E5484D", "#F06060"] as const,
  tabBar: ["transparent", "rgba(17, 18, 16, 0.9)", "#111210"] as const,
  cricket: ["#B8862D", "#D4A43D"] as const,
  hatch: ["#C25A3A", "#E08060"] as const,
} as const;

// ---------------------------------------------------------------------------
// Spacing (4px baseline)
// ---------------------------------------------------------------------------
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
} as const;

// ---------------------------------------------------------------------------
// Border radii — softer, rounder per tami·draft
// ---------------------------------------------------------------------------
export const Radius = {
  xs: 5,
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Font sizes
// ---------------------------------------------------------------------------
export const Font = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  "2xl": 22,
  "3xl": 28,
  "4xl": 36,
} as const;

// ---------------------------------------------------------------------------
// Shadows — subtle, matching warm theme
// ---------------------------------------------------------------------------
export const Shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

// ---------------------------------------------------------------------------
// Card mixin
// ---------------------------------------------------------------------------
export const card = {
  backgroundColor: Colors.bgSurface,
  borderRadius: Radius.md,
  borderWidth: 1,
  borderColor: Colors.border,
} as const;

// ---------------------------------------------------------------------------
// Role colors (dark mode defaults for mobile)
// ---------------------------------------------------------------------------
export const RoleColors = {
  BAT: { bg: "#9A7225", text: "#FDF5E6", lightBg: "#2A2210", lightText: "#D4A43D" },
  BOWL: { bg: "#2E7A52", text: "#E8F5EE", lightBg: "#1A2E22", lightText: "#5DB882" },
  AR: { bg: "#3A4A95", text: "#D8DEF5", lightBg: "#1A1E30", lightText: "#8090D0" },
  WK: { bg: "#634A8A", text: "#E8DEF5", lightBg: "#221A30", lightText: "#A088CC" },
} as const;

export const RoleColorsLight = {
  BAT: { bg: "#B8862D", text: "#FDF5E6", lightBg: "#FDF5E6", lightText: "#B8862D" },
  BOWL: { bg: "#3D9968", text: "#E8F5EE", lightBg: "#E8F5EE", lightText: "#3D9968" },
  AR: { bg: "#4A5DB5", text: "#E8ECF8", lightBg: "#EEF0F8", lightText: "#4A5DB5" },
  WK: { bg: "#7B5EA7", text: "#F0ECF8", lightBg: "#F0EEF5", lightText: "#7B5EA7" },
} as const;
