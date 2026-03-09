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

const TIER_IDS = ["free", "pro", "elite"] as const;

interface TierFeatureForm {
  teamsPerMatch: number | null;
  guruQuestionsPerDay: number | null;
  fdrLevel: "basic" | "full" | "full_historical";
  hasProjectedPoints: boolean;
  hasConfidence: boolean;
  hasRateMyTeam: boolean;
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
  hasTeamSolver: boolean;
  hasPointsBreakdown: boolean;
  hasValueTracker: boolean;
  hasStatTopFives: boolean;
}

interface TierForm {
  priceMonthly: number;
  priceInPaise: number;
  features: TierFeatureForm;
  displayFeatures: string[];
}

const FEATURE_LABELS: Record<keyof TierFeatureForm, string> = {
  teamsPerMatch: "Teams Per Match",
  guruQuestionsPerDay: "Guru Questions / Day",
  fdrLevel: "FDR Level",
  hasProjectedPoints: "Projected Points",
  hasConfidence: "Confidence Intervals",
  hasRateMyTeam: "Rate My Team",
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
  hasTeamSolver: "Team Solver (Auto-Pick)",
  hasPointsBreakdown: "Points Breakdown",
  hasValueTracker: "Value Tracker",
  hasStatTopFives: "Stat Top Fives",
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
          priceMonthly: c.priceMonthly,
          priceInPaise: c.priceInPaise,
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
        priceMonthly: forms[tier].priceMonthly,
        priceInPaise: forms[tier].priceInPaise,
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
                color: tier === "free" ? "var(--text-secondary)" : tier === "pro" ? "var(--accent)" : "var(--amber)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                {tier}
              </h3>

              {/* Pricing */}
              <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>
                Pricing
              </h4>
              <div style={rowStyle}>
                <span>Monthly (INR)</span>
                <input
                  type="number"
                  min={0}
                  value={form.priceMonthly}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    updateTier(tier, { priceMonthly: v, priceInPaise: v * 100 });
                  }}
                  style={inputStyle}
                  disabled={tier === "free"}
                />
              </div>
              <div style={{ ...rowStyle, color: "var(--text-muted)", fontSize: 12 }}>
                <span>Price in Paise</span>
                <span style={{ fontFamily: "var(--font-data)" }}>{form.priceInPaise}</span>
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

                // Numeric (nullable) — teamsPerMatch, guruQuestionsPerDay
                return (
                  <div key={key} style={rowStyle}>
                    <span>{FEATURE_LABELS[key]}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="number"
                        min={0}
                        value={value === null ? "" : value as number}
                        placeholder="∞"
                        onChange={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          updateFeature(tier, key, v);
                        }}
                        style={{ ...inputStyle, width: 60 }}
                      />
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {value === null ? "unlimited" : ""}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Display Features */}
              <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginTop: 16, marginBottom: 8, textTransform: "uppercase" }}>
                Display Features (shown to users)
              </h4>
              {form.displayFeatures.map((feat, idx) => (
                <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
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
                    style={{ border: "none", background: "none", color: "var(--red)", cursor: "pointer", fontSize: 16 }}
                  >
                    x
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
