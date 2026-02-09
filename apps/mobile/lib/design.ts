/**
 * DraftCrick Design System
 * Cutting-edge dark-first design with gradients, glassmorphism, and vibrant accents.
 */

export const Colors = {
  // Backgrounds
  bg: "#080C14",
  bgCard: "rgba(255, 255, 255, 0.04)",
  bgCardHover: "rgba(255, 255, 255, 0.07)",
  bgElevated: "#0F1522",
  bgSurface: "#121A2A",

  // Primary accent
  accent: "#00F5A0",
  accentDark: "#00C880",
  accentMuted: "rgba(0, 245, 160, 0.15)",
  accentGlow: "rgba(0, 245, 160, 0.25)",

  // Secondary colors
  cyan: "#00D9F5",
  gold: "#FFD700",
  amber: "#FFB800",
  purple: "#8B5CF6",
  blue: "#3B82F6",
  pink: "#EC4899",

  // Status
  red: "#FF4D4F",
  redMuted: "rgba(255, 77, 79, 0.15)",
  redGlow: "rgba(255, 77, 79, 0.3)",
  green: "#10B981",
  greenMuted: "rgba(16, 185, 129, 0.15)",

  // Text
  text: "#FFFFFF",
  textSecondary: "rgba(255, 255, 255, 0.6)",
  textTertiary: "rgba(255, 255, 255, 0.35)",
  textInverse: "#080C14",

  // Borders
  border: "rgba(255, 255, 255, 0.06)",
  borderLight: "rgba(255, 255, 255, 0.1)",
  borderAccent: "rgba(0, 245, 160, 0.2)",

  // Overlay
  overlay: "rgba(0, 0, 0, 0.5)",
  glass: "rgba(255, 255, 255, 0.03)",
} as const;

export const Gradients = {
  primary: ["#00F5A0", "#00D9F5"] as const,
  primaryVertical: ["#00F5A0", "#00C880"] as const,
  hot: ["#FF6B6B", "#FF8E53"] as const,
  live: ["#FF4D4F", "#FF6B35"] as const,
  gold: ["#FFD700", "#FF8C00"] as const,
  purple: ["#8B5CF6", "#6366F1"] as const,
  blue: ["#3B82F6", "#2563EB"] as const,
  dark: ["#0F1522", "#080C14"] as const,
  hero: ["rgba(0, 245, 160, 0.08)", "rgba(0, 217, 245, 0.02)", "transparent"] as const,
  cardShine: ["rgba(255, 255, 255, 0.05)", "transparent", "rgba(255, 255, 255, 0.02)"] as const,
  tabBar: ["transparent", "rgba(8, 12, 20, 0.95)", "#080C14"] as const,
} as const;

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

export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
  full: 9999,
} as const;

export const Font = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
} as const;

export const Shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  }),
} as const;

/** Glass card style mixin */
export const glassCard = {
  backgroundColor: Colors.bgCard,
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: Radius.lg,
} as const;

/** Elevated glass card mixin */
export const elevatedCard = {
  ...glassCard,
  backgroundColor: Colors.bgSurface,
  borderColor: Colors.borderLight,
  ...Shadow.md,
} as const;
