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

export default function AuctionConfigPage() {
  const config = trpc.admin.auctionConfig.getConfig.useQuery();
  const upsertSquadRule = trpc.admin.auctionConfig.upsertSquadRule.useMutation({ onSuccess: () => config.refetch() });
  const deleteSquadRule = trpc.admin.auctionConfig.deleteSquadRule.useMutation({ onSuccess: () => config.refetch() });
  const updatePlatform = trpc.admin.auctionConfig.updatePlatformSettings.useMutation({ onSuccess: () => config.refetch() });
  const forceResume = trpc.admin.auctionConfig.forceResume.useMutation({ onSuccess: () => { pausedAuctions.refetch(); } });
  const pausedAuctions = trpc.admin.auctionConfig.listPaused.useQuery();

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Auction Config</h1>
      <SquadRulesEditor
        rules={config.data?.squadRules ?? []}
        onSave={(rule) => upsertSquadRule.mutate(rule)}
        onDelete={(id) => deleteSquadRule.mutate({ id })}
        saving={upsertSquadRule.isPending}
      />
      <PlatformSettingsEditor
        maxPausesCap={config.data?.maxPausesCap ?? 5}
        bidIncrementOptions={config.data?.bidIncrementOptions ?? [0.1, 0.2, 0.5, 1.0]}
        defaults={config.data?.defaults ?? {}}
        onSave={(data) => updatePlatform.mutate(data)}
        saving={updatePlatform.isPending}
      />
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
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Squad Rules</h2>
        <button
          style={btnSecondary}
          onClick={() => setEditing({ ...emptyRule, id: `rule_${Date.now()}` })}
        >
          + Add Rule
        </button>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Define squad composition templates. League creators pick from these when setting up an auction.
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
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Platform Settings</h2>

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
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Paused Auctions</h2>

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
