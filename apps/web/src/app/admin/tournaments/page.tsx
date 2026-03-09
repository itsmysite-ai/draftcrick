"use client";

import React, { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DataTable } from "../_components/DataTable";

export default function TournamentsPage() {
  const tournaments = trpc.admin.tournaments.list.useQuery();
  const toggleVisible = trpc.admin.tournaments.toggleVisible.useMutation({
    onSuccess: () => tournaments.refetch(),
  });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const discover = trpc.admin.tournaments.discover.useMutation({
    onSuccess: (data) => {
      tournaments.refetch();
      setSuccessMsg(`Discovered ${data.discovered} tournament${data.discovered !== 1 ? "s" : ""}: ${data.tournaments.join(", ")}`);
      setTimeout(() => setSuccessMsg(null), 8000);
    },
    onError: (err) => {
      setSuccessMsg(`Discovery failed: ${err.message}`);
      setTimeout(() => setSuccessMsg(null), 8000);
    },
  });
  const [hydratingIds, setHydratingIds] = useState<Set<string>>(new Set());

  const handleToggleVisible = (row: any) => {
    const newVisible = !row.isVisible;
    if (newVisible) {
      setHydratingIds((prev) => new Set(prev).add(row.id));
      setTimeout(() => setHydratingIds((prev) => { const next = new Set(prev); next.delete(row.id); return next; }), 30000);
    }
    toggleVisible.mutate({ tournamentId: row.id, visible: newVisible });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Tournaments</h1>
        <button
          onClick={() => { setSuccessMsg(null); discover.mutate({ sport: "cricket" }); }}
          disabled={discover.isPending}
          style={{
            padding: "8px 16px", backgroundColor: "var(--amber)", color: "#fff", border: "none",
            borderRadius: 6, fontSize: 13, fontWeight: 600,
            cursor: discover.isPending ? "not-allowed" : "pointer",
            opacity: discover.isPending ? 0.7 : 1,
          }}
        >
          {discover.isPending ? "Discovering..." : "Discover Tournaments"}
        </button>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
        All tournaments from database. Toggle visibility to control what users see. Toggling ON auto-fetches matches &amp; players.
      </p>

      {/* Success / error banner */}
      {successMsg && (
        <div style={{
          padding: "10px 16px", marginBottom: 16, borderRadius: 6,
          backgroundColor: discover.isError ? "rgba(229,72,77,0.1)" : "rgba(61,153,104,0.1)",
          border: `1px solid ${discover.isError ? "rgba(229,72,77,0.3)" : "rgba(61,153,104,0.3)"}`,
          fontSize: 13,
          color: discover.isError ? "var(--red)" : "var(--accent)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16 }}>&times;</button>
        </div>
      )}

      <DataTable
        loading={tournaments.isLoading}
        data={tournaments.data ?? []}
        columns={[
          {
            key: "name",
            header: "Tournament",
            render: (row) => (
              <div>
                <Link
                  href={`/admin/tournaments/${row.id}`}
                  style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}
                >
                  {row.name}
                </Link>
                {row.description && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {row.description}
                  </div>
                )}
              </div>
            ),
          },
          { key: "category", header: "Category", width: "100px" },
          {
            key: "startDate",
            header: "Dates",
            width: "180px",
            render: (row) => {
              const fmt = (d: string | null) => {
                if (!d) return "?";
                try {
                  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                } catch { return d; }
              };
              return (
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {fmt(row.startDate)} – {fmt(row.endDate)}
                </span>
              );
            },
          },
          {
            key: "isVisible",
            header: "Visible",
            width: "120px",
            render: (row) => (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => handleToggleVisible(row)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "none",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    backgroundColor: row.isVisible ? "var(--accent)" : "var(--border)",
                    color: row.isVisible ? "#fff" : "var(--text-secondary)",
                  }}
                >
                  {row.isVisible ? "ON" : "OFF"}
                </button>
                {hydratingIds.has(row.id) && (
                  <span style={{ fontSize: 11, color: "var(--amber)", fontWeight: 500 }}>Hydrating...</span>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
