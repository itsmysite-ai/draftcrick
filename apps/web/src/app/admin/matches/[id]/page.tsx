"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { DataTable } from "../../_components/DataTable";

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
  const [resultText, setResultText] = useState("");
  const [creating, setCreating] = useState(false);
  const [contestName, setContestName] = useState("Free Contest");
  const [contestFee, setContestFee] = useState(0);
  const [contestMax, setContestMax] = useState(100);

  const matchQuery = trpc.admin.matches.getById.useQuery(
    { matchId },
    { enabled: !!matchId }
  );
  const match = matchQuery.data;

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
      matchQuery.refetch();
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

  const enrichPlayers = trpc.admin.matches.enrichPlayers.useMutation({
    onSuccess: (data: any) => {
      playersQuery.refetch();
      alert(`Enriched ${data.enriched} of ${data.total} players`);
    },
    onError: (err) => alert(`Error: ${err.message}`),
  });

  const refreshMatch = trpc.admin.matches.refreshMatch.useMutation({
    onSuccess: (data) => {
      matchQuery.refetch();
      alert(`Match refreshed: ${(data as any).changes?.join(", ") || "no changes"}`);
    },
    onError: (err) => alert(`Error: ${err.message}`),
  });

  const updatePhase = trpc.admin.matches.updatePhase.useMutation({
    onSuccess: (data) => {
      matchQuery.refetch();
      contestsQuery.refetch();
      playersQuery.refetch();
      const actions = (data as any)?.lifecycleActions;
      if (actions && actions.length > 0) {
        alert(`Phase updated. Automation:\n${actions.join("\n")}`);
      }
    },
    onError: (err) => alert(`Error: ${err.message}`),
  });

  if (!match && !matchQuery.isLoading) {
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
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Phase</div>
            <select
              value={match.matchPhase}
              onChange={(e) => updatePhase.mutate({ matchId, phase: e.target.value })}
              disabled={updatePhase.isPending}
              style={{
                padding: "4px 8px",
                border: "1px solid var(--border)",
                borderRadius: 4,
                fontSize: 14,
                fontWeight: 600,
                backgroundColor: "var(--bg)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              <option value="idle">idle</option>
              <option value="pre_match">pre_match</option>
              <option value="live">live</option>
              <option value="post_match">post_match</option>
              <option value="completed">completed</option>
            </select>
          </div>
          <InfoItem label="Format" value={match.format} />
          <InfoItem label="Tournament" value={(match as any).tournamentName || match.tournament || "—"} />
          <InfoItem label="Venue" value={match.venue || "—"} />
          <InfoItem label="Start Time" value={match.startTime ? new Date(match.startTime).toLocaleString() : "—"} />
          <InfoItem label="Toss" value={match.tossWinner ? `${match.tossWinner} (${match.tossDecision})` : "—"} />
          <InfoItem label="Score" value={match.scoreSummary || "—"} />
          <InfoItem label="Result" value={match.result || "—"} />
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Draft</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: match.draftEnabled ? "#22c55e" : "var(--text-muted)" }}>
              {match.draftEnabled ? "Enabled" : "Disabled"}
            </div>
          </div>
        </div>
      </div>

      {/* Phase Automation Guide */}
      <div style={{ ...cardStyle, marginTop: 16, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>Phase Automation:</span>
          <PhaseStep phase="pre_match" current={match.matchPhase} label="Draft opens, users notified" />
          <span style={{ color: "var(--text-muted)" }}>→</span>
          <PhaseStep phase="live" current={match.matchPhase} label="Contests lock, draft closes" />
          <span style={{ color: "var(--text-muted)" }}>→</span>
          <PhaseStep phase="post_match" current={match.matchPhase} label="Contests settle, prizes awarded" />
          <span style={{ color: "var(--text-muted)" }}>→</span>
          <PhaseStep phase="completed" current={match.matchPhase} label="Final cleanup" />
        </div>
      </div>

      {/* Lifecycle Controls */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Manual Controls</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => refreshMatch.mutate({ matchId })}
            disabled={refreshMatch.isPending}
            style={btnStyle("var(--text-secondary)")}
          >
            {refreshMatch.isPending ? "Refreshing..." : "Refresh Match Data"}
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
              placeholder="e.g. MI won by 5 wickets"
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
            <>
              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={() => enrichPlayers.mutate({ matchId })}
                  disabled={enrichPlayers.isPending}
                  title="AI-enrich form, sentiment, injury data"
                  style={btnStyle("var(--accent)")}
                >
                  {enrichPlayers.isPending ? "Enriching..." : `Enrich ${players.length} Players`}
                </button>
              </div>
            <DataTable
              columns={[
                { key: "name", header: "Name" },
                { key: "team", header: "Team" },
                { key: "role", header: "Role" },
                {
                  key: "credits",
                  header: "Credits",
                  render: (row: any) => {
                    const s = (row.stats as any) ?? {};
                    const val = s.adminCredits ?? s.calculatedCredits ?? s.credits;
                    return val != null ? <span style={{ fontWeight: 600 }}>{val}</span> : "—";
                  },
                  sortValue: (row: any) => {
                    const s = (row.stats as any) ?? {};
                    return s.adminCredits ?? s.calculatedCredits ?? s.credits ?? null;
                  },
                },
                {
                  key: "avgFP",
                  header: "Avg FP",
                  render: (row: any) => {
                    const v = (row.stats as any)?.recentAvgFP;
                    return v != null ? <span style={{ fontWeight: 600, color: "var(--accent)" }}>{v}</span> : "—";
                  },
                  sortValue: (row: any) => (row.stats as any)?.recentAvgFP ?? null,
                },
                {
                  key: "runs",
                  header: "Runs",
                  render: (row: any) => row.score?.runs ?? "—",
                  sortValue: (row: any) => row.score?.runs ?? null,
                },
                {
                  key: "wickets",
                  header: "Wkts",
                  render: (row: any) => row.score?.wickets ?? "—",
                  sortValue: (row: any) => row.score?.wickets ?? null,
                },
                {
                  key: "catches",
                  header: "Catches",
                  render: (row: any) => row.score?.catches ?? "—",
                  sortValue: (row: any) => row.score?.catches ?? null,
                },
                {
                  key: "fantasyPoints",
                  header: "Fantasy Pts",
                  render: (row: any) => (
                    <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                      {row.score?.fantasyPoints ? Number(row.score.fantasyPoints).toFixed(1) : "—"}
                    </span>
                  ),
                  sortValue: (row: any) => row.score?.fantasyPoints ? Number(row.score.fantasyPoints) : null,
                },
              ]}
              data={players}
              defaultSort={{ key: "fantasyPoints", dir: "desc" }}
            />
            </>
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
            <DataTable
              columns={[
                { key: "name", header: "Name" },
                {
                  key: "status",
                  header: "Status",
                  render: (row: any) => (
                    <span style={{ color: STATUS_COLORS[row.status] ?? "var(--text-primary)", fontWeight: 600 }}>
                      {row.status}
                    </span>
                  ),
                },
                { key: "contestType", header: "Type" },
                {
                  key: "entries",
                  header: "Entries",
                  render: (row: any) => `${row.currentEntries}/${row.maxEntries}`,
                  sortValue: (row: any) => row.currentEntries,
                },
                {
                  key: "entryFee",
                  header: "Fee",
                  render: (row: any) => row.entryFee === 0 ? "FREE" : `${row.entryFee} PC`,
                  sortValue: (row: any) => Number(row.entryFee),
                },
                {
                  key: "prizePool",
                  header: "Prize Pool",
                  render: (row: any) => (
                    <span style={{ fontWeight: 600 }}>{row.prizePool} PC</span>
                  ),
                  sortValue: (row: any) => Number(row.prizePool),
                },
              ]}
              data={contestsList}
            />
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


const linkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--accent)",
  fontSize: 14,
  cursor: "pointer",
  padding: 0,
};

const PHASE_ORDER = ["idle", "pre_match", "live", "post_match", "completed"];

function PhaseStep({ phase, current, label }: { phase: string; current: string; label: string }) {
  const currentIdx = PHASE_ORDER.indexOf(current);
  const stepIdx = PHASE_ORDER.indexOf(phase);
  const isDone = currentIdx > stepIdx;
  const isActive = current === phase;

  return (
    <div style={{
      padding: "4px 10px",
      borderRadius: 6,
      border: `1px solid ${isActive ? "var(--accent)" : isDone ? "#22c55e" : "var(--border)"}`,
      backgroundColor: isActive ? "rgba(59,130,246,0.1)" : isDone ? "rgba(34,197,94,0.08)" : "transparent",
    }}>
      <div style={{ fontWeight: 600, color: isActive ? "var(--accent)" : isDone ? "#22c55e" : "var(--text-muted)" }}>
        {isDone ? "✓ " : ""}{phase}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{label}</div>
    </div>
  );
}
