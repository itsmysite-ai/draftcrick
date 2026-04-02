// Tamagui v2: themes are plain objects (createTheme was removed)
import { tokens } from "./tokens";

/**
 * All role color keys that a theme must define.
 * Both cricket and F1 role keys are present in every theme —
 * the "inactive" sport's roles get transparent fallbacks.
 */
const TRANSPARENT = "transparent";

// ─── Cricket role colors ───────────────────────────────────────

const cricketRolesLight = {
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
};

const cricketRolesDark = {
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
};

// ─── F1 role colors ────────────────────────────────────────────

const f1RolesLight = {
  roleDRVBg: tokens.color.roleDrvBg,
  roleDRVText: tokens.color.roleDrvText,
  roleDRVLightBg: tokens.color.roleDrvLightBg,
  roleDRVLightText: tokens.color.roleDrvLightText,
  roleCONBg: tokens.color.roleConBg,
  roleCONText: tokens.color.roleConText,
  roleCONLightBg: tokens.color.roleConLightBg,
  roleCONLightText: tokens.color.roleConLightText,
  roleTPBg: tokens.color.roleTpBg,
  roleTPText: tokens.color.roleTpText,
  roleTPLightBg: tokens.color.roleTpLightBg,
  roleTPLightText: tokens.color.roleTpLightText,
};

const f1RolesDark = {
  roleDRVBg: tokens.color.roleDrvBgDark,
  roleDRVText: "#FFFFFF",
  roleDRVLightBg: tokens.color.roleDrvLightBgDark,
  roleDRVLightText: tokens.color.roleDrvLightTextDark,
  roleCONBg: tokens.color.roleConBgDark,
  roleCONText: "#E8E8EA",
  roleCONLightBg: tokens.color.roleConLightBgDark,
  roleCONLightText: tokens.color.roleConLightTextDark,
  roleTPBg: tokens.color.roleTpBgDark,
  roleTPText: tokens.color.roleTpTextDark,
  roleTPLightBg: tokens.color.roleTpLightBgDark,
  roleTPLightText: tokens.color.roleTpLightTextDark,
};

// Transparent fallbacks for roles not in the active sport
const transparentCricketRoles = {
  roleBATBg: TRANSPARENT, roleBATText: TRANSPARENT, roleBATLightBg: TRANSPARENT, roleBATLightText: TRANSPARENT,
  roleBOWLBg: TRANSPARENT, roleBOWLText: TRANSPARENT, roleBOWLLightBg: TRANSPARENT, roleBOWLLightText: TRANSPARENT,
  roleARBg: TRANSPARENT, roleARText: TRANSPARENT, roleARLightBg: TRANSPARENT, roleARLightText: TRANSPARENT,
  roleWKBg: TRANSPARENT, roleWKText: TRANSPARENT, roleWKLightBg: TRANSPARENT, roleWKLightText: TRANSPARENT,
};

const transparentF1Roles = {
  roleDRVBg: TRANSPARENT, roleDRVText: TRANSPARENT, roleDRVLightBg: TRANSPARENT, roleDRVLightText: TRANSPARENT,
  roleCONBg: TRANSPARENT, roleCONText: TRANSPARENT, roleCONLightBg: TRANSPARENT, roleCONLightText: TRANSPARENT,
  roleTPBg: TRANSPARENT, roleTPText: TRANSPARENT, roleTPLightBg: TRANSPARENT, roleTPLightText: TRANSPARENT,
};

// ─── Shared base theme values ──────────────────────────────────

const lightBase = {
  background: tokens.color.warmWhite,
  backgroundHover: tokens.color.cream,
  backgroundPress: tokens.color.sand,
  backgroundFocus: tokens.color.cream,
  color: "#1A1A1A",
  colorHover: "#000000",
  colorPress: "#333333",
  colorFocus: "#1A1A1A",
  backgroundSurface: tokens.color.white,
  backgroundSurfaceHover: tokens.color.cream,
  backgroundSurfaceAlt: "#EFECEA",
  borderColor: tokens.color.sand,
  borderColorHover: tokens.color.sandDark,
  shadowColor: "rgba(0,0,0,0.06)",
  placeholderColor: "#B5B0A8",
  colorSecondary: "#8A8580",
  colorMuted: "#B5B0A8",
  colorOverlay: "rgba(0,0,0,0.35)",
};

const darkBase = {
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
  borderColor: tokens.color.charcoalBorder,
  borderColorHover: "#444543",
  shadowColor: "rgba(0,0,0,0.3)",
  placeholderColor: "#6E6D6A",
  colorSecondary: "#9A9894",
  colorMuted: "#8A8985",
  colorOverlay: "rgba(0,0,0,0.55)",
};

// ─── Default themes (= cricket, backwards compatible) ──────────

/**
 * draftplay.ai — Light theme (default = cricket)
 * Warm off-white backgrounds, earthy green accents.
 */
export const light = ({
  ...lightBase,
  accentBackground: tokens.color.accent,
  accentColor: tokens.color.white,
  borderColorFocus: tokens.color.accent,
  colorAccent: tokens.color.accent,
  colorAccentHover: tokens.color.accentHover,
  colorAccentLight: tokens.color.accentLight,
  colorCricket: tokens.color.cricket,
  colorCricketLight: tokens.color.cricketLight,
  colorHatch: tokens.color.hatch,
  colorSportBrand: tokens.color.cricket,
  colorSportBrandLight: tokens.color.cricketLight,
  ...cricketRolesLight,
  ...f1RolesLight, // F1 roles still available for reference
});

/**
 * draftplay.ai — Dark theme (default = cricket)
 * Deep charcoal-green backgrounds, lighter green accents.
 */
export const dark = ({
  ...darkBase,
  accentBackground: tokens.color.accentHover,
  accentColor: tokens.color.charcoalDeep,
  borderColorFocus: tokens.color.accentHover,
  colorAccent: tokens.color.accentHover,
  colorAccentHover: "#7BCFA0",
  colorAccentLight: tokens.color.accentLightDark,
  colorCricket: tokens.color.cricketDark,
  colorCricketLight: tokens.color.cricketLightDark,
  colorHatch: tokens.color.hatchDark,
  colorSportBrand: tokens.color.cricketDark,
  colorSportBrandLight: tokens.color.cricketLightDark,
  ...cricketRolesDark,
  ...f1RolesDark, // F1 roles still available for reference
});

// ─── Cricket sub-themes (explicit) ─────────────────────────────

export const cricket_light = ({
  ...lightBase,
  accentBackground: tokens.color.accent,
  accentColor: tokens.color.white,
  borderColorFocus: tokens.color.accent,
  colorAccent: tokens.color.accent,
  colorAccentHover: tokens.color.accentHover,
  colorAccentLight: tokens.color.accentLight,
  colorCricket: tokens.color.cricket,
  colorCricketLight: tokens.color.cricketLight,
  colorHatch: tokens.color.hatch,
  colorSportBrand: tokens.color.cricket,
  colorSportBrandLight: tokens.color.cricketLight,
  ...cricketRolesLight,
  ...transparentF1Roles,
});

export const cricket_dark = ({
  ...darkBase,
  accentBackground: tokens.color.accentHover,
  accentColor: tokens.color.charcoalDeep,
  borderColorFocus: tokens.color.accentHover,
  colorAccent: tokens.color.accentHover,
  colorAccentHover: "#7BCFA0",
  colorAccentLight: tokens.color.accentLightDark,
  colorCricket: tokens.color.cricketDark,
  colorCricketLight: tokens.color.cricketLightDark,
  colorHatch: tokens.color.hatchDark,
  colorSportBrand: tokens.color.cricketDark,
  colorSportBrandLight: tokens.color.cricketLightDark,
  ...cricketRolesDark,
  ...transparentF1Roles,
});

// ─── F1 sub-themes ─────────────────────────────────────────────

export const f1_light = ({
  // F1 light — cool silver/steel instead of warm whites
  background: "#F0F1F5",
  backgroundHover: "#E6E8EE",
  backgroundPress: "#DCDEE6",
  backgroundFocus: "#E6E8EE",
  color: "#15151E",
  colorHover: "#000000",
  colorPress: "#2A2A35",
  colorFocus: "#15151E",
  backgroundSurface: "#FFFFFF",
  backgroundSurfaceHover: "#ECEDF2",
  backgroundSurfaceAlt: "#E6E8EE",
  borderColor: "#D0D2DA",
  borderColorHover: "#B8BAC5",
  shadowColor: "rgba(0,0,30,0.08)",
  placeholderColor: "#9A9BA5",
  colorSecondary: "#6A6B78",
  colorMuted: "#9A9BA5",
  colorOverlay: "rgba(0,0,20,0.35)",

  accentBackground: tokens.color.f1Red,
  accentColor: tokens.color.white,
  borderColorFocus: tokens.color.f1Red,
  colorAccent: tokens.color.f1Red,
  colorAccentHover: tokens.color.f1RedHover,
  colorAccentLight: "#FCE8E8",
  colorCricket: tokens.color.f1Carbon,
  colorCricketLight: "#E8E8EC",
  colorHatch: tokens.color.f1Red,
  colorSportBrand: tokens.color.f1Carbon,
  colorSportBrandLight: "#E8E8EC",
  ...transparentCricketRoles,
  ...f1RolesLight,
});

export const f1_dark = ({
  // F1 dark — deep carbon fiber with blue-steel undertone
  background: "#0C0C14",
  backgroundHover: "#141420",
  backgroundPress: "#1C1C2A",
  backgroundFocus: "#141420",
  color: "#E8E8F0",
  colorHover: "#FFFFFF",
  colorPress: "#CCCCDD",
  colorFocus: "#E8E8F0",
  backgroundSurface: "#161622",
  backgroundSurfaceHover: "#1E1E2C",
  backgroundSurfaceAlt: "#1E1E2C",
  borderColor: "#28283A",
  borderColorHover: "#38384A",
  shadowColor: "rgba(0,0,30,0.4)",
  placeholderColor: "#6A6A82",
  colorSecondary: "#9A9AB2",
  colorMuted: "#7A7A95",
  colorOverlay: "rgba(0,0,20,0.6)",

  accentBackground: tokens.color.f1RedHover,
  accentColor: "#FFFFFF",
  borderColorFocus: tokens.color.f1RedHover,
  colorAccent: tokens.color.f1RedHover,
  colorAccentHover: "#FF5550",
  colorAccentLight: "#2A1018",
  colorCricket: "#8888A0",
  colorCricketLight: "#1C1C2A",
  colorHatch: tokens.color.f1RedHover,
  colorSportBrand: "#8888A0",
  colorSportBrandLight: "#1C1C2A",
  ...transparentCricketRoles,
  ...f1RolesDark,
});

// ─── Exports ───────────────────────────────────────────────────

export const allThemes = {
  light,
  dark,
  cricket_light,
  cricket_dark,
  f1_light,
  f1_dark,
};
