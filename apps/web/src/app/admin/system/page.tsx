"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { DataTable } from "../_components/DataTable";

const PAGE_SIZE = 25;

export default function SystemPage() {
  const [sport, setSport] = useState<"cricket" | "f1">("cricket");
  const [page, setPage] = useState(0);
  const refreshLogs = trpc.admin.system.refreshLogs.useQuery({
    limit: PAGE_SIZE + 1,
    offset: page * PAGE_SIZE,
  });
  const triggerRefresh = trpc.admin.system.triggerRefresh.useMutation({
    onSuccess: () => refreshLogs.refetch(),
  });

  const data = (refreshLogs.data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (refreshLogs.data ?? []).length > PAGE_SIZE;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>System</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value as "cricket" | "f1")}
            style={{
              padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)",
              backgroundColor: "var(--bg-surface)", fontSize: 13, fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <option value="cricket">Cricket</option>
            <option value="f1">F1</option>
          </select>
          <button
            onClick={() => triggerRefresh.mutate({ sport })}
            disabled={triggerRefresh.isPending}
            style={{
              padding: "8px 16px", backgroundColor: "var(--accent)", color: "#fff", border: "none",
              borderRadius: 6, fontSize: 13, fontWeight: 600,
              cursor: triggerRefresh.isPending ? "not-allowed" : "pointer",
              opacity: triggerRefresh.isPending ? 0.7 : 1,
            }}
          >
            {triggerRefresh.isPending ? "Refreshing..." : "Refresh Visible Only"}
          </button>
        </div>
      </div>

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
          { key: "trigger", header: "Trigger", width: "120px" },
          {
            key: "status",
            header: "Status",
            width: "100px",
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
          { key: "durationMs", header: "Duration", width: "100px", render: (row) => row.durationMs ? `${row.durationMs}ms` : "-" },
          { key: "recordsUpserted", header: "Upserted", width: "80px" },
          { key: "createdAt", header: "Time", render: (row) => new Date(row.createdAt).toLocaleString() },
          { key: "errorMessage", header: "Error", render: (row) => row.errorMessage ? <span style={{ fontSize: 12, color: "var(--red)" }}>{row.errorMessage}</span> : null },
        ]}
      />
    </div>
  );
}
