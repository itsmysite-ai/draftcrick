"use client";

import React from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  page?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  hasMore?: boolean;
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
}: DataTableProps<T>) {
  const showPagination = onPageChange != null;

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
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    width: col.width,
                  }}
                >
                  {col.header}
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
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: idx < data.length - 1 ? "1px solid var(--border)" : "none" }}>
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
          <span>Page {page + 1}{data.length > 0 ? ` (${data.length} rows)` : ""}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onPageChange(page - 1)} disabled={page === 0} style={btnStyle(page === 0)}>Prev</button>
            <button onClick={() => onPageChange(page + 1)} disabled={!hasMore} style={btnStyle(!hasMore)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
