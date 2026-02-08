import { createTheme } from "tamagui";
import { tokens } from "./tokens";

/**
 * Dark theme — default (better for sports viewing at night)
 */
export const dark = createTheme({
  background: tokens.color.navy,
  backgroundHover: tokens.color.navyLight,
  backgroundPress: tokens.color.navyLighter,
  backgroundFocus: tokens.color.navyLight,

  color: tokens.color.white,
  colorHover: tokens.color.warmWhite,
  colorPress: tokens.color.gray200,
  colorFocus: tokens.color.white,

  // Surface colors (cards, sheets)
  backgroundSurface: tokens.color.charcoal,
  backgroundSurfaceHover: tokens.color.charcoalLight,

  // Accent
  accentBackground: tokens.color.green,
  accentColor: tokens.color.navy,

  // Borders
  borderColor: tokens.color.charcoalLight,
  borderColorHover: tokens.color.gray600,
  borderColorFocus: tokens.color.green,

  // Shadows
  shadowColor: "rgba(0, 0, 0, 0.4)",

  // Placeholders
  placeholderColor: tokens.color.gray500,
});

/**
 * Light theme
 */
export const light = createTheme({
  background: tokens.color.warmWhite,
  backgroundHover: tokens.color.gray50,
  backgroundPress: tokens.color.gray100,
  backgroundFocus: tokens.color.gray50,

  color: tokens.color.navy,
  colorHover: tokens.color.navyLight,
  colorPress: tokens.color.gray800,
  colorFocus: tokens.color.navy,

  backgroundSurface: tokens.color.white,
  backgroundSurfaceHover: tokens.color.gray50,

  accentBackground: tokens.color.green,
  accentColor: tokens.color.navy,

  borderColor: tokens.color.gray200,
  borderColorHover: tokens.color.gray300,
  borderColorFocus: tokens.color.green,

  shadowColor: "rgba(0, 0, 0, 0.08)",

  placeholderColor: tokens.color.gray400,
});

/**
 * Comfort Dark — enhanced contrast (WCAG AAA)
 */
export const comfortDark = createTheme({
  ...dark,
  // Higher contrast text
  color: tokens.color.white,
  // Larger, bolder accent
  accentBackground: tokens.color.greenLight,
  // More visible borders
  borderColor: tokens.color.gray500,
  borderColorFocus: tokens.color.greenLight,
});

/**
 * Comfort Light — enhanced contrast (WCAG AAA)
 */
export const comfortLight = createTheme({
  ...light,
  color: tokens.color.black,
  accentBackground: tokens.color.greenDark,
  borderColor: tokens.color.gray400,
  borderColorFocus: tokens.color.greenDark,
});

export const allThemes = {
  dark,
  light,
  comfortDark,
  comfortLight,
};
