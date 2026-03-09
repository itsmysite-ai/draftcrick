"use client";

import React, { useState } from "react";
import { TierConfigEditor } from "./TierConfigEditor";
import { PromoCodesManager } from "./PromoCodesManager";
import { SubscribersManager } from "./SubscribersManager";
import { PaymentSettings } from "./PaymentSettings";
import { AnalyticsDashboard } from "./AnalyticsDashboard";

const tabs = [
  { id: "analytics", label: "Analytics" },
  { id: "tiers", label: "Tier Config" },
  { id: "promos", label: "Promo Codes" },
  { id: "subscribers", label: "Subscribers" },
  { id: "settings", label: "Settings" },
] as const;

type Tab = (typeof tabs)[number]["id"];

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "8px 20px",
  fontSize: 14,
  fontWeight: active ? 600 : 400,
  color: active ? "var(--accent)" : "var(--text-secondary)",
  backgroundColor: active ? "var(--bg)" : "transparent",
  border: "1px solid var(--border)",
  borderBottom: active ? "2px solid var(--accent)" : "1px solid var(--border)",
  borderRadius: "8px 8px 0 0",
  cursor: "pointer",
});

export default function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("analytics");

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Subscriptions</h1>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tabStyle(activeTab === tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "analytics" && <AnalyticsDashboard />}
      {activeTab === "tiers" && <TierConfigEditor />}
      {activeTab === "promos" && <PromoCodesManager />}
      {activeTab === "subscribers" && <SubscribersManager />}
      {activeTab === "settings" && <PaymentSettings />}
    </div>
  );
}
