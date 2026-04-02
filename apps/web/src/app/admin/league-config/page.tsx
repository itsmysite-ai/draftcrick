"use client";

import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

const inputStyle: React.CSSProperties = {
  width: 80,
  padding: "6px 8px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 13,
  backgroundColor: "var(--bg)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-data)",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid var(--border)",
  fontSize: 14,
};

const sectionStyle: React.CSSProperties = {
  padding: 20,
  backgroundColor: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  marginBottom: 24,
};

const btnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "var(--font-data)",
};

const btnPrimary: React.CSSProperties = {
  ...btnStyle,
  backgroundColor: "var(--accent)",
  color: "white",
};

const btnDanger: React.CSSProperties = {
  ...btnStyle,
  backgroundColor: "var(--error, #e5484d)",
  color: "white",
};

const btnSecondary: React.CSSProperties = {
  ...btnStyle,
  backgroundColor: "var(--bg-surface-alt, #252624)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
};

const formatBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 700,
  fontFamily: "var(--font-data)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const FORMAT_COLORS: Record<string, { bg: string; color: string }> = {
  auction: { bg: "rgba(212, 164, 61, 0.15)", color: "#D4A43D" },
  draft: { bg: "rgba(93, 168, 184, 0.15)", color: "#5DA8B8" },
  salary_cap: { bg: "rgba(93, 184, 130, 0.15)", color: "#5DB882" },
  all: { bg: "rgba(160, 136, 204, 0.15)", color: "#A088CC" },
};

function FormatBadges({ formats }: { formats: string[] }) {
  return (
    <span style={{ display: "inline-flex", gap: 6, marginLeft: 10 }}>
      {formats.map((f) => {
        const c = FORMAT_COLORS[f] ?? FORMAT_COLORS.all!;
        return (
          <span key={f} style={{ ...formatBadgeStyle, backgroundColor: c.bg, color: c.color }}>
            {f.replace("_", " ")}
          </span>
        );
      })}
    </span>
  );
}

export default function AuctionConfigPage() {
  const config = trpc.admin.leagueConfig.getConfig.useQuery();
  const upsertSquadRule = trpc.admin.leagueConfig.upsertSquadRule.useMutation({ onSuccess: () => config.refetch() });
  const deleteSquadRule = trpc.admin.leagueConfig.deleteSquadRule.useMutation({ onSuccess: () => config.refetch() });
  const updatePlatform = trpc.admin.leagueConfig.updatePlatformSettings.useMutation({ onSuccess: () => config.refetch() });
  const forceResume = trpc.admin.leagueConfig.forceResume.useMutation({ onSuccess: () => { pausedAuctions.refetch(); } });
  const pausedAuctions = trpc.admin.leagueConfig.listPaused.useQuery();

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>League Config</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24, marginTop: -16 }}>
        Configure default rules for all league formats. Badges show which formats each section applies to.
      </p>

      {/* ── Squad Rules (active — CRUD) ── */}
      <SquadRulesEditor
        rules={config.data?.squadRules ?? []}
        onSave={(rule) => upsertSquadRule.mutate(rule)}
        onDelete={(id) => deleteSquadRule.mutate({ id })}
        saving={upsertSquadRule.isPending}
      />

      {/* ── Auction Platform Settings (active) ── */}
      <PlatformSettingsEditor
        maxPausesCap={config.data?.maxPausesCap ?? 5}
        bidIncrementOptions={config.data?.bidIncrementOptions ?? [0.1, 0.2, 0.5, 1.0]}
        defaults={config.data?.defaults ?? {}}
        onSave={(data) => updatePlatform.mutate(data)}
        saving={updatePlatform.isPending}
      />

      {/* ── Auto-generated rule category sections (placeholders) ── */}
      {RULE_CATEGORIES.map((cat) => (
        <RuleCategorySection key={cat.id} category={cat} />
      ))}

      {/* ── Active Paused Auctions (operational) ── */}
      <PausedAuctionsPanel
        auctions={pausedAuctions.data ?? []}
        onForceResume={(roomId) => forceResume.mutate({ roomId })}
        resuming={forceResume.isPending}
      />
    </div>
  );
}

// ── Squad Rules CRUD ────────────────────────────────────────

interface SquadRuleForm {
  id: string;
  name: string;
  minWK: number; minBAT: number; minBOWL: number; minAR: number;
  maxWK: number; maxBAT: number; maxBOWL: number; maxAR: number;
}

const emptyRule: SquadRuleForm = {
  id: "", name: "", minWK: 1, minBAT: 3, minBOWL: 3, minAR: 1, maxWK: 4, maxBAT: 7, maxBOWL: 7, maxAR: 5,
};

function SquadRulesEditor({
  rules,
  onSave,
  onDelete,
  saving,
}: {
  rules: any[];
  onSave: (rule: SquadRuleForm) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState<SquadRuleForm | null>(null);

  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Squad Rules <FormatBadges formats={["auction", "draft"]} /></h2>
        <button
          style={btnSecondary}
          onClick={() => setEditing({ ...emptyRule, id: `rule_${Date.now()}` })}
        >
          + Add Rule
        </button>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Define squad composition templates (min/max per role). League creators pick from these when setting up an auction or draft league.
      </p>

      {rules.length === 0 && !editing && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0" }}>
          No squad rules defined. The &quot;No rules&quot; option is always available by default.
        </p>
      )}

      {/* Existing rules */}
      {rules.map((rule: any) => (
        <div key={rule.id} style={{ ...labelStyle, gap: 12 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600 }}>{rule.name}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>
              WK: {rule.minWK}-{rule.maxWK} | BAT: {rule.minBAT}-{rule.maxBAT} | BOWL: {rule.minBOWL}-{rule.maxBOWL} | AR: {rule.minAR}-{rule.maxAR}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={btnSecondary} onClick={() => setEditing(rule)}>Edit</button>
            <button style={btnDanger} onClick={() => onDelete(rule.id)}>Delete</button>
          </div>
        </div>
      ))}

      {/* Edit/Create form */}
      {editing && (
        <div style={{ marginTop: 16, padding: 16, backgroundColor: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Rule Name</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Balanced"
                style={{ ...inputStyle, width: "100%", marginTop: 4 }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            {(["WK", "BAT", "BOWL", "AR"] as const).map((role) => (
              <div key={role}>
                <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{role}</label>
                <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>min</span>
                  <input
                    type="number"
                    min={0}
                    max={11}
                    value={editing[`min${role}` as keyof SquadRuleForm] as number}
                    onChange={(e) => setEditing({ ...editing, [`min${role}`]: Number(e.target.value) })}
                    style={{ ...inputStyle, width: 50 }}
                  />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>max</span>
                  <input
                    type="number"
                    min={0}
                    max={14}
                    value={editing[`max${role}` as keyof SquadRuleForm] as number}
                    onChange={(e) => setEditing({ ...editing, [`max${role}`]: Number(e.target.value) })}
                    style={{ ...inputStyle, width: 50 }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            <button style={btnSecondary} onClick={() => setEditing(null)}>Cancel</button>
            <button
              style={{ ...btnPrimary, opacity: saving || !editing.name ? 0.5 : 1 }}
              disabled={saving || !editing.name}
              onClick={() => { onSave(editing); setEditing(null); }}
            >
              {saving ? "Saving..." : "Save Rule"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Platform Settings ───────────────────────────────────────

function PlatformSettingsEditor({
  maxPausesCap,
  bidIncrementOptions,
  defaults,
  onSave,
  saving,
}: {
  maxPausesCap: number;
  bidIncrementOptions: number[];
  defaults: Record<string, unknown>;
  onSave: (data: { maxPausesCap?: number; bidIncrementOptions?: number[]; defaults?: Record<string, unknown> }) => void;
  saving: boolean;
}) {
  const [cap, setCap] = useState(maxPausesCap);
  const [increments, setIncrements] = useState(bidIncrementOptions);

  useEffect(() => {
    setCap(maxPausesCap);
    setIncrements(bidIncrementOptions);
  }, [maxPausesCap, bidIncrementOptions]);

  const allIncrements = [0.1, 0.2, 0.5, 1.0, 2.0];

  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Auction Platform Settings <FormatBadges formats={["auction"]} /></h2>

      <div style={labelStyle}>
        <div>
          <span>Max Pauses Per Member (Platform Cap)</span>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
            League creators cannot set higher than this
          </p>
        </div>
        <input
          type="number"
          min={0}
          max={20}
          value={cap}
          onChange={(e) => setCap(Number(e.target.value))}
          style={inputStyle}
        />
      </div>

      <div style={{ ...labelStyle, flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
        <span>Available Bid Increments</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {allIncrements.map((inc) => {
            const active = increments.includes(inc);
            return (
              <button
                key={inc}
                onClick={() => {
                  setIncrements(active ? increments.filter((i) => i !== inc) : [...increments, inc].sort());
                }}
                style={{
                  ...btnSecondary,
                  backgroundColor: active ? "var(--accent)" : "var(--bg)",
                  color: active ? "white" : "var(--text-primary)",
                  padding: "6px 14px",
                  fontSize: 13,
                }}
              >
                {inc}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
          League creators can only choose from these options
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button
          style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}
          disabled={saving}
          onClick={() => onSave({ maxPausesCap: cap, bidIncrementOptions: increments })}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

// ── Paused Auctions ─────────────────────────────────────────

function PausedAuctionsPanel({
  auctions,
  onForceResume,
  resuming,
}: {
  auctions: { roomId: string; leagueId: string; pausedBy: string; pausedAt: string }[];
  onForceResume: (roomId: string) => void;
  resuming: boolean;
}) {
  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Paused Auctions <FormatBadges formats={["auction"]} /></h2>

      {auctions.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0" }}>
          No auctions are currently paused.
        </p>
      ) : (
        auctions.map((a) => (
          <div key={a.roomId} style={{ ...labelStyle, gap: 12 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 12 }}>
                Room: {a.roomId.slice(0, 8)}...
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 12 }}>
                Paused by: {a.pausedBy?.slice(0, 8)}... | {a.pausedAt ? new Date(a.pausedAt).toLocaleString() : ""}
              </span>
            </div>
            <button
              style={{ ...btnDanger, opacity: resuming ? 0.5 : 1 }}
              disabled={resuming}
              onClick={() => onForceResume(a.roomId)}
            >
              Force Resume
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// ── Rule Categories (all 10, with format mapping + rules) ───

interface RuleCategoryInfo {
  id: string;
  label: string;
  formats: string[];
  description: string;
  rules: { key: string; label: string; description: string; type: string; default: unknown; advanced?: boolean }[];
}

const RULE_CATEGORIES: RuleCategoryInfo[] = [
  {
    id: "teamComposition", label: "Team Composition", formats: ["salary_cap", "draft", "auction"],
    description: "Squad size, role limits (min/max batsmen, bowlers, WK, AR), overseas player cap, team cap.",
    rules: [
      { key: "teamComposition.teamSize", label: "Team Size", description: "Players per team", type: "number", default: 11 },
      { key: "teamComposition.minBatsmen", label: "Min Batsmen", description: "Minimum batsmen", type: "number", default: 1 },
      { key: "teamComposition.maxBatsmen", label: "Max Batsmen", description: "Maximum batsmen", type: "number", default: 6 },
      { key: "teamComposition.minBowlers", label: "Min Bowlers", description: "Minimum bowlers", type: "number", default: 1 },
      { key: "teamComposition.maxBowlers", label: "Max Bowlers", description: "Maximum bowlers", type: "number", default: 6 },
      { key: "teamComposition.minAllRounders", label: "Min All-rounders", description: "Minimum ARs", type: "number", default: 1 },
      { key: "teamComposition.maxAllRounders", label: "Max All-rounders", description: "Maximum ARs", type: "number", default: 6 },
      { key: "teamComposition.minWicketKeepers", label: "Min WKs", description: "Minimum WKs", type: "number", default: 1 },
      { key: "teamComposition.maxWicketKeepers", label: "Max WKs", description: "Maximum WKs", type: "number", default: 4 },
      { key: "teamComposition.maxOverseasPlayers", label: "Overseas Limit", description: "Max overseas players", type: "number", default: 4 },
      { key: "teamComposition.maxFromOneTeam", label: "Max From One Team", description: "Max from a single team", type: "number", default: 7 },
      { key: "teamComposition.uncappedPlayerSlots", label: "Uncapped Slots", description: "Reserved for uncapped", type: "number", default: 0, advanced: true },
      { key: "teamComposition.benchSize", label: "Bench Size", description: "Substitute slots", type: "number", default: 0, advanced: true },
    ],
  },
  {
    id: "scoring", label: "Scoring", formats: ["salary_cap", "draft", "auction"],
    description: "Points for runs, wickets, catches, milestones, penalties for ducks, dot balls, wides.",
    rules: [
      { key: "scoring.runPoints", label: "Run Points", description: "Per run", type: "number", default: 1 },
      { key: "scoring.boundaryBonus", label: "Boundary Bonus", description: "Extra per four", type: "number", default: 1 },
      { key: "scoring.sixBonus", label: "Six Bonus", description: "Extra per six", type: "number", default: 2 },
      { key: "scoring.halfCenturyBonus", label: "Half-Century", description: "50+ bonus", type: "number", default: 20 },
      { key: "scoring.centuryBonus", label: "Century", description: "100+ bonus", type: "number", default: 50 },
      { key: "scoring.duckPenalty", label: "Duck Penalty", description: "Out for 0", type: "number", default: -5 },
      { key: "scoring.wicketPoints", label: "Wicket Points", description: "Per wicket", type: "number", default: 25 },
      { key: "scoring.maidenOverPoints", label: "Maiden Over", description: "Per maiden", type: "number", default: 15 },
      { key: "scoring.threeWicketBonus", label: "3-Wicket Bonus", description: "3+ wickets", type: "number", default: 15 },
      { key: "scoring.fiveWicketBonus", label: "5-Wicket Haul", description: "5+ wickets", type: "number", default: 30 },
      { key: "scoring.catchPoints", label: "Catch Points", description: "Per catch", type: "number", default: 10 },
      { key: "scoring.stumpingPoints", label: "Stumping", description: "Per stumping", type: "number", default: 15 },
      { key: "scoring.runOutDirectPoints", label: "Direct Run-out", description: "Direct hit", type: "number", default: 15 },
      { key: "scoring.playerOfMatchBonus", label: "Player of Match", description: "POM bonus", type: "number", default: 25 },
      { key: "scoring.thirtyRunBonus", label: "30-Run Bonus", description: "30+ bonus", type: "number", default: 5, advanced: true },
      { key: "scoring.fourWicketBonus", label: "4-Wicket Bonus", description: "4+ wickets", type: "number", default: 25, advanced: true },
      { key: "scoring.runOutIndirectPoints", label: "Indirect Run-out", description: "Assist", type: "number", default: 10, advanced: true },
      { key: "scoring.dotBallFacedPenalty", label: "Dot Ball Penalty", description: "Per dot faced", type: "number", default: 0, advanced: true },
      { key: "scoring.dotBallBowledPoints", label: "Dot Ball Bowled", description: "Per dot bowled", type: "number", default: 0, advanced: true },
      { key: "scoring.noballPenalty", label: "No-Ball Penalty", description: "Per no-ball", type: "number", default: 0, advanced: true },
      { key: "scoring.widePenalty", label: "Wide Penalty", description: "Per wide", type: "number", default: 0, advanced: true },
      { key: "scoring.winningTeamBonus", label: "Winning Team", description: "Team wins bonus", type: "number", default: 0, advanced: true },
      { key: "scoring.powerplayRunBonus", label: "Powerplay Run Bonus", description: "Powerplay runs", type: "number", default: 0, advanced: true },
      { key: "scoring.deathOverWicketBonus", label: "Death Over Wicket", description: "Overs 16-20", type: "number", default: 0, advanced: true },
    ],
  },
  {
    id: "boosters", label: "Boosters & Power-ups", formats: ["salary_cap", "draft"],
    description: "Captain/VC multipliers, triple captain, bench boost, power player, super sub chips.",
    rules: [
      { key: "boosters.captainMultiplier", label: "Captain Multiplier", description: "Captain boost", type: "number", default: 2 },
      { key: "boosters.viceCaptainMultiplier", label: "VC Multiplier", description: "Vice-captain boost", type: "number", default: 1.5 },
      { key: "boosters.tripleCaptainEnabled", label: "Triple Captain", description: "3x captain chip", type: "boolean", default: false, advanced: true },
      { key: "boosters.powerPlayerEnabled", label: "Power Player", description: "3x boost chip", type: "boolean", default: false, advanced: true },
      { key: "boosters.superSubEnabled", label: "Super Sub", description: "Auto-swap benched", type: "boolean", default: false, advanced: true },
      { key: "boosters.benchBoostEnabled", label: "Bench Boost", description: "Bench players score", type: "boolean", default: false, advanced: true },
    ],
  },
  {
    id: "transfers", label: "Transfers & Trading", formats: ["salary_cap", "draft"],
    description: "Free transfers, trade windows, waiver wire, veto system, penalties.",
    rules: [
      { key: "transfers.maxTransfersPerWeek", label: "Max Transfers/Week", description: "Swaps per week", type: "number", default: 5 },
      { key: "transfers.freeTransfersPerWeek", label: "Free Transfers", description: "Before penalty", type: "number", default: 2 },
      { key: "transfers.transferPenaltyPoints", label: "Transfer Penalty", description: "Points per extra", type: "number", default: 4 },
      { key: "transfers.tradeWindowOpen", label: "Trading Enabled", description: "Allow trades", type: "boolean", default: false },
      { key: "transfers.maxTradesPerWeek", label: "Max Trades/Week", description: "Trades per week", type: "number", default: 2, advanced: true },
      { key: "transfers.waiverWireEnabled", label: "Waiver Wire", description: "Queue system", type: "boolean", default: false, advanced: true },
      { key: "transfers.tradeVetoEnabled", label: "Trade Veto", description: "Block unfair trades", type: "boolean", default: false, advanced: true },
    ],
  },
  {
    id: "playoffs", label: "Playoffs", formats: ["salary_cap", "draft", "auction"],
    description: "End-of-season playoffs — format, size, rounds, home advantage, wildcards.",
    rules: [
      { key: "playoffs.playoffsEnabled", label: "Playoffs", description: "Enable playoffs", type: "boolean", default: false },
      { key: "playoffs.playoffSize", label: "Size", description: "Teams in playoffs", type: "number", default: 4 },
      { key: "playoffs.playoffFormat", label: "Format", description: "Knockout/round robin", type: "select", default: "knockout" },
      { key: "playoffs.thirdPlaceMatch", label: "3rd Place Match", description: "Consolation final", type: "boolean", default: false, advanced: true },
      { key: "playoffs.wildcardSpots", label: "Wildcards", description: "Extra spots", type: "number", default: 0, advanced: true },
      { key: "playoffs.homeAdvantageEnabled", label: "Home Advantage", description: "Seed bonus", type: "boolean", default: false, advanced: true },
    ],
  },
  {
    id: "salary", label: "Salary & Budget", formats: ["salary_cap"],
    description: "Budget, player price ranges, price changes, inflation, rollover.",
    rules: [
      { key: "salary.totalBudget", label: "Total Budget", description: "Starting budget", type: "number", default: 100 },
      { key: "salary.playerPriceMin", label: "Min Price", description: "Cheapest player", type: "number", default: 4 },
      { key: "salary.playerPriceMax", label: "Max Price", description: "Most expensive", type: "number", default: 12 },
      { key: "salary.priceChangeEnabled", label: "Price Changes", description: "Dynamic pricing", type: "boolean", default: false, advanced: true },
      { key: "salary.inflationRate", label: "Inflation (%)", description: "Weekly budget growth", type: "number", default: 0, advanced: true },
      { key: "salary.budgetRollover", label: "Rollover", description: "Save unspent budget", type: "boolean", default: false, advanced: true },
    ],
  },
  {
    id: "autoManagement", label: "Auto-management", formats: ["salary_cap", "draft", "auction"],
    description: "Auto-swap injured, auto-captain, auto-pick for inactive managers.",
    rules: [
      { key: "autoManagement.autoSwapInjured", label: "Auto-swap Injured", description: "Bench injured", type: "boolean", default: true },
      { key: "autoManagement.autoCaptainIfBenched", label: "Auto Captain", description: "New captain if benched", type: "boolean", default: true },
      { key: "autoManagement.autoPickEnabled", label: "Auto-Pick", description: "Pick if deadline missed", type: "boolean", default: true },
      { key: "autoManagement.deadlineReminderHours", label: "Reminder (hrs)", description: "Before deadline", type: "number", default: 2 },
      { key: "autoManagement.inactivityAutoPick", label: "Inactivity Auto-Pick", description: "Pick for inactive", type: "boolean", default: true, advanced: true },
      { key: "autoManagement.inactivityThresholdDays", label: "Inactivity Days", description: "Days before auto", type: "number", default: 7, advanced: true },
    ],
  },
  {
    id: "scoringModifiers", label: "Scoring Modifiers", formats: ["salary_cap", "draft"],
    description: "Multipliers for home/away, powerplay, death overs, super over.",
    rules: [
      { key: "scoringModifiers.homeMultiplier", label: "Home Multiplier", description: "Home boost", type: "number", default: 1.0, advanced: true },
      { key: "scoringModifiers.awayMultiplier", label: "Away Multiplier", description: "Away modifier", type: "number", default: 1.0, advanced: true },
      { key: "scoringModifiers.powerplayBonusMultiplier", label: "Powerplay Bonus", description: "Powerplay boost", type: "number", default: 1.0, advanced: true },
      { key: "scoringModifiers.deathOversBonusMultiplier", label: "Death Overs Bonus", description: "Death overs boost", type: "number", default: 1.0, advanced: true },
      { key: "scoringModifiers.superOverMultiplier", label: "Super Over", description: "Super over boost", type: "number", default: 1.0, advanced: true },
    ],
  },
  {
    id: "draft", label: "Snake Draft", formats: ["draft"],
    description: "Rounds, time per pick, snake order, keeper players, auto-pick on timeout.",
    rules: [
      { key: "draft.maxRounds", label: "Draft Rounds", description: "Number of rounds", type: "number", default: 15 },
      { key: "draft.timePerPick", label: "Time Per Pick (sec)", description: "Seconds per pick", type: "number", default: 60 },
      { key: "draft.snakeDraftEnabled", label: "Snake Draft", description: "Reverse each round", type: "boolean", default: true },
      { key: "draft.autoPick", label: "Auto-Pick on Timeout", description: "Auto-pick if time out", type: "boolean", default: true },
      { key: "draft.pauseBetweenRounds", label: "Pause Between Rounds", description: "Break each round", type: "boolean", default: false },
      { key: "draft.keeperPlayersEnabled", label: "Keeper Players", description: "Keep between seasons", type: "boolean", default: false, advanced: true },
      { key: "draft.keeperPlayerSlots", label: "Keeper Slots", description: "How many keepers", type: "number", default: 2, advanced: true },
    ],
  },
  {
    id: "auction", label: "Auction", formats: ["auction"],
    description: "Budget, bid timers, increments, base price, visibility, pauses, squad rules.",
    rules: [
      { key: "auction.auctionBudget", label: "Budget", description: "Starting budget", type: "number", default: 100 },
      { key: "auction.minBid", label: "Min Bid", description: "Opening bid floor", type: "number", default: 1 },
      { key: "auction.bidIncrement", label: "Bid Increment", description: "Min raise amount", type: "number", default: 0.1 },
      { key: "auction.maxBidTime", label: "Bid Timer (sec)", description: "Seconds to bid", type: "number", default: 15 },
      { key: "auction.goingOnceTime", label: "Going Once (sec)", description: "First countdown", type: "number", default: 5 },
      { key: "auction.goingTwiceTime", label: "Going Twice (sec)", description: "Final countdown", type: "number", default: 3 },
      { key: "auction.maxPlayersPerTeam", label: "Squad Size", description: "Max per team", type: "number", default: 14 },
      { key: "auction.unsoldPlayerReAuction", label: "Re-auction Unsold", description: "Retry unsold", type: "boolean", default: true },
      { key: "auction.squadVisibility", label: "Squad Visibility", description: "When squads visible", type: "select", default: "after_sold" },
      { key: "auction.buyerVisibility", label: "Buyer Identity", description: "When buyer shown", type: "select", default: "during_auction" },
      { key: "auction.squadRule", label: "Squad Rule", description: "Composition constraint", type: "select", default: "none" },
      { key: "auction.maxPausesPerMember", label: "Pauses Per Member", description: "Tactical timeouts", type: "number", default: 3 },
      { key: "auction.basePriceMode", label: "Base Price Mode", description: "Opening bid mode", type: "select", default: "flat", advanced: true },
      { key: "auction.basePricePercent", label: "Base Price %", description: "% of credits", type: "number", default: 50, advanced: true },
      { key: "auction.rightToMatchEnabled", label: "Right to Match", description: "Previous owner match", type: "boolean", default: false, advanced: true },
    ],
  },
];

function RuleCategorySection({ category }: { category: RuleCategoryInfo }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const advancedRules = category.rules.filter((r) => r.advanced);
  const visibleRules = showAdvanced ? category.rules : category.rules.filter((r) => !r.advanced);

  return (
    <div style={sectionStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>
          {category.label} <FormatBadges formats={category.formats} />
        </h2>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...formatBadgeStyle, backgroundColor: "rgba(229, 72, 77, 0.12)", color: "#E5484D", fontSize: 9 }}>
            TO BE IMPLEMENTED
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-data)" }}>
            {category.rules.length} rules
          </span>
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        {category.description}
      </p>

      {visibleRules.map((rule) => (
        <div key={rule.key} style={labelStyle}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13 }}>{rule.label}</span>
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 8 }}>
              {rule.description}
            </span>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-data)" }}>
            {String(rule.default)}
          </span>
        </div>
      ))}

      {advancedRules.length > 0 && (
        <button
          style={{ ...btnSecondary, marginTop: 12, fontSize: 11, padding: "4px 12px" }}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? `Hide ${advancedRules.length} advanced` : `Show ${advancedRules.length} advanced rules`}
        </button>
      )}
    </div>
  );
}
