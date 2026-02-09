/**
 * DraftCrick Design System — "CrickUI"
 * Aligned with web marketing page (localhost:3000).
 * Clean, restrained dark theme with subtle accents.
 * Fonts: Inter (body) + Space Grotesk (headings).
 */

// ---------------------------------------------------------------------------
// Font families — loaded via @expo-google-fonts in root layout
// ---------------------------------------------------------------------------
export const FontFamily = {
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  heading: "SpaceGrotesk_700Bold",
  headingBold: "SpaceGrotesk_800ExtraBold",
} as const;

// ---------------------------------------------------------------------------
// Colors — matched to CrickUI tokens & web globals.css
// ---------------------------------------------------------------------------
export const Colors = {
  // Backgrounds (from tokens.ts)
  bg: "#0A1628",
  bgLight: "#0E1D35",
  bgSurface: "#1A2332",        // charcoal — cards, sheets
  bgSurfaceHover: "#1F2B3D",   // card hover state
  bgSurfacePress: "#243044",   // card press state

  // Primary accent — Electric Green
  accent: "#00F5A0",
  accentDark: "#00C880",
  accentMuted: "rgba(0, 245, 160, 0.1)",   // subtle badge bg

  // Secondary
  amber: "#FFB800",
  amberMuted: "rgba(255, 184, 0, 0.1)",
  gold: "#FFD700",
  cyan: "#00D9F5",
  purple: "#8B5CF6",
  blue: "#3B82F6",

  // Status
  red: "#FF4D4F",
  redMuted: "rgba(255, 77, 79, 0.12)",

  // Text (matched to web — white / #ADB5BD / #6C757D)
  text: "#FFFFFF",
  textSecondary: "#ADB5BD",
  textTertiary: "#6C757D",
  textInverse: "#0A1628",

  // Borders (matched to web — #243044 / #1A2332)
  border: "#243044",
  borderSubtle: "#1A2332",

  // Misc
  overlay: "rgba(0, 0, 0, 0.5)",
} as const;

// ---------------------------------------------------------------------------
// Gradients — keep subtle; only for accent elements, not full cards
// ---------------------------------------------------------------------------
export const Gradients = {
  // Very subtle hero wash (barely visible)
  heroWash: ["rgba(0, 245, 160, 0.04)", "transparent"] as const,
  // CTA button gradient
  accent: ["#00F5A0", "#00D9F5"] as const,
  // Live indicator
  live: ["#FF4D4F", "#FF6B35"] as const,
  // Tab bar fade
  tabBar: ["transparent", "rgba(10, 22, 40, 0.9)", "#0A1628"] as const,
  // Status accents (very subtle card top borders)
  gold: ["#FFD700", "#FF8C00"] as const,
  purple: ["#8B5CF6", "#6366F1"] as const,
  blue: ["#3B82F6", "#2563EB"] as const,
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
// Border radii (matched to web — 8px default, 12px cards)
// ---------------------------------------------------------------------------
export const Radius = {
  xs: 4,
  sm: 8,     // buttons, small elements
  md: 12,    // cards (matched to web)
  lg: 16,
  xl: 24,    // pills / badges
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Font sizes
// ---------------------------------------------------------------------------
export const Font = {
  xs: 11,
  sm: 13,
  md: 14,    // web body: 14px
  lg: 16,
  xl: 18,    // web card heading: 18px
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
} as const;

// ---------------------------------------------------------------------------
// Shadows — subtle, matching dark theme
// ---------------------------------------------------------------------------
export const Shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

// ---------------------------------------------------------------------------
// Card mixin — matches web feature cards
// ---------------------------------------------------------------------------
export const card = {
  backgroundColor: Colors.bgSurface,
  borderRadius: Radius.md,
  borderWidth: 1,
  borderColor: Colors.border,
} as const;
