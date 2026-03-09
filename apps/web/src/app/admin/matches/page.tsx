"use client";

import React, { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { DataTable } from "../_components/DataTable";

const PAGE_SIZE = 25;

const STATUS_COLORS: Record<string, string> = {
  upcoming: "var(--amber)",
  live: "var(--accent)",
  completed: "var(--text-muted)",
  delayed: "var(--red)",
  abandoned: "var(--red)",
};

export default function MatchesPage() {
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(0);

  const matchesList = trpc.admin.matches.list.useQuery({
    status: status || undefined,
    limit: PAGE_SIZE + 1,
    offset: page * PAGE_SIZE,
  });
  const updatePhase = trpc.admin.matches.updatePhase.useMutation({
    onSuccess: () => matchesList.refetch(),
  });

  const data = (matchesList.data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (matchesList.data ?? []).length > PAGE_SIZE;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Matches</h1>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, backgroundColor: "var(--bg)", color: "var(--text-primary)" }}
        >
          <option value="">All Statuses</option>
          <option value="upcoming">Upcoming</option>
          <option value="live">Live</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <DataTable
        loading={matchesList.isLoading}
        data={data}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        hasMore={hasMore}
        columns={[
          {
            key: "teams",
            header: "Match",
            render: (row: any) => (
              <Link
                href={`/admin/matches/${row.id}`}
                style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
              >
                {row.teamHome ?? "TBD"} vs {row.teamAway ?? "TBD"}
              </Link>
            ),
          },
          {
            key: "status",
            header: "Status",
            width: "100px",
            render: (row: any) => (
              <span style={{ color: STATUS_COLORS[row.status] ?? "var(--text-primary)", fontWeight: 600, fontSize: 12 }}>
                {row.status}
              </span>
            ),
          },
          {
            key: "scoreSummary",
            header: "Score",
            render: (row: any) => (
              <span style={{ fontSize: 12, fontFamily: "var(--font-data)" }}>
                {row.scoreSummary || "—"}
              </span>
            ),
          },
          {
            key: "result",
            header: "Result",
            render: (row: any) => (
              <span style={{ fontSize: 12 }}>
                {row.result || "—"}
              </span>
            ),
          },
          {
            key: "toss",
            header: "Toss",
            render: (row: any) =>
              row.tossWinner ? (
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {row.tossWinner} ({row.tossDecision})
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
              ),
          },
          {
            key: "matchPhase",
            header: "Phase",
            width: "140px",
            render: (row: any) => (
              <select
                value={row.matchPhase}
                onChange={(e) => updatePhase.mutate({ matchId: row.id, phase: e.target.value })}
                style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, backgroundColor: "var(--bg)", color: "var(--text-primary)" }}
              >
                <option value="idle">idle</option>
                <option value="pre_match">pre_match</option>
                <option value="live">live</option>
                <option value="post_match">post_match</option>
                <option value="completed">completed</option>
              </select>
            ),
          },
          {
            key: "startTime",
            header: "Start",
            render: (row: any) => row.startTime ? new Date(row.startTime).toLocaleString() : "-",
          },
        ]}
      />
    </div>
  );
}
