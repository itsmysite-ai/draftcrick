/**
 * draftplay.ai Design System — Mobile
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

export const F1FontFamily = {
  body: "TitilliumWeb_400Regular",
  bodyItalic: "TitilliumWeb_400Regular_Italic",
  bodyMedium: "TitilliumWeb_600SemiBold",
  bodySemiBold: "TitilliumWeb_600SemiBold",
  bodySemiBoldItalic: "TitilliumWeb_600SemiBold_Italic",
  bodyBold: "TitilliumWeb_700Bold",
  bodyBoldItalic: "TitilliumWeb_700Bold_Italic",
  heading: "TitilliumWeb_700Bold",
  headingBold: "TitilliumWeb_900Black",
  mono: "SpaceMono_400Regular",
  monoMedium: "SpaceMono_700Bold",
} as const;

// ---------------------------------------------------------------------------
// Sport font tokens — Tamagui $fontFamily values per sport
// ---------------------------------------------------------------------------
export const SportFontTokens = {
  cricket: { body: "$body", heading: "$heading", mono: "$mono" },
  f1: { body: "$f1Body", heading: "$f1Heading", mono: "$f1Mono" },
} as const;

export function getSportFonts(sport: string) {
  return SportFontTokens[sport as keyof typeof SportFontTokens] ?? SportFontTokens.cricket;
}

// ---------------------------------------------------------------------------
// Colors — draftplay.ai dark mode (default for mobile)
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
// Border radii — softer, rounder per draftplay.ai
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

// ---------------------------------------------------------------------------
// F1 Colors — Racing Red + Carbon Black
// ---------------------------------------------------------------------------
export const F1Colors = {
  // Deep carbon fiber with blue-steel undertone
  bg: "#0C0C14",
  bgLight: "#141420",
  bgSurface: "#161622",
  bgSurfaceHover: "#1E1E2C",
  bgSurfacePress: "#26263A",
  bgSurfaceAlt: "#1E1E2C",

  accent: "#FF2D28",
  accentDark: "#E10600",
  accentMuted: "rgba(225, 6, 0, 0.12)",
  accentLight: "#2A1018",

  cricket: "#8888A0", // sport brand slot (steel)
  cricketLight: "#1C1C2A",
  amber: "#8888A0",
  amberMuted: "rgba(136, 136, 160, 0.1)",

  hatch: "#FF2D28",

  gold: "#E10600",
  cyan: "#60A5FA",
  purple: "#818CF8",
  blue: "#3B82F6",

  red: "#EF4444",
  redMuted: "rgba(239, 68, 68, 0.12)",

  text: "#E8E8F0",
  textSecondary: "#9A9AB2",
  textTertiary: "#7A7A95",
  textInverse: "#0C0C14",

  border: "#28283A",
  borderSubtle: "#1E1E2C",

  overlay: "rgba(0, 0, 20, 0.6)",
} as const;

export const F1ColorsLight = {
  // Cool silver/steel — industrial F1 paddock feel
  bg: "#F0F1F5",
  bgLight: "#E6E8EE",
  bgSurface: "#FFFFFF",
  bgSurfaceHover: "#ECEDF2",
  bgSurfacePress: "#DCDEE6",
  bgSurfaceAlt: "#E6E8EE",

  accent: "#E10600",
  accentDark: "#B80500",
  accentMuted: "rgba(225, 6, 0, 0.08)",
  accentLight: "#FCE8E8",

  cricket: "#15151E",
  cricketLight: "#E8E8EC",
  amber: "#15151E",
  amberMuted: "rgba(21, 21, 30, 0.08)",

  hatch: "#E10600",

  gold: "#E10600",
  cyan: "#0EA5E9",
  purple: "#6366F1",
  blue: "#3B82F6",

  red: "#EF4444",
  redMuted: "rgba(239, 68, 68, 0.08)",

  text: "#15151E",
  textSecondary: "#6A6B78",
  textTertiary: "#9A9BA5",
  textInverse: "#F0F1F5",

  border: "#D0D2DA",
  borderSubtle: "#E6E8EE",

  overlay: "rgba(0, 0, 20, 0.35)",
} as const;

// ---------------------------------------------------------------------------
// F1 Role colors
// ---------------------------------------------------------------------------
export const F1RoleColors = {
  DRV: { bg: "#CC0500", text: "#FFFFFF", lightBg: "#2E1010", lightText: "#FF4D48" },
  CON: { bg: "#2A2A35", text: "#E8E8EA", lightBg: "#1A1A22", lightText: "#9A9AA0" },
  TP: { bg: "#1E3A8A", text: "#BFDBFE", lightBg: "#0F1A30", lightText: "#60A5FA" },
} as const;

export const F1RoleColorsLight = {
  DRV: { bg: "#E10600", text: "#FFFFFF", lightBg: "#FDE8E8", lightText: "#B80500" },
  CON: { bg: "#15151E", text: "#E8E8EA", lightBg: "#E8E8EA", lightText: "#15151E" },
  TP: { bg: "#1E40AF", text: "#DBEAFE", lightBg: "#EFF6FF", lightText: "#1E40AF" },
} as const;

// ---------------------------------------------------------------------------
// Sport-aware color getters
// ---------------------------------------------------------------------------
type RoleColorMap = Record<string, { bg: string; text: string; lightBg: string; lightText: string }>;

const SPORT_COLORS = {
  cricket: { dark: Colors, light: ColorsLight },
  f1: { dark: F1Colors, light: F1ColorsLight },
} as const;

const SPORT_ROLE_COLORS = {
  cricket: { dark: RoleColors as RoleColorMap, light: RoleColorsLight as RoleColorMap },
  f1: { dark: F1RoleColors as RoleColorMap, light: F1RoleColorsLight as RoleColorMap },
} as const;

export function getColors(sport: string, mode: "light" | "dark") {
  return (SPORT_COLORS[sport as keyof typeof SPORT_COLORS] ?? SPORT_COLORS.cricket)[mode];
}

export function getRoleColors(sport: string, mode: "light" | "dark"): RoleColorMap {
  return (SPORT_ROLE_COLORS[sport as keyof typeof SPORT_ROLE_COLORS] ?? SPORT_ROLE_COLORS.cricket)[mode];
}
