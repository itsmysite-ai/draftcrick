import { inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getFromHotCache, setHotCache } from "./sports-cache";
import { getLogger } from "../lib/logger";

const log = getLogger("team-solver");

interface PlayerInput {
  id: string;
  name: string;
  team: string;
  role: string;
  credits: number;
  projectedPoints: number;
  nationality?: string;
}

export interface OverseasRule {
  enabled: boolean;
  hostCountry: string;
  maxOverseas: number;
}

export interface SolverPreferences {
  /** "balanced" = default, "batting_heavy" = boost batsmen, "bowling_heavy" = boost bowlers */
  playStyle: "balanced" | "batting_heavy" | "bowling_heavy";
  /** "safe" = favor consistent players, "risky" = favor high-ceiling players, "moderate" = default */
  riskLevel: "safe" | "moderate" | "risky";
  /** "stars" = spend on premium picks, "value" = find budget gems, "mixed" = default */
  budgetStrategy: "stars" | "value" | "mixed";
  /** "safe_captain" = highest projected, "differential" = pick #3-5 ranked player as C */
  captainStyle: "safe_captain" | "differential";
  /** Optional: team to favor (more players from this team) */
  teamBias?: string;
  /** Optional: preferred captain player ID */
  preferredCaptainId?: string;
}

interface SolvedTeamPlayer extends PlayerInput {
  isCaptain: boolean;
  isViceCaptain: boolean;
  contribution: number; // projected pts × multiplier
}

export interface SolvedTeam {
  players: SolvedTeamPlayer[];
  totalCredits: number;
  totalProjectedPoints: number;
  captain: string;
  viceCaptain: string;
}

// Team composition constraints
const CONSTRAINTS = {
  totalPlayers: 11,
  maxBudget: 100,
  maxFromOneTeam: 7,
  minFromOneTeam: 4,
  roles: {
    wicket_keeper: { min: 1, max: 4 },
    batsman: { min: 3, max: 6 },
    all_rounder: { min: 1, max: 4 },
    bowler: { min: 2, max: 5 },
  } as Record<string, { min: number; max: number }>,
};

/**
 * Auto-pick the optimal 11 players within budget using projected points.
 * Uses greedy algorithm with constraint satisfaction.
 */
export async function solveOptimalTeam(
  db: NodePgDatabase<any>,
  matchId: string,
  teamA: string,
  teamB: string,
  playerInputs: PlayerInput[],
  preferences?: SolverPreferences,
  overseasRule?: OverseasRule,
): Promise<SolvedTeam | null> {
  const prefs = preferences ?? { playStyle: "balanced", riskLevel: "moderate", budgetStrategy: "mixed", captainStyle: "safe_captain" };
  const prefKey = `${prefs.playStyle}:${prefs.riskLevel}:${prefs.budgetStrategy ?? "mixed"}:${prefs.captainStyle ?? "safe_captain"}:${prefs.teamBias ?? "none"}:${prefs.preferredCaptainId ?? "none"}`;
  const cacheKey = `team-solver:v2:${matchId}:${prefKey}`;
  const cached = await getFromHotCache<SolvedTeam>(cacheKey);
  if (cached) return cached;

  try {
    if (playerInputs.length < 11) {
      log.warn({ count: playerInputs.length }, "Not enough players for team solver");
      return null;
    }

    // Normalize roles and apply preference-based adjustments
    const players = playerInputs.map((p) => ({
      ...p,
      role: normalizeRole(p.role),
      projectedPoints: applyPreferenceBoost(p, prefs),
    }));

    const team = greedySolve(players, teamA, teamB, prefs, overseasRule);
    if (!team) return null;

    await setHotCache(cacheKey, team, 1800);
    return team;
  } catch (err) {
    log.error({ err }, "Team solver failed");
    return null;
  }
}

/**
 * Adjust projected points based on user preferences.
 * This creates differentiated teams for different play styles.
 */
function applyPreferenceBoost(player: PlayerInput, prefs: SolverPreferences): number {
  let pts = player.projectedPoints;
  const role = normalizeRole(player.role);

  // Play style boosts
  if (prefs.playStyle === "batting_heavy") {
    if (role === "batsman") pts *= 1.25;
    else if (role === "wicket_keeper") pts *= 1.15;
    else if (role === "bowler") pts *= 0.85;
  } else if (prefs.playStyle === "bowling_heavy") {
    if (role === "bowler") pts *= 1.25;
    else if (role === "all_rounder") pts *= 1.1;
    else if (role === "batsman") pts *= 0.85;
  }

  // Risk level: add variance to differentiate
  if (prefs.riskLevel === "risky") {
    // Favor high-ceiling players (amplify projections)
    pts = pts > 20 ? pts * 1.2 : pts * 0.8;
  } else if (prefs.riskLevel === "safe") {
    // Flatten projections — favor mid-range reliable picks
    const avg = 25;
    pts = pts + (avg - pts) * 0.3;
  }

  // Budget strategy: affects how credits map to value
  if (prefs.budgetStrategy === "stars") {
    // Premium players (high credits) get boosted — spend big on star power
    if (player.credits >= 9) pts *= 1.2;
    else if (player.credits <= 6) pts *= 0.85;
  } else if (prefs.budgetStrategy === "value") {
    // Budget picks get boosted — find hidden gems
    if (player.credits <= 7) pts *= 1.2;
    else if (player.credits >= 9.5) pts *= 0.85;
  }

  // Team bias boost
  if (prefs.teamBias && player.team.toLowerCase() === prefs.teamBias.toLowerCase()) {
    pts *= 1.15;
  }

  return pts;
}

function normalizeRole(role: string): string {
  const r = role.toLowerCase().replace(/[-\s]/g, "_");
  if (r.includes("keeper") || r === "wk") return "wicket_keeper";
  if (r.includes("all") || r === "ar") return "all_rounder";
  if (r.includes("bowl")) return "bowler";
  return "batsman";
}

function greedySolve(
  players: PlayerInput[],
  teamA: string,
  teamB: string,
  prefs?: SolverPreferences,
  overseasRule?: OverseasRule,
): SolvedTeam | null {
  const maxOverseas = overseasRule?.enabled ? overseasRule.maxOverseas : Infinity;
  const hostCountry = overseasRule?.hostCountry?.toLowerCase() ?? "";

  const isOverseas = (p: PlayerInput): boolean => {
    if (!overseasRule?.enabled || !p.nationality) return false;
    return p.nationality.toLowerCase() !== hostCountry;
  };

  // Sort by value ratio (projected points / credits), descending
  const sorted = [...players].sort((a, b) => {
    const ratioA = a.credits > 0 ? a.projectedPoints / a.credits : 0;
    const ratioB = b.credits > 0 ? b.projectedPoints / b.credits : 0;
    return ratioB - ratioA;
  });

  const selected: PlayerInput[] = [];
  let budget = CONSTRAINTS.maxBudget;
  const roleCounts: Record<string, number> = {};
  const teamCounts: Record<string, number> = {};
  let overseasCount = 0;

  const canAdd = (p: PlayerInput): boolean => {
    if (p.credits > budget) return false;
    const role = normalizeRole(p.role);
    const maxForRole = CONSTRAINTS.roles[role]?.max ?? 6;
    if ((roleCounts[role] ?? 0) >= maxForRole) return false;
    const pTeam = p.team.toLowerCase();
    if ((teamCounts[pTeam] ?? 0) >= CONSTRAINTS.maxFromOneTeam) return false;
    if (isOverseas(p) && overseasCount >= maxOverseas) return false;
    return true;
  };

  const addPlayer = (p: PlayerInput) => {
    selected.push(p);
    budget -= p.credits;
    const role = normalizeRole(p.role);
    roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    const pTeam = p.team.toLowerCase();
    teamCounts[pTeam] = (teamCounts[pTeam] ?? 0) + 1;
    if (isOverseas(p)) overseasCount++;
  };

  // Phase 1: Fill minimum role requirements
  for (const [role, { min }] of Object.entries(CONSTRAINTS.roles)) {
    const rolePlayers = sorted.filter(
      (p) => normalizeRole(p.role) === role && !selected.includes(p),
    );
    const toAdd = rolePlayers
      .sort((a, b) => b.projectedPoints - a.projectedPoints);

    let added = 0;
    for (const p of toAdd) {
      if (added >= min) break;
      if (!canAdd(p)) continue;
      addPlayer(p);
      added++;
    }
  }

  // Phase 2: Fill remaining slots with best value players
  const candidates = sorted.filter((p) => !selected.includes(p));

  for (const p of candidates) {
    if (selected.length >= CONSTRAINTS.totalPlayers) break;
    if (!canAdd(p)) continue;
    addPlayer(p);
  }

  if (selected.length < CONSTRAINTS.totalPlayers) {
    log.warn("Could not fill 11 players within constraints");
    return null;
  }

  // Check min team constraint
  const teamALower = teamA.toLowerCase();
  const teamBLower = teamB.toLowerCase();
  const countA = selected.filter((p) => p.team.toLowerCase() === teamALower).length;
  const countB = selected.filter((p) => p.team.toLowerCase() === teamBLower).length;
  if (countA < CONSTRAINTS.minFromOneTeam || countB < CONSTRAINTS.minFromOneTeam) {
    log.warn({ countA, countB }, "Team balance constraint not met");
    // Still return — best effort
  }

  // Pick captain and vice-captain
  const byPoints = [...selected].sort((a, b) => b.projectedPoints - a.projectedPoints);
  let captain = byPoints[0]!;
  let viceCaptain = byPoints[1]!;

  // Override captain if user has a preference and that player is in the team
  if (prefs?.preferredCaptainId) {
    const preferred = selected.find((p) => p.id === prefs.preferredCaptainId);
    if (preferred) {
      captain = preferred;
      viceCaptain = byPoints.find((p) => p.id !== captain.id)!;
    }
  } else if (prefs?.captainStyle === "differential") {
    // Differential captain: pick 3rd-5th ranked player as C (unexpected pick)
    const diffIndex = Math.min(2 + Math.floor(Math.random() * 3), byPoints.length - 2);
    captain = byPoints[diffIndex]!;
    viceCaptain = byPoints[0]!; // best player becomes VC instead
  }

  const solvedPlayers: SolvedTeamPlayer[] = selected.map((p) => ({
    ...p,
    isCaptain: p.id === captain.id,
    isViceCaptain: p.id === viceCaptain.id,
    contribution:
      p.projectedPoints * (p.id === captain.id ? 2 : p.id === viceCaptain.id ? 1.5 : 1),
  }));

  const totalProjected = solvedPlayers.reduce((s, p) => s + p.contribution, 0);

  return {
    players: solvedPlayers,
    totalCredits: round(CONSTRAINTS.maxBudget - budget),
    totalProjectedPoints: round(totalProjected),
    captain: captain.name,
    viceCaptain: viceCaptain.name,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
