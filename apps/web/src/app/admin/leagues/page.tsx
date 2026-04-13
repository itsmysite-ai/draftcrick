"use client";

import React, { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DataTable } from "../_components/DataTable";

const PAGE_SIZE = 25;

const FORMAT_LABELS: Record<string, string> = {
  cricket_manager: "Cricket Manager",
  salary_cap: "Salary Cap",
  draft: "Draft",
  auction: "Auction",
  prediction: "Prediction",
};

export default function AdminLeaguesPage() {
  const [page, setPage] = useState(0);
  const [formatFilter, setFormatFilter] = useState<string>("");

  const leaguesList = trpc.admin.leagues.list.useQuery({
    format: (formatFilter || undefined) as
      | "cricket_manager"
      | "salary_cap"
      | "draft"
      | "auction"
      | "prediction"
      | undefined,
    limit: PAGE_SIZE + 1,
    offset: page * PAGE_SIZE,
  });

  const deleteLeague = trpc.admin.leagues.delete.useMutation({
    onSuccess: () => leaguesList.refetch(),
  });

  const data = (leaguesList.data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (leaguesList.data ?? []).length > PAGE_SIZE;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin Leagues</h1>
        <Link
          href="/admin/leagues/new"
          style={{
            padding: "8px 16px",
            backgroundColor: "var(--accent)",
            color: "white",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          + New League
        </Link>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: "var(--text-secondary)", marginRight: 8 }}>
          Format:
        </label>
        <select
          value={formatFilter}
          onChange={(e) => {
            setFormatFilter(e.target.value);
            setPage(0);
          }}
          style={{
            padding: "6px 10px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-primary)",
            fontSize: 13,
          }}
        >
          <option value="">All formats</option>
          <option value="cricket_manager">Cricket Manager</option>
          <option value="salary_cap">Salary Cap</option>
          <option value="draft">Draft</option>
          <option value="auction">Auction</option>
          <option value="prediction">Prediction</option>
        </select>
      </div>

      <DataTable
        loading={leaguesList.isLoading}
        data={data}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        hasMore={hasMore}
        columns={[
          {
            key: "name",
            header: "Name",
            render: (row) => (
              <Link
                href={`/admin/leagues/${row.id}`}
                style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
              >
                {row.name}
              </Link>
            ),
          },
          {
            key: "format",
            header: "Format",
            width: "160px",
            render: (row) => (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: "rgba(61,153,104,0.1)",
                  color: "var(--accent)",
                  fontFamily: "var(--font-data)",
                }}
              >
                {FORMAT_LABELS[row.format] ?? row.format}
              </span>
            ),
          },
          { key: "tournament", header: "Tournament" },
          {
            key: "visibility",
            header: "Visibility",
            width: "110px",
            render: (row) => (row.isPrivate ? "Private" : "Public"),
          },
          {
            key: "maxMembers",
            header: "Members",
            width: "90px",
          },
          {
            key: "status",
            header: "Status",
            width: "100px",
          },
          {
            key: "actions",
            header: "",
            width: "90px",
            render: (row) => (
              <button
                onClick={() => {
                  if (confirm(`Delete league "${row.name}"? This cannot be undone.`))
                    deleteLeague.mutate({ leagueId: row.id });
                }}
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  border: "1px solid var(--red)",
                  borderRadius: 6,
                  backgroundColor: "transparent",
                  color: "var(--red)",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
