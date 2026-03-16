"use client";

import React, { useState } from "react";

type Section = "credits" | "sources" | "injury" | "override";

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: "credits", label: "Credit Calculation" },
  { id: "sources", label: "Credit Sources" },
  { id: "injury", label: "Injury Adjustments" },
  { id: "override", label: "Admin Override" },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<Section>("credits");

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Documentation</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
        Cricket credit calculation engine reference. Other sports (F1, football) will use separate engines.
      </p>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: activeSection === s.id ? 600 : 400,
              color: activeSection === s.id ? "var(--accent)" : "var(--text-secondary)",
              backgroundColor: activeSection === s.id ? "var(--bg)" : "transparent",
              border: activeSection === s.id ? "1px solid var(--border)" : "1px solid transparent",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === "credits" && <CreditCalculationSection />}
      {activeSection === "sources" && <CreditSourcesSection />}
      {activeSection === "injury" && <InjurySection />}
      {activeSection === "override" && <OverrideSection />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Credit Calculation Section                                        */
/* ------------------------------------------------------------------ */

function CreditCalculationSection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <InfoCard title="Overview">
        <p>
          Player credits range from <strong>7.0 to 10.0</strong> (1 decimal). They represent a
          player&apos;s fantasy value based on career stats, recent form, media sentiment, and
          experience. Credits are recalculated deterministically whenever player data is enriched.
        </p>
        <p style={{ marginTop: 8 }}>
          Each stat is scaled to 7.0&ndash;10.0 independently, then combined using role-specific
          weights. The formula has two modes: <strong>pre-season</strong> (career stats only) and{" "}
          <strong>in-season</strong> (when recent average fantasy points are available from actual
          match data).
        </p>
      </InfoCard>

      <InfoCard title="Stat Scaling Ranges">
        <p style={{ marginBottom: 8, fontSize: 12, color: "var(--text-muted)" }}>
          Each raw stat is linearly scaled to the 7.0&ndash;10.0 output range. Values outside the
          range are clamped. For inverse stats (lower = better), the scale is reversed.
        </p>
        <Table
          headers={["Stat", "Direction", "Input Range", "Example"]}
          rows={[
            ["Batting Average", "Higher = better", "15 \u2013 55", "Avg 35 \u2192 8.5"],
            ["Strike Rate", "Higher = better", "100 \u2013 180", "SR 140 \u2192 8.5"],
            ["Bowling Average", "Lower = better", "12 \u2013 40", "Avg 22 \u2192 8.93"],
            ["Economy Rate", "Lower = better", "5 \u2013 12", "Econ 7.25 \u2192 9.04"],
            ["Bowling Strike Rate", "Lower = better", "10 \u2013 30", "SR 18 \u2192 8.80"],
            ["Experience (matches)", "More = better (x\u2070\u00B7\u2076 curve)", "0 \u2013 100 (power curve)", "16m \u2192 8.0, 50m \u2192 9.0, 100+ \u2192 10.0"],
            ["Form (1\u201310)", "Higher = better", "1 \u2013 10", "Form 9 \u2192 9.67"],
            ["Sentiment (1\u201310)", "Higher = better", "1 \u2013 10", "Buzz 10 \u2192 10.0"],
            ["Recent Avg FP", "Higher = better", "15 \u2013 80 pts", "50 pts \u2192 8.62"],
          ]}
        />
        <p style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
          Missing or zero stats default to <strong>7.0</strong> (cheap pick / unknown).
          Missing form and sentiment default to <strong>8.0</strong> (neutral).
        </p>
      </InfoCard>

      {/* Role: Batsman */}
      <InfoCard title="Batsman">
        <p style={{ marginBottom: 12 }}>Primary signal: batting average and strike rate.</p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <WeightTable
            label="Pre-season (no match FP data)"
            rows={[
              ["Batting Average", "30%"],
              ["Strike Rate", "20%"],
              ["Experience", "15%"],
              ["Recent Form", "15%"],
              ["Sentiment", "10%"],
              ["Baseline", "10%"],
            ]}
          />
          <WeightTable
            label="In-season (with recent avg FP)"
            rows={[
              ["Recent Avg FP", "30%"],
              ["Batting Average", "20%"],
              ["Strike Rate", "15%"],
              ["Experience", "15%"],
              ["Form", "10%"],
              ["Sentiment", "10%"],
            ]}
          />
        </div>
      </InfoCard>

      {/* Role: Bowler */}
      <InfoCard title="Bowler">
        <p style={{ marginBottom: 12 }}>Primary signal: bowling average, economy, and experience.</p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <WeightTable
            label="Pre-season"
            rows={[
              ["Bowling Average", "25%"],
              ["Economy Rate", "20%"],
              ["Experience", "20%"],
              ["Recent Form", "15%"],
              ["Bowling Strike Rate", "10%"],
              ["Sentiment", "10%"],
            ]}
          />
          <WeightTable
            label="In-season"
            rows={[
              ["Recent Avg FP", "25%"],
              ["Bowling Average", "20%"],
              ["Economy Rate", "15%"],
              ["Experience", "15%"],
              ["Bowling SR", "10%"],
              ["Form", "10%"],
              ["Sentiment", "5%"],
            ]}
          />
        </div>
      </InfoCard>

      {/* Role: All-Rounder */}
      <InfoCard title="All-Rounder">
        <p style={{ marginBottom: 12 }}>
          Blends batting sub-score (60% avg + 40% SR) and bowling sub-score (60% bowl avg + 40%
          econ). Balanced players get a bonus via the &quot;balance&quot; factor (min of batting/bowling
          sub-scores).
        </p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <WeightTable
            label="Pre-season"
            rows={[
              ["Batting Sub-score", "25%"],
              ["Bowling Sub-score", "25%"],
              ["Experience", "15%"],
              ["Recent Form", "10%"],
              ["Sentiment", "10%"],
              ["Balance Bonus", "5%"],
              ["Baseline", "10%"],
            ]}
          />
          <WeightTable
            label="In-season"
            rows={[
              ["Recent Avg FP", "30%"],
              ["Batting Sub-score", "15%"],
              ["Bowling Sub-score", "15%"],
              ["Experience", "10%"],
              ["Form", "10%"],
              ["Sentiment", "10%"],
              ["Balance Bonus", "10%"],
            ]}
          />
        </div>
      </InfoCard>

      {/* Role: Wicket-Keeper */}
      <InfoCard title="Wicket-Keeper">
        <p style={{ marginBottom: 12 }}>
          Similar to batsman but with slightly lower batting weight to account for keeping value.
        </p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <WeightTable
            label="Pre-season"
            rows={[
              ["Batting Average", "25%"],
              ["Strike Rate", "20%"],
              ["Experience", "15%"],
              ["Recent Form", "15%"],
              ["Sentiment", "10%"],
              ["Baseline", "15%"],
            ]}
          />
          <WeightTable
            label="In-season"
            rows={[
              ["Recent Avg FP", "30%"],
              ["Batting Average", "20%"],
              ["Strike Rate", "15%"],
              ["Experience", "15%"],
              ["Form", "10%"],
              ["Sentiment", "10%"],
            ]}
          />
        </div>
      </InfoCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Credit Sources Section                                            */
/* ------------------------------------------------------------------ */

function CreditSourcesSection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <InfoCard title="Credit Priority">
        <p style={{ marginBottom: 12 }}>
          Multiple credit values can exist for a player. The system uses the highest-priority
          available value:
        </p>
        <Table
          headers={["Priority", "Source", "Badge", "Color", "Description"]}
          rows={[
            ["1 (highest)", "Admin Override", "OVR", "Amber", "Manually set by admin. Never overwritten by recalculation."],
            ["2", "Calculated", "CALC", "Green", "Deterministic output from the credits engine formula."],
            ["3", "Gemini AI", "GEM", "Gray", "Raw credits returned by Gemini during player fetch."],
            ["4 (lowest)", "Base", "\u2014", "\u2014", "Fallback value (default 8.0) when no other source exists."],
          ]}
        />
      </InfoCard>

      <InfoCard title="When Credits Are Recalculated">
        <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
          <li><strong>Initial player fetch</strong> \u2014 When players are fetched for a match via Cricbuzz/Gemini, credits are calculated from the incoming stats.</li>
          <li><strong>AI enrichment</strong> \u2014 When &quot;Enrich&quot; is clicked, form/sentiment/injury data is fetched from Gemini, and credits are recalculated with the enriched stats.</li>
          <li><strong>Admin override</strong> \u2014 Manually set credits bypass all calculation. Use &quot;Reset&quot; to clear the override and revert to calculated credits.</li>
        </ul>
      </InfoCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Injury Section                                                    */
/* ------------------------------------------------------------------ */

function InjurySection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <InfoCard title="Injury Status Multipliers">
        <p style={{ marginBottom: 12 }}>
          Injury status applies a multiplier to the calculated credits <strong>after</strong> the
          role-based formula runs, <strong>before</strong> clamping to 7.0&ndash;10.0.
        </p>
        <Table
          headers={["Status", "Multiplier", "Effect", "Example (raw 9.3)"]}
          rows={[
            ["fit", "1.00x", "No change", "9.3"],
            ["recovered", "0.95x", "Slight discount \u2014 returning from injury", "8.8"],
            ["doubtful", "0.85x", "Significant risk \u2014 may not play", "7.9"],
            ["injured", "0.70x", "Heavy discount \u2014 unlikely to play", "7.0 (clamped)"],
          ]}
        />
        <p style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
          Injury status is fetched from Gemini AI during enrichment and reflects current media reports.
        </p>
      </InfoCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Override Section                                                   */
/* ------------------------------------------------------------------ */

function OverrideSection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <InfoCard title="Admin Override">
        <p>
          Admins can manually set credits for any player. This override is stored as{" "}
          <code style={{ fontSize: 12, padding: "1px 4px", backgroundColor: "var(--bg)", borderRadius: 3 }}>adminCredits</code>{" "}
          in the player&apos;s stats JSON and takes highest priority.
        </p>
        <ul style={{ paddingLeft: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <li><strong>Set override:</strong> Click &quot;Edit&quot; next to the credits column on the Players page or in a match&apos;s player list. Enter a value between 0 and 20.</li>
          <li><strong>Clear override:</strong> Click &quot;Reset&quot; to remove the admin override. The player reverts to the calculated (CALC) credits.</li>
          <li><strong>Persistence:</strong> Admin overrides survive re-enrichment and recalculation. They are only cleared by explicit &quot;Reset&quot; action.</li>
        </ul>
      </InfoCard>

      <InfoCard title="When to Override">
        <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
          <li>Player has stale/incorrect stats from Gemini (e.g., wrong bowling average)</li>
          <li>Breaking news not yet reflected in AI data (last-minute injury, form change)</li>
          <li>Balancing for gameplay purposes (e.g., a player is consistently over/under-picked)</li>
          <li>Tournament-specific adjustments (e.g., player performs differently at a specific venue)</li>
        </ul>
      </InfoCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared Components                                                 */
/* ------------------------------------------------------------------ */

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 20,
        backgroundColor: "var(--bg-surface)",
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{title}</h3>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
        {children}
      </div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          fontFamily: "var(--font-data)",
        }}
      >
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderBottom: "2px solid var(--border)",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: "6px 10px",
                    borderBottom: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeightTable({ label, rows }: { label: string; rows: string[][] }) {
  return (
    <div style={{ flex: 1, minWidth: 240 }}>
      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>
        {label}
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--font-data)" }}>
        <tbody>
          {rows.map(([stat, weight], i) => (
            <tr key={i}>
              <td style={{ padding: "4px 8px", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                {stat}
              </td>
              <td
                style={{
                  padding: "4px 8px",
                  borderBottom: "1px solid var(--border)",
                  fontWeight: 600,
                  color: "var(--accent)",
                  textAlign: "right",
                  width: 50,
                }}
              >
                {weight}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
