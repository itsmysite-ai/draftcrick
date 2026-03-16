"use client";

import React, { useState, useMemo } from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null;
}

type SortDir = "asc" | "desc";

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  page?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  hasMore?: boolean;
  defaultSort?: { key: string; dir: SortDir };
  /** When provided, sorting is server-side: DataTable won't sort locally, calls this instead */
  onSort?: (key: string, dir: SortDir) => void;
}

const btnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "6px 14px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  backgroundColor: "transparent",
  color: disabled ? "var(--text-muted)" : "var(--text-primary)",
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: 13,
});

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading,
  emptyMessage = "No data found",
  page = 0,
  onPageChange,
  pageSize = 25,
  hasMore,
  defaultSort,
  onSort,
}: DataTableProps<T>) {
  const showPagination = onPageChange != null;
  const serverSide = !!onSort;
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSort?.dir ?? "asc");

  const handleSort = (col: Column<T>) => {
    if (col.sortable === false) return;
    let newDir: SortDir;
    if (sortKey === col.key) {
      newDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      newDir = "asc";
    }
    setSortKey(col.key);
    setSortDir(newDir);
    if (onSort) {
      onSort(col.key, newDir);
    }
  };

  const sortedData = useMemo(() => {
    // When server-side sorting, data is already sorted — don't re-sort locally
    if (serverSide || !sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;

    return [...data].sort((a, b) => {
      const av = col.sortValue ? col.sortValue(a) : a[sortKey];
      const bv = col.sortValue ? col.sortValue(b) : b[sortKey];

      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns, serverSide]);

  const sortIndicator = (col: Column<T>) => {
    if (col.sortable === false) return null;
    if (sortKey !== col.key) return <span style={{ opacity: 0.3, marginLeft: 4 }}>&#8597;</span>;
    return <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>;
  };

  return (
    <div>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col)}
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    width: col.width,
                    cursor: col.sortable !== false ? "pointer" : "default",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col.header}{sortIndicator(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                  Loading...
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: idx < sortedData.length - 1 ? "1px solid var(--border)" : "none" }}>
                  {columns.map((col) => (
                    <td key={col.key} style={{ padding: "10px 14px", fontSize: 14, color: "var(--text-primary)" }}>
                      {col.render ? col.render(row) : String(row[col.key] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
          <span>Page {page + 1}{sortedData.length > 0 ? ` (${sortedData.length} rows)` : ""}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onPageChange(page - 1)} disabled={page === 0} style={btnStyle(page === 0)}>Prev</button>
            <button onClick={() => onPageChange(page + 1)} disabled={!hasMore} style={btnStyle(!hasMore)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
