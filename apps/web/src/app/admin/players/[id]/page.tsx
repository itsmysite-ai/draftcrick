"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

const ROLES = ["batsman", "bowler", "all_rounder", "wicket_keeper"] as const;

const STAT_LABELS: Record<string, string> = {
  average: "Batting Avg",
  bowlingAverage: "Bowling Avg",
  strikeRate: "Strike Rate",
  economyRate: "Economy",
  bowlingStrikeRate: "Bowl SR",
  matchesPlayed: "Matches",
  recentForm: "Form (1-10)",
  sentimentScore: "Sentiment (1-10)",
  injuryStatus: "Injury Status",
  formNote: "Form Note",
  credits: "Credits (active)",
  calculatedCredits: "Credits (calc)",
  geminiCredits: "Credits (Gemini)",
  adminCredits: "Credits (admin)",
};

const EDITABLE_STATS = [
  "average", "bowlingAverage", "strikeRate", "economyRate", "bowlingStrikeRate",
  "matchesPlayed", "recentForm", "sentimentScore", "injuryStatus", "formNote",
];

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600, backgroundColor: bg, color, textTransform: "uppercase" }}>
      {children}
    </span>
  );
}

function StatCard({ label, value, muted }: { label: string; value: string | number | null; muted?: boolean }) {
  return (
    <div style={{ padding: "10px 14px", backgroundColor: "var(--bg-surface)", borderRadius: 8, border: "1px solid var(--border)", minWidth: 120 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4, letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: muted ? "var(--text-muted)" : "var(--text-primary)", fontFamily: "var(--font-data)" }}>
        {value ?? "-"}
      </div>
    </div>
  );
}

export default function PlayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const playerId = params.id as string;

  const playerQuery = trpc.admin.players.getById.useQuery({ playerId }, { enabled: !!playerId });
  const utils = trpc.useUtils();

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editStats, setEditStats] = useState<Record<string, any>>({});
  const [refetchTeam, setRefetchTeam] = useState("");
  const [refetchTournament, setRefetchTournament] = useState("");

  const updatePlayer = trpc.admin.players.updatePlayer.useMutation({
    onSuccess: () => {
      utils.admin.players.getById.invalidate({ playerId });
      setEditing(false);
    },
  });

  const refetchMutation = trpc.admin.players.refetchFromCricbuzz.useMutation({
    onSuccess: () => {
      utils.admin.players.getById.invalidate({ playerId });
    },
  });

  const fixNationality = trpc.admin.players.fixNationality.useMutation({
    onSuccess: () => {
      utils.admin.players.getById.invalidate({ playerId });
    },
  });

  const player = playerQuery.data;

  if (playerQuery.isLoading) {
    return <div style={{ padding: 32, color: "var(--text-muted)" }}>Loading player...</div>;
  }

  if (!player) {
    return <div style={{ padding: 32, color: "var(--text-muted)" }}>Player not found</div>;
  }

  const stats = (player.stats as Record<string, any>) ?? {};
  const matchHistory = player.matchHistory ?? [];

  const startEditing = () => {
    setEditForm({
      name: player.name,
      team: player.team,
      role: player.role,
      nationality: player.nationality ?? "",
      battingStyle: player.battingStyle ?? "",
      bowlingStyle: player.bowlingStyle ?? "",
    });
    setEditStats(
      EDITABLE_STATS.reduce((acc, key) => {
        acc[key] = stats[key] ?? "";
        return acc;
      }, {} as Record<string, any>)
    );
    setEditing(true);
  };

  const saveEdits = () => {
    const cleanStats: Record<string, any> = {};
    for (const key of EDITABLE_STATS) {
      const val = editStats[key];
      if (val === "" || val === undefined) continue;
      if (key === "injuryStatus" || key === "formNote") {
        cleanStats[key] = String(val);
      } else {
        const num = parseFloat(val);
        if (!isNaN(num)) cleanStats[key] = num;
      }
    }

    updatePlayer.mutate({
      playerId,
      name: editForm.name || undefined,
      team: editForm.team || undefined,
      role: editForm.role as any || undefined,
      nationality: editForm.nationality || undefined,
      battingStyle: editForm.battingStyle || null,
      bowlingStyle: editForm.bowlingStyle || null,
      stats: Object.keys(cleanStats).length > 0 ? cleanStats : undefined,
    });
  };

  const creditSource = stats.adminCredits != null ? "ADMIN" : stats.calculatedCredits != null ? "CALC" : stats.geminiCredits != null ? "GEMINI" : null;
  const activeCredits = stats.adminCredits ?? stats.calculatedCredits ?? stats.geminiCredits ?? "-";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.push("/admin/players")}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--accent)", padding: 0 }}
        >
          &larr; Players
        </button>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        {player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt={player.name}
            style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }}
          />
        ) : null}
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{player.name}</h1>
        {player.isDisabled && <Badge color="var(--red)" bg="rgba(220,38,38,0.12)">Disabled</Badge>}
      </div>

      {/* Player Info Section */}
      <div style={{ display: "flex", gap: 24, marginBottom: 32, flexWrap: "wrap" }}>
        {/* Left: Info card */}
        <div style={{ flex: "1 1 400px", backgroundColor: "var(--bg-surface)", borderRadius: 10, border: "1px solid var(--border)", padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Player Info</h2>
            {!editing ? (
              <button onClick={startEditing} style={actionBtnStyle}>Edit</button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveEdits} disabled={updatePlayer.isPending} style={{ ...actionBtnStyle, backgroundColor: "var(--accent)", color: "#fff" }}>
                  {updatePlayer.isPending ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)} style={actionBtnStyle}>Cancel</button>
              </div>
            )}
          </div>

          {editing ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Name" value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} />
              <Field label="Team" value={editForm.team} onChange={(v) => setEditForm({ ...editForm, team: v })} />
              <div>
                <label style={labelStyle}>Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  style={inputStyle}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                </select>
              </div>
              <Field label="Nationality" value={editForm.nationality} onChange={(v) => setEditForm({ ...editForm, nationality: v })} />
              <Field label="Batting Style" value={editForm.battingStyle} onChange={(v) => setEditForm({ ...editForm, battingStyle: v })} />
              <Field label="Bowling Style" value={editForm.bowlingStyle} onChange={(v) => setEditForm({ ...editForm, bowlingStyle: v })} />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 14 }}>
              <InfoRow label="Team" value={player.team} />
              <InfoRow label="Role" value={player.role.replace("_", " ")} />
              <div style={{ padding: "6px 0", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--text-muted)", fontSize: 12, marginRight: 8 }}>Nationality:</span>
                <span style={{ color: "var(--text-primary)" }}>{player.nationality ?? "-"}</span>
                <button
                  onClick={() => fixNationality.mutate({ playerId })}
                  disabled={fixNationality.isPending}
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 4,
                    border: "1px solid #6366f1",
                    backgroundColor: "transparent",
                    color: "#6366f1",
                    cursor: fixNationality.isPending ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {fixNationality.isPending ? "Fixing..." : "Fix (AI)"}
                </button>
                {fixNationality.isSuccess && (
                  <span style={{ fontSize: 11, color: "#22c55e" }}>Fixed!</span>
                )}
                {fixNationality.isError && (
                  <span style={{ fontSize: 11, color: "var(--red)" }}>{fixNationality.error.message}</span>
                )}
              </div>
              <InfoRow label="Batting Style" value={player.battingStyle ?? "-"} />
              <InfoRow label="Bowling Style" value={player.bowlingStyle ?? "-"} />
              <InfoRow label="External ID" value={player.externalId} />
              <InfoRow label="Last Fetched" value={player.lastFetchedAt ? new Date(player.lastFetchedAt).toLocaleString() : "Never"} />
              <InfoRow label="Fetch Action" value={player.lastFetchAction ?? "-"} />
            </div>
          )}
        </div>

        {/* Right: Credits + Refetch */}
        <div style={{ flex: "0 1 320px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Credits card */}
          <div style={{ backgroundColor: "var(--bg-surface)", borderRadius: 10, border: "1px solid var(--border)", padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>Credits</h3>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-data)", marginBottom: 6 }}>
              {activeCredits}
              {creditSource && (
                <Badge
                  color={creditSource === "ADMIN" ? "var(--amber)" : creditSource === "CALC" ? "#22c55e" : "#9ca3af"}
                  bg={creditSource === "ADMIN" ? "rgba(212,164,61,0.15)" : creditSource === "CALC" ? "rgba(34,197,94,0.15)" : "rgba(156,163,175,0.15)"}
                >
                  {creditSource}
                </Badge>
              )}
            </div>
            {stats.geminiCredits != null && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Gemini: {stats.geminiCredits}</div>}
            {stats.calculatedCredits != null && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Calculated: {stats.calculatedCredits}</div>}
            {stats.adminCredits != null && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Admin Override: {stats.adminCredits}</div>}
          </div>

          {/* Refetch card */}
          <div style={{ backgroundColor: "var(--bg-surface)", borderRadius: 10, border: "1px solid var(--border)", padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>Refetch from Cricbuzz</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                placeholder={`Team (default: ${player.team})`}
                value={refetchTeam}
                onChange={(e) => setRefetchTeam(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="Tournament (default: IPL)"
                value={refetchTournament}
                onChange={(e) => setRefetchTournament(e.target.value)}
                style={inputStyle}
              />
              <button
                onClick={() => {
                  if (confirm(`Refetch ${player.name} from Cricbuzz?`)) {
                    refetchMutation.mutate({
                      playerId,
                      teamName: refetchTeam || undefined,
                      tournamentName: refetchTournament || undefined,
                    });
                  }
                }}
                disabled={refetchMutation.isPending}
                style={{
                  ...actionBtnStyle,
                  backgroundColor: refetchMutation.isPending ? "var(--bg)" : "var(--accent)",
                  color: refetchMutation.isPending ? "var(--text-muted)" : "#fff",
                  width: "100%",
                  textAlign: "center" as const,
                }}
              >
                {refetchMutation.isPending ? "Fetching..." : "Refetch Player"}
              </button>
              {refetchMutation.isSuccess && (
                <div style={{ fontSize: 12, color: "#22c55e" }}>
                  Refetched from {(refetchMutation.data as any)?.source ?? "cricbuzz"}
                </div>
              )}
              {refetchMutation.isError && (
                <div style={{ fontSize: 12, color: "var(--red)" }}>
                  {refetchMutation.error.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Stats</h2>
        </div>

        {editing ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {EDITABLE_STATS.map((key) => (
              <div key={key}>
                <label style={labelStyle}>{STAT_LABELS[key] ?? key}</label>
                <input
                  value={editStats[key] ?? ""}
                  onChange={(e) => setEditStats({ ...editStats, [key]: e.target.value })}
                  style={inputStyle}
                  placeholder="-"
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            <StatCard label="Batting Avg" value={stats.average} />
            <StatCard label="Strike Rate" value={stats.strikeRate} />
            <StatCard label="Bowling Avg" value={stats.bowlingAverage} />
            <StatCard label="Economy" value={stats.economyRate} />
            <StatCard label="Bowl SR" value={stats.bowlingStrikeRate} />
            <StatCard label="Matches" value={stats.matchesPlayed} />
            <StatCard label="Form" value={stats.recentForm} />
            <StatCard label="Sentiment" value={stats.sentimentScore} />
            <StatCard label="Injury" value={stats.injuryStatus} />
            {stats.formNote && <div style={{ gridColumn: "1 / -1", fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", padding: "4px 0" }}>{stats.formNote}</div>}
          </div>
        )}
      </div>

      {/* Match History */}
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>Match History ({matchHistory.length})</h2>
        {matchHistory.length === 0 ? (
          <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 14, textAlign: "center" }}>No match data</div>
        ) : (
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", backgroundColor: "var(--bg-surface)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Match", "Format", "Runs", "Balls", "4s", "6s", "Wkts", "Overs", "Conc", "Ct", "FP"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matchHistory.map((m: any, idx: number) => (
                  <tr key={m.matchId} style={{ borderBottom: idx < matchHistory.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "8px 10px", fontSize: 13 }}>
                      <div>{m.matchName ?? "-"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {m.matchDate ? new Date(m.matchDate).toLocaleDateString() : ""}{m.tournamentName ? ` · ${m.tournamentName}` : ""}
                      </div>
                    </td>
                    <td style={cellStyle}>{m.matchFormat ?? "-"}</td>
                    <td style={cellStyle}>{m.runs}</td>
                    <td style={cellStyle}>{m.ballsFaced}</td>
                    <td style={cellStyle}>{m.fours}</td>
                    <td style={cellStyle}>{m.sixes}</td>
                    <td style={cellStyle}>{m.wickets}</td>
                    <td style={cellStyle}>{m.oversBowled}</td>
                    <td style={cellStyle}>{m.runsConceded}</td>
                    <td style={cellStyle}>{m.catches}</td>
                    <td style={{ ...cellStyle, fontWeight: 600, color: "var(--accent)" }}>{m.fantasyPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Shared Styles ---

const actionBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 600,
  border: "1px solid var(--border)",
  borderRadius: 6,
  backgroundColor: "transparent",
  color: "var(--text-primary)",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 13,
  backgroundColor: "var(--bg)",
  color: "var(--text-primary)",
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  marginBottom: 4,
  letterSpacing: "0.04em",
};

const cellStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "var(--font-data)",
};

// --- Helper Components ---

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ padding: "6px 0" }}>
      <span style={{ color: "var(--text-muted)", fontSize: 12, marginRight: 8 }}>{label}:</span>
      <span style={{ color: "var(--text-primary)" }}>{value ?? "-"}</span>
    </div>
  );
}
