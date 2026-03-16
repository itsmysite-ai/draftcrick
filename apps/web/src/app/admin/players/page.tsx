"use client";

import React, { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DataTable } from "../_components/DataTable";

const PAGE_SIZE = 25;

export default function PlayersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(0);
  const [editingCredits, setEditingCredits] = useState<string | null>(null);
  const [creditsValue, setCreditsValue] = useState("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const playersList = trpc.admin.players.list.useQuery({
    search: search || undefined,
    role: role || undefined,
    sortBy: sortBy as any,
    sortDir,
    limit: PAGE_SIZE + 1, // fetch 1 extra to detect hasMore
    offset: page * PAGE_SIZE,
  });

  const updateCredits = trpc.admin.players.updateCredits.useMutation({
    onSuccess: () => {
      playersList.refetch();
      setEditingCredits(null);
    },
  });

  const recalcCredits = trpc.admin.players.recalculateAllCredits.useMutation({
    onSuccess: (data) => {
      playersList.refetch();
      alert(`Recalculated credits for ${data.updated} players (${data.skipped} admin overrides skipped)`);
    },
  });

  const fixNationalities = trpc.admin.players.fixAllNationalities.useMutation({
    onSuccess: (data) => {
      playersList.refetch();
      alert(`Fixed ${data.updated} out of ${data.needsFix} players with incorrect nationalities`);
    },
  });

  const data = (playersList.data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (playersList.data ?? []).length > PAGE_SIZE;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Players</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              if (confirm("Fix nationalities for all players using Gemini AI? This resolves birth places like 'Anand, Gujarat' to proper country names.")) {
                fixNationalities.mutate();
              }
            }}
            disabled={fixNationalities.isPending}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              backgroundColor: fixNationalities.isPending ? "var(--bg)" : "#6366f1",
              color: fixNationalities.isPending ? "var(--text-muted)" : "#fff",
              border: "none",
              borderRadius: 6,
              cursor: fixNationalities.isPending ? "not-allowed" : "pointer",
            }}
          >
            {fixNationalities.isPending ? "Fixing..." : "Fix Nationalities (AI)"}
          </button>
          <button
            onClick={() => {
              if (confirm("Recalculate credits for ALL players using the current formula? Admin overrides will be preserved.")) {
                recalcCredits.mutate();
              }
            }}
            disabled={recalcCredits.isPending}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              backgroundColor: recalcCredits.isPending ? "var(--bg)" : "var(--accent)",
              color: recalcCredits.isPending ? "var(--text-muted)" : "#fff",
              border: "none",
              borderRadius: 6,
              cursor: recalcCredits.isPending ? "not-allowed" : "pointer",
            }}
          >
            {recalcCredits.isPending ? "Recalculating..." : "Recalculate All Credits"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input
          placeholder="Search players..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 14,
            backgroundColor: "var(--bg)",
            color: "var(--text-primary)",
            width: 240,
          }}
        />
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value); setPage(0); }}
          style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, backgroundColor: "var(--bg)", color: "var(--text-primary)" }}
        >
          <option value="">All Roles</option>
          <option value="batsman">Batsman</option>
          <option value="bowler">Bowler</option>
          <option value="all_rounder">All-Rounder</option>
          <option value="wicket_keeper">Wicket Keeper</option>
        </select>
      </div>

      <DataTable
        loading={playersList.isLoading}
        data={data}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        hasMore={hasMore}
        defaultSort={{ key: sortBy, dir: sortDir }}
        onSort={(key, dir) => { setSortBy(key); setSortDir(dir); setPage(0); }}
        columns={[
          { key: "name", header: "Name", render: (row) => (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {row.photoUrl ? (
                <img
                  src={row.photoUrl}
                  alt={row.name}
                  style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", flexShrink: 0 }}>
                  {row.name.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()}
                </div>
              )}
              <Link href={`/admin/players/${row.id}`} style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
                {row.name}
              </Link>
            </div>
          ) },
          { key: "team", header: "Team", width: "140px" },
          { key: "role", header: "Role", width: "120px", render: (row) => row.role.replace("_", " ") },
          { key: "nationality", header: "Nationality", width: "120px" },
          {
            key: "credits",
            header: "Credits",
            width: "160px",
            render: (row) => {
              const stats = (row.stats as any) ?? {};
              const calculatedCredits = stats.calculatedCredits;
              const geminiCredits = stats.credits;
              const displayCredits = calculatedCredits ?? geminiCredits ?? "-";
              const adminCredits = stats.adminCredits;
              const isOverridden = adminCredits != null;
              const sourceBadge = isOverridden ? "OVR" : calculatedCredits != null ? "CALC" : geminiCredits != null ? "GEM" : null;
              const badgeColor = isOverridden ? "rgba(212,164,61,0.15)" : calculatedCredits != null ? "rgba(34,197,94,0.15)" : "rgba(156,163,175,0.15)";
              const badgeTextColor = isOverridden ? "var(--amber)" : calculatedCredits != null ? "#22c55e" : "#9ca3af";

              if (editingCredits === row.id) {
                return (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="20"
                      value={creditsValue}
                      onChange={(e) => setCreditsValue(e.target.value)}
                      style={{ width: 60, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, backgroundColor: "var(--bg)", color: "var(--text-primary)" }}
                    />
                    <button
                      onClick={() => updateCredits.mutate({ playerId: row.id, credits: parseFloat(creditsValue) })}
                      style={{ fontSize: 11, padding: "3px 6px", cursor: "pointer", border: "1px solid var(--accent)", borderRadius: 4, backgroundColor: "transparent", color: "var(--accent)" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingCredits(null)}
                      style={{ fontSize: 11, padding: "3px 6px", cursor: "pointer", border: "1px solid var(--border)", borderRadius: 4, backgroundColor: "transparent", color: "var(--text-muted)" }}
                    >
                      X
                    </button>
                  </div>
                );
              }

              return (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 13 }}>
                    {isOverridden ? adminCredits : displayCredits}
                  </span>
                  {sourceBadge && (
                    <span style={{ fontSize: 10, padding: "1px 4px", borderRadius: 3, backgroundColor: badgeColor, color: badgeTextColor, fontWeight: 600 }}>
                      {sourceBadge}
                    </span>
                  )}
                  <button
                    onClick={() => { setEditingCredits(row.id); setCreditsValue(String(isOverridden ? adminCredits : displayCredits === "-" ? 8 : displayCredits)); }}
                    style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Edit
                  </button>
                  {isOverridden && (
                    <button
                      onClick={() => updateCredits.mutate({ playerId: row.id, credits: null })}
                      style={{ fontSize: 11, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              );
            },
          },
        ]}
      />
    </div>
  );
}
