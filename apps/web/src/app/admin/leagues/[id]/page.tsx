"use client";

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const FORMAT_LABELS: Record<string, string> = {
  cricket_manager: "Cricket Manager",
  salary_cap: "Salary Cap",
  draft: "Draft",
  auction: "Auction",
  prediction: "Prediction",
};

export default function AdminLeagueDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const leagueQuery = trpc.admin.leagues.get.useQuery(
    { leagueId: id },
    { enabled: !!id }
  );

  if (!id) return <div>Missing league id</div>;
  if (leagueQuery.isLoading) return <div>Loading…</div>;
  if (!leagueQuery.data) return <div>League not found</div>;

  const league = leagueQuery.data;

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/admin/leagues"
          style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}
        >
          ← Admin Leagues
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>{league.name}</h1>
        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 13, color: "var(--text-secondary)", flexWrap: "wrap" }}>
          <Tag>{FORMAT_LABELS[league.format] ?? league.format}</Tag>
          <Tag>{league.tournament}</Tag>
          <Tag>{league.isPrivate ? "Private" : "Public"}</Tag>
          <Tag>max {league.maxMembers}</Tag>
          <Tag>status: {league.status}</Tag>
          <Tag>{league.members?.length ?? 0} member(s)</Tag>
        </div>
      </div>

      {league.format === "cricket_manager" ? (
        <CricketManagerSection leagueId={id} tournament={league.tournament} />
      ) : (
        <div
          style={{
            padding: 24,
            backgroundColor: "var(--bg-surface)",
            borderRadius: 8,
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            fontSize: 14,
          }}
        >
          This league format uses the standard contest flow. Contests are auto-created from the
          league's tournament schedule. Manage them via the Contests page.
        </div>
      )}
    </div>
  );
}

// ─── Cricket Manager section (rounds + composer) ───────────────────────────

function CricketManagerSection({
  leagueId,
  tournament,
}: {
  leagueId: string;
  tournament: string;
}) {
  const roundsQuery = trpc.cricketManager.getLeagueRounds.useQuery({ leagueId });
  const [showComposer, setShowComposer] = useState(false);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Rounds</h2>
        <button
          onClick={() => setShowComposer((v) => !v)}
          style={{
            padding: "8px 16px",
            backgroundColor: showComposer ? "var(--bg-surface)" : "var(--accent)",
            color: showComposer ? "var(--text-primary)" : "white",
            border: showComposer ? "1px solid var(--border)" : "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showComposer ? "Cancel" : "+ Compose Round"}
        </button>
      </div>

      {showComposer && (
        <RoundComposer
          leagueId={leagueId}
          tournament={tournament}
          nextRoundNumber={(roundsQuery.data?.length ?? 0) + 1}
          onCreated={() => {
            setShowComposer(false);
            roundsQuery.refetch();
          }}
        />
      )}

      <div style={{ marginTop: 16 }}>
        {roundsQuery.isLoading ? (
          <div style={{ color: "var(--text-secondary)" }}>Loading rounds…</div>
        ) : (roundsQuery.data ?? []).length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              backgroundColor: "var(--bg-surface)",
              border: "1px dashed var(--border)",
              borderRadius: 8,
              color: "var(--text-secondary)",
              fontSize: 14,
            }}
          >
            No rounds yet. Compose your first round above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(roundsQuery.data ?? []).map((r: any) => (
              <RoundRow
                key={r.id}
                round={r}
                onChanged={() => roundsQuery.refetch()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RoundRow({
  round,
  onChanged,
}: {
  round: any;
  onChanged: () => void;
}) {
  const deleteRound = trpc.cricketManager.deleteRound.useMutation({ onSuccess: onChanged });

  return (
    <div
      style={{
        padding: 16,
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 12,
              fontWeight: 700,
              backgroundColor: "rgba(61,153,104,0.1)",
              color: "var(--accent)",
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            R{round.roundNumber}
          </span>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{round.name}</div>
          <Tag>{round.status}</Tag>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          {round.matchesTotal} matches · window {formatDate(round.windowStart)} →{" "}
          {formatDate(round.windowEnd)} · lock {formatDate(round.lockTime)}
          {round.totalEntries > 0 && ` · ${round.totalEntries} entries`}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {round.status === "upcoming" && (
          <button
            onClick={() => {
              if (confirm(`Delete round "${round.name}"?`))
                deleteRound.mutate({ roundId: round.id });
            }}
            style={actionBtn("danger")}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function RoundComposer({
  leagueId,
  tournament,
  nextRoundNumber,
  onCreated,
}: {
  leagueId: string;
  tournament: string;
  nextRoundNumber: number;
  onCreated: () => void;
}) {
  const matchesQuery = trpc.admin.matches.list.useQuery({
    tournament,
    limit: 500,
  });
  const compose = trpc.cricketManager.composeRound.useMutation({
    onSuccess: onCreated,
  });

  const [roundNumber, setRoundNumber] = useState(nextRoundNumber);
  const [name, setName] = useState(`Round ${nextRoundNumber}`);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const sortedMatches = useMemo(() => {
    return [...(matchesQuery.data ?? [])].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }, [matchesQuery.data]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.size === 0) {
      setError("Select at least one match");
      return;
    }
    compose.mutate({
      leagueId,
      roundNumber,
      name: name.trim() || `Round ${roundNumber}`,
      matchIds: Array.from(selected),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: 16,
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 120 }}>
          <label style={labelStyle}>Round #</label>
          <input
            type="number"
            value={roundNumber}
            onChange={(e) => setRoundNumber(Number(e.target.value))}
            min={1}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Round name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            placeholder="Round 1 — Opening Fixtures"
          />
        </div>
      </div>

      <label style={labelStyle}>
        Matches ({selected.size} selected) — sorted by date
      </label>
      <div
        style={{
          maxHeight: 360,
          overflow: "auto",
          border: "1px solid var(--border)",
          borderRadius: 6,
          backgroundColor: "var(--bg)",
        }}
      >
        {matchesQuery.isLoading ? (
          <div style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>
            Loading matches…
          </div>
        ) : sortedMatches.length === 0 ? (
          <div style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>
            No matches found for tournament "{tournament}".
          </div>
        ) : (
          sortedMatches.map((m: any) => {
            const isSelected = selected.has(m.id);
            return (
              <label
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  backgroundColor: isSelected
                    ? "rgba(61,153,104,0.06)"
                    : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(m.id)}
                />
                <div style={{ flex: 1, display: "flex", gap: 10, alignItems: "center" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      minWidth: 130,
                    }}
                  >
                    {formatDate(m.startTime)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {m.teamHome} vs {m.teamAway}
                  </span>
                  <Tag>{m.status}</Tag>
                </div>
              </label>
            );
          })
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            backgroundColor: "rgba(229,72,77,0.1)",
            color: "var(--red)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      {compose.error && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            backgroundColor: "rgba(229,72,77,0.1)",
            color: "var(--red)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {compose.error.message}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button
          type="submit"
          disabled={compose.isPending}
          style={{
            padding: "8px 16px",
            backgroundColor: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: compose.isPending ? "not-allowed" : "pointer",
          }}
        >
          {compose.isPending ? "Composing…" : `Compose Round (${selected.size} matches)`}
        </button>
      </div>
    </form>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 4,
        backgroundColor: "rgba(94,93,90,0.1)",
        color: "var(--text-secondary)",
        fontFamily: "var(--font-data)",
      }}
    >
      {children}
    </span>
  );
}

function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  backgroundColor: "var(--bg)",
  color: "var(--text-primary)",
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-primary)",
  marginBottom: 4,
};

function actionBtn(variant: "neutral" | "accent" | "danger"): React.CSSProperties {
  const colors = {
    neutral: { border: "var(--border)", color: "var(--text-primary)" },
    accent: { border: "var(--accent)", color: "var(--accent)" },
    danger: { border: "var(--red)", color: "var(--red)" },
  }[variant];
  return {
    fontSize: 12,
    padding: "6px 10px",
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    backgroundColor: "transparent",
    color: colors.color,
    cursor: "pointer",
    fontWeight: 500,
  };
}
