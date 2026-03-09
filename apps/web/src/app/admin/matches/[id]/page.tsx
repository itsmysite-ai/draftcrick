"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";

type Tab = "players" | "contests";

const STATUS_COLORS: Record<string, string> = {
  upcoming: "var(--amber)",
  live: "var(--accent)",
  completed: "var(--text-muted)",
  open: "var(--amber)",
  settling: "var(--accent)",
  settled: "var(--text-muted)",
  cancelled: "var(--red)",
};

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;
  const [tab, setTab] = useState<Tab>("players");
  const [resultText, setResultText] = useState("India won by 6 wickets");
  const [creating, setCreating] = useState(false);
  const [contestName, setContestName] = useState("Free Contest");
  const [contestFee, setContestFee] = useState(0);
  const [contestMax, setContestMax] = useState(100);

  // Fetch match data from the list endpoint (filter by matchId)
  const matchQuery = trpc.admin.matches.list.useQuery({ limit: 1, offset: 0 });
  const allMatches = trpc.admin.matches.list.useQuery({ limit: 200, offset: 0 });
  const match = (allMatches.data ?? []).find((m: any) => m.id === matchId);

  const playersQuery = trpc.admin.matches.getPlayers.useQuery(
    { matchId },
    { enabled: !!matchId }
  );

  const contestsQuery = trpc.admin.contests.list.useQuery(
    { matchId },
    { enabled: !!matchId }
  );

  const seedScores = trpc.admin.matches.seedPlayerScores.useMutation({
    onSuccess: () => { playersQuery.refetch(); alert("Player scores seeded!"); },
    onError: (err) => alert(`Error: ${err.message}`),
  });

  const lifecycle = trpc.admin.matches.simulateLifecycle.useMutation({
    onSuccess: (data) => {
      alert(data.result);
      allMatches.refetch();
      contestsQuery.refetch();
      playersQuery.refetch();
    },
    onError: (err) => alert(`Error: ${err.message}`),
  });

  const createContest = trpc.admin.contests.create.useMutation({
    onSuccess: () => {
      setCreating(false);
      contestsQuery.refetch();
      alert("Contest created!");
    },
    onError: (err) => alert(`Error: ${err.message}`),
  });

  const refreshMatch = trpc.admin.matches.refreshMatch.useMutation({
    onSuccess: (data) => {
      allMatches.refetch();
      alert(`Match refreshed: ${(data as any).changes?.join(", ") || "no changes"}`);
    },
    onError: (err) => alert(`Error: ${err.message}`),
  });

  if (!match && !allMatches.isLoading) {
    return (
      <div>
        <button onClick={() => router.back()} style={linkStyle}>← Back</button>
        <p style={{ marginTop: 24, color: "var(--text-muted)" }}>Match not found.</p>
      </div>
    );
  }

  if (!match) {
    return <p style={{ color: "var(--text-muted)" }}>Loading...</p>;
  }

  const players = playersQuery.data ?? [];
  const contestsList = contestsQuery.data ?? [];
  const isPending = lifecycle.isPending || seedScores.isPending;

  const openContests = contestsList.filter((c: any) => c.status === "open").length;
  const liveContests = contestsList.filter((c: any) => c.status === "live").length;
  const settlingContests = contestsList.filter((c: any) => c.status === "settling").length;

  return (
    <div>
      {/* Header */}
      <button onClick={() => router.push("/admin/matches")} style={linkStyle}>← Back to Matches</button>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>
        {match.teamHome} vs {match.teamAway}
      </h1>

      {/* Match Info Card */}
      <div style={cardStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <InfoItem label="Status" value={match.status} color={STATUS_COLORS[match.status]} />
          <InfoItem label="Phase" value={match.matchPhase} />
          <InfoItem label="Format" value={match.format} />
          <InfoItem label="Tournament" value={match.tournament} />
          <InfoItem label="Venue" value={match.venue || "—"} />
          <InfoItem label="Start Time" value={match.startTime ? new Date(match.startTime).toLocaleString() : "—"} />
          <InfoItem label="Toss" value={match.tossWinner ? `${match.tossWinner} (${match.tossDecision})` : "—"} />
          <InfoItem label="Score" value={match.scoreSummary || "—"} />
          <InfoItem label="Result" value={match.result || "—"} />
        </div>
      </div>

      {/* Lifecycle Controls */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Lifecycle Controls</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => refreshMatch.mutate({ matchId })}
            disabled={refreshMatch.isPending}
            style={btnStyle("var(--text-secondary)")}
          >
            {refreshMatch.isPending ? "Refreshing..." : "Refresh from Gemini"}
          </button>

          <button
            onClick={() => lifecycle.mutate({ matchId, phase: "lock" })}
            disabled={isPending || openContests === 0}
            style={btnStyle("var(--amber)")}
            title={openContests === 0 ? "No open contests to lock" : `Lock ${openContests} open contest(s)`}
          >
            1. Lock Contests ({openContests})
          </button>

          <button
            onClick={() => seedScores.mutate({ matchId })}
            disabled={isPending || players.length === 0}
            style={btnStyle("var(--accent)")}
          >
            2. Seed Scores ({players.length} players)
          </button>

          <button
            onClick={() => lifecycle.mutate({ matchId, phase: "score" })}
            disabled={isPending || liveContests === 0}
            style={btnStyle("var(--accent)")}
            title={`Process scores for ${liveContests} live contest(s)`}
          >
            3. Process Scores ({liveContests})
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              value={resultText}
              onChange={(e) => setResultText(e.target.value)}
              placeholder="Match result text"
              style={inputStyle}
            />
            <button
              onClick={() => lifecycle.mutate({ matchId, phase: "complete", result: resultText })}
              disabled={isPending || match.status !== "live"}
              style={btnStyle("var(--red)")}
            >
              4. Complete Match
            </button>
          </div>

          <button
            onClick={() => lifecycle.mutate({ matchId, phase: "settle" })}
            disabled={isPending || settlingContests === 0}
            style={btnStyle("var(--accent)")}
            title={`Settle ${settlingContests} contest(s)`}
          >
            5. Settle Contests ({settlingContests})
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: 0, marginTop: 24, borderBottom: "2px solid var(--border)" }}>
        {(["players", "contests"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: tab === t ? 700 : 400,
              color: tab === t ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              backgroundColor: "transparent",
              border: "none",
              borderBottomWidth: 2,
              borderBottomStyle: "solid",
              borderBottomColor: tab === t ? "var(--accent)" : "transparent",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t} ({t === "players" ? players.length : contestsList.length})
          </button>
        ))}
      </div>

      {/* Players Tab */}
      {tab === "players" && (
        <div style={{ marginTop: 16 }}>
          {playersQuery.isLoading ? (
            <p style={{ color: "var(--text-muted)" }}>Loading players...</p>
          ) : players.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No players linked. Use "Fetch Players" on the tournament page first.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Team</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Runs</th>
                  <th style={thStyle}>Wkts</th>
                  <th style={thStyle}>Catches</th>
                  <th style={thStyle}>Fantasy Pts</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p: any) => (
                  <tr key={p.id}>
                    <td style={tdStyle}>{p.name}</td>
                    <td style={tdStyle}>{p.team}</td>
                    <td style={tdStyle}>{p.role}</td>
                    <td style={tdStyle}>{p.score?.runs ?? "—"}</td>
                    <td style={tdStyle}>{p.score?.wickets ?? "—"}</td>
                    <td style={tdStyle}>{p.score?.catches ?? "—"}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: "var(--accent)" }}>
                      {p.score?.fantasyPoints ? Number(p.score.fantasyPoints).toFixed(1) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Contests Tab */}
      {tab === "contests" && (
        <div style={{ marginTop: 16 }}>
          {/* Create Contest Button */}
          {!creating ? (
            <button onClick={() => setCreating(true)} style={{ ...btnStyle("var(--accent)"), marginBottom: 16 }}>
              + Create Contest
            </button>
          ) : (
            <div style={{ ...cardStyle, marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input value={contestName} onChange={(e) => setContestName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Entry Fee (PC)</label>
                <input type="number" value={contestFee} onChange={(e) => setContestFee(Number(e.target.value))} style={{ ...inputStyle, width: 80 }} />
              </div>
              <div>
                <label style={labelStyle}>Max Entries</label>
                <input type="number" value={contestMax} onChange={(e) => setContestMax(Number(e.target.value))} style={{ ...inputStyle, width: 80 }} />
              </div>
              <button
                onClick={() => createContest.mutate({
                  matchId,
                  name: contestName,
                  entryFee: String(contestFee),
                  maxEntries: contestMax,
                  contestType: "public",
                  isGuaranteed: false,
                  prizeDistribution: [],
                })}
                disabled={createContest.isPending}
                style={btnStyle("var(--accent)")}
              >
                {createContest.isPending ? "Creating..." : "Create"}
              </button>
              <button onClick={() => setCreating(false)} style={btnStyle("var(--text-muted)")}>Cancel</button>
            </div>
          )}

          {contestsQuery.isLoading ? (
            <p style={{ color: "var(--text-muted)" }}>Loading contests...</p>
          ) : contestsList.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No contests for this match. Create one above.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Entries</th>
                  <th style={thStyle}>Fee</th>
                  <th style={thStyle}>Prize Pool</th>
                </tr>
              </thead>
              <tbody>
                {contestsList.map((c: any) => (
                  <tr key={c.id}>
                    <td style={tdStyle}>{c.name}</td>
                    <td style={{ ...tdStyle, color: STATUS_COLORS[c.status] ?? "var(--text-primary)", fontWeight: 600 }}>
                      {c.status}
                    </td>
                    <td style={tdStyle}>{c.contestType}</td>
                    <td style={tdStyle}>{c.currentEntries}/{c.maxEntries}</td>
                    <td style={tdStyle}>{c.entryFee === 0 ? "FREE" : `${c.entryFee} PC`}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{c.prizePool} PC</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: color ?? "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 8,
  border: "1px solid var(--border)",
  backgroundColor: "var(--bg-surface)",
};

const btnStyle = (color: string): React.CSSProperties => ({
  padding: "8px 16px",
  backgroundColor: color,
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 13,
  backgroundColor: "var(--bg)",
  color: "var(--text-primary)",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  display: "block",
  marginBottom: 4,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "2px solid var(--border)",
  fontSize: 12,
  color: "var(--text-muted)",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--border)",
};

const linkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--accent)",
  fontSize: 14,
  cursor: "pointer",
  padding: 0,
};
