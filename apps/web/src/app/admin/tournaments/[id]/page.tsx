"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DataTable } from "../../_components/DataTable";

const PAGE_SIZE = 25;
const PLAYER_PAGE_SIZE = 50;

type Tab = "matches" | "players" | "standings" | "rules";

// ---------------------------------------------------------------------------
// Fetch action badge — reusable for matches, players, standings
// ---------------------------------------------------------------------------

function FetchBadge({ action, timestamp }: { action: string | null; timestamp: string | Date | null }) {
  if (!action) return null;
  const color = action === "new" ? "var(--accent)" : action === "updated" ? "var(--amber)" : "var(--text-muted)";
  const bg = action === "new" ? "rgba(61,153,104,0.15)" : action === "updated" ? "rgba(255,180,40,0.15)" : "rgba(120,120,120,0.1)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 600, backgroundColor: bg, color, textTransform: "uppercase" }}>
        {action}
      </span>
      {timestamp && (
        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
          {new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
          {new Date(timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fetch result summary — reusable
// ---------------------------------------------------------------------------

function FetchResultSummary({ data }: { data: { new: number; updated: number; skipped?: number; fetched?: number; total?: number } }) {
  const count = data.fetched ?? data.total ?? 0;
  return (
    <div style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.6 }}>
      <span style={{ color: "var(--text-secondary)" }}>Fetched {count}: </span>
      {data.new > 0 && <span style={{ color: "var(--accent)", fontWeight: 600 }}>{data.new} new</span>}
      {data.new > 0 && data.updated > 0 && <span style={{ color: "var(--text-muted)" }}> · </span>}
      {data.updated > 0 && <span style={{ color: "var(--amber)", fontWeight: 600 }}>{data.updated} updated</span>}
      {(data.new > 0 || data.updated > 0) && (data.skipped ?? 0) > 0 && <span style={{ color: "var(--text-muted)" }}> · </span>}
      {(data.skipped ?? 0) > 0 && <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{data.skipped} skipped</span>}
      {data.new === 0 && data.updated === 0 && (data.skipped ?? 0) === 0 && <span style={{ color: "var(--text-muted)" }}>no changes</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match Player Panel — shown when a match row is expanded
// ---------------------------------------------------------------------------

function MatchPlayerPanel({ matchId, matchStatus, onClose }: { matchId: string; matchStatus: string; onClose: () => void }) {
  const isCompleted = matchStatus === "completed";
  const utils = trpc.useUtils();
  const matchPlayers = trpc.admin.matches.getPlayers.useQuery({ matchId });

  // Diff review state
  const [pendingDiffs, setPendingDiffs] = useState<any[] | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

  const fetchPlayers = trpc.admin.matches.fetchPlayers.useMutation({
    onSuccess: (data: any) => {
      if (data.mode === "review") {
        // Filter out no_change entries — admin only sees new/updated
        const actionable = (data.diffs ?? []).filter((d: any) => d.changeType !== "no_change");
        setPendingDiffs(actionable);
        setApprovedIds(new Set());
        setRejectedIds(new Set());
      } else {
        // Auto-applied (first fetch)
        setPendingDiffs(null);
        utils.admin.matches.getPlayers.invalidate({ matchId });
      }
    },
  });

  const applyChanges = trpc.admin.matches.applyPlayerChanges.useMutation({
    onSuccess: () => {
      setPendingDiffs(null);
      setApprovedIds(new Set());
      setRejectedIds(new Set());
      utils.admin.matches.getPlayers.invalidate({ matchId });
    },
  });

  const toggleDisabled = trpc.admin.players.toggleDisabled.useMutation({
    onSuccess: () => { utils.admin.matches.getPlayers.invalidate({ matchId }); },
  });
  const removeFromMatch = trpc.admin.players.removeFromMatch.useMutation({
    onSuccess: () => { utils.admin.matches.getPlayers.invalidate({ matchId }); },
  });
  const addToMatch = trpc.admin.players.addToMatch.useMutation({
    onSuccess: () => {
      utils.admin.matches.getPlayers.invalidate({ matchId });
      setAddSearch("");
      setShowAddPanel(false);
    },
  });

  const enrichPlayers = trpc.admin.matches.enrichPlayers.useMutation({
    onSuccess: (data: any) => {
      utils.admin.matches.getPlayers.invalidate({ matchId });
      alert(`Enriched ${data.enriched} of ${data.total} players`);
    },
    onError: (err) => alert(`Enrich failed: ${err.message}`),
  });

  const [refreshingPlayerId, setRefreshingPlayerId] = useState<string | null>(null);

  const refreshPlayer = trpc.admin.matches.refreshPlayer.useMutation({
    onSuccess: (data: any) => {
      if (data.mode === "no_change") {
        // No changes — just clear loading state
        setRefreshingPlayerId(null);
      } else if (data.mode === "review") {
        // Merge single-player diffs into the pending diff view
        const newDiffs = data.diffs ?? [];
        setPendingDiffs((prev) => {
          if (!prev) return newDiffs;
          // Replace existing diffs for same externalId, add new ones
          const existingMap = new Map(prev.map((d: any) => [d.externalId, d]));
          for (const d of newDiffs) existingMap.set(d.externalId, d);
          return Array.from(existingMap.values());
        });
        setRefreshingPlayerId(null);
      }
    },
    onError: () => { setRefreshingPlayerId(null); },
  });

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const searchPlayers = trpc.admin.players.list.useQuery(
    { search: addSearch, limit: 10 },
    { enabled: showAddPanel && addSearch.length >= 2 }
  );

  const playerData = matchPlayers.data ?? [];
  const existingIds = new Set(playerData.map((p: any) => p.id));

  // Diff review helpers
  const toggleApprove = (extId: string) => {
    setApprovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(extId)) next.delete(extId); else next.add(extId);
      return next;
    });
    setRejectedIds((prev) => { const next = new Set(prev); next.delete(extId); return next; });
  };
  const toggleReject = (extId: string) => {
    setRejectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(extId)) next.delete(extId); else next.add(extId);
      return next;
    });
    setApprovedIds((prev) => { const next = new Set(prev); next.delete(extId); return next; });
  };
  const approveAll = () => {
    if (!pendingDiffs) return;
    setApprovedIds(new Set(pendingDiffs.map((d: any) => d.externalId)));
    setRejectedIds(new Set());
  };
  const rejectAll = () => {
    if (!pendingDiffs) return;
    setRejectedIds(new Set(pendingDiffs.map((d: any) => d.externalId)));
    setApprovedIds(new Set());
  };
  const handleApply = () => {
    if (!pendingDiffs) return;
    const approved = pendingDiffs.filter((d: any) => approvedIds.has(d.externalId));
    if (approved.length === 0) return;
    applyChanges.mutate({ matchId, approved });
  };

  return (
    <div style={{
      padding: "12px 16px", backgroundColor: "rgba(94,93,90,0.04)",
      borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Players ({playerData.length})</span>
          <button
            onClick={() => fetchPlayers.mutate({ matchId })}
            disabled={fetchPlayers.isPending}
            style={{
              padding: "4px 10px", backgroundColor: "var(--amber)", color: "#fff", border: "none",
              borderRadius: 4, fontSize: 11, fontWeight: 600,
              cursor: fetchPlayers.isPending ? "not-allowed" : "pointer",
              opacity: fetchPlayers.isPending ? 0.7 : 1,
            }}
          >
            {fetchPlayers.isPending ? "Fetching..." : "Fetch Players"}
          </button>
          <button
            onClick={() => enrichPlayers.mutate({ matchId })}
            disabled={enrichPlayers.isPending || playerData.length === 0}
            title={playerData.length === 0 ? "Fetch players first" : "AI-enrich form, sentiment, injury data"}
            style={{
              padding: "4px 10px", backgroundColor: "var(--accent)", color: "#fff", border: "none",
              borderRadius: 4, fontSize: 11, fontWeight: 600,
              cursor: enrichPlayers.isPending || playerData.length === 0 ? "not-allowed" : "pointer",
              opacity: enrichPlayers.isPending || playerData.length === 0 ? 0.7 : 1,
            }}
          >
            {enrichPlayers.isPending ? "Enriching..." : "Enrich Players"}
          </button>
          <button
            onClick={() => setShowAddPanel(!showAddPanel)}
            style={{
              padding: "4px 10px", backgroundColor: "transparent", color: "var(--accent)",
              border: "1px solid var(--accent)", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}
          >
            + Add Player
          </button>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14 }}>
          &times;
        </button>
      </div>

      {fetchPlayers.isError && (
        <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 8 }}>
          Fetch failed: {fetchPlayers.error.message}
        </div>
      )}

      {/* Auto-apply result summary (first fetch) */}
      {fetchPlayers.isSuccess && fetchPlayers.data.mode === "auto" && fetchPlayers.data.fetched > 0 && (
        <FetchResultSummary data={fetchPlayers.data} />
      )}

      {/* Diff review panel (re-fetch) */}
      {pendingDiffs !== null && (
        <div style={{ marginBottom: 12, border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{
            padding: "8px 12px", backgroundColor: "rgba(255,180,40,0.08)",
            borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
              Review Changes ({pendingDiffs.length} {pendingDiffs.length === 1 ? "change" : "changes"})
            </span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {pendingDiffs.length > 0 && (
                <>
                  <button onClick={approveAll} style={{ fontSize: 10, padding: "3px 8px", cursor: "pointer", background: "rgba(61,153,104,0.1)", border: "1px solid var(--accent)", borderRadius: 3, color: "var(--accent)", fontWeight: 600 }}>
                    Approve All
                  </button>
                  <button onClick={rejectAll} style={{ fontSize: 10, padding: "3px 8px", cursor: "pointer", background: "rgba(229,72,77,0.1)", border: "1px solid var(--red)", borderRadius: 3, color: "var(--red)", fontWeight: 600 }}>
                    Reject All
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={approvedIds.size === 0 || applyChanges.isPending}
                    style={{
                      fontSize: 10, padding: "3px 10px", cursor: approvedIds.size === 0 ? "not-allowed" : "pointer",
                      backgroundColor: approvedIds.size > 0 ? "var(--accent)" : "var(--text-muted)",
                      color: "#fff", border: "none", borderRadius: 3, fontWeight: 600,
                      opacity: applyChanges.isPending ? 0.7 : 1,
                    }}
                  >
                    {applyChanges.isPending ? "Applying..." : `Apply ${approvedIds.size} Approved`}
                  </button>
                  <button
                    onClick={() => { setPendingDiffs(null); setApprovedIds(new Set()); setRejectedIds(new Set()); }}
                    style={{ fontSize: 10, padding: "3px 8px", cursor: "pointer", background: "none", border: "1px solid var(--border)", borderRadius: 3, color: "var(--text-muted)" }}
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
          </div>

          {pendingDiffs.length === 0 ? (
            <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--accent)", fontWeight: 500 }}>
              No changes detected — all players are up to date.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "rgba(94,93,90,0.03)" }}>
                  <th style={{ ...miniTh, textAlign: "left", width: 160 }}>Player</th>
                  <th style={{ ...miniTh, width: 100 }}>Team</th>
                  <th style={{ ...miniTh, width: 70 }}>Type</th>
                  <th style={{ ...miniTh, textAlign: "left" }}>Reason</th>
                  <th style={{ ...miniTh, width: 80 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingDiffs.map((d: any) => {
                  const isApproved = approvedIds.has(d.externalId);
                  const isRejected = rejectedIds.has(d.externalId);
                  const borderLeft = isApproved ? "3px solid var(--accent)" : isRejected ? "3px solid var(--red)" : "3px solid transparent";
                  const bg = isApproved ? "rgba(61,153,104,0.04)" : isRejected ? "rgba(229,72,77,0.04)" : "transparent";
                  return (
                    <tr key={d.externalId} style={{ borderBottom: "1px solid var(--border)", borderLeft, backgroundColor: bg }}>
                      <td style={{ ...miniTd, textAlign: "left", fontWeight: 500 }}>{d.name}</td>
                      <td style={miniTd}>{d.team}</td>
                      <td style={miniTd}>
                        <span style={{
                          fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700, textTransform: "uppercase",
                          backgroundColor: d.changeType === "new" ? "rgba(61,153,104,0.15)" : "rgba(255,180,40,0.15)",
                          color: d.changeType === "new" ? "var(--accent)" : "var(--amber)",
                        }}>
                          {d.changeType}
                        </span>
                      </td>
                      <td style={{ ...miniTd, textAlign: "left", color: "var(--text-secondary)", fontSize: 11, maxWidth: 300 }}>
                        {d.reason}
                      </td>
                      <td style={miniTd}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                          <button
                            onClick={() => toggleApprove(d.externalId)}
                            style={{
                              fontSize: 13, width: 26, height: 24, cursor: "pointer", borderRadius: 3,
                              border: isApproved ? "2px solid var(--accent)" : "1px solid var(--border)",
                              backgroundColor: isApproved ? "rgba(61,153,104,0.15)" : "transparent",
                              color: isApproved ? "var(--accent)" : "var(--text-muted)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                            title="Approve"
                          >
                            &#10003;
                          </button>
                          <button
                            onClick={() => toggleReject(d.externalId)}
                            style={{
                              fontSize: 13, width: 26, height: 24, cursor: "pointer", borderRadius: 3,
                              border: isRejected ? "2px solid var(--red)" : "1px solid var(--border)",
                              backgroundColor: isRejected ? "rgba(229,72,77,0.15)" : "transparent",
                              color: isRejected ? "var(--red)" : "var(--text-muted)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                            title="Reject"
                          >
                            &#10005;
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {applyChanges.isError && (
            <div style={{ padding: "6px 12px", fontSize: 11, color: "var(--red)" }}>
              Apply failed: {applyChanges.error.message}
            </div>
          )}
        </div>
      )}

      {/* Add player search panel */}
      {showAddPanel && (
        <div style={{ marginBottom: 10, padding: "8px 12px", backgroundColor: "var(--bg)", borderRadius: 6, border: "1px solid var(--border)" }}>
          <input
            placeholder="Search player to add..."
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, backgroundColor: "var(--bg)", color: "var(--text-primary)", width: 240, marginBottom: 6 }}
            autoFocus
          />
          {searchPlayers.data && searchPlayers.data.length > 0 && (
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {searchPlayers.data
                .filter((p: any) => !existingIds.has(p.id))
                .map((p: any) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 12 }}>{p.name} ({p.team}) — {(p.role ?? "").replace(/_/g, " ")}</span>
                    <button
                      onClick={() => addToMatch.mutate({ playerId: p.id, matchId })}
                      style={{ fontSize: 11, padding: "2px 8px", color: "var(--accent)", background: "none", border: "1px solid var(--accent)", borderRadius: 4, cursor: "pointer" }}
                    >
                      Add
                    </button>
                  </div>
                ))}
            </div>
          )}
          {addSearch.length >= 2 && searchPlayers.data?.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>No matching players found</div>
          )}
        </div>
      )}

      {/* Player list */}
      {matchPlayers.isLoading ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading...</div>
      ) : playerData.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          No players linked. Click "Fetch Players" to fetch player data.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ ...miniTh, textAlign: "left" }}>Name</th>
              <th style={miniTh}>Team</th>
              <th style={miniTh}>Role</th>
              <th style={miniTh}>Bat Avg</th>
              <th style={miniTh}>Bowl Avg</th>
              <th style={miniTh}>SR</th>
              <th style={miniTh}>Econ</th>
              <th style={miniTh}>Avg FP</th>
              <th style={miniTh}>Form</th>
              <th style={miniTh}>Buzz</th>
              <th style={miniTh}>Credits</th>
              <th style={miniTh}>Injury</th>
              <th style={miniTh}>Status</th>
              <th style={miniTh}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {playerData.map((p: any) => {
              const stats = (p.stats as any) ?? {};
              const activeCredits = stats.adminCredits ?? stats.calculatedCredits ?? stats.geminiCredits ?? stats.credits ?? "-";
              const creditSource = stats.adminCredits != null ? "OVR" : stats.calculatedCredits != null ? "CALC" : stats.geminiCredits != null ? "GEM" : "";
              const creditColor = creditSource === "OVR" ? "var(--amber)" : creditSource === "CALC" ? "var(--accent)" : "var(--text-muted)";

              const formScore = stats.recentForm as number | undefined;
              const sentScore = stats.sentimentScore as number | undefined;
              const formColor = !formScore ? "var(--text-muted)" : formScore >= 7 ? "var(--accent)" : formScore >= 4 ? "var(--amber)" : "var(--red)";
              const sentColor = !sentScore ? "var(--text-muted)" : sentScore >= 7 ? "var(--accent)" : sentScore >= 4 ? "var(--amber)" : "var(--red)";

              const injury = stats.injuryStatus as string | undefined;
              const injuryColor = !injury || injury === "fit" ? "var(--accent)" : injury === "recovered" ? "var(--amber)" : "var(--red)";

              return (
                <tr key={p.pmsId} style={{ borderBottom: "1px solid var(--border)", opacity: p.isDisabled ? 0.5 : 1 }} title={stats.formNote || undefined}>
                  <td style={{ ...miniTd, textAlign: "left", fontWeight: 500 }}>
                    {p.name}
                    {p.battingStyle && <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{p.battingStyle}{p.bowlingStyle ? ` / ${p.bowlingStyle}` : ""}</div>}
                    {stats.formNote && <div style={{ fontSize: 9, color: "var(--text-secondary)", fontWeight: 400, fontStyle: "italic", lineHeight: 1.3, marginTop: 1 }}>{stats.formNote}</div>}
                  </td>
                  <td style={miniTd}>{p.team}</td>
                  <td style={miniTd}>{(p.role ?? "").replace(/_/g, " ")}</td>
                  <td style={{ ...miniTd, fontFamily: "var(--font-data)" }}>{stats.average ?? "—"}</td>
                  <td style={{ ...miniTd, fontFamily: "var(--font-data)" }}>{stats.bowlingAverage ?? "—"}</td>
                  <td style={{ ...miniTd, fontFamily: "var(--font-data)" }}>{stats.strikeRate ?? "—"}</td>
                  <td style={{ ...miniTd, fontFamily: "var(--font-data)" }}>{stats.economyRate ?? "—"}</td>
                  <td style={{ ...miniTd, fontFamily: "var(--font-data)", fontWeight: 600, color: stats.recentAvgFP ? "var(--accent)" : "var(--text-muted)" }}>{stats.recentAvgFP ?? "—"}</td>
                  <td style={{ ...miniTd, fontWeight: 600, color: formColor }}>{formScore ?? "—"}</td>
                  <td style={{ ...miniTd, fontWeight: 600, color: sentColor }}>{sentScore ?? "—"}</td>
                  <td style={{ ...miniTd, fontFamily: "var(--font-data)" }}>
                    <span style={{ fontWeight: 600 }}>{activeCredits}</span>
                    {creditSource && <span style={{ fontSize: 8, color: creditColor, marginLeft: 2, fontWeight: 700 }}>{creditSource}</span>}
                  </td>
                  <td style={{ ...miniTd, fontSize: 10, color: injuryColor, fontWeight: 600, textTransform: "capitalize" }}>
                    {injury || "—"}
                  </td>
                  <td style={miniTd}>
                    <span style={{
                      fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 600,
                      backgroundColor: p.isDisabled ? "rgba(229,72,77,0.1)" : "rgba(61,153,104,0.1)",
                      color: p.isDisabled ? "var(--red)" : "var(--accent)",
                    }}>
                      {p.isDisabled ? "Off" : "On"}
                    </span>
                  </td>
                  <td style={miniTd}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                      <button
                        onClick={() => {
                          setRefreshingPlayerId(p.id);
                          refreshPlayer.mutate({ matchId, playerId: p.id });
                        }}
                        disabled={refreshingPlayerId === p.id}
                        style={{
                          fontSize: 10, padding: "2px 6px", cursor: refreshingPlayerId === p.id ? "not-allowed" : "pointer",
                          background: "none", border: "1px solid var(--blue, #3b82f6)", borderRadius: 3,
                          color: "var(--blue, #3b82f6)", opacity: refreshingPlayerId === p.id ? 0.6 : 1,
                        }}
                        title="Refresh this player's stats"
                      >
                        {refreshingPlayerId === p.id ? "↻..." : "↻"}
                      </button>
                      <button
                        onClick={() => toggleDisabled.mutate({ playerId: p.id })}
                        style={{ fontSize: 10, padding: "2px 6px", cursor: "pointer", background: "none", border: "1px solid var(--border)", borderRadius: 3, color: p.isDisabled ? "var(--accent)" : "var(--amber)" }}
                      >
                        {p.isDisabled ? "Enable" : "Disable"}
                      </button>
                      <button
                        onClick={() => removeFromMatch.mutate({ playerId: p.id, matchId })}
                        style={{ fontSize: 10, padding: "2px 6px", cursor: "pointer", background: "none", border: "1px solid var(--red)", borderRadius: 3, color: "var(--red)" }}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

const miniTh: React.CSSProperties = {
  padding: "4px 8px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)",
};

const miniTd: React.CSSProperties = {
  padding: "4px 8px", textAlign: "center", fontSize: 12,
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("matches");
  const [matchPage, setMatchPage] = useState(0);
  const [playerPage, setPlayerPage] = useState(0);
  const [playerSearch, setPlayerSearch] = useState("");
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const tournament = trpc.admin.tournaments.getById.useQuery({ tournamentId: id });
  const matchesList = trpc.admin.matches.list.useQuery({
    tournamentId: id,
    limit: PAGE_SIZE + 1,
    offset: matchPage * PAGE_SIZE,
  });
  const playersList = trpc.admin.tournaments.getPlayers.useQuery({
    tournamentId: id,
    search: playerSearch || undefined,
    limit: PLAYER_PAGE_SIZE + 1,
    offset: playerPage * PLAYER_PAGE_SIZE,
  });
  const forceRefresh = trpc.admin.tournaments.forceRefresh.useMutation({
    onSuccess: () => {
      utils.admin.tournaments.getById.invalidate({ tournamentId: id });
      utils.admin.matches.list.invalidate({ tournamentId: id });
      utils.admin.tournaments.getPlayers.invalidate({ tournamentId: id });
    },
  });
  const toggleVisible = trpc.admin.tournaments.toggleVisible.useMutation({
    onSuccess: () => utils.admin.tournaments.getById.invalidate({ tournamentId: id }),
  });
  const refreshMatches = trpc.admin.tournaments.refreshMatches.useMutation({
    onSuccess: () => utils.admin.matches.list.invalidate({ tournamentId: id }),
  });
  const [refreshingMatchId, setRefreshingMatchId] = useState<string | null>(null);
  const [matchRefreshResult, setMatchRefreshResult] = useState<{ matchId: string; changes: string[]; unchanged: boolean } | null>(null);
  const refreshMatch = trpc.admin.matches.refreshMatch.useMutation({
    onSuccess: (data: any) => {
      setRefreshingMatchId(null);
      setMatchRefreshResult({ matchId: data.id, changes: data.changes, unchanged: data.unchanged });
      setTimeout(() => setMatchRefreshResult(null), 6000);
      utils.admin.matches.list.invalidate({ tournamentId: id });
    },
    onError: () => { setRefreshingMatchId(null); },
  });
  const refreshStandings = trpc.admin.tournaments.refreshStandings.useMutation({
    onSuccess: () => utils.admin.tournaments.getById.invalidate({ tournamentId: id }),
  });
  const fetchTeamLogos = trpc.admin.tournaments.fetchTeamLogos.useMutation({
    onSuccess: () => utils.admin.tournaments.getById.invalidate({ tournamentId: id }),
  });
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const updateRules = trpc.admin.tournaments.updateRules.useMutation({
    onSuccess: () => utils.admin.tournaments.getById.invalidate({ tournamentId: id }),
  });
  const deleteTournament = trpc.admin.tournaments.delete.useMutation({
    onSuccess: () => {
      router.push("/admin/tournaments");
    },
  });

  const t = tournament.data;

  if (tournament.isLoading) {
    return <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading...</div>;
  }
  if (!t) {
    return <div style={{ padding: 40, color: "var(--red)" }}>Tournament not found</div>;
  }

  const matchData = (matchesList.data ?? []).slice(0, PAGE_SIZE);
  const matchHasMore = (matchesList.data ?? []).length > PAGE_SIZE;

  const playerData = (playersList.data ?? []).slice(0, PLAYER_PAGE_SIZE);
  const playerHasMore = (playersList.data ?? []).length > PLAYER_PAGE_SIZE;

  const standings = (t.standings as any[]) ?? [];

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
    backgroundColor: "transparent",
    color: activeTab === tab ? "var(--accent)" : "var(--text-secondary)",
  });

  return (
    <div>
      {/* Back link */}
      <Link href="/admin/tournaments" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none", marginBottom: 16, display: "inline-block" }}>
        &larr; Back to Tournaments
      </Link>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{t.name}</h1>
          {t.description && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>{t.description}</p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
            {t.category && (
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, backgroundColor: "rgba(94,93,90,0.1)", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>
                {t.category}
              </span>
            )}
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t.startDate ?? "?"} &mdash; {t.endDate ?? "?"}
            </span>
          </div>
          {/* Team logos */}
          {(t.teams as any[])?.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              {(t.teams as any[]).map((team: any) => (
                <div key={team.name} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px 2px 2px", backgroundColor: "var(--bg-surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
                  {team.logo ? (
                    <img src={team.logo} alt={team.name} style={{ width: 20, height: 20, borderRadius: 4, objectFit: "contain" }} />
                  ) : (
                    <div style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "var(--text-muted)" }}>
                      {team.shortName || team.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>{team.shortName || team.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => toggleVisible.mutate({ tournamentId: id, visible: !t.isVisible })}
            style={{
              padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
              backgroundColor: t.isVisible ? "var(--accent)" : "var(--border)",
              color: t.isVisible ? "#fff" : "var(--text-secondary)",
            }}
          >
            {t.isVisible ? "Visible" : "Hidden"}
          </button>
          <button
            onClick={() => forceRefresh.mutate({ tournamentId: id })}
            disabled={forceRefresh.isPending}
            style={{
              padding: "6px 14px", backgroundColor: "var(--amber)", color: "#fff", border: "none",
              borderRadius: 6, fontSize: 12, fontWeight: 600,
              cursor: forceRefresh.isPending ? "not-allowed" : "pointer",
              opacity: forceRefresh.isPending ? 0.7 : 1,
            }}
          >
            {forceRefresh.isPending ? "Refreshing..." : "Refresh All"}
          </button>
          <button
            onClick={() => fetchTeamLogos.mutate({ tournamentId: id })}
            disabled={fetchTeamLogos.isPending}
            style={{
              padding: "6px 14px", backgroundColor: "#6366f1", color: "#fff", border: "none",
              borderRadius: 6, fontSize: 12, fontWeight: 600,
              cursor: fetchTeamLogos.isPending ? "not-allowed" : "pointer",
              opacity: fetchTeamLogos.isPending ? 0.7 : 1,
            }}
          >
            {fetchTeamLogos.isPending ? "Fetching..." : "Fetch Team Logos"}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              padding: "6px 14px", backgroundColor: "transparent", color: "var(--red)", border: "1px solid var(--red)",
              borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div style={{
          padding: "12px 16px", marginBottom: 16, borderRadius: 6,
          backgroundColor: "rgba(229,72,77,0.08)", border: "1px solid rgba(229,72,77,0.3)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 13, color: "var(--red)" }}>
            Delete &quot;{t.name}&quot; and all its matches/players? This cannot be undone.
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => deleteTournament.mutate({ tournamentId: id })}
              disabled={deleteTournament.isPending}
              style={{
                padding: "6px 14px", backgroundColor: "var(--red)", color: "#fff", border: "none",
                borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: deleteTournament.isPending ? "not-allowed" : "pointer",
                opacity: deleteTournament.isPending ? 0.7 : 1,
              }}
            >
              {deleteTournament.isPending ? "Deleting..." : "Yes, Delete"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              style={{
                padding: "6px 14px", backgroundColor: "transparent", color: "var(--text-muted)",
                border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Team logos result */}
      {fetchTeamLogos.isSuccess && (
        <div style={{ padding: "8px 16px", marginBottom: 12, borderRadius: 6, backgroundColor: "rgba(34,197,94,0.08)", fontSize: 12, color: "#22c55e" }}>
          Fetched logos for {fetchTeamLogos.data.updated} teams
          {fetchTeamLogos.data.teams.map((t: any) => (
            <span key={t.name} style={{ marginLeft: 8 }}>
              {t.logo && <img src={t.logo} alt={t.name} style={{ width: 20, height: 20, borderRadius: 4, verticalAlign: "middle", marginRight: 4 }} />}
              {t.name}
            </span>
          ))}
        </div>
      )}
      {fetchTeamLogos.isError && (
        <div style={{ padding: "8px 16px", marginBottom: 12, borderRadius: 6, backgroundColor: "rgba(229,72,77,0.08)", fontSize: 12, color: "var(--red)" }}>
          Failed to fetch team logos: {fetchTeamLogos.error.message}
        </div>
      )}

      {/* Hydrating banner */}
      {t.isVisible && matchData.length === 0 && playerData.length === 0 && !matchesList.isLoading && (
        <div style={{
          padding: "10px 16px", marginBottom: 16, borderRadius: 6,
          backgroundColor: "rgba(212,164,61,0.1)", border: "1px solid rgba(212,164,61,0.3)",
          fontSize: 13, color: "var(--amber)",
        }}>
          Data is being hydrated in the background. Click &quot;Refresh All&quot; to check for updates.
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 20, marginTop: 16 }}>
        <button style={tabStyle("matches")} onClick={() => setActiveTab("matches")}>
          Matches {matchesList.data ? `(${matchData.length}${matchHasMore ? "+" : ""})` : ""}
        </button>
        <button style={tabStyle("players")} onClick={() => setActiveTab("players")}>
          Players {playersList.data ? `(${playerData.length}${playerHasMore ? "+" : ""})` : ""}
        </button>
        <button style={tabStyle("standings")} onClick={() => setActiveTab("standings")}>
          Standings {standings.length > 0 ? `(${standings.length})` : ""}
        </button>
        <button style={tabStyle("rules")} onClick={() => setActiveTab("rules")}>
          Rules
        </button>
      </div>

      {/* ====================== MATCHES TAB ====================== */}
      {activeTab === "matches" && (
        <div>
          {/* Refresh Matches button + result */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => refreshMatches.mutate({ tournamentId: id })}
              disabled={refreshMatches.isPending}
              style={{
                padding: "6px 14px", backgroundColor: "var(--amber)", color: "#fff", border: "none",
                borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: refreshMatches.isPending ? "not-allowed" : "pointer",
                opacity: refreshMatches.isPending ? 0.7 : 1,
              }}
            >
              {refreshMatches.isPending ? "Refreshing..." : "Refresh Matches"}
            </button>
          </div>
          {refreshMatches.isSuccess && <FetchResultSummary data={refreshMatches.data} />}
          {refreshMatches.isError && (
            <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 8 }}>
              Refresh failed: {refreshMatches.error.message}
            </div>
          )}

          {matchesList.isLoading ? (
            <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13 }}>Loading matches...</div>
          ) : matchData.length === 0 ? (
            <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13 }}>No matches found. Click &quot;Refresh Matches&quot; to fetch match data.</div>
          ) : (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    <th style={{ ...thStyle, textAlign: "left" }}>Home</th>
                    <th style={{ ...thStyle, textAlign: "left" }}>Away</th>
                    <th style={thStyle}>Format</th>
                    <th style={thStyle}>Start</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Phase</th>
                    <th style={{ ...thStyle, textAlign: "left" }}>Score / Result</th>
                    <th style={thStyle}>Toss</th>
                    <th style={thStyle}>Last Fetch</th>
                    <th style={{ ...thStyle, textAlign: "left" }}>Venue</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matchData.map((row: any) => (
                    <React.Fragment key={row.id}>
                      <tr
                        onClick={() => setExpandedMatchId(expandedMatchId === row.id ? null : row.id)}
                        style={{
                          borderBottom: "1px solid var(--border)", cursor: "pointer",
                          backgroundColor: expandedMatchId === row.id ? "rgba(61,153,104,0.04)" : "transparent",
                          opacity: row.status === "completed" ? 0.6 : 1,
                        }}
                      >
                        <td style={{ ...tdStyle, textAlign: "left", fontWeight: 500 }}>{row.teamHome}</td>
                        <td style={{ ...tdStyle, textAlign: "left", fontWeight: 500 }}>{row.teamAway}</td>
                        <td style={tdStyle}>{row.format}</td>
                        <td style={tdStyle}>{row.startTime ? new Date(row.startTime).toLocaleString() : "-"}</td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                            backgroundColor: row.status === "live" ? "rgba(229,72,77,0.1)" : row.status === "completed" ? "rgba(94,93,90,0.1)" : "rgba(61,153,104,0.1)",
                            color: row.status === "live" ? "var(--red)" : row.status === "completed" ? "var(--text-secondary)" : "var(--accent)",
                          }}>
                            {row.status}
                          </span>
                        </td>
                        <td style={tdStyle}>{row.matchPhase}</td>
                        <td style={{ ...tdStyle, textAlign: "left", maxWidth: 220, fontSize: 11 }}>
                          {(row as any).scoreSummary && (
                            <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{(row as any).scoreSummary}</div>
                          )}
                          {row.result ? (
                            <div style={{ color: "var(--accent)", fontWeight: 600 }}>{row.result}</div>
                          ) : !((row as any).scoreSummary) ? (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          ) : null}
                        </td>
                        <td style={{ ...tdStyle, fontSize: 11 }}>
                          {row.tossWinner ? (
                            <span>{row.tossWinner} ({row.tossDecision})</span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <FetchBadge action={row.lastFetchAction} timestamp={row.lastFetchedAt} />
                        </td>
                        <td style={{ ...tdStyle, textAlign: "left" }}>{row.venue}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setMatchRefreshResult(null); setRefreshingMatchId(row.id); refreshMatch.mutate({ matchId: row.id }); }}
                              disabled={refreshingMatchId === row.id}
                              style={{
                                padding: "2px 8px", fontSize: 10, fontWeight: 600,
                                cursor: refreshingMatchId === row.id ? "not-allowed" : "pointer",
                                background: "none", border: "1px solid var(--blue, #3b82f6)", borderRadius: 3,
                                color: refreshingMatchId === row.id ? "var(--amber)" : "var(--blue, #3b82f6)",
                                opacity: refreshingMatchId === row.id ? 0.7 : 1,
                              }}
                              title="Refresh this match's status, score & result"
                            >
                              {refreshingMatchId === row.id ? "Refreshing..." : "Refresh"}
                            </button>
                            {matchRefreshResult?.matchId === row.id && (
                              <span style={{ fontSize: 9, color: matchRefreshResult.unchanged ? "var(--text-muted)" : "var(--accent)", maxWidth: 120, textAlign: "center", lineHeight: 1.2 }}>
                                {matchRefreshResult.unchanged ? "No changes" : matchRefreshResult.changes.join(", ")}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedMatchId === row.id && (
                        <tr>
                          <td colSpan={11} style={{ padding: 0 }}>
                            <MatchPlayerPanel matchId={row.id} matchStatus={row.status} onClose={() => setExpandedMatchId(null)} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              {/* Pagination */}
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
                {matchPage > 0 && (
                  <button onClick={() => setMatchPage(matchPage - 1)} style={paginationBtn}>Previous</button>
                )}
                {matchHasMore && (
                  <button onClick={() => setMatchPage(matchPage + 1)} style={paginationBtn}>Next</button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ====================== PLAYERS TAB ====================== */}
      {activeTab === "players" && (
        <div>
          <input
            placeholder="Search players..."
            value={playerSearch}
            onChange={(e) => { setPlayerSearch(e.target.value); setPlayerPage(0); }}
            style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 14, backgroundColor: "var(--bg)", color: "var(--text-primary)", width: 280, marginBottom: 16 }}
          />
          <DataTable
            loading={playersList.isLoading}
            data={playerData}
            page={playerPage}
            onPageChange={setPlayerPage}
            pageSize={PLAYER_PAGE_SIZE}
            hasMore={playerHasMore}
            columns={[
              { key: "name", header: "Name" },
              { key: "team", header: "Team" },
              {
                key: "role",
                header: "Role",
                width: "120px",
                render: (row) => (row.role ?? "").replace(/_/g, " "),
              },
              { key: "nationality", header: "Nationality", width: "120px" },
              {
                key: "credits",
                header: "Credits",
                width: "100px",
                render: (row) => {
                  const stats = (row.stats as any) ?? {};
                  if (stats.adminCredits != null) {
                    return (
                      <span style={{ fontFamily: "var(--font-data)" }}>
                        {stats.adminCredits}
                        <span style={{ fontSize: 10, color: "var(--amber)", marginLeft: 4 }}>OVR</span>
                      </span>
                    );
                  }
                  return <span style={{ fontFamily: "var(--font-data)" }}>{stats.credits ?? "-"}</span>;
                },
              },
            ]}
          />
        </div>
      )}

      {/* ====================== STANDINGS TAB ====================== */}
      {activeTab === "standings" && (
        <div>
          {/* Refresh Standings button + result */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <button
              onClick={() => refreshStandings.mutate({ tournamentId: id })}
              disabled={refreshStandings.isPending}
              style={{
                padding: "6px 14px", backgroundColor: "var(--blue, var(--accent))", color: "#fff", border: "none",
                borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: refreshStandings.isPending ? "not-allowed" : "pointer",
                opacity: refreshStandings.isPending ? 0.7 : 1,
              }}
            >
              {refreshStandings.isPending ? "Refreshing..." : "Refresh Standings"}
            </button>
            {/* Show last update info from DB */}
            {(t as any).standingsUpdatedAt && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Last updated: {new Date((t as any).standingsUpdatedAt).toLocaleString()}
                {(t as any).standingsFetchAction && (
                  <span style={{
                    marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 600,
                    backgroundColor: (t as any).standingsFetchAction === "new" ? "rgba(61,153,104,0.15)" : "rgba(255,180,40,0.15)",
                    color: (t as any).standingsFetchAction === "new" ? "var(--accent)" : "var(--amber)",
                    textTransform: "uppercase",
                  }}>
                    {(t as any).standingsFetchAction}
                  </span>
                )}
              </span>
            )}
          </div>
          {refreshStandings.isSuccess && (
            <div style={{ fontSize: 12, marginBottom: 8, color: "var(--accent)" }}>
              Standings refreshed: {refreshStandings.data.teamsCount} teams ({refreshStandings.data.fetchAction})
            </div>
          )}
          {refreshStandings.isError && (
            <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 8 }}>
              Refresh failed: {refreshStandings.error.message}
            </div>
          )}

          {standings.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No standings data available. Click &quot;Refresh Standings&quot; to fetch.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Team</th>
                  <th style={thStyle}>P</th>
                  <th style={thStyle}>W</th>
                  <th style={thStyle}>L</th>
                  <th style={thStyle}>T</th>
                  <th style={thStyle}>NR</th>
                  <th style={thStyle}>Pts</th>
                  <th style={thStyle}>NRR</th>
                  {standings.some((s: any) => s.group) && <th style={thStyle}>Group</th>}
                </tr>
              </thead>
              <tbody>
                {standings.map((s: any, i: number) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={tdStyle}>{s.position}</td>
                    <td style={{ ...tdStyle, textAlign: "left", fontWeight: 500 }}>{s.team}</td>
                    <td style={tdStyle}>{s.played}</td>
                    <td style={tdStyle}>{s.won}</td>
                    <td style={tdStyle}>{s.lost}</td>
                    <td style={tdStyle}>{s.tied}</td>
                    <td style={tdStyle}>{s.noResult}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{s.points}</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--font-data)" }}>{s.netRunRate}</td>
                    {standings.some((st: any) => st.group) && <td style={tdStyle}>{s.group ?? "-"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {/* ====================== RULES TAB ====================== */}
      {activeTab === "rules" && (() => {
        const rules = (t.tournamentRules as any) ?? {};
        const overseas = rules.overseasRule ?? { enabled: false, hostCountry: "" };
        const roleLimits = rules.roleLimits ?? {};

        const ruleInputStyle: React.CSSProperties = {
          padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 4,
          fontSize: 13, backgroundColor: "var(--bg)", color: "var(--text-primary)", width: 80,
        };
        const ruleLabelStyle: React.CSSProperties = {
          fontSize: 13, fontWeight: 600, color: "var(--text-primary)", minWidth: 160,
        };
        const ruleRowStyle: React.CSSProperties = {
          display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
          borderBottom: "1px solid var(--border)",
        };
        const ruleDescStyle: React.CSSProperties = {
          fontSize: 11, color: "var(--text-muted)", marginLeft: 4,
        };

        const saveField = (field: string, value: any) => {
          updateRules.mutate({ tournamentId: id, rules: { ...rules, [field]: value } });
        };

        return (
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>
              Rules are saved automatically on change. These override global defaults for this tournament.
            </div>

            {/* Budget & Team Composition */}
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>Budget & Team Composition</h3>

            <div style={ruleRowStyle}>
              <span style={ruleLabelStyle}>Max Budget</span>
              <input
                type="number"
                defaultValue={rules.maxBudget ?? 100}
                style={ruleInputStyle}
                onBlur={(e) => {
                  const v = parseFloat((e.target as HTMLInputElement).value);
                  if (!isNaN(v) && v > 0) saveField("maxBudget", v);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              />
              <span style={ruleDescStyle}>Total credits budget per team</span>
            </div>

            <div style={ruleRowStyle}>
              <span style={ruleLabelStyle}>Max from One Team</span>
              <input
                type="number"
                defaultValue={rules.maxFromOneTeam ?? 7}
                style={ruleInputStyle}
                onBlur={(e) => {
                  const v = parseInt((e.target as HTMLInputElement).value);
                  if (!isNaN(v) && v > 0) saveField("maxFromOneTeam", v);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              />
              <span style={ruleDescStyle}>Max players from a single team</span>
            </div>

            {/* Overseas Rule */}
            <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8, color: "var(--text-primary)" }}>Overseas Rule</h3>

            <div style={ruleRowStyle}>
              <span style={ruleLabelStyle}>Enable Overseas</span>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={overseas.enabled}
                  onChange={(e) => {
                    saveField("overseasRule", { ...overseas, enabled: (e.target as HTMLInputElement).checked });
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{overseas.enabled ? "On" : "Off"}</span>
              </label>
              <span style={ruleDescStyle}>Tag non-host-country players as &quot;overseas&quot;</span>
            </div>

            {overseas.enabled && (
              <>
                <div style={ruleRowStyle}>
                  <span style={ruleLabelStyle}>Host Country</span>
                  <input
                    type="text"
                    defaultValue={overseas.hostCountry}
                    placeholder="e.g. India"
                    style={{ ...ruleInputStyle, width: 160 }}
                    onBlur={(e) => {
                      const v = (e.target as HTMLInputElement).value.trim();
                      if (v && v !== overseas.hostCountry) saveField("overseasRule", { enabled: true, hostCountry: v });
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                  <span style={ruleDescStyle}>Players from other countries are tagged overseas</span>
                </div>

                <div style={ruleRowStyle}>
                  <span style={ruleLabelStyle}>Max Overseas</span>
                  <input
                    type="number"
                    defaultValue={rules.maxOverseas ?? 4}
                    style={ruleInputStyle}
                    onBlur={(e) => {
                      const v = parseInt((e.target as HTMLInputElement).value);
                      if (!isNaN(v) && v >= 0) saveField("maxOverseas", v);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                  <span style={ruleDescStyle}>Max overseas players per team</span>
                </div>
              </>
            )}

            {/* Role Limits */}
            <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 20, marginBottom: 8, color: "var(--text-primary)" }}>Role Limits</h3>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Min and max players per role in a team.</div>

            {(["wicket_keeper", "batsman", "all_rounder", "bowler"] as const).map((role) => {
              const label = { wicket_keeper: "Wicket Keeper", batsman: "Batsman", all_rounder: "All Rounder", bowler: "Bowler" }[role];
              const defaultLimits: Record<string, { min: number; max: number }> = { wicket_keeper: { min: 1, max: 4 }, batsman: { min: 1, max: 6 }, all_rounder: { min: 1, max: 6 }, bowler: { min: 1, max: 6 } };
              const limits = roleLimits[role] ?? defaultLimits[role] ?? { min: 1, max: 6 };
              return (
                <div key={role} style={ruleRowStyle}>
                  <span style={ruleLabelStyle}>{label}</span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Min</span>
                  <input
                    type="number"
                    defaultValue={limits.min}
                    style={{ ...ruleInputStyle, width: 50 }}
                    onBlur={(e) => {
                      const v = parseInt((e.target as HTMLInputElement).value);
                      if (!isNaN(v) && v >= 0) saveField("roleLimits", { ...roleLimits, [role]: { ...limits, min: v } });
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Max</span>
                  <input
                    type="number"
                    defaultValue={limits.max}
                    style={{ ...ruleInputStyle, width: 50 }}
                    onBlur={(e) => {
                      const v = parseInt((e.target as HTMLInputElement).value);
                      if (!isNaN(v) && v >= 1) saveField("roleLimits", { ...roleLimits, [role]: { ...limits, max: v } });
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                </div>
              );
            })}

            {updateRules.isPending && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>Saving...</div>}
            {updateRules.isError && <div style={{ fontSize: 12, color: "var(--red)", marginTop: 12 }}>Save failed: {updateRules.error.message}</div>}
          </div>
        );
      })()}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "center",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "center",
  fontSize: 13,
};

const paginationBtn: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--border)",
  borderRadius: 6,
  backgroundColor: "transparent",
  color: "var(--text-secondary)",
};
