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
  const setPricingMode = trpc.subscription.admin.setPricingMode.useMutation({
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
  const isPricingStub = data.pricingMode === "stub";
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
            : "Live mode: Android/Web go through Razorpay, iOS goes through Apple IAP via RevenueCat. Real money is being processed."}
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

      {/* Pricing Geo Mode */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Pricing Geo Mode</h2>

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
              backgroundColor: isPricingStub ? "var(--amber)" : "var(--accent)",
              color: "#fff",
            }}
          >
            {data.pricingMode}
          </span>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
          {isPricingStub
            ? "Stub mode: pricing currency uses the user's self-declared country from their profile. Good for testing."
            : "Live mode: pricing currency is determined by server-side IP geolocation. Prevents users from declaring a cheaper region."}
        </p>

        <button
          onClick={() => setPricingMode.mutate({ mode: isPricingStub ? "live" : "stub" })}
          disabled={setPricingMode.isPending}
          style={{
            padding: "8px 20px",
            backgroundColor: isPricingStub ? "var(--accent)" : "var(--amber)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: setPricingMode.isPending ? "not-allowed" : "pointer",
            opacity: setPricingMode.isPending ? 0.5 : 1,
          }}
        >
          {setPricingMode.isPending
            ? "Switching..."
            : isPricingStub
              ? "Switch to Live (IP-based)"
              : "Switch to Stub (Declared)"}
        </button>

        {setPricingMode.error && (
          <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>
            {setPricingMode.error.message}
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
          Razorpay is used for Android and Web payments. Set via environment variables on the API server.
        </p>
      </div>

      {/* RevenueCat / Apple IAP Configuration Status */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>RevenueCat / Apple IAP Configuration</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 }}>
          RevenueCat handles iOS In-App Purchases via Apple StoreKit 2. iOS users are automatically routed
          through Apple IAP instead of Razorpay.
        </p>

        <ConfigRow label="EXPO_PUBLIC_REVENUECAT_API_KEY" configured={!!(data as any).hasRevenueCatApiKey} />
        <ConfigRow label="REVENUECAT_WEBHOOK_AUTH_KEY" configured={!!(data as any).hasRevenueCatWebhookKey} />

        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: "rgba(93,184,130,0.06)", border: "1px solid rgba(93,184,130,0.15)" }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
            <strong>Platform routing:</strong><br />
            iOS &rarr; Apple IAP via RevenueCat (30% Apple commission)<br />
            Android &rarr; Razorpay (2% payment gateway fee)<br />
            Web &rarr; Razorpay (2% payment gateway fee)
          </p>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 16 }}>
          Configure RevenueCat dashboard at app.revenuecat.com. Product IDs must match App Store Connect.
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
