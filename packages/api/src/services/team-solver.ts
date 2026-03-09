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
): Promise<SolvedTeam | null> {
  const cacheKey = `team-solver:${matchId}`;
  const cached = await getFromHotCache<SolvedTeam>(cacheKey);
  if (cached) return cached;

  try {
    if (playerInputs.length < 11) {
      log.warn({ count: playerInputs.length }, "Not enough players for team solver");
      return null;
    }

    // Normalize roles
    const players = playerInputs.map((p) => ({
      ...p,
      role: normalizeRole(p.role),
    }));

    const team = greedySolve(players, teamA, teamB);
    if (!team) return null;

    await setHotCache(cacheKey, team, 1800);
    return team;
  } catch (err) {
    log.error({ err }, "Team solver failed");
    return null;
  }
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
): SolvedTeam | null {
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

  // Phase 1: Fill minimum role requirements
  for (const [role, { min }] of Object.entries(CONSTRAINTS.roles)) {
    const rolePlayers = sorted.filter(
      (p) => normalizeRole(p.role) === role && !selected.includes(p),
    );
    const toAdd = rolePlayers
      .sort((a, b) => b.projectedPoints - a.projectedPoints)
      .slice(0, min);

    for (const p of toAdd) {
      if (budget - p.credits < 0) continue;
      selected.push(p);
      budget -= p.credits;
      roleCounts[role] = (roleCounts[role] ?? 0) + 1;
      const pTeam = p.team.toLowerCase();
      teamCounts[pTeam] = (teamCounts[pTeam] ?? 0) + 1;
    }
  }

  // Phase 2: Fill remaining slots with best value players
  const remaining = CONSTRAINTS.totalPlayers - selected.length;
  const candidates = sorted.filter((p) => !selected.includes(p));

  for (const p of candidates) {
    if (selected.length >= CONSTRAINTS.totalPlayers) break;
    if (p.credits > budget) continue;

    const role = normalizeRole(p.role);
    const maxForRole = CONSTRAINTS.roles[role]?.max ?? 6;
    if ((roleCounts[role] ?? 0) >= maxForRole) continue;

    const pTeam = p.team.toLowerCase();
    if ((teamCounts[pTeam] ?? 0) >= CONSTRAINTS.maxFromOneTeam) continue;

    selected.push(p);
    budget -= p.credits;
    roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    teamCounts[pTeam] = (teamCounts[pTeam] ?? 0) + 1;
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

  // Pick captain (highest projected) and vice-captain (2nd highest)
  const byPoints = [...selected].sort((a, b) => b.projectedPoints - a.projectedPoints);
  const captain = byPoints[0]!;
  const viceCaptain = byPoints[1]!;

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
