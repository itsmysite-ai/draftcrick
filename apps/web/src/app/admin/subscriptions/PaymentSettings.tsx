"use client";

import React from "react";
import { trpc } from "@/lib/trpc";

const sectionStyle: React.CSSProperties = {
  padding: 20,
  backgroundColor: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  marginBottom: 24,
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid var(--border)",
  fontSize: 14,
};

export function PaymentSettings() {
  const settings = trpc.subscription.admin.getPaymentSettings.useQuery();
  const setMode = trpc.subscription.admin.setPaymentMode.useMutation({
    onSuccess: () => settings.refetch(),
  });

  const data = settings.data;

  if (settings.isLoading) {
    return <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading payment settings...</p>;
  }

  if (!data) {
    return <p style={{ color: "var(--red)", fontSize: 14 }}>Failed to load payment settings</p>;
  }

  const isStub = data.mode === "stub";
  const canGoLive = data.razorpayConfigured && data.hasPlanPro && data.hasPlanElite && data.hasWebhookSecret;

  return (
    <div>
      {/* Payment Mode */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Payment Mode</h2>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Current mode:</span>
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--font-data)",
              textTransform: "uppercase",
              letterSpacing: 1,
              backgroundColor: isStub ? "var(--amber)" : "var(--red)",
              color: "#fff",
            }}
          >
            {data.mode}
          </span>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
          {isStub
            ? "Stub mode: subscriptions activate immediately without real payment. Use this for development and testing."
            : "Live mode: subscriptions go through Razorpay payment flow. Real money is being processed."}
        </p>

        <button
          onClick={() => setMode.mutate({ mode: isStub ? "live" : "stub" })}
          disabled={setMode.isPending || (isStub && !canGoLive)}
          style={{
            padding: "8px 20px",
            backgroundColor: isStub ? "var(--red)" : "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: setMode.isPending || (isStub && !canGoLive) ? "not-allowed" : "pointer",
            opacity: setMode.isPending || (isStub && !canGoLive) ? 0.5 : 1,
          }}
        >
          {setMode.isPending
            ? "Switching..."
            : isStub
              ? "Switch to Live Mode"
              : "Switch to Stub Mode"}
        </button>

        {setMode.error && (
          <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>
            {setMode.error.message}
          </p>
        )}

        {isStub && !canGoLive && (
          <p style={{ color: "var(--amber)", fontSize: 13, marginTop: 8 }}>
            Cannot enable live mode: missing required Razorpay environment variables (see below).
          </p>
        )}
      </div>

      {/* Razorpay Configuration Status */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Razorpay Configuration</h2>

        <ConfigRow label="RAZORPAY_KEY_ID" configured={data.hasKeyId} />
        <ConfigRow label="RAZORPAY_KEY_SECRET" configured={data.hasKeySecret} />
        <ConfigRow label="RAZORPAY_WEBHOOK_SECRET" configured={data.hasWebhookSecret} />
        <ConfigRow label="RAZORPAY_PLAN_PRO" configured={data.hasPlanPro} />
        <ConfigRow label="RAZORPAY_PLAN_ELITE" configured={data.hasPlanElite} />

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 16 }}>
          These are set via environment variables on the API server. Update your .env file and restart the server to configure.
        </p>
      </div>
    </div>
  );
}

function ConfigRow({ label, configured }: { label: string; configured: boolean }) {
  return (
    <div style={labelStyle}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 13 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: configured ? "var(--accent)" : "var(--red)",
        }}
      >
        {configured ? "Configured" : "Missing"}
      </span>
    </div>
  );
}
