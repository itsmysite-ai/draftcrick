/**
 * Sport-specific theme tokens.
 *
 * Each sport defines its own accent palette, brand colors, and role colors
 * for both light and dark modes. These are used by the theme factories
 * in themes.ts to generate per-sport Tamagui sub-themes.
 */

export interface RoleColorSet {
  bg: string;
  text: string;
  lightBg: string;
  lightText: string;
}

export interface SportThemeTokens {
  /** Primary accent color (buttons, links, active states) */
  accent: string;
  accentHover: string;
  accentDark: string;
  accentLight: string; // tinted bg in light mode
  accentLightDark: string; // tinted bg in dark mode

  /** Sport brand color (decorative, badges) */
  sportBrand: string;
  sportBrandLight: string;
  sportBrandDark: string;
  sportBrandLightDark: string;

  /** Role colors per RoleToken — light mode */
  rolesLight: Record<string, RoleColorSet>;
  /** Role colors per RoleToken — dark mode */
  rolesDark: Record<string, RoleColorSet>;
}

// ─── Cricket ────────────────────────────────────────────────────
export const CRICKET_TOKENS: SportThemeTokens = {
  accent: "#3D9968",
  accentHover: "#5DB882",
  accentDark: "#2A7A5A",
  accentLight: "#E8F5EE",
  accentLightDark: "#1A2E22",

  sportBrand: "#B8862D",
  sportBrandLight: "#FDF5E6",
  sportBrandDark: "#D4A43D",
  sportBrandLightDark: "#2A2210",

  rolesLight: {
    BAT: { bg: "#B8862D", text: "#FDF5E6", lightBg: "#FDF5E6", lightText: "#B8862D" },
    BOWL: { bg: "#3D9968", text: "#E8F5EE", lightBg: "#E8F5EE", lightText: "#3D9968" },
    AR: { bg: "#4A5DB5", text: "#E8ECF8", lightBg: "#EEF0F8", lightText: "#4A5DB5" },
    WK: { bg: "#7B5EA7", text: "#F0ECF8", lightBg: "#F0EEF5", lightText: "#7B5EA7" },
  },
  rolesDark: {
    BAT: { bg: "#9A7225", text: "#FDF5E6", lightBg: "#2A2210", lightText: "#D4A43D" },
    BOWL: { bg: "#2E7A52", text: "#E8F5EE", lightBg: "#1A2E22", lightText: "#5DB882" },
    AR: { bg: "#3A4A95", text: "#D8DEF5", lightBg: "#1A1E30", lightText: "#8090D0" },
    WK: { bg: "#634A8A", text: "#E8DEF5", lightBg: "#221A30", lightText: "#A088CC" },
  },
};

// ─── F1 ─────────────────────────────────────────────────────────
export const F1_TOKENS: SportThemeTokens = {
  accent: "#E10600", // Racing Red
  accentHover: "#FF2D28",
  accentDark: "#B80500",
  accentLight: "#FDE8E8", // light mode red tint
  accentLightDark: "#2E1010", // dark mode red tint

  sportBrand: "#15151E", // Carbon Black
  sportBrandLight: "#E8E8EA",
  sportBrandDark: "#2A2A35",
  sportBrandLightDark: "#15151E",

  rolesLight: {
    DRV: { bg: "#E10600", text: "#FFFFFF", lightBg: "#FDE8E8", lightText: "#B80500" },
    CON: { bg: "#15151E", text: "#E8E8EA", lightBg: "#E8E8EA", lightText: "#15151E" },
    TP: { bg: "#1E40AF", text: "#DBEAFE", lightBg: "#EFF6FF", lightText: "#1E40AF" },
  },
  rolesDark: {
    DRV: { bg: "#CC0500", text: "#FFFFFF", lightBg: "#2E1010", lightText: "#FF4D48" },
    CON: { bg: "#2A2A35", text: "#E8E8EA", lightBg: "#1A1A22", lightText: "#9A9AA0" },
    TP: { bg: "#1E3A8A", text: "#BFDBFE", lightBg: "#0F1A30", lightText: "#60A5FA" },
  },
};

/** Map of sport key → tokens */
export const SPORT_THEME_TOKENS: Record<string, SportThemeTokens> = {
  cricket: CRICKET_TOKENS,
  f1: F1_TOKENS,
};
