"use client";

import React from "react";
import { trpc } from "@/lib/trpc";
import { StatsCard } from "../_components/StatsCard";

export default function RevenuePage() {
  const summary = trpc.admin.revenue.summary.useQuery();

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Revenue</h1>

      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        <StatsCard label="Total Deposits" value={`₹${summary.data?.totalDeposits ?? 0}`} />
        <StatsCard label="Total Withdrawals" value={`₹${summary.data?.totalWithdrawals ?? 0}`} />
      </div>

      <div
        style={{
          padding: 40,
          textAlign: "center",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Full Revenue Dashboard</p>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Coming with L1.5 Subscription Monetization
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 12 }}>
          Will include: subscription metrics, MRR, churn, ARPU, conversion funnels
        </p>
      </div>
    </div>
  );
}
