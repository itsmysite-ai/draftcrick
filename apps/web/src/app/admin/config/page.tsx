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

export default function ConfigPage() {
  const teamRules = trpc.admin.config.getTeamRules.useQuery({});
  const flags = trpc.admin.config.getFeatureFlags.useQuery();
  const upsert = trpc.admin.config.upsert.useMutation({
    onSuccess: () => {
      teamRules.refetch();
      flags.refetch();
    },
  });

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Config</h1>
      <TeamRulesEditor rules={teamRules.data} onSave={(rules) => upsert.mutate({ key: "global_team_rules", value: rules, description: "Default team builder rules" })} saving={upsert.isPending} />
      <FeatureFlagsEditor flags={flags.data} onSave={(f) => upsert.mutate({ key: "feature_flags", value: f, description: "Global feature flags" })} saving={upsert.isPending} />
      <EarlyAccessFlagsEditor />
    </div>
  );
}

function TeamRulesEditor({ rules, onSave, saving }: { rules: any; onSave: (v: any) => void; saving: boolean }) {
  const [form, setForm] = useState({ maxBudget: 100, maxOverseas: 4, maxFromOneTeam: 7, wkMin: 1, wkMax: 4, batMin: 1, batMax: 6, arMin: 1, arMax: 6, bowlMin: 1, bowlMax: 6 });

  useEffect(() => {
    if (rules) {
      const rl = rules.roleLimits ?? {};
      setForm({
        maxBudget: rules.maxBudget ?? 100,
        maxOverseas: rules.maxOverseas ?? 4,
        maxFromOneTeam: rules.maxFromOneTeam ?? 7,
        wkMin: rl.wicket_keeper?.min ?? 1, wkMax: rl.wicket_keeper?.max ?? 4,
        batMin: rl.batsman?.min ?? 1, batMax: rl.batsman?.max ?? 6,
        arMin: rl.all_rounder?.min ?? 1, arMax: rl.all_rounder?.max ?? 6,
        bowlMin: rl.bowler?.min ?? 1, bowlMax: rl.bowler?.max ?? 6,
      });
    }
  }, [rules]);

  const handleSave = () => {
    onSave({
      maxBudget: form.maxBudget,
      maxOverseas: form.maxOverseas,
      maxFromOneTeam: form.maxFromOneTeam,
      roleLimits: {
        wicket_keeper: { min: form.wkMin, max: form.wkMax },
        batsman: { min: form.batMin, max: form.batMax },
        all_rounder: { min: form.arMin, max: form.arMax },
        bowler: { min: form.bowlMin, max: form.bowlMax },
      },
    });
  };

  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Team Builder Rules (Global Defaults)</h2>

      <div style={labelStyle}>
        <span>Max Budget (credits)</span>
        <input type="number" min={1} value={form.maxBudget} onChange={(e) => setForm({ ...form, maxBudget: Number(e.target.value) })} style={inputStyle} />
      </div>
      <div style={labelStyle}>
        <span>Max Overseas Players</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="number" min={0} value={form.maxOverseas} onChange={(e) => setForm({ ...form, maxOverseas: Number(e.target.value) })} style={inputStyle} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>0 = no limit</span>
        </div>
      </div>
      <div style={labelStyle}>
        <span>Max Players From One Team</span>
        <input type="number" min={1} value={form.maxFromOneTeam} onChange={(e) => setForm({ ...form, maxFromOneTeam: Number(e.target.value) })} style={inputStyle} />
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 20, marginBottom: 8, color: "var(--text-secondary)" }}>Role Limits (Min / Max)</h3>
      <RoleRow label="Wicket Keeper" min={form.wkMin} max={form.wkMax} onMinChange={(v) => setForm({ ...form, wkMin: v })} onMaxChange={(v) => setForm({ ...form, wkMax: v })} />
      <RoleRow label="Batsman" min={form.batMin} max={form.batMax} onMinChange={(v) => setForm({ ...form, batMin: v })} onMaxChange={(v) => setForm({ ...form, batMax: v })} />
      <RoleRow label="All-Rounder" min={form.arMin} max={form.arMax} onMinChange={(v) => setForm({ ...form, arMin: v })} onMaxChange={(v) => setForm({ ...form, arMax: v })} />
      <RoleRow label="Bowler" min={form.bowlMin} max={form.bowlMax} onMinChange={(v) => setForm({ ...form, bowlMin: v })} onMaxChange={(v) => setForm({ ...form, bowlMax: v })} />

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          marginTop: 16, padding: "8px 20px", backgroundColor: "var(--accent)", color: "#fff",
          border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Saving..." : "Save Team Rules"}
      </button>
    </div>
  );
}

function RoleRow({ label, min, max, onMinChange, onMaxChange }: { label: string; min: number; max: number; onMinChange: (v: number) => void; onMaxChange: (v: number) => void }) {
  return (
    <div style={{ ...labelStyle, gap: 8 }}>
      <span style={{ flex: 1 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Min</span>
        <input type="number" min={0} max={11} value={min} onChange={(e) => onMinChange(Number(e.target.value))} style={{ ...inputStyle, width: 50 }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>Max</span>
        <input type="number" min={1} max={11} value={max} onChange={(e) => onMaxChange(Number(e.target.value))} style={{ ...inputStyle, width: 50 }} />
      </div>
    </div>
  );
}

function FeatureFlagsEditor({ flags, onSave, saving }: { flags: any; onSave: (v: any) => void; saving: boolean }) {
  const [form, setForm] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (flags) setForm(flags);
  }, [flags]);

  const toggle = (key: string) => {
    const updated = { ...form, [key]: !form[key] };
    setForm(updated);
    onSave(updated);
  };

  const flagLabels: Record<string, string> = {
    draftEnabled: "Draft Mode",
    auctionEnabled: "Auction Mode",
    predictionsEnabled: "Predictions",
    progaActive: "PROGA Active (free-to-play only)",
  };

  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Feature Flags</h2>
      {Object.entries(form).map(([key, value]) => (
        <div key={key} style={labelStyle}>
          <span>{flagLabels[key] ?? key}</span>
          <button
            onClick={() => toggle(key)}
            disabled={saving}
            style={{
              padding: "4px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
              backgroundColor: value ? "var(--accent)" : "var(--border)",
              color: value ? "#fff" : "var(--text-secondary)",
            }}
          >
            {value ? "ON" : "OFF"}
          </button>
        </div>
      ))}
    </div>
  );
}

const ACCESS_OPTIONS = [
  { value: "elite_only", label: "Elite Only", color: "#D4A017" },
  { value: "pro_and_above", label: "Pro & Above", color: "var(--accent)" },
  { value: "all", label: "All Tiers", color: "var(--accent)" },
  { value: "disabled", label: "Disabled", color: "var(--red)" },
];

const EA_FEATURE_LABELS: Record<string, string> = {
  team_solver: "Team Solver (Auto-Pick)",
  gurus_verdict: "Guru's Verdict (Team Review)",
  confidence_intervals: "Confidence Intervals",
  live_predictions: "Live Predictions",
  ai_insights: "AI Insights",
  player_compare: "Player Comparison",
  rate_my_team: "Rate My Team",
  projected_points: "Projected Points",
  captain_picks: "AI Captain Picks",
};

function EarlyAccessFlagsEditor() {
  const earlyAccessFlags = trpc.admin.config.getEarlyAccessFlags.useQuery();
  const updateFlag = trpc.admin.config.updateEarlyAccessFlag.useMutation({
    onSuccess: () => earlyAccessFlags.refetch(),
  });

  const flags = earlyAccessFlags.data as Record<string, { access: string; badge: string | null }> | undefined;

  if (earlyAccessFlags.isLoading) {
    return <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading early access flags...</p>;
  }

  if (!flags) return null;

  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Early Access Feature Gates</h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
        Control which subscription tiers can access each feature. Features start as &quot;Elite Only&quot; and can be
        promoted to wider tiers as they mature. The &quot;Early Access&quot; badge shows on the subscription screen for gated features.
      </p>

      {Object.entries(flags).map(([key, flag]) => {
        const accessColor = ACCESS_OPTIONS.find((o) => o.value === flag.access)?.color ?? "var(--text-muted)";
        return (
          <div key={key} style={{ ...labelStyle, gap: 12 }}>
            <span style={{ flex: 1 }}>{EA_FEATURE_LABELS[key] ?? key}</span>

            {flag.badge && (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "var(--font-data)",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  backgroundColor: "rgba(139,92,246,0.12)",
                  color: "#8B5CF6",
                }}
              >
                EARLY ACCESS
              </span>
            )}

            <select
              value={flag.access}
              onChange={(e) =>
                updateFlag.mutate({
                  key,
                  access: e.target.value as any,
                  badge: e.target.value === "all" ? null : flag.badge,
                })
              }
              disabled={updateFlag.isPending}
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: "var(--bg)",
                color: accessColor,
                fontFamily: "var(--font-data)",
                cursor: "pointer",
                width: 140,
              }}
            >
              {ACCESS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}

      {updateFlag.isSuccess && (
        <p style={{ color: "var(--accent)", fontSize: 13, marginTop: 8 }}>Flag updated.</p>
      )}
      {updateFlag.isError && (
        <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>Error: {updateFlag.error.message}</p>
      )}
    </div>
  );
}
