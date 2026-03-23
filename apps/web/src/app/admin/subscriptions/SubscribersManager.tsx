"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { DataTable } from "../_components/DataTable";
import { StatsCard } from "../_components/StatsCard";

const sectionStyle: React.CSSProperties = {
  padding: 20,
  backgroundColor: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  marginBottom: 24,
};

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 13,
  backgroundColor: "var(--bg)",
  color: "var(--text-primary)",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: "var(--font-data)",
};

export function SubscribersManager() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tierFilter, setTierFilter] = useState<string>("");

  const metrics = trpc.subscription.admin.getMetrics.useQuery();
  const subs = trpc.subscription.admin.listSubscriptions.useQuery({
    status: (statusFilter || undefined) as any,
    tier: (tierFilter || undefined) as any,
    limit: 50,
  });

  const override = trpc.subscription.admin.overrideUserTier.useMutation({
    onSuccess: () => {
      subs.refetch();
      metrics.refetch();
      setOverrideForm(null);
    },
  });

  const [overrideForm, setOverrideForm] = useState<{
    userId: string;
    username: string;
    tier: "basic" | "pro" | "elite";
    reason: string;
  } | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const userEvents = trpc.subscription.admin.getUserEvents.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );

  // Compute metrics from data
  const metricData = metrics.data?.subscriptionsByTierAndStatus ?? [];
  const activeByTier = (tier: string) =>
    metricData.filter((m: any) => m.tier === tier && m.status === "active").reduce((sum: number, m: any) => sum + m.count, 0);

  return (
    <div>
      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatsCard label="Active Basic" value={activeByTier("basic")} icon="B" />
        <StatsCard label="Active Pro" value={activeByTier("pro")} icon="P" />
        <StatsCard label="Active Elite" value={activeByTier("elite")} icon="E" />
        <StatsCard
          label="Total Subscriptions"
          value={metricData.reduce((sum: number, m: any) => sum + m.count, 0)}
        />
        <StatsCard label="Active Day Passes" value={(metrics.data as any)?.activeDayPasses ?? 0} icon="⚡" />
        <StatsCard label="Promo Redemptions" value={metrics.data?.totalPromoRedemptions ?? 0} />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ ...selectStyle, width: 160 }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
          <option value="past_due">Past Due</option>
        </select>

        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          style={{ ...selectStyle, width: 130 }}
        >
          <option value="">All Tiers</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="elite">Elite</option>
        </select>
      </div>

      {/* Subscribers Table */}
      <DataTable
        loading={subs.isLoading}
        data={subs.data ?? []}
        emptyMessage="No subscriptions found"
        columns={[
          {
            key: "user",
            header: "User",
            render: (row: any) => (
              <div>
                <div style={{ fontWeight: 500 }}>{row.user?.username ?? "-"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.user?.email ?? "-"}</div>
              </div>
            ),
          },
          {
            key: "tier",
            header: "Tier",
            width: "80px",
            render: (row: any) => (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "var(--font-data)",
                  backgroundColor:
                    row.tier === "elite" ? "rgba(212,160,23,0.15)" :
                    row.tier === "pro" ? "rgba(16,185,129,0.15)" :
                    "var(--border)",
                  color:
                    row.tier === "elite" ? "#D4A017" :
                    row.tier === "pro" ? "var(--accent)" :
                    "var(--text-muted)",
                }}
              >
                {row.tier.toUpperCase()}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            width: "90px",
            render: (row: any) => (
              <span style={{
                fontSize: 12,
                color: row.status === "active" ? "var(--accent)" : row.status === "cancelled" ? "var(--red)" : "var(--text-muted)",
              }}>
                {row.status}
              </span>
            ),
          },
          {
            key: "priceInPaise",
            header: "Price",
            width: "80px",
            render: (row: any) => row.priceInPaise ? `₹${(Number(row.priceInPaise) / 100).toFixed(0)}` : "-",
          },
          {
            key: "paymentProvider",
            header: "Provider",
            width: "80px",
            render: (row: any) => {
              const provider = row.paymentProvider ?? "razorpay";
              const colors: Record<string, { bg: string; fg: string }> = {
                apple: { bg: "rgba(0,0,0,0.08)", fg: "#333" },
                razorpay: { bg: "rgba(2,123,227,0.1)", fg: "#027BE3" },
                admin: { bg: "rgba(212,160,23,0.15)", fg: "#D4A017" },
                stub: { bg: "var(--border)", fg: "var(--text-muted)" },
              };
              const c = colors[provider] ?? colors.stub;
              return (
                <span style={{
                  padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                  fontFamily: "var(--font-data)", backgroundColor: c.bg, color: c.fg,
                }}>
                  {provider}
                </span>
              );
            },
          },
          {
            key: "purchasePlatform",
            header: "Platform",
            width: "70px",
            render: (row: any) => (
              <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-muted)" }}>
                {row.purchasePlatform ?? "-"}
              </span>
            ),
          },
          {
            key: "currentPeriodEnd",
            header: "Period End",
            width: "110px",
            render: (row: any) => row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toLocaleDateString() : "-",
          },
          {
            key: "cancelAtPeriodEnd",
            header: "Cancel?",
            width: "70px",
            render: (row: any) => row.cancelAtPeriodEnd ? "Yes" : "-",
          },
          {
            key: "actions",
            header: "Actions",
            width: "160px",
            render: (row: any) => (
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => setSelectedUserId(row.userId)}
                  style={{
                    padding: "3px 8px",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    fontSize: 11,
                    backgroundColor: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  History
                </button>
                <button
                  onClick={() =>
                    setOverrideForm({
                      userId: row.userId,
                      username: row.user?.username ?? row.userId,
                      tier: row.tier as "basic" | "pro" | "elite",
                      reason: "",
                    })
                  }
                  style={{
                    padding: "3px 8px",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    fontSize: 11,
                    backgroundColor: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Override
                </button>
              </div>
            ),
          },
        ]}
      />

      {/* User Event History Panel */}
      {selectedUserId && (
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>
              Subscription Event History
            </h3>
            <button
              onClick={() => setSelectedUserId(null)}
              style={{
                padding: "4px 12px", border: "1px solid var(--border)", borderRadius: 4,
                fontSize: 12, backgroundColor: "transparent", color: "var(--text-secondary)", cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
          {userEvents.isLoading ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading events...</p>
          ) : !userEvents.data?.length ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No events found for this user.</p>
          ) : (
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, color: "var(--text-muted)" }}>Event</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, color: "var(--text-muted)" }}>From</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, color: "var(--text-muted)" }}>To</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, color: "var(--text-muted)" }}>Date</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, color: "var(--text-muted)" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {userEvents.data.map((evt: any) => (
                  <tr key={evt.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 8px" }}>
                      <span style={{
                        padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                        fontFamily: "var(--font-data)",
                        backgroundColor:
                          evt.event === "admin_override" ? "rgba(212,160,23,0.15)" :
                          evt.event === "cancelled" ? "rgba(229,72,77,0.1)" :
                          "rgba(16,185,129,0.1)",
                        color:
                          evt.event === "admin_override" ? "#D4A017" :
                          evt.event === "cancelled" ? "var(--red)" :
                          "var(--accent)",
                      }}>
                        {evt.event.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ padding: "6px 8px", fontFamily: "var(--font-data)" }}>{evt.fromTier ?? "-"}</td>
                    <td style={{ padding: "6px 8px", fontFamily: "var(--font-data)" }}>{evt.toTier ?? "-"}</td>
                    <td style={{ padding: "6px 8px", color: "var(--text-muted)" }}>
                      {new Date(evt.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {evt.metadata ? JSON.stringify(evt.metadata) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Override Modal */}
      {overrideForm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setOverrideForm(null)}
        >
          <div
            style={{
              ...sectionStyle,
              maxWidth: 400,
              width: "100%",
              margin: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              Override Tier: {overrideForm.username}
            </h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                New Tier
              </label>
              <select
                value={overrideForm.tier}
                onChange={(e) => setOverrideForm({ ...overrideForm, tier: e.target.value as any })}
                style={{ ...selectStyle, width: "100%" }}
              >
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="elite">Elite</option>
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Reason (required)
              </label>
              <input
                type="text"
                placeholder="Support ticket #123, testing, etc."
                value={overrideForm.reason}
                onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setOverrideForm(null)}
                style={{
                  padding: "8px 16px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 13,
                  backgroundColor: "transparent",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  override.mutate({
                    userId: overrideForm.userId,
                    tier: overrideForm.tier,
                    reason: overrideForm.reason,
                  })
                }
                disabled={!overrideForm.reason || override.isPending}
                style={{
                  padding: "8px 16px",
                  backgroundColor: overrideForm.reason ? "var(--accent)" : "var(--border)",
                  color: overrideForm.reason ? "#fff" : "var(--text-muted)",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: overrideForm.reason ? "pointer" : "not-allowed",
                  opacity: override.isPending ? 0.7 : 1,
                }}
              >
                {override.isPending ? "Overriding..." : "Apply Override"}
              </button>
            </div>

            {override.isError && (
              <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>
                Error: {override.error.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
