/**
 * Auction Target Squad Service
 *
 * Manages per-user "wanna be" squads for auctions — the players they want to buy.
 * Targets evolve as the auction progresses (players bought by others get replaced).
 */

import type { Database } from "@draftplay/db";
import { draftRooms } from "@draftplay/db";
import { eq } from "drizzle-orm";
import type { SquadRule } from "@draftplay/shared";

export interface TargetPlayer {
  playerId: string;
  priority: number;
  status: "target" | "acquired" | "gone";
  boughtAt?: number; // price if acquired
  replacedBy?: string; // playerId of replacement if gone
  addedBy: "manual" | "ai";
}

export interface TargetSquad {
  targets: TargetPlayer[];
  generatedBy: "manual" | "ai" | "hybrid";
  lastEvolvedAt: string;
}

interface PlayerInfo {
  id: string;
  name: string;
  role: string;
  team: string;
  credits: number;
  stats?: Record<string, unknown>;
}

// ── AI Auto-Build ────────────────────────────────────────────

/**
 * Generate an optimal target squad using rule-based logic.
 * Considers: squad rule, budget, player stats/credits.
 */
export function autoBuildTargetSquad(
  availablePlayers: PlayerInfo[],
  squadRule: SquadRule | null,
  budget: number,
  squadSize: number,
): TargetSquad {
  const targets: TargetPlayer[] = [];
  const used = new Set<string>();
  const roleCounts: Record<string, number> = { WK: 0, BAT: 0, BOWL: 0, AR: 0 };

  // Sort by credits (quality) descending
  const sorted = [...availablePlayers].sort((a, b) => (b.credits ?? 0) - (a.credits ?? 0));

  // Phase 1: Fill minimums first (pick best player per required role)
  if (squadRule) {
    const mins: Array<{ role: string; min: number }> = [
      { role: "WK", min: squadRule.minWK ?? 0 },
      { role: "BAT", min: squadRule.minBAT ?? 0 },
      { role: "BOWL", min: squadRule.minBOWL ?? 0 },
      { role: "AR", min: squadRule.minAR ?? 0 },
    ];

    for (const { role, min } of mins) {
      const candidates = sorted.filter(
        (p) => mapRole(p.role) === role && !used.has(p.id),
      );
      for (let i = 0; i < min && i < candidates.length; i++) {
        const p = candidates[i]!;
        targets.push({
          playerId: p.id,
          priority: targets.length + 1,
          status: "target",
          addedBy: "ai",
        });
        used.add(p.id);
        roleCounts[role] = (roleCounts[role] ?? 0) + 1;
      }
    }
  }

  // Phase 2: Fill remaining slots with best value players (respecting max limits)
  const remaining = squadSize - targets.length;
  let budgetLeft = budget;

  // Estimate budget used by current targets
  for (const t of targets) {
    const p = availablePlayers.find((pl) => pl.id === t.playerId);
    if (p) budgetLeft -= p.credits;
  }

  for (const player of sorted) {
    if (targets.length >= squadSize) break;
    if (used.has(player.id)) continue;

    const role = mapRole(player.role);
    const maxForRole = squadRule
      ? ((squadRule as any)[`max${role}`] as number) ?? 99
      : 99;

    if ((roleCounts[role] ?? 0) >= maxForRole) continue;

    // Budget check: can we afford this player? Use avg remaining budget as threshold
    const slotsLeft = squadSize - targets.length;
    const avgBudget = slotsLeft > 0 ? budgetLeft / slotsLeft : 0;
    // Allow up to 1.5x avg budget for top picks
    if (player.credits > avgBudget * 1.5 && targets.length > squadSize * 0.5) continue;

    targets.push({
      playerId: player.id,
      priority: targets.length + 1,
      status: "target",
      addedBy: "ai",
    });
    used.add(player.id);
    roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    budgetLeft -= player.credits;
  }

  return {
    targets,
    generatedBy: "ai",
    lastEvolvedAt: new Date().toISOString(),
  };
}

// ── Evolution Logic ──────────────────────────────────────────

/**
 * Evolve target squad based on auction progress.
 * - Players bought by others → status "gone", find replacement
 * - Players bought by user → status "acquired"
 * - Budget changes → swap expensive targets for cheaper ones if needed
 */
export function evolveTargetSquad(
  current: TargetSquad,
  soldPlayers: Array<{ playerId: string; userId: string; amount: number }>,
  myUserId: string,
  availablePlayers: PlayerInfo[],
  squadRule: SquadRule | null,
  budget: number,
  squadSize: number,
  myTeamSize: number,
): TargetSquad {
  const soldIds = new Set(soldPlayers.map((sp) => sp.playerId));
  const availableIds = new Set(availablePlayers.map((p) => p.id));
  const usedInTargets = new Set(current.targets.map((t) => t.playerId));

  const evolved = current.targets.map((target) => {
    // Already resolved
    if (target.status !== "target") return target;

    // Bought by me
    const mySale = soldPlayers.find(
      (sp) => sp.playerId === target.playerId && sp.userId === myUserId,
    );
    if (mySale) {
      return { ...target, status: "acquired" as const, boughtAt: mySale.amount };
    }

    // Bought by someone else
    if (soldIds.has(target.playerId) && !availableIds.has(target.playerId)) {
      const replacement = findReplacement(
        target.playerId,
        availablePlayers,
        current.targets,
        squadRule,
        budget,
        squadSize - myTeamSize,
      );
      return {
        ...target,
        status: "gone" as const,
        replacedBy: replacement?.id ?? undefined,
      };
    }

    return target;
  });

  // Add replacements as new targets
  const newTargets: TargetPlayer[] = [];
  for (const t of evolved) {
    if (t.status === "gone" && t.replacedBy && !usedInTargets.has(t.replacedBy)) {
      newTargets.push({
        playerId: t.replacedBy,
        priority: evolved.length + newTargets.length + 1,
        status: "target",
        addedBy: "ai",
      });
      usedInTargets.add(t.replacedBy);
    }
  }

  // Re-prioritize: acquired first, then active targets, then gone
  const all = [...evolved, ...newTargets];
  const active = all.filter((t) => t.status === "target");
  const acquired = all.filter((t) => t.status === "acquired");
  const gone = all.filter((t) => t.status === "gone");

  const reprioritized = [
    ...acquired.map((t, i) => ({ ...t, priority: i + 1 })),
    ...active.map((t, i) => ({ ...t, priority: acquired.length + i + 1 })),
    ...gone.map((t, i) => ({ ...t, priority: acquired.length + active.length + i + 1 })),
  ];

  return {
    targets: reprioritized,
    generatedBy: current.generatedBy === "ai" ? "ai" : "hybrid",
    lastEvolvedAt: new Date().toISOString(),
  };
}

function findReplacement(
  gonePlayerId: string,
  availablePlayers: PlayerInfo[],
  currentTargets: TargetPlayer[],
  squadRule: SquadRule | null,
  budget: number,
  slotsRemaining: number,
): PlayerInfo | null {
  // Find the gone player's role
  const gonePlayer = availablePlayers.find((p) => p.id === gonePlayerId);
  // If not in available (already sold), we need role from somewhere else
  // For now, just find best available in any needed role
  const targetIds = new Set(currentTargets.map((t) => t.playerId));
  const candidates = availablePlayers.filter((p) => !targetIds.has(p.id));

  if (gonePlayer) {
    // Same role replacement
    const sameRole = candidates
      .filter((p) => mapRole(p.role) === mapRole(gonePlayer.role))
      .sort((a, b) => (b.credits ?? 0) - (a.credits ?? 0));
    if (sameRole.length > 0) return sameRole[0]!;
  }

  // Fallback: best available by credits
  const sorted = candidates.sort((a, b) => (b.credits ?? 0) - (a.credits ?? 0));
  return sorted[0] ?? null;
}

function mapRole(role: string): string {
  const r = (role ?? "").toLowerCase();
  if (r === "wicket_keeper" || r === "wk") return "WK";
  if (r === "batsman" || r === "bat" || r === "batter") return "BAT";
  if (r === "bowler" || r === "bowl") return "BOWL";
  if (r === "all_rounder" || r === "ar" || r === "allrounder") return "AR";
  return "BAT";
}

// ── Persistence ──────────────────────────────────────────────

/**
 * Load target squad from draftRooms.settings
 */
export async function loadTargetSquad(
  db: Database,
  roomId: string,
  userId: string,
): Promise<TargetSquad | null> {
  const room = await db.query.draftRooms.findFirst({
    where: eq(draftRooms.id, roomId),
    columns: { settings: true },
  });
  if (!room) return null;

  const settings = (room.settings ?? {}) as Record<string, unknown>;
  const squads = (settings._targetSquads ?? {}) as Record<string, TargetSquad>;
  return squads[userId] ?? null;
}

/**
 * Save target squad to draftRooms.settings
 */
export async function saveTargetSquad(
  db: Database,
  roomId: string,
  userId: string,
  squad: TargetSquad,
): Promise<void> {
  const room = await db.query.draftRooms.findFirst({
    where: eq(draftRooms.id, roomId),
    columns: { settings: true },
  });
  if (!room) return;

  const settings = (room.settings ?? {}) as Record<string, unknown>;
  const squads = (settings._targetSquads ?? {}) as Record<string, TargetSquad>;
  squads[userId] = squad;

  await db
    .update(draftRooms)
    .set({
      settings: { ...settings, _targetSquads: squads },
    })
    .where(eq(draftRooms.id, roomId));
}
