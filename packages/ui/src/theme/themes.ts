import { createTheme } from "tamagui";
import { tokens } from "./tokens";

/**
 * tami·draft — Light theme
 * Warm off-white backgrounds, earthy green accents.
 */
export const light = createTheme({
  background: tokens.color.warmWhite,
  backgroundHover: tokens.color.cream,
  backgroundPress: tokens.color.sand,
  backgroundFocus: tokens.color.cream,

  color: "#1A1A1A",
  colorHover: "#000000",
  colorPress: "#333333",
  colorFocus: "#1A1A1A",

  // Surface colors (cards, sheets)
  backgroundSurface: tokens.color.white,
  backgroundSurfaceHover: tokens.color.cream,

  // Surface alt (tab containers, input bg)
  backgroundSurfaceAlt: "#EFECEA",

  // Accent
  accentBackground: tokens.color.accent,
  accentColor: tokens.color.white,

  // Borders
  borderColor: tokens.color.sand,
  borderColorHover: tokens.color.sandDark,
  borderColorFocus: tokens.color.accent,

  // Shadows
  shadowColor: "rgba(0,0,0,0.06)",

  // Placeholders
  placeholderColor: "#B5B0A8",

  // Text variants
  colorSecondary: "#8A8580",
  colorMuted: "#B5B0A8",

  // Semantic accents
  colorAccent: tokens.color.accent,
  colorAccentHover: tokens.color.accentHover,
  colorAccentLight: tokens.color.accentLight,
  colorCricket: tokens.color.cricket,
  colorCricketLight: tokens.color.cricketLight,
  colorHatch: tokens.color.hatch,
  colorOverlay: "rgba(0,0,0,0.35)",

  // Role colors
  roleBATBg: tokens.color.roleBatBg,
  roleBATText: tokens.color.roleBatText,
  roleBATLightBg: tokens.color.roleBatLightBg,
  roleBATLightText: tokens.color.roleBatLightText,
  roleBOWLBg: tokens.color.roleBowlBg,
  roleBOWLText: tokens.color.roleBowlText,
  roleBOWLLightBg: tokens.color.roleBowlLightBg,
  roleBOWLLightText: tokens.color.roleBowlLightText,
  roleARBg: tokens.color.roleArBg,
  roleARText: tokens.color.roleArText,
  roleARLightBg: tokens.color.roleArLightBg,
  roleARLightText: tokens.color.roleArLightText,
  roleWKBg: tokens.color.roleWkBg,
  roleWKText: tokens.color.roleWkText,
  roleWKLightBg: tokens.color.roleWkLightBg,
  roleWKLightText: tokens.color.roleWkLightText,
});

/**
 * tami·draft — Dark theme
 * Deep charcoal-green backgrounds, lighter green accents.
 */
export const dark = createTheme({
  background: tokens.color.charcoalDeep,
  backgroundHover: tokens.color.charcoal,
  backgroundPress: tokens.color.charcoalLight,
  backgroundFocus: tokens.color.charcoal,

  color: "#EDECEA",
  colorHover: "#FFFFFF",
  colorPress: "#CCCCCC",
  colorFocus: "#EDECEA",

  backgroundSurface: tokens.color.charcoal,
  backgroundSurfaceHover: tokens.color.charcoalLight,

  backgroundSurfaceAlt: tokens.color.charcoalLight,

  accentBackground: tokens.color.accentHover,
  accentColor: tokens.color.charcoalDeep,

  borderColor: tokens.color.charcoalBorder,
  borderColorHover: "#444543",
  borderColorFocus: tokens.color.accentHover,

  shadowColor: "rgba(0,0,0,0.3)",

  placeholderColor: "#5E5D5A",

  colorSecondary: "#9A9894",
  colorMuted: "#5E5D5A",

  colorAccent: tokens.color.accentHover,
  colorAccentHover: "#7BCFA0",
  colorAccentLight: tokens.color.accentLightDark,
  colorCricket: tokens.color.cricketDark,
  colorCricketLight: tokens.color.cricketLightDark,
  colorHatch: tokens.color.hatchDark,
  colorOverlay: "rgba(0,0,0,0.55)",

  // Role colors (dark mode - muted)
  roleBATBg: "#9A7225",
  roleBATText: "#FDF5E6",
  roleBATLightBg: "#2A2210",
  roleBATLightText: "#D4A43D",
  roleBOWLBg: "#2E7A52",
  roleBOWLText: "#E8F5EE",
  roleBOWLLightBg: "#1A2E22",
  roleBOWLLightText: "#5DB882",
  roleARBg: "#3A4A95",
  roleARText: "#D8DEF5",
  roleARLightBg: "#1A1E30",
  roleARLightText: "#8090D0",
  roleWKBg: "#634A8A",
  roleWKText: "#E8DEF5",
  roleWKLightBg: "#221A30",
  roleWKLightText: "#A088CC",
});

export const allThemes = {
  dark,
  light,
};
