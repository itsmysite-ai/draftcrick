"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { DataTable } from "../_components/DataTable";

const PAGE_SIZE = 25;

export default function ContestsPage() {
  const [page, setPage] = useState(0);
  const contestsList = trpc.admin.contests.list.useQuery({
    limit: PAGE_SIZE + 1,
    offset: page * PAGE_SIZE,
  });
  const cancelContest = trpc.admin.contests.cancel.useMutation({
    onSuccess: () => contestsList.refetch(),
  });

  const data = (contestsList.data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (contestsList.data ?? []).length > PAGE_SIZE;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Contests</h1>

      <DataTable
        loading={contestsList.isLoading}
        data={data}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        hasMore={hasMore}
        columns={[
          { key: "name", header: "Name" },
          { key: "contestType", header: "Type", width: "100px" },
          {
            key: "entries",
            header: "Entries",
            width: "100px",
            render: (row) => `${row.currentEntries}/${row.maxEntries}`,
          },
          { key: "entryFee", header: "Fee", width: "80px" },
          { key: "prizePool", header: "Prize", width: "100px" },
          {
            key: "status",
            header: "Status",
            width: "100px",
            render: (row) => (
              <span style={{
                padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                backgroundColor: row.status === "open" ? "rgba(61,153,104,0.1)" : row.status === "cancelled" ? "rgba(229,72,77,0.1)" : "rgba(94,93,90,0.1)",
                color: row.status === "open" ? "var(--accent)" : row.status === "cancelled" ? "var(--red)" : "var(--text-secondary)",
              }}>
                {row.status}
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            width: "80px",
            render: (row) =>
              row.status === "open" ? (
                <button
                  onClick={() => { if (confirm("Cancel this contest?")) cancelContest.mutate({ contestId: row.id }); }}
                  style={{ fontSize: 12, padding: "4px 8px", border: "1px solid var(--red)", borderRadius: 6, backgroundColor: "transparent", color: "var(--red)", cursor: "pointer" }}
                >
                  Cancel
                </button>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
