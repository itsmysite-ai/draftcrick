"use client";

import React from "react";
import { trpc } from "@/lib/trpc";
import { StatsCard } from "./_components/StatsCard";

export default function AdminDashboard() {
  const stats = trpc.admin.system.stats.useQuery();
  const flags = trpc.admin.config.getFeatureFlags.useQuery();
  const subMetrics = trpc.subscription.admin.getMetrics.useQuery();

  const activeByTier = (tier: string) =>
    (subMetrics.data?.subscriptionsByTierAndStatus ?? [])
      .filter((m: any) => m.tier === tier && m.status === "active")
      .reduce((sum: number, m: any) => sum + m.count, 0);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        <StatsCard label="Total Users" value={stats.data?.totalUsers ?? "-"} />
        <StatsCard label="Teams Created" value={stats.data?.totalTeams ?? "-"} />
        <StatsCard label="Active Contests" value={stats.data?.activeContests ?? "-"} />
        <StatsCard label="Visible Tournaments" value={stats.data?.visibleTournaments ?? "-"} />
        <StatsCard label="Pro Subscribers" value={subMetrics.data ? activeByTier("pro") : "-"} icon="★" />
        <StatsCard label="Elite Subscribers" value={subMetrics.data ? activeByTier("elite") : "-"} icon="★" />
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Feature Flags</h2>
      {flags.data && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Object.entries(flags.data).map(([key, value]) => (
            <div
              key={key}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg-surface)",
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 500 }}>{key}</span>
              <span
                style={{
                  marginLeft: 8,
                  color: value ? "var(--accent)" : "var(--red)",
                  fontFamily: "var(--font-data)",
                }}
              >
                {value ? "ON" : "OFF"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Quick Actions</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <RefreshButton />
        </div>
      </div>
    </div>
  );
}

function RefreshButton() {
  // TODO(f1-launch): Restore sport selector when F1 launches
  // const [sport, setSport] = React.useState<"cricket" | "f1">("cricket");
  const sport = "cricket" as const;
  const discover = trpc.admin.tournaments.discover.useMutation();
  const refresh = trpc.admin.system.triggerRefresh.useMutation();

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      {/* TODO(f1-launch): Restore sport selector dropdown
      <select value={sport} onChange={(e) => setSport(e.target.value as "cricket" | "f1")} style={...}>
        <option value="cricket">Cricket</option>
        <option value="f1">F1</option>
      </select>
      */}
      <span
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          backgroundColor: "var(--bg-surface)",
          fontSize: 14,
          fontWeight: 500,
          fontFamily: "var(--font-data)",
          color: "var(--text-primary)",
        }}
      >
        Cricket
      </span>
      <button
        onClick={() => discover.mutate({ sport })}
        disabled={discover.isPending}
        style={{
          padding: "10px 20px",
          backgroundColor: "var(--amber)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: discover.isPending ? "not-allowed" : "pointer",
          opacity: discover.isPending ? 0.7 : 1,
        }}
      >
        {discover.isPending ? "Discovering..." : "Discover Tournaments"}
      </button>
      <button
        onClick={() => refresh.mutate({ sport })}
        disabled={refresh.isPending}
        style={{
          padding: "10px 20px",
          backgroundColor: "var(--accent)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: refresh.isPending ? "not-allowed" : "pointer",
          opacity: refresh.isPending ? 0.7 : 1,
        }}
      >
        {refresh.isPending ? "Refreshing..." : "Refresh Visible Only"}
      </button>
    </div>
  );
}
