"use client";

import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

const sectionStyle: React.CSSProperties = {
  padding: 20,
  backgroundColor: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  marginBottom: 24,
};

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

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid var(--border)",
  fontSize: 14,
};

const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "4px 14px",
  borderRadius: 6,
  border: "none",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  backgroundColor: active ? "var(--accent)" : "var(--border)",
  color: active ? "#fff" : "var(--text-secondary)",
});

const TIER_IDS = ["basic", "pro", "elite"] as const;

interface TierFeatureForm {
  teamsPerMatch: number;
  guruQuestionsPerDay: number;
  maxLeagues: number;
  fdrLevel: "basic" | "full" | "full_historical";
  hasProjectedPoints: boolean;
  hasConfidence: boolean;
  hasRateMyTeam: boolean;
  rateMyTeamPerDay: number;
  hasCaptainPicks: boolean;
  hasDifferentials: boolean;
  hasPlayingXI: boolean;
  hasPitchWeather: boolean;
  hasHeadToHead: boolean;
  isAdFree: boolean;
  guruPriority: boolean;
  dailyCoinDrip: number;
  hasPlayerStats: boolean;
  hasPlayerCompare: boolean;
  playerComparesPerDay: number;
  hasTeamSolver: boolean;
  teamSolverPerDay: number;
  hasPointsBreakdown: boolean;
  hasValueTracker: boolean;
  hasStatTopFives: boolean;
  hasGuruVerdict: boolean;
  predictionSuggestionsPerMatch: number;
}

interface TierForm {
  priceYearlyINR: number;
  priceYearlyUSD: number;
  hasFreeTrial: boolean;
  freeTrialDays: number;
  features: TierFeatureForm;
  displayFeatures: string[];
}

const FEATURE_LABELS: Record<keyof TierFeatureForm, string> = {
  teamsPerMatch: "Teams Per Match",
  guruQuestionsPerDay: "Guru Questions / Day",
  maxLeagues: "Max Leagues",
  fdrLevel: "FDR Level",
  hasProjectedPoints: "Projected Points",
  hasConfidence: "Confidence Intervals",
  hasRateMyTeam: "Rate My Team",
  rateMyTeamPerDay: "Rate My Team / Day",
  hasCaptainPicks: "AI Captain Picks",
  hasDifferentials: "Differentials",
  hasPlayingXI: "Playing XI Prediction",
  hasPitchWeather: "Weather & Pitch Report",
  hasHeadToHead: "Head to Head Stats",
  isAdFree: "Ad-Free",
  guruPriority: "Priority Guru",
  dailyCoinDrip: "Daily Pop Coins",
  hasPlayerStats: "Player Stats Tables",
  hasPlayerCompare: "Player Comparison",
  playerComparesPerDay: "Player Compares / Day",
  hasTeamSolver: "Team Solver (Auto-Pick)",
  teamSolverPerDay: "Team Solver / Day",
  hasPointsBreakdown: "Points Breakdown",
  hasValueTracker: "Value Tracker",
  hasStatTopFives: "Stat Top Fives",
  hasGuruVerdict: "Guru's Verdict (Team Review)",
  predictionSuggestionsPerMatch: "AI Prediction Suggestions / Match",
};

export function TierConfigEditor() {
  const configs = trpc.subscription.admin.getTierConfigs.useQuery();
  const update = trpc.subscription.admin.updateTierConfigs.useMutation({
    onSuccess: () => configs.refetch(),
  });

  const [forms, setForms] = useState<Record<string, TierForm>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (configs.data) {
      const initial: Record<string, TierForm> = {};
      for (const tier of TIER_IDS) {
        const c = configs.data[tier];
        initial[tier] = {
          priceYearlyINR: (c as any).priceYearlyINR ?? 0,
          priceYearlyUSD: (c as any).priceYearlyUSD ?? 0,
          hasFreeTrial: (c as any).hasFreeTrial ?? false,
          freeTrialDays: (c as any).freeTrialDays ?? 0,
          features: { ...c.features },
          displayFeatures: [...c.displayFeatures],
        };
      }
      setForms(initial);
      setDirty(false);
    }
  }, [configs.data]);

  const updateTier = (tier: string, patch: Partial<TierForm>) => {
    setForms((prev) => ({ ...prev, [tier]: { ...prev[tier], ...patch } }));
    setDirty(true);
  };

  const updateFeature = (tier: string, key: keyof TierFeatureForm, value: any) => {
    setForms((prev) => ({
      ...prev,
      [tier]: { ...prev[tier], features: { ...prev[tier].features, [key]: value } },
    }));
    setDirty(true);
  };

  const handleSave = () => {
    const tiers: Record<string, any> = {};
    for (const tier of TIER_IDS) {
      tiers[tier] = {
        priceYearlyINR: forms[tier].priceYearlyINR,
        priceYearlyUSD: forms[tier].priceYearlyUSD,
        hasFreeTrial: forms[tier].hasFreeTrial,
        freeTrialDays: forms[tier].freeTrialDays,
        features: forms[tier].features,
        displayFeatures: forms[tier].displayFeatures,
      };
    }
    update.mutate({ tiers });
    setDirty(false);
  };

  if (configs.isLoading || Object.keys(forms).length === 0) {
    return <p style={{ color: "var(--text-muted)" }}>Loading tier configs...</p>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Toggle features and adjust pricing for each subscription tier. Changes apply immediately after saving.
        </p>
        <button
          onClick={handleSave}
          disabled={!dirty || update.isPending}
          style={{
            padding: "8px 24px",
            backgroundColor: dirty ? "var(--accent)" : "var(--border)",
            color: dirty ? "#fff" : "var(--text-muted)",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: dirty ? "pointer" : "not-allowed",
            opacity: update.isPending ? 0.7 : 1,
          }}
        >
          {update.isPending ? "Saving..." : "Save All Changes"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {TIER_IDS.map((tier) => {
          const form = forms[tier];
          if (!form) return null;

          return (
            <div key={tier} style={sectionStyle}>
              <h3 style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 16,
                color: tier === "basic" ? "var(--text-secondary)" : tier === "pro" ? "var(--accent)" : "var(--amber)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                {tier}
              </h3>

              {/* Pricing — Yearly */}
              <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>
                Yearly Pricing
              </h4>
              <div style={rowStyle}>
                <span>INR (₹/yr)</span>
                <input
                  type="number"
                  min={0}
                  value={Math.round(form.priceYearlyINR / 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    updateTier(tier, { priceYearlyINR: v * 100 });
                  }}
                  style={inputStyle}
                />
              </div>
              <div style={{ ...rowStyle, color: "var(--text-muted)", fontSize: 12 }}>
                <span>Paise</span>
                <span style={{ fontFamily: "var(--font-data)" }}>{form.priceYearlyINR}</span>
              </div>
              <div style={rowStyle}>
                <span>USD ($/yr)</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={(form.priceYearlyUSD / 100).toFixed(2)}
                  onChange={(e) => {
                    const v = Math.round(Number(e.target.value) * 100);
                    updateTier(tier, { priceYearlyUSD: v });
                  }}
                  style={inputStyle}
                />
              </div>
              <div style={rowStyle}>
                <span>Free Trial</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => updateTier(tier, { hasFreeTrial: !form.hasFreeTrial })}
                    style={toggleBtnStyle(form.hasFreeTrial)}
                  >
                    {form.hasFreeTrial ? "ON" : "OFF"}
                  </button>
                  {form.hasFreeTrial && (
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={form.freeTrialDays}
                      onChange={(e) => updateTier(tier, { freeTrialDays: Number(e.target.value) || 7 })}
                      style={{ ...inputStyle, width: 50 }}
                    />
                  )}
                  {form.hasFreeTrial && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>days</span>}
                </div>
              </div>

              {/* Feature Toggles */}
              <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginTop: 16, marginBottom: 8, textTransform: "uppercase" }}>
                Features
              </h4>
              {(Object.keys(FEATURE_LABELS) as (keyof TierFeatureForm)[]).map((key) => {
                const value = form.features[key];

                if (typeof value === "boolean") {
                  return (
                    <div key={key} style={rowStyle}>
                      <span>{FEATURE_LABELS[key]}</span>
                      <button
                        onClick={() => updateFeature(tier, key, !value)}
                        style={toggleBtnStyle(value)}
                      >
                        {value ? "ON" : "OFF"}
                      </button>
                    </div>
                  );
                }

                if (key === "fdrLevel") {
                  return (
                    <div key={key} style={rowStyle}>
                      <span>{FEATURE_LABELS[key]}</span>
                      <select
                        value={value as string}
                        onChange={(e) => updateFeature(tier, key, e.target.value)}
                        style={{ ...inputStyle, width: 130 }}
                      >
                        <option value="basic">Basic</option>
                        <option value="full">Full</option>
                        <option value="full_historical">Full + Historical</option>
                      </select>
                    </div>
                  );
                }

                // Numeric — teamsPerMatch, guruQuestionsPerDay, limits
                return (
                  <div key={key} style={rowStyle}>
                    <span>{FEATURE_LABELS[key]}</span>
                    <input
                      type="number"
                      min={0}
                      value={value as number}
                      onChange={(e) => updateFeature(tier, key, Number(e.target.value) || 0)}
                      style={{ ...inputStyle, width: 60 }}
                    />
                  </div>
                );
              })}

              {/* Display Features */}
              <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginTop: 16, marginBottom: 8, textTransform: "uppercase" }}>
                Display Features (shown to users)
              </h4>
              {form.displayFeatures.map((feat, idx) => (
                <div key={idx} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    <button
                      onClick={() => {
                        if (idx === 0) return;
                        const updated = [...form.displayFeatures];
                        [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
                        updateTier(tier, { displayFeatures: updated });
                      }}
                      disabled={idx === 0}
                      style={{
                        border: "none", background: "none", cursor: idx === 0 ? "default" : "pointer",
                        color: idx === 0 ? "var(--border)" : "var(--text-muted)", fontSize: 10, padding: "0 2px", lineHeight: 1,
                      }}
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => {
                        if (idx === form.displayFeatures.length - 1) return;
                        const updated = [...form.displayFeatures];
                        [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
                        updateTier(tier, { displayFeatures: updated });
                      }}
                      disabled={idx === form.displayFeatures.length - 1}
                      style={{
                        border: "none", background: "none", cursor: idx === form.displayFeatures.length - 1 ? "default" : "pointer",
                        color: idx === form.displayFeatures.length - 1 ? "var(--border)" : "var(--text-muted)", fontSize: 10, padding: "0 2px", lineHeight: 1,
                      }}
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 16, textAlign: "center" }}>{idx + 1}</span>
                  <input
                    type="text"
                    value={feat}
                    onChange={(e) => {
                      const updated = [...form.displayFeatures];
                      updated[idx] = e.target.value;
                      updateTier(tier, { displayFeatures: updated });
                    }}
                    style={{ ...inputStyle, width: "100%", fontSize: 12 }}
                  />
                  <button
                    onClick={() => {
                      const updated = form.displayFeatures.filter((_, i) => i !== idx);
                      updateTier(tier, { displayFeatures: updated });
                    }}
                    style={{ border: "none", background: "none", color: "var(--red)", cursor: "pointer", fontSize: 14, padding: "0 4px" }}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => updateTier(tier, { displayFeatures: [...form.displayFeatures, ""] })}
                style={{ marginTop: 4, border: "1px dashed var(--border)", background: "none", color: "var(--text-muted)", padding: "4px 12px", borderRadius: 4, fontSize: 12, cursor: "pointer" }}
              >
                + Add Feature Line
              </button>
            </div>
          );
        })}
      </div>

      {update.isSuccess && (
        <p style={{ color: "var(--accent)", fontSize: 13, marginTop: 12 }}>Tier configs saved successfully.</p>
      )}
      {update.isError && (
        <p style={{ color: "var(--red)", fontSize: 13, marginTop: 12 }}>Error: {update.error.message}</p>
      )}
    </div>
  );
}
