"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { DataTable } from "../_components/DataTable";

const PAGE_SIZE = 25;

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const usersList = trpc.admin.users.list.useQuery({
    search: search || undefined,
    limit: PAGE_SIZE + 1,
    offset: page * PAGE_SIZE,
  });
  const updateRole = trpc.admin.users.updateRole.useMutation({
    onSuccess: () => usersList.refetch(),
  });

  const data = (usersList.data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (usersList.data ?? []).length > PAGE_SIZE;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Users</h1>

      <input
        placeholder="Search users..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 14, backgroundColor: "var(--bg)", color: "var(--text-primary)", width: 280, marginBottom: 20 }}
      />

      <DataTable
        loading={usersList.isLoading}
        data={data}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        hasMore={hasMore}
        columns={[
          { key: "username", header: "Username" },
          { key: "displayName", header: "Name" },
          { key: "email", header: "Email" },
          {
            key: "role",
            header: "Role",
            width: "140px",
            render: (row) => (
              <select
                value={row.role}
                onChange={(e) => updateRole.mutate({ userId: row.id, role: e.target.value as any })}
                style={{ padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, backgroundColor: "var(--bg)", color: "var(--text-primary)" }}
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
                <option value="moderator">moderator</option>
              </select>
            ),
          },
          {
            key: "createdAt",
            header: "Joined",
            width: "160px",
            render: (row) => new Date(row.createdAt).toLocaleDateString(),
          },
        ]}
      />
    </div>
  );
}
