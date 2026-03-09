"use client";

import React from "react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: string;
}

export function StatsCard({ label, value, icon }: StatsCardProps) {
  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        minWidth: 180,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, marginBottom: 8 }}>
        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-data)" }}>{value}</div>
    </div>
  );
}
