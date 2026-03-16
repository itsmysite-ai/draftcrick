"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { DataTable } from "../_components/DataTable";

const PAGE_SIZE = 25;

const selectStyle = {
  padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)",
  backgroundColor: "var(--bg-surface)", fontSize: 13, fontWeight: 500,
  cursor: "pointer",
} as const;

const btnStyle = (pending: boolean) => ({
  padding: "8px 16px", backgroundColor: "var(--accent)", color: "#fff", border: "none",
  borderRadius: 6, fontSize: 13, fontWeight: 600,
  cursor: pending ? "not-allowed" : "pointer",
  opacity: pending ? 0.7 : 1,
} as const);

export default function SystemPage() {
  const [sport, setSport] = useState<"cricket" | "f1">("cricket");
  const [page, setPage] = useState(0);
  const [showEspnPreview, setShowEspnPreview] = useState(false);

  const refreshLogs = trpc.admin.system.refreshLogs.useQuery({
    limit: PAGE_SIZE + 1,
    offset: page * PAGE_SIZE,
  });
  const triggerRefresh = trpc.admin.system.triggerRefresh.useMutation({
    onSuccess: () => refreshLogs.refetch(),
  });

  // Data source preference
  const dataSourceQuery = trpc.admin.system.getDataSource.useQuery();
  const setDataSource = trpc.admin.system.setDataSource.useMutation({
    onSuccess: () => dataSourceQuery.refetch(),
  });

  // ESPN Preview (only fetched when panel is open)
  const espnPreview = trpc.admin.system.espnPreview.useQuery(
    { sport },
    { enabled: showEspnPreview }
  );

  const data = (refreshLogs.data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (refreshLogs.data ?? []).length > PAGE_SIZE;
  const currentDataSource = dataSourceQuery.data?.dataSource ?? "auto";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>System</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value as "cricket" | "f1")}
            style={selectStyle}
          >
            <option value="cricket">Cricket</option>
            <option value="f1">F1</option>
          </select>
          <select
            value={currentDataSource}
            onChange={(e) => setDataSource.mutate({ dataSource: e.target.value as "auto" | "espn" | "jolpica" | "gemini" | "cricbuzz" })}
            style={selectStyle}
          >
            <option value="auto">Auto (Cricbuzz → ESPN → Gemini fallback)</option>
            <option value="espn">ESPN Only (no fallback)</option>
            <option value="cricbuzz">Cricbuzz Only (no fallback)</option>
            <option value="jolpica">Jolpica Only (F1 only, no fallback)</option>
            <option value="gemini">Gemini Only (no fallback)</option>
          </select>
          <button
            onClick={() => triggerRefresh.mutate({ sport })}
            disabled={triggerRefresh.isPending}
            style={btnStyle(triggerRefresh.isPending)}
          >
            {triggerRefresh.isPending ? "Refreshing..." : "Refresh Visible Only"}
          </button>
        </div>
      </div>

      {/* Data Source Info */}
      <div style={{
        padding: "12px 16px", borderRadius: 8, marginBottom: 16,
        backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontSize: 13 }}>
          <strong>Data Source:</strong>{" "}
          <span style={{
            padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600,
            backgroundColor: currentDataSource === "auto" ? "rgba(61,153,104,0.1)" : currentDataSource === "espn" ? "rgba(56,133,224,0.1)" : currentDataSource === "jolpica" ? "rgba(139,92,246,0.1)" : "rgba(212,164,61,0.1)",
            color: currentDataSource === "auto" ? "var(--accent)" : currentDataSource === "espn" ? "#3885E0" : currentDataSource === "jolpica" ? "#8B5CF6" : "var(--amber)",
          }}>
            {currentDataSource === "auto" ? "Cricbuzz + ESPN, Gemini fallback" : `${currentDataSource.toUpperCase()} only — no fallback`}
          </span>
        </div>
        <button
          onClick={() => setShowEspnPreview(!showEspnPreview)}
          style={{
            padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            backgroundColor: "transparent", border: "1px solid var(--border)",
            cursor: "pointer", color: "var(--fg-secondary)",
          }}
        >
          {showEspnPreview ? "Hide ESPN Preview" : "Show ESPN Preview"}
        </button>
      </div>

      {/* ESPN Preview Panel */}
      {showEspnPreview && (
        <div style={{
          padding: 16, borderRadius: 8, marginBottom: 16,
          backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)",
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            ESPN Live Data Preview ({sport.toUpperCase()})
          </h3>
          {espnPreview.isLoading ? (
            <p style={{ fontSize: 13, color: "var(--fg-secondary)" }}>Loading ESPN data...</p>
          ) : espnPreview.data?.success === false ? (
            <p style={{ fontSize: 13, color: "var(--red)" }}>ESPN error: {espnPreview.data.error}</p>
          ) : espnPreview.data ? (
            <div>
              <p style={{ fontSize: 12, color: "var(--fg-secondary)", marginBottom: 8 }}>
                {espnPreview.data.tournaments} tournaments, {espnPreview.data.matches} matches
                ({espnPreview.data.durationMs}ms)
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--fg-secondary)" }}>Tournaments</h4>
                  <div style={{ maxHeight: 200, overflow: "auto", fontSize: 12 }}>
                    {espnPreview.data.data.tournaments.map((t: any) => (
                      <div key={t.id} style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                        <strong>{t.name}</strong>
                        <span style={{ marginLeft: 8, color: "var(--fg-secondary)" }}>{t.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--fg-secondary)" }}>Matches</h4>
                  <div style={{ maxHeight: 200, overflow: "auto", fontSize: 12 }}>
                    {espnPreview.data.data.matches.map((m: any) => (
                      <div key={m.id} style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                        <strong>{m.teamA} vs {m.teamB}</strong>
                        <span style={{
                          marginLeft: 8, padding: "1px 6px", borderRadius: 3, fontSize: 11, fontWeight: 600,
                          backgroundColor: m.status === "live" ? "rgba(229,72,77,0.1)" : m.status === "completed" ? "rgba(61,153,104,0.1)" : "rgba(212,164,61,0.1)",
                          color: m.status === "live" ? "var(--red)" : m.status === "completed" ? "var(--accent)" : "var(--amber)",
                        }}>
                          {m.status}
                        </span>
                        {m.scoreSummary && <div style={{ color: "var(--fg-secondary)", marginTop: 2 }}>{m.scoreSummary}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Refresh Logs */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Refresh Log</h2>
      <DataTable
        loading={refreshLogs.isLoading}
        data={data}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        hasMore={hasMore}
        columns={[
          { key: "entityType", header: "Entity", width: "100px" },
          { key: "trigger", header: "Trigger", width: "100px" },
          {
            key: "status",
            header: "Status",
            width: "90px",
            render: (row) => (
              <span style={{
                padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                backgroundColor: row.status === "success" ? "rgba(61,153,104,0.1)" : row.status === "failed" ? "rgba(229,72,77,0.1)" : "rgba(212,164,61,0.1)",
                color: row.status === "success" ? "var(--accent)" : row.status === "failed" ? "var(--red)" : "var(--amber)",
              }}>
                {row.status}
              </span>
            ),
          },
          { key: "durationMs", header: "Duration", width: "90px", render: (row) => row.durationMs ? `${row.durationMs}ms` : "-" },
          { key: "recordsUpserted", header: "Upserted", width: "70px" },
          { key: "createdAt", header: "Time", render: (row) => new Date(row.createdAt).toLocaleString() },
          { key: "errorMessage", header: "Error", render: (row) => row.errorMessage ? <span style={{ fontSize: 12, color: "var(--red)" }}>{row.errorMessage}</span> : null },
        ]}
      />
    </div>
  );
}
