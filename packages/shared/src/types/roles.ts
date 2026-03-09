import type { CricketRole, F1Role, PlayerRole } from "./match";

// Role tokens — uppercase short codes used by theme system and design system
export type CricketRoleToken = "BAT" | "BOWL" | "AR" | "WK";
export type F1RoleToken = "DRV" | "CON" | "TP";
export type RoleToken = CricketRoleToken | F1RoleToken;

// Mapping from role value to display token
export const ROLE_TO_TOKEN: Record<PlayerRole, RoleToken> = {
  batsman: "BAT",
  bowler: "BOWL",
  all_rounder: "AR",
  wicket_keeper: "WK",
  driver: "DRV",
  constructor: "CON",
  team_principal: "TP",
};

// Reverse mapping: token → role value
export const TOKEN_TO_ROLE: Record<RoleToken, PlayerRole> = {
  BAT: "batsman",
  BOWL: "bowler",
  AR: "all_rounder",
  WK: "wicket_keeper",
  DRV: "driver",
  CON: "constructor",
  TP: "team_principal",
};

// Cricket role helpers
export const CRICKET_ROLES: CricketRole[] = ["batsman", "bowler", "all_rounder", "wicket_keeper"];
export const CRICKET_ROLE_TOKENS: CricketRoleToken[] = ["BAT", "BOWL", "AR", "WK"];

// F1 role helpers
export const F1_ROLES: F1Role[] = ["driver", "constructor", "team_principal"];
export const F1_ROLE_TOKENS: F1RoleToken[] = ["DRV", "CON", "TP"];
