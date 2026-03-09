"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { DataTable } from "../_components/DataTable";

const PAGE_SIZE = 25;

export default function PlayersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(0);
  const [editingCredits, setEditingCredits] = useState<string | null>(null);
  const [creditsValue, setCreditsValue] = useState("");

  const playersList = trpc.admin.players.list.useQuery({
    search: search || undefined,
    role: role || undefined,
    limit: PAGE_SIZE + 1, // fetch 1 extra to detect hasMore
    offset: page * PAGE_SIZE,
  });

  const updateCredits = trpc.admin.players.updateCredits.useMutation({
    onSuccess: () => {
      playersList.refetch();
      setEditingCredits(null);
    },
  });

  const data = (playersList.data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (playersList.data ?? []).length > PAGE_SIZE;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Players</h1>

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
        columns={[
          { key: "name", header: "Name" },
          { key: "team", header: "Team", width: "140px" },
          { key: "role", header: "Role", width: "120px", render: (row) => row.role.replace("_", " ") },
          { key: "nationality", header: "Nationality", width: "120px" },
          {
            key: "credits",
            header: "Credits",
            width: "160px",
            render: (row) => {
              const stats = (row.stats as any) ?? {};
              const geminiCredits = stats.credits ?? "-";
              const adminCredits = stats.adminCredits;
              const isOverridden = adminCredits != null;

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
                    {isOverridden ? adminCredits : geminiCredits}
                  </span>
                  {isOverridden && (
                    <span style={{ fontSize: 10, padding: "1px 4px", borderRadius: 3, backgroundColor: "rgba(212,164,61,0.15)", color: "var(--amber)", fontWeight: 600 }}>
                      OVERRIDE
                    </span>
                  )}
                  <button
                    onClick={() => { setEditingCredits(row.id); setCreditsValue(String(isOverridden ? adminCredits : geminiCredits === "-" ? 8 : geminiCredits)); }}
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
