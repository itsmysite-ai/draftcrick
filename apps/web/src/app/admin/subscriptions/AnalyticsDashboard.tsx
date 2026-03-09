"use client";

import React from "react";
import { trpc } from "@/lib/trpc";
import { StatsCard } from "../_components/StatsCard";

const sectionStyle: React.CSSProperties = {
  padding: 20,
  backgroundColor: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  marginBottom: 24,
};

const headingStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 16,
  color: "var(--text-primary)",
};

const subheadingStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 10,
  color: "var(--text-secondary)",
};

const gridStyle = (cols: number): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: `repeat(${cols}, 1fr)`,
  gap: 16,
  marginBottom: 20,
});

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
  fontFamily: "var(--font-data)",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 600,
  fontSize: 11,
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text-primary)",
};

const badgeStyle = (color: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  backgroundColor: color === "green" ? "#22c55e22" : color === "red" ? "#ef444422" : color === "yellow" ? "#eab30822" : "#6366f122",
  color: color === "green" ? "#22c55e" : color === "red" ? "#ef4444" : color === "yellow" ? "#eab308" : "#6366f1",
});

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function BarChart({ data, labelKey, valueKey, color = "var(--accent)" }: {
  data: Record<string, any>[];
  labelKey: string;
  valueKey: string;
  color?: string;
}) {
  if (!data.length) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No data yet</div>;
  const max = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 64, fontFamily: "var(--font-data)" }}>
            {d[labelKey]}
          </span>
          <div style={{ flex: 1, height: 20, backgroundColor: "var(--bg)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${(Number(d[valueKey]) / max) * 100}%`,
              height: "100%",
              backgroundColor: color,
              borderRadius: 4,
              minWidth: Number(d[valueKey]) > 0 ? 4 : 0,
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 32, textAlign: "right", fontFamily: "var(--font-data)" }}>
            {d[valueKey]}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsDashboard() {
  const analytics = trpc.subscription.admin.getAnalytics.useQuery({ months: 6 });

  if (analytics.isLoading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading analytics...</div>;
  }

  if (analytics.error) {
    return (
      <div style={{ padding: 20, color: "#ef4444", backgroundColor: "#ef444411", borderRadius: 8 }}>
        Failed to load analytics: {analytics.error.message}
      </div>
    );
  }

  const data = analytics.data!;
  const { overview, conversion, churn, monthlyTrends, promoROI, paymentFailures, atRisk } = data;

  // Aggregate monthly trends by month for chart
  const trendsByMonth = new Map<string, { created: number; upgraded: number; cancelled: number; payment_failed: number }>();
  for (const t of monthlyTrends) {
    const existing = trendsByMonth.get(t.month) ?? { created: 0, upgraded: 0, cancelled: 0, payment_failed: 0 };
    existing[t.event as keyof typeof existing] = (existing[t.event as keyof typeof existing] ?? 0) + t.count;
    trendsByMonth.set(t.month, existing);
  }
  const trendRows = Array.from(trendsByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({ month, ...counts }));

  return (
    <div>
      {/* Overview */}
      <div style={gridStyle(5)}>
        <StatsCard label="Total Users" value={overview.totalUsers} />
        <StatsCard label="Free Users" value={overview.freeUsers} />
        <StatsCard label="Pro Users" value={overview.proUsers} icon="💎" />
        <StatsCard label="Elite Users" value={overview.eliteUsers} icon="👑" />
        <StatsCard label="Conversion Rate" value={`${overview.conversionRate}%`} />
      </div>

      <div style={gridStyle(3)}>
        <StatsCard label="Monthly Recurring Revenue" value={overview.mrrDisplay} icon="💰" />
        <StatsCard label="ARPU (paid users)" value={`₹${overview.arpu}`} />
        <StatsCard label="Total Paid" value={overview.proUsers + overview.eliteUsers} />
      </div>

      {/* Conversion Funnel */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Conversion Funnel</div>
        <div style={gridStyle(4)}>
          <div>
            <div style={subheadingStyle}>Free → Pro</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-data)" }}>{conversion.freeToPro}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{conversion.freeToProRate}% of all users</div>
          </div>
          <div>
            <div style={subheadingStyle}>Free → Elite</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-data)" }}>{conversion.freeToElite}</div>
          </div>
          <div>
            <div style={subheadingStyle}>Pro → Elite</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-data)" }}>{conversion.proToElite}</div>
          </div>
          <div>
            <div style={subheadingStyle}>Overall Conversion</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-data)", color: "var(--accent)" }}>
              {overview.conversionRate}%
            </div>
          </div>
        </div>
      </div>

      {/* Churn Metrics */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Churn Analysis</div>
        <div style={gridStyle(3)}>
          <StatsCard label="Total Churned (all time)" value={churn.totalChurned} icon="📉" />
          <StatsCard label="Avg Days Before Churn" value={churn.avgDaysBeforeChurn} icon="⏱" />
          <div>
            <div style={subheadingStyle}>At-Risk Users</div>
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <div>
                <span style={badgeStyle("yellow")}>{atRisk.cancelled} cancelled</span>
              </div>
              <div>
                <span style={badgeStyle("red")}>{atRisk.pastDue} past due</span>
              </div>
              <div>
                <span style={badgeStyle("red")}>{atRisk.expired} expired</span>
              </div>
            </div>
          </div>
        </div>

        {churn.byMonth.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={subheadingStyle}>Monthly Churn</div>
            <BarChart
              data={churn.byMonth.map((c: any) => ({ label: `${c.month} (${c.tier})`, value: c.count }))}
              labelKey="label"
              valueKey="value"
              color="#ef4444"
            />
          </div>
        )}
      </div>

      {/* Monthly Trends */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Monthly Trends (Last 6 Months)</div>
        {trendRows.length > 0 ? (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Month</th>
                <th style={thStyle}>New Subs</th>
                <th style={thStyle}>Upgrades</th>
                <th style={thStyle}>Cancellations</th>
                <th style={thStyle}>Payment Failures</th>
              </tr>
            </thead>
            <tbody>
              {trendRows.map((row) => (
                <tr key={row.month}>
                  <td style={tdStyle}>{row.month}</td>
                  <td style={tdStyle}>
                    <span style={badgeStyle("green")}>{row.created}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={badgeStyle("blue")}>{row.upgraded}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={badgeStyle("red")}>{row.cancelled}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={badgeStyle("yellow")}>{row.payment_failed}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No subscription events yet</div>
        )}
      </div>

      {/* Payment Failures */}
      {paymentFailures.length > 0 && (
        <div style={sectionStyle}>
          <div style={headingStyle}>Payment Failures</div>
          <BarChart data={paymentFailures} labelKey="month" valueKey="count" color="#ef4444" />
        </div>
      )}

      {/* Promo Code ROI */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Promo Code Performance</div>
        {promoROI.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Influencer</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Redemptions</th>
                  <th style={thStyle}>Unique Users</th>
                  <th style={thStyle}>Discount Given</th>
                  <th style={thStyle}>Commission Owed</th>
                  <th style={thStyle}>Retained</th>
                  <th style={thStyle}>Retention %</th>
                </tr>
              </thead>
              <tbody>
                {promoROI.map((p: any) => (
                  <tr key={p.code}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{p.code}</td>
                    <td style={tdStyle}>{p.influencer ?? "—"}</td>
                    <td style={tdStyle}>{p.discountType}</td>
                    <td style={tdStyle}>
                      <span style={badgeStyle(p.isActive ? "green" : "red")}>
                        {p.isActive ? "active" : "inactive"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {p.totalRedemptions}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""}
                    </td>
                    <td style={tdStyle}>{p.uniqueUsers}</td>
                    <td style={tdStyle}>{formatPaise(p.totalDiscountGivenPaise)}</td>
                    <td style={tdStyle}>{formatPaise(p.totalCommissionPaise)}</td>
                    <td style={tdStyle}>{p.retainedUsers}</td>
                    <td style={tdStyle}>
                      <span style={badgeStyle(p.retentionRate >= 50 ? "green" : p.retentionRate >= 25 ? "yellow" : "red")}>
                        {p.retentionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No promo codes created yet</div>
        )}
      </div>
    </div>
  );
}
