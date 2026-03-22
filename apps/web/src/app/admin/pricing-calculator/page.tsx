"use client";

import React, { useState, useMemo } from "react";

// ─── Design tokens (matching admin portal) ─────────────────────
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

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: 90,
  padding: "6px 8px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 13,
  backgroundColor: "var(--bg)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-data)",
};

const wideInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: 120,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 0",
  borderBottom: "1px solid var(--border)",
  fontSize: 13,
};

const gridStyle = (cols: number): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: `repeat(${cols}, 1fr)`,
  gap: 16,
  marginBottom: 20,
});

const badgeStyle = (color: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "var(--font-data)",
  backgroundColor:
    color === "green" ? "#22c55e22" :
    color === "red" ? "#ef444422" :
    color === "yellow" ? "#eab30822" :
    color === "blue" ? "#3b82f622" :
    "#6366f122",
  color:
    color === "green" ? "#22c55e" :
    color === "red" ? "#ef4444" :
    color === "yellow" ? "#eab308" :
    color === "blue" ? "#3b82f6" :
    "#6366f1",
});

const cardStyle: React.CSSProperties = {
  padding: 16,
  backgroundColor: "var(--bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  textAlign: "center" as const,
};

const summaryCardStyle = (highlight?: string): React.CSSProperties => ({
  ...cardStyle,
  borderColor: highlight === "green" ? "#22c55e44" : highlight === "red" ? "#ef444444" : "var(--border)",
  backgroundColor: highlight === "green" ? "#22c55e08" : highlight === "red" ? "#ef444408" : "var(--bg)",
});

// ─── Types ─────────────────────────────────────────────────────

interface InfraCosts {
  // Cloud Run
  cloudRunVcpuSec: number;
  cloudRunGibSec: number;
  cloudRunPerMReqs: number;
  // Cloud SQL
  cloudSqlInstanceMonthly: number;
  cloudSqlStoragePerGb: number;
  cloudSqlBackupPerGb: number;
  cloudSqlStorageGb: number;
  cloudSqlHaMultiplier: number;
  // Redis
  redisPerGbHour: number;
  redisCapacityGb: number;
  // Networking
  egressPerGb: number;
  crossRegionPerGb: number;
  // Logging
  loggingPerGib: number;
  loggingFreeGib: number;
  // Artifact Registry
  artifactPerGb: number;
  artifactUsageGb: number;
}

interface AiCosts {
  inputPerMTokens: number;
  outputPerMTokens: number;
  batchInputPerMTokens: number;
  batchOutputPerMTokens: number;
  batchRatio: number; // % of calls that use batch API
}

interface FirebaseCosts {
  authFreeMAU: number;
  authPerMAUAboveFree: number;
  smsPerOtpIndia: number;
  smsPerOtpUS: number;
  avgOtpsPerUserPerYear: number;
}

interface PaymentCosts {
  razorpayPercent: number;
  razorpayFixedINR: number;
  stripePercent: number;
  stripeFixedUSD: number;
  appStorePercent: number;
  useAppStore: boolean; // If true, apply app store cut instead
}

interface OpsCosts {
  domainAnnual: number;
  emailServiceMonthly: number;
  smsNotificationsMonthly: number;
  errorMonitoringMonthly: number;
  githubMonthly: number;
  ciCdMonthly: number;
  webHostingMonthly: number;
  analyticsToolMonthly: number;
  supportToolMonthly: number;
  legalMonthly: number;
  cricketDataApiMonthly: number;
  accountingMonthly: number;
  miscMonthly: number;
}

interface TeamCosts {
  founderSalaryMonthly: number;
  dev1Monthly: number;
  dev2Monthly: number;
  designerMonthly: number;
  otherMonthly: number;
}

interface MarketingCosts {
  monthlyBudget: number;
  blendedCacINR: number;
  blendedCacUSD: number;
}

interface PricingConfig {
  basicYearlyINR: number;
  proYearlyINR: number;
  eliteYearlyINR: number;
  dayPassINR: number;
  basicYearlyUSD: number;
  proYearlyUSD: number;
  eliteYearlyUSD: number;
  dayPassUSD: number;
}

interface UserAssumptions {
  totalUsers: number;
  indiaPercent: number;
  basicPercent: number;
  proPercent: number;
  elitePercent: number;
  dayPassPercent: number; // % of users who buy day passes
  dayPassesPerUserPerYear: number;
  regions: number; // 1 or 2
  gstPercent: number;
  inrToUsd: number;
}

interface UsageProfile {
  basicAiCallsPerDay: number;
  proAiCallsPerDay: number;
  eliteAiCallsPerDay: number;
  basicActiveDaysPerMonth: number;
  proActiveDaysPerMonth: number;
  eliteActiveDaysPerMonth: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  cacheHitReduction: number; // % reduction in actual AI calls due to caching
}

// ─── Default values ────────────────────────────────────────────

const DEFAULT_INFRA: InfraCosts = {
  cloudRunVcpuSec: 0.000024,
  cloudRunGibSec: 0.0000025,
  cloudRunPerMReqs: 0.40,
  cloudSqlInstanceMonthly: 75,
  cloudSqlStoragePerGb: 0.17,
  cloudSqlBackupPerGb: 0.08,
  cloudSqlStorageGb: 50,
  cloudSqlHaMultiplier: 2.0,
  redisPerGbHour: 0.049,
  redisCapacityGb: 1,
  egressPerGb: 0.12,
  crossRegionPerGb: 0.01,
  loggingPerGib: 0.50,
  loggingFreeGib: 50,
  artifactPerGb: 0.10,
  artifactUsageGb: 5,
};

const DEFAULT_AI: AiCosts = {
  inputPerMTokens: 0.15,
  outputPerMTokens: 0.60,
  batchInputPerMTokens: 0.075,
  batchOutputPerMTokens: 0.30,
  batchRatio: 30,
};

const DEFAULT_FIREBASE: FirebaseCosts = {
  authFreeMAU: 50000,
  authPerMAUAboveFree: 0.0055,
  smsPerOtpIndia: 0.015,
  smsPerOtpUS: 0.01,
  avgOtpsPerUserPerYear: 4,
};

const DEFAULT_PAYMENT: PaymentCosts = {
  razorpayPercent: 2.0,
  razorpayFixedINR: 3,
  stripePercent: 2.9,
  stripeFixedUSD: 0.30,
  appStorePercent: 15,
  useAppStore: false,
};

const DEFAULT_OPS: OpsCosts = {
  domainAnnual: 90,
  emailServiceMonthly: 25,
  smsNotificationsMonthly: 20,
  errorMonitoringMonthly: 0,
  githubMonthly: 16,
  ciCdMonthly: 10,
  webHostingMonthly: 0,
  analyticsToolMonthly: 0,
  supportToolMonthly: 0,
  legalMonthly: 100,
  cricketDataApiMonthly: 0,
  accountingMonthly: 80,
  miscMonthly: 50,
};

const DEFAULT_TEAM: TeamCosts = {
  founderSalaryMonthly: 0,
  dev1Monthly: 0,
  dev2Monthly: 0,
  designerMonthly: 0,
  otherMonthly: 0,
};

const DEFAULT_MARKETING: MarketingCosts = {
  monthlyBudget: 0,
  blendedCacINR: 40,
  blendedCacUSD: 4,
};

const DEFAULT_PRICING: PricingConfig = {
  basicYearlyINR: 289,
  proYearlyINR: 889,
  eliteYearlyINR: 1899,
  dayPassINR: 69,
  basicYearlyUSD: 5.99,
  proYearlyUSD: 19.99,
  eliteYearlyUSD: 49.99,
  dayPassUSD: 2.99,
};

const DEFAULT_USERS: UserAssumptions = {
  totalUsers: 5000,
  indiaPercent: 80,
  basicPercent: 50,
  proPercent: 32,
  elitePercent: 13,
  dayPassPercent: 5,
  dayPassesPerUserPerYear: 20,
  regions: 2,
  gstPercent: 18,
  inrToUsd: 83,
};

const DEFAULT_USAGE: UsageProfile = {
  basicAiCallsPerDay: 3,
  proAiCallsPerDay: 18,
  eliteAiCallsPerDay: 70,
  basicActiveDaysPerMonth: 15,
  proActiveDaysPerMonth: 22,
  eliteActiveDaysPerMonth: 28,
  avgInputTokens: 2000,
  avgOutputTokens: 800,
  cacheHitReduction: 60,
};

// ─── Helpers ───────────────────────────────────────────────────

function fmt(n: number, decimals = 0): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(decimals > 0 ? decimals : 1)}K`;
  return `$${n.toFixed(decimals)}`;
}

function fmtINR(n: number): string {
  if (Math.abs(n) >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (Math.abs(n) >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// ─── Input Component ───────────────────────────────────────────

function NumInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step,
  wide,
  tooltip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  wide?: boolean;
  tooltip?: string;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={labelStyle} title={tooltip}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {prefix && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{prefix}</span>}
        <input
          type="number"
          value={value}
          step={step ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
          style={wide ? wideInputStyle : inputStyle}
        />
        {suffix && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{suffix}</span>}
      </div>
    </div>
  );
}

// ─── Collapsible Section ───────────────────────────────────────

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = true,
  children,
  monthlyCost,
  annualCost,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  monthlyCost?: number;
  annualCost?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={sectionStyle}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        onClick={() => setOpen(!open)}
      >
        <div>
          <h3 style={{ ...headingStyle, marginBottom: subtitle ? 4 : 0 }}>{open ? "▼" : "▶"} {title}</h3>
          {subtitle && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{subtitle}</p>}
        </div>
        {(monthlyCost !== undefined || annualCost !== undefined) && (
          <div style={{ textAlign: "right" }}>
            {monthlyCost !== undefined && (
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-data)", color: "var(--text-primary)" }}>
                {fmt(monthlyCost, 0)}/mo
              </div>
            )}
            {annualCost !== undefined && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-data)" }}>
                {fmt(annualCost, 0)}/yr
              </div>
            )}
          </div>
        )}
      </div>
      {open && <div style={{ marginTop: 16 }}>{children}</div>}
    </div>
  );
}

// ─── Main Calculator Component ─────────────────────────────────

export default function PricingCalculatorPage() {
  // State for all cost factors
  const [infra, setInfra] = useState<InfraCosts>(DEFAULT_INFRA);
  const [ai, setAi] = useState<AiCosts>(DEFAULT_AI);
  const [firebase, setFirebase] = useState<FirebaseCosts>(DEFAULT_FIREBASE);
  const [payment, setPayment] = useState<PaymentCosts>(DEFAULT_PAYMENT);
  const [ops, setOps] = useState<OpsCosts>(DEFAULT_OPS);
  const [team, setTeam] = useState<TeamCosts>(DEFAULT_TEAM);
  const [marketing, setMarketing] = useState<MarketingCosts>(DEFAULT_MARKETING);
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING);
  const [users, setUsers] = useState<UserAssumptions>(DEFAULT_USERS);
  const [usage, setUsage] = useState<UsageProfile>(DEFAULT_USAGE);

  // Derived calculations
  const calc = useMemo(() => {
    const totalUsers = users.totalUsers;
    const indiaUsers = Math.round(totalUsers * users.indiaPercent / 100);
    const usUsers = totalUsers - indiaUsers;

    const basicUsers = Math.round(totalUsers * users.basicPercent / 100);
    const proUsers = Math.round(totalUsers * users.proPercent / 100);
    const eliteUsers = Math.round(totalUsers * users.elitePercent / 100);
    const dayPassUsers = Math.round(totalUsers * users.dayPassPercent / 100);

    const indiaBasic = Math.round(basicUsers * users.indiaPercent / 100);
    const indiaPro = Math.round(proUsers * users.indiaPercent / 100);
    const indiaElite = Math.round(eliteUsers * users.indiaPercent / 100);
    const indiaDayPass = Math.round(dayPassUsers * users.indiaPercent / 100);
    const usBasic = basicUsers - indiaBasic;
    const usPro = proUsers - indiaPro;
    const usElite = eliteUsers - indiaElite;
    const usDayPass = dayPassUsers - indiaDayPass;

    // ─── REVENUE ───
    const revenueIndiaBasic = indiaBasic * pricing.basicYearlyINR;
    const revenueIndiaPro = indiaPro * pricing.proYearlyINR;
    const revenueIndiaElite = indiaElite * pricing.eliteYearlyINR;
    const revenueIndiaDayPass = indiaDayPass * users.dayPassesPerUserPerYear * pricing.dayPassINR;
    const revenueIndiaTotal = revenueIndiaBasic + revenueIndiaPro + revenueIndiaElite + revenueIndiaDayPass;
    const revenueIndiaUSD = revenueIndiaTotal / users.inrToUsd;

    const revenueUsBasic = usBasic * pricing.basicYearlyUSD;
    const revenueUsPro = usPro * pricing.proYearlyUSD;
    const revenueUsElite = usElite * pricing.eliteYearlyUSD;
    const revenueUsDayPass = usDayPass * users.dayPassesPerUserPerYear * pricing.dayPassUSD;
    const revenueUsTotal = revenueUsBasic + revenueUsPro + revenueUsElite + revenueUsDayPass;

    const totalRevenueUSD = revenueIndiaUSD + revenueUsTotal;

    // ─── INFRASTRUCTURE ───
    const cloudRunMonthly = totalUsers <= 500
      ? 25 : totalUsers <= 5000
      ? 80 : totalUsers <= 20000
      ? 250 : 500;
    const cloudRunTotal = cloudRunMonthly * users.regions;

    const cloudSqlMonthly = (infra.cloudSqlInstanceMonthly * infra.cloudSqlHaMultiplier)
      + (infra.cloudSqlStorageGb * infra.cloudSqlStoragePerGb)
      + (infra.cloudSqlStorageGb * infra.cloudSqlBackupPerGb * 0.5);
    const cloudSqlTotal = cloudSqlMonthly * users.regions;

    const redisMonthly = infra.redisPerGbHour * infra.redisCapacityGb * 730; // ~730 hours/month
    const redisTotal = redisMonthly * users.regions;

    const estimatedEgressGb = totalUsers * 0.003 * 20; // ~3MB/user × 20 active days
    const egressMonthly = estimatedEgressGb * infra.egressPerGb;

    const loggingEstGib = Math.max(0, (totalUsers * 0.001) - infra.loggingFreeGib);
    const loggingMonthly = loggingEstGib * infra.loggingPerGib;

    const artifactMonthly = Math.max(0, infra.artifactUsageGb - 0.5) * infra.artifactPerGb;

    const infraMonthly = cloudRunTotal + cloudSqlTotal + redisTotal + egressMonthly + loggingMonthly + artifactMonthly;

    // ─── AI COSTS ───
    const cacheFactor = 1 - (usage.cacheHitReduction / 100);
    const aiCostPerCall = () => {
      const batchPct = ai.batchRatio / 100;
      const standardPct = 1 - batchPct;
      const inputCost = (standardPct * ai.inputPerMTokens + batchPct * ai.batchInputPerMTokens) * (usage.avgInputTokens / 1_000_000);
      const outputCost = (standardPct * ai.outputPerMTokens + batchPct * ai.batchOutputPerMTokens) * (usage.avgOutputTokens / 1_000_000);
      return inputCost + outputCost;
    };
    const costPerAiCall = aiCostPerCall();

    const basicAiMonthly = basicUsers * usage.basicAiCallsPerDay * usage.basicActiveDaysPerMonth * costPerAiCall * cacheFactor;
    const proAiMonthly = proUsers * usage.proAiCallsPerDay * usage.proActiveDaysPerMonth * costPerAiCall * cacheFactor;
    const eliteAiMonthly = eliteUsers * usage.eliteAiCallsPerDay * usage.eliteActiveDaysPerMonth * costPerAiCall * cacheFactor;
    const aiMonthly = basicAiMonthly + proAiMonthly + eliteAiMonthly;

    // ─── FIREBASE ───
    const firebaseAuthMonthly = totalUsers > firebase.authFreeMAU
      ? (totalUsers - firebase.authFreeMAU) * firebase.authPerMAUAboveFree
      : 0;
    const firebaseSmsAnnual = (indiaUsers * firebase.smsPerOtpIndia + usUsers * firebase.smsPerOtpUS) * firebase.avgOtpsPerUserPerYear;
    const firebaseMonthly = firebaseAuthMonthly + (firebaseSmsAnnual / 12);

    // ─── PAYMENT PROCESSING ───
    let paymentFeesAnnual: number;
    if (payment.useAppStore) {
      paymentFeesAnnual = totalRevenueUSD * (payment.appStorePercent / 100);
    } else {
      // India via Razorpay
      const indiaSubTxns = indiaBasic + indiaPro + indiaElite; // 1 yearly txn each
      const indiaDayPassTxns = indiaDayPass * users.dayPassesPerUserPerYear;
      const razorpayFeeINR = (revenueIndiaTotal * payment.razorpayPercent / 100) + ((indiaSubTxns + indiaDayPassTxns) * payment.razorpayFixedINR);
      const razorpayFeeUSD = razorpayFeeINR / users.inrToUsd;

      // US via Stripe
      const usSubTxns = usBasic + usPro + usElite;
      const usDayPassTxns = usDayPass * users.dayPassesPerUserPerYear;
      const stripeFee = (revenueUsTotal * payment.stripePercent / 100) + ((usSubTxns + usDayPassTxns) * payment.stripeFixedUSD);

      paymentFeesAnnual = razorpayFeeUSD + stripeFee;
    }
    const paymentMonthly = paymentFeesAnnual / 12;

    // ─── OPS ───
    const opsMonthly = ops.emailServiceMonthly + ops.smsNotificationsMonthly + ops.errorMonitoringMonthly
      + ops.githubMonthly + ops.ciCdMonthly + ops.webHostingMonthly + ops.analyticsToolMonthly
      + ops.supportToolMonthly + ops.legalMonthly + ops.cricketDataApiMonthly + ops.accountingMonthly
      + ops.miscMonthly + (ops.domainAnnual / 12);

    // ─── TEAM ───
    const teamMonthlyINR = team.founderSalaryMonthly + team.dev1Monthly + team.dev2Monthly + team.designerMonthly + team.otherMonthly;
    const teamMonthly = teamMonthlyINR / users.inrToUsd;

    // ─── MARKETING ───
    const marketingMonthly = marketing.monthlyBudget / users.inrToUsd;

    // ─── TOTALS ───
    const totalMonthlyCost = infraMonthly + aiMonthly + firebaseMonthly + paymentMonthly + opsMonthly + teamMonthly + marketingMonthly;
    const totalAnnualCost = totalMonthlyCost * 12;
    const totalAnnualRevenue = totalRevenueUSD;
    const netProfit = totalAnnualRevenue - totalAnnualCost;
    const margin = totalAnnualRevenue > 0 ? (netProfit / totalAnnualRevenue) * 100 : 0;

    // ─── PER USER ───
    const costPerUserMonth = totalUsers > 0 ? totalMonthlyCost / totalUsers : 0;
    const costPerUserYear = costPerUserMonth * 12;
    const revenuePerUserYear = totalUsers > 0 ? totalAnnualRevenue / totalUsers : 0;
    const profitPerUserYear = revenuePerUserYear - costPerUserYear;

    // ─── PER TIER UNIT ECONOMICS ───
    const basicCostPerYear = ((infraMonthly / totalUsers) + (basicAiMonthly / Math.max(basicUsers, 1)) + (firebaseMonthly / totalUsers) + (opsMonthly / totalUsers)) * 12;
    const proCostPerYear = ((infraMonthly / totalUsers) + (proAiMonthly / Math.max(proUsers, 1)) + (firebaseMonthly / totalUsers) + (opsMonthly / totalUsers)) * 12;
    const eliteCostPerYear = ((infraMonthly / totalUsers) + (eliteAiMonthly / Math.max(eliteUsers, 1)) + (firebaseMonthly / totalUsers) + (opsMonthly / totalUsers)) * 12;

    const basicRevenuePerUserINR = pricing.basicYearlyINR;
    const proRevenuePerUserINR = pricing.proYearlyINR;
    const eliteRevenuePerUserINR = pricing.eliteYearlyINR;
    const dayPassRevenuePerUser = users.dayPassesPerUserPerYear * pricing.dayPassINR;

    // ─── DAY PASS ECONOMICS ───
    const dayPassCost = costPerAiCall * 70 * cacheFactor + 0.018; // Elite-level AI usage for 1 day + infra
    const dayPassRevenueINR = pricing.dayPassINR;
    const dayPassRevenueUSD_val = dayPassRevenueINR / users.inrToUsd;
    const dayPassMargin = dayPassRevenueUSD_val > 0 ? ((dayPassRevenueUSD_val - dayPassCost) / dayPassRevenueUSD_val) * 100 : 0;
    const dayPassBreakeven = pricing.eliteYearlyINR > 0 ? Math.ceil(pricing.eliteYearlyINR / pricing.dayPassINR) : 0;

    // Cost breakdown percentages
    const costBreakdown = {
      infra: { amount: infraMonthly, pct: totalMonthlyCost > 0 ? (infraMonthly / totalMonthlyCost) * 100 : 0 },
      ai: { amount: aiMonthly, pct: totalMonthlyCost > 0 ? (aiMonthly / totalMonthlyCost) * 100 : 0 },
      firebase: { amount: firebaseMonthly, pct: totalMonthlyCost > 0 ? (firebaseMonthly / totalMonthlyCost) * 100 : 0 },
      payment: { amount: paymentMonthly, pct: totalMonthlyCost > 0 ? (paymentMonthly / totalMonthlyCost) * 100 : 0 },
      ops: { amount: opsMonthly, pct: totalMonthlyCost > 0 ? (opsMonthly / totalMonthlyCost) * 100 : 0 },
      team: { amount: teamMonthly, pct: totalMonthlyCost > 0 ? (teamMonthly / totalMonthlyCost) * 100 : 0 },
      marketing: { amount: marketingMonthly, pct: totalMonthlyCost > 0 ? (marketingMonthly / totalMonthlyCost) * 100 : 0 },
    };

    return {
      // Users
      indiaUsers, usUsers, basicUsers, proUsers, eliteUsers, dayPassUsers,
      indiaBasic, indiaPro, indiaElite, indiaDayPass,
      usBasic, usPro, usElite, usDayPass,
      // Revenue
      revenueIndiaTotal, revenueIndiaUSD, revenueUsTotal, totalRevenueUSD,
      revenueIndiaBasic, revenueIndiaPro, revenueIndiaElite, revenueIndiaDayPass,
      revenueUsBasic, revenueUsPro, revenueUsElite, revenueUsDayPass,
      // Costs (monthly)
      cloudRunTotal, cloudSqlTotal, redisTotal, egressMonthly, loggingMonthly, artifactMonthly,
      infraMonthly, aiMonthly, firebaseMonthly, paymentMonthly, opsMonthly, teamMonthly, marketingMonthly,
      basicAiMonthly, proAiMonthly, eliteAiMonthly,
      costPerAiCall,
      // Totals
      totalMonthlyCost, totalAnnualCost, totalAnnualRevenue, netProfit, margin,
      // Per user
      costPerUserMonth, costPerUserYear, revenuePerUserYear, profitPerUserYear,
      // Per tier
      basicCostPerYear, proCostPerYear, eliteCostPerYear,
      basicRevenuePerUserINR, proRevenuePerUserINR, eliteRevenuePerUserINR,
      dayPassRevenuePerUser,
      // Day pass
      dayPassCost, dayPassRevenueUSD_val, dayPassMargin, dayPassBreakeven,
      // Breakdown
      costBreakdown,
    };
  }, [infra, ai, firebase, payment, ops, team, marketing, pricing, users, usage]);

  // Presets
  const applyPreset = (preset: "beta" | "growth" | "scale") => {
    if (preset === "beta") {
      setUsers(u => ({ ...u, totalUsers: 500, basicPercent: 55, proPercent: 30, elitePercent: 10, dayPassPercent: 5, regions: 2 }));
      setInfra(i => ({ ...i, cloudSqlInstanceMonthly: 26, cloudSqlStorageGb: 10, cloudSqlHaMultiplier: 1, redisCapacityGb: 1 }));
      setTeam({ founderSalaryMonthly: 0, dev1Monthly: 0, dev2Monthly: 0, designerMonthly: 0, otherMonthly: 0 });
      setMarketing(m => ({ ...m, monthlyBudget: 0 }));
    } else if (preset === "growth") {
      setUsers(u => ({ ...u, totalUsers: 5000, basicPercent: 50, proPercent: 32, elitePercent: 13, dayPassPercent: 5, regions: 2 }));
      setInfra(i => ({ ...i, cloudSqlInstanceMonthly: 75, cloudSqlStorageGb: 50, cloudSqlHaMultiplier: 2, redisCapacityGb: 1 }));
      setTeam({ founderSalaryMonthly: 0, dev1Monthly: 50000, dev2Monthly: 0, designerMonthly: 20000, otherMonthly: 0 });
      setMarketing(m => ({ ...m, monthlyBudget: 75000 }));
    } else if (preset === "scale") {
      setUsers(u => ({ ...u, totalUsers: 50000, basicPercent: 45, proPercent: 35, elitePercent: 15, dayPassPercent: 5, regions: 2 }));
      setInfra(i => ({ ...i, cloudSqlInstanceMonthly: 150, cloudSqlStorageGb: 200, cloudSqlHaMultiplier: 2, redisCapacityGb: 5 }));
      setTeam({ founderSalaryMonthly: 100000, dev1Monthly: 100000, dev2Monthly: 80000, designerMonthly: 50000, otherMonthly: 30000 });
      setMarketing(m => ({ ...m, monthlyBudget: 750000 }));
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Pricing & Cost Projection Calculator</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          Adjust any input to instantly recalculate. All costs in USD unless noted. Airline model — no free tier.
        </p>
      </div>

      {/* ─── Presets ─── */}
      <div style={{ ...sectionStyle, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Quick Presets:</span>
        {(["beta", "growth", "scale"] as const).map(p => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: "var(--bg)",
              color: "var(--text-primary)",
            }}
          >
            {p === "beta" ? "Beta (500)" : p === "growth" ? "Growth (5K)" : "Scale (50K)"}
          </button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Custom:</span>
          <input
            type="number"
            min={1}
            placeholder="e.g. 10000"
            style={{
              width: 100,
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              fontSize: 12,
              fontFamily: "var(--font-data)",
              backgroundColor: "var(--bg)",
              color: "var(--text-primary)",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = Number((e.target as HTMLInputElement).value);
                if (v > 0) setUsers(u => ({ ...u, totalUsers: v }));
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
              const v = Number(input.value);
              if (v > 0) setUsers(u => ({ ...u, totalUsers: v }));
            }}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--accent)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: "var(--accent)",
              color: "#fff",
            }}
          >
            Apply
          </button>
        </div>
      </div>

      {/* ─── SUMMARY DASHBOARD (always visible) ─── */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>P&L Summary</h3>
        <div style={gridStyle(5)}>
          <div style={summaryCardStyle("green")}>
            <div style={labelStyle}>Annual Revenue</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-data)", color: "#22c55e" }}>
              {fmt(calc.totalAnnualRevenue)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtINR(calc.revenueIndiaTotal)} + ${calc.revenueUsTotal.toFixed(0)}</div>
          </div>
          <div style={summaryCardStyle("red")}>
            <div style={labelStyle}>Annual Cost</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-data)", color: "#ef4444" }}>
              {fmt(calc.totalAnnualCost)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmt(calc.totalMonthlyCost)}/mo</div>
          </div>
          <div style={summaryCardStyle(calc.netProfit >= 0 ? "green" : "red")}>
            <div style={labelStyle}>Net Profit</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-data)", color: calc.netProfit >= 0 ? "#22c55e" : "#ef4444" }}>
              {fmt(calc.netProfit)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              <span style={badgeStyle(calc.margin >= 50 ? "green" : calc.margin >= 0 ? "yellow" : "red")}>
                {pct(calc.margin)} margin
              </span>
            </div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>Revenue/User/Year</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-data)" }}>{fmt(calc.revenuePerUserYear, 2)}</div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>Cost/User/Year</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-data)" }}>{fmt(calc.costPerUserYear, 2)}</div>
          </div>
        </div>

        {/* Cost breakdown bar */}
        <h4 style={subheadingStyle}>Cost Breakdown (Monthly)</h4>
        <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
          {[
            { key: "infra", color: "#3b82f6", label: "Infra" },
            { key: "ai", color: "#8b5cf6", label: "AI" },
            { key: "firebase", color: "#f59e0b", label: "Firebase" },
            { key: "payment", color: "#ef4444", label: "Payment" },
            { key: "ops", color: "#6366f1", label: "Ops" },
            { key: "team", color: "#14b8a6", label: "Team" },
            { key: "marketing", color: "#f97316", label: "Marketing" },
          ].map(({ key, color }) => {
            const segment = calc.costBreakdown[key as keyof typeof calc.costBreakdown];
            return segment.pct > 0 ? (
              <div key={key} style={{ width: `${segment.pct}%`, backgroundColor: color, minWidth: segment.pct > 2 ? 2 : 0 }} />
            ) : null;
          })}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { key: "infra", color: "#3b82f6", label: "Infrastructure" },
            { key: "ai", color: "#8b5cf6", label: "AI (Gemini)" },
            { key: "firebase", color: "#f59e0b", label: "Firebase" },
            { key: "payment", color: "#ef4444", label: "Payment Fees" },
            { key: "ops", color: "#6366f1", label: "Operations" },
            { key: "team", color: "#14b8a6", label: "Team" },
            { key: "marketing", color: "#f97316", label: "Marketing" },
          ].map(({ key, color, label }) => {
            const segment = calc.costBreakdown[key as keyof typeof calc.costBreakdown];
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
                <span style={{ color: "var(--text-muted)" }}>{label}: {fmt(segment.amount)}/mo ({pct(segment.pct)})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Per-Tier Unit Economics (EDITABLE) ─── */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Per-Tier Unit Economics (Airline P&L View)</h3>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>
          Edit prices, user %, and Day Pass count directly — everything recalculates instantly.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              {["Tier", "Users %", "Users #", "Price (INR)", "Price (USD)", "Cost/User/Yr", "/day", "Day Pass B/E", "Margin", "Tier Revenue/Yr"].map(h => (
                <th key={h} style={{ padding: "8px 8px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ── Basic ── */}
            <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg)" }}>
              <td style={{ padding: "10px 8px", fontWeight: 700 }}>Basic<br/><span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-muted)" }}>Economy</span></td>
              <td style={{ padding: "6px 4px" }}>
                <input type="number" value={users.basicPercent} onChange={e => setUsers(u => ({ ...u, basicPercent: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 52 }} /><span style={{ fontSize: 10, color: "var(--text-muted)" }}>%</span>
              </td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12 }}>{calc.basicUsers.toLocaleString()}</td>
              <td style={{ padding: "6px 4px" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>₹</span>
                <input type="number" value={pricing.basicYearlyINR} onChange={e => setPricing(p => ({ ...p, basicYearlyINR: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 64 }} /><span style={{ fontSize: 10, color: "var(--text-muted)" }}>/yr</span>
              </td>
              <td style={{ padding: "6px 4px" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>$</span>
                <input type="number" value={pricing.basicYearlyUSD} step={0.01} onChange={e => setPricing(p => ({ ...p, basicYearlyUSD: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 58 }} /><span style={{ fontSize: 10, color: "var(--text-muted)" }}>/yr</span>
              </td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12 }}>{fmt(calc.basicCostPerYear, 2)}</td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-muted)" }}>₹{(pricing.basicYearlyINR / 365).toFixed(1)}</td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--text-muted)" }}>—</td>
              <td style={{ padding: "10px 8px" }}>{(() => {
                const rev = pricing.basicYearlyINR / users.inrToUsd;
                const m = rev > 0 ? ((rev - calc.basicCostPerYear) / rev) * 100 : 0;
                return <span style={badgeStyle(m >= 50 ? "green" : m >= 20 ? "yellow" : "red")}>{pct(m)}</span>;
              })()}</td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600 }}>
                {fmtINR(calc.basicUsers * pricing.basicYearlyINR)}
              </td>
            </tr>

            {/* ── Pro ── */}
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "10px 8px", fontWeight: 700 }}>Pro<br/><span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-muted)" }}>Premium Eco.</span></td>
              <td style={{ padding: "6px 4px" }}>
                <input type="number" value={users.proPercent} onChange={e => setUsers(u => ({ ...u, proPercent: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 52 }} /><span style={{ fontSize: 10, color: "var(--text-muted)" }}>%</span>
              </td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12 }}>{calc.proUsers.toLocaleString()}</td>
              <td style={{ padding: "6px 4px" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>₹</span>
                <input type="number" value={pricing.proYearlyINR} onChange={e => setPricing(p => ({ ...p, proYearlyINR: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 64 }} /><span style={{ fontSize: 10, color: "var(--text-muted)" }}>/yr</span>
              </td>
              <td style={{ padding: "6px 4px" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>$</span>
                <input type="number" value={pricing.proYearlyUSD} step={0.01} onChange={e => setPricing(p => ({ ...p, proYearlyUSD: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 58 }} /><span style={{ fontSize: 10, color: "var(--text-muted)" }}>/yr</span>
              </td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12 }}>{fmt(calc.proCostPerYear, 2)}</td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-muted)" }}>₹{(pricing.proYearlyINR / 365).toFixed(1)}</td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--text-muted)" }}>—</td>
              <td style={{ padding: "10px 8px" }}>{(() => {
                const rev = pricing.proYearlyINR / users.inrToUsd;
                const m = rev > 0 ? ((rev - calc.proCostPerYear) / rev) * 100 : 0;
                return <span style={badgeStyle(m >= 50 ? "green" : m >= 20 ? "yellow" : "red")}>{pct(m)}</span>;
              })()}</td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600 }}>
                {fmtINR(calc.proUsers * pricing.proYearlyINR)}
              </td>
            </tr>

            {/* ── Elite ── */}
            <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg)" }}>
              <td style={{ padding: "10px 8px", fontWeight: 700 }}>Elite<br/><span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-muted)" }}>Business Class</span></td>
              <td style={{ padding: "6px 4px" }}>
                <input type="number" value={users.elitePercent} onChange={e => setUsers(u => ({ ...u, elitePercent: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 52 }} /><span style={{ fontSize: 10, color: "var(--text-muted)" }}>%</span>
              </td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12 }}>{calc.eliteUsers.toLocaleString()}</td>
              <td style={{ padding: "6px 4px" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>₹</span>
                <input type="number" value={pricing.eliteYearlyINR} onChange={e => setPricing(p => ({ ...p, eliteYearlyINR: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 64 }} /><span style={{ fontSize: 10, color: "var(--text-muted)" }}>/yr</span>
              </td>
              <td style={{ padding: "6px 4px" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>$</span>
                <input type="number" value={pricing.eliteYearlyUSD} step={0.01} onChange={e => setPricing(p => ({ ...p, eliteYearlyUSD: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 58 }} /><span style={{ fontSize: 10, color: "var(--text-muted)" }}>/yr</span>
              </td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12 }}>{fmt(calc.eliteCostPerYear, 2)}</td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-muted)" }}>₹{(pricing.eliteYearlyINR / 365).toFixed(1)}</td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--text-muted)" }}>—</td>
              <td style={{ padding: "10px 8px" }}>{(() => {
                const rev = pricing.eliteYearlyINR / users.inrToUsd;
                const m = rev > 0 ? ((rev - calc.eliteCostPerYear) / rev) * 100 : 0;
                return <span style={badgeStyle(m >= 50 ? "green" : m >= 20 ? "yellow" : "red")}>{pct(m)}</span>;
              })()}</td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600 }}>
                {fmtINR(calc.eliteUsers * pricing.eliteYearlyINR)}
              </td>
            </tr>

            {/* ── Day Pass ── */}
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              <td style={{ padding: "10px 8px", fontWeight: 700 }}>Day Pass<br/><span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-muted)" }}>Gate Upgrade</span></td>
              <td style={{ padding: "6px 4px" }}>
                <input type="number" value={users.dayPassPercent} onChange={e => setUsers(u => ({ ...u, dayPassPercent: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 52 }} /><span style={{ fontSize: 10, color: "var(--text-muted)" }}>%</span>
              </td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12 }}>{calc.dayPassUsers.toLocaleString()}</td>
              <td style={{ padding: "6px 4px" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>₹</span>
                <input type="number" value={pricing.dayPassINR} onChange={e => setPricing(p => ({ ...p, dayPassINR: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 52 }} /><span style={{ fontSize: 10, color: "var(--text-muted)" }}>/day</span>
              </td>
              <td style={{ padding: "6px 4px" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>$</span>
                <input type="number" value={pricing.dayPassUSD} step={0.01} onChange={e => setPricing(p => ({ ...p, dayPassUSD: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 52 }} /><span style={{ fontSize: 10, color: "var(--text-muted)" }}>/day</span>
              </td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12 }}>{fmt(calc.dayPassCost * users.dayPassesPerUserPerYear, 2)}</td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-muted)" }}>
                ₹{pricing.dayPassINR}/day
              </td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12 }}>
                <span style={badgeStyle("blue")}>{calc.dayPassBreakeven} passes</span>
              </td>
              <td style={{ padding: "10px 8px" }}>{(() => {
                const rev = (pricing.dayPassINR * users.dayPassesPerUserPerYear) / users.inrToUsd;
                const cost = calc.dayPassCost * users.dayPassesPerUserPerYear;
                const m = rev > 0 ? ((rev - cost) / rev) * 100 : 0;
                return <span style={badgeStyle(m >= 50 ? "green" : m >= 20 ? "yellow" : "red")}>{pct(m)}</span>;
              })()}</td>
              <td style={{ padding: "10px 8px", fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600 }}>
                {fmtINR(calc.dayPassUsers * users.dayPassesPerUserPerYear * pricing.dayPassINR)}
              </td>
            </tr>

            {/* ── Day Pass config row ── */}
            <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg)" }}>
              <td colSpan={3} style={{ padding: "8px 8px", fontSize: 11, color: "var(--text-muted)" }}>
                Day Passes per user per year:
              </td>
              <td colSpan={2} style={{ padding: "6px 4px" }}>
                <input type="number" value={users.dayPassesPerUserPerYear}
                  onChange={e => setUsers(u => ({ ...u, dayPassesPerUserPerYear: Number(e.target.value) }))}
                  style={{ ...inputStyle, width: 52 }} />
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}> passes/yr</span>
              </td>
              <td colSpan={5} style={{ padding: "8px 8px", fontSize: 11, color: "var(--text-muted)" }}>
                Cost per single Day Pass: {fmt(calc.dayPassCost, 4)} | Revenue: ₹{pricing.dayPassINR} ({fmt(pricing.dayPassINR / users.inrToUsd, 2)}) | Margin per pass: {pct(calc.dayPassMargin)}
              </td>
            </tr>
          </tbody>

          {/* ── Totals footer ── */}
          <tfoot>
            <tr style={{ fontWeight: 700, fontSize: 13 }}>
              <td style={{ padding: "12px 8px" }}>TOTAL</td>
              <td style={{ padding: "12px 8px", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-muted)" }}>
                {users.basicPercent + users.proPercent + users.elitePercent + users.dayPassPercent}%
              </td>
              <td style={{ padding: "12px 8px", fontFamily: "var(--font-data)" }}>{users.totalUsers.toLocaleString()}</td>
              <td colSpan={2} style={{ padding: "12px 8px" }}>
                <span style={{ fontFamily: "var(--font-data)", color: "#22c55e" }}>
                  {fmtINR(calc.revenueIndiaTotal)} + ${calc.revenueUsTotal.toFixed(0)}
                </span>
              </td>
              <td style={{ padding: "12px 8px", fontFamily: "var(--font-data)", color: "#ef4444" }}>
                {fmt(calc.totalAnnualCost)}
              </td>
              <td colSpan={2}></td>
              <td style={{ padding: "12px 8px" }}>
                <span style={badgeStyle(calc.margin >= 50 ? "green" : calc.margin >= 0 ? "yellow" : "red")}>
                  {pct(calc.margin)}
                </span>
              </td>
              <td style={{ padding: "12px 8px", fontFamily: "var(--font-data)", color: calc.netProfit >= 0 ? "#22c55e" : "#ef4444" }}>
                {fmt(calc.totalAnnualRevenue)}/yr
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Quick pricing experiments */}
        <div style={{ marginTop: 16, padding: 12, backgroundColor: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
          <h4 style={{ ...subheadingStyle, marginBottom: 8 }}>Quick Pricing Experiments</h4>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "Aggressive India", basic: 199, pro: 699, elite: 1499, dp: 49, bUSD: 3.99, pUSD: 14.99, eUSD: 34.99, dpUSD: 1.99 },
              { label: "Premium India", basic: 399, pro: 1199, elite: 2499, dp: 99, bUSD: 7.99, pUSD: 24.99, eUSD: 59.99, dpUSD: 3.99 },
              { label: "US-focused", basic: 289, pro: 889, elite: 1899, dp: 69, bUSD: 9.99, pUSD: 29.99, eUSD: 79.99, dpUSD: 4.99 },
              { label: "Reset defaults", basic: 289, pro: 889, elite: 1899, dp: 69, bUSD: 5.99, pUSD: 19.99, eUSD: 49.99, dpUSD: 2.99 },
            ].map(exp => (
              <button
                key={exp.label}
                onClick={() => setPricing({
                  basicYearlyINR: exp.basic, proYearlyINR: exp.pro, eliteYearlyINR: exp.elite, dayPassINR: exp.dp,
                  basicYearlyUSD: exp.bUSD, proYearlyUSD: exp.pUSD, eliteYearlyUSD: exp.eUSD, dayPassUSD: exp.dpUSD,
                })}
                style={{
                  padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  backgroundColor: "var(--bg-surface)", color: "var(--text-primary)",
                }}
              >
                {exp.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ INPUT SECTIONS ═══ */}

      {/* ─── User Assumptions ─── */}
      <CollapsibleSection title="User Assumptions" subtitle="Total users, region split, tier distribution">
        <div style={gridStyle(4)}>
          <NumInput label="Total Users" value={users.totalUsers} onChange={v => setUsers(u => ({ ...u, totalUsers: v }))} />
          <NumInput label="India %" value={users.indiaPercent} onChange={v => setUsers(u => ({ ...u, indiaPercent: v }))} suffix="%" />
          <NumInput label="INR to USD rate" value={users.inrToUsd} onChange={v => setUsers(u => ({ ...u, inrToUsd: v }))} prefix="₹" step={0.5} />
          <NumInput label="GST %" value={users.gstPercent} onChange={v => setUsers(u => ({ ...u, gstPercent: v }))} suffix="%" />
        </div>
        <h4 style={subheadingStyle}>Tier Distribution</h4>
        <div style={gridStyle(5)}>
          <NumInput label="Basic %" value={users.basicPercent} onChange={v => setUsers(u => ({ ...u, basicPercent: v }))} suffix="%" />
          <NumInput label="Pro %" value={users.proPercent} onChange={v => setUsers(u => ({ ...u, proPercent: v }))} suffix="%" />
          <NumInput label="Elite %" value={users.elitePercent} onChange={v => setUsers(u => ({ ...u, elitePercent: v }))} suffix="%" />
          <NumInput label="Day Pass buyers %" value={users.dayPassPercent} onChange={v => setUsers(u => ({ ...u, dayPassPercent: v }))} suffix="%" />
          <NumInput label="Day Passes/user/yr" value={users.dayPassesPerUserPerYear} onChange={v => setUsers(u => ({ ...u, dayPassesPerUserPerYear: v }))} />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          Total: {users.basicPercent + users.proPercent + users.elitePercent + users.dayPassPercent}% allocated
          (Day Pass users also hold a base tier — this is % who actively buy passes)
        </div>
      </CollapsibleSection>

      {/* ─── GCP Infrastructure ─── */}
      <CollapsibleSection
        title="GCP Infrastructure"
        subtitle="Cloud Run, Cloud SQL, Redis, Networking, Logging"
        defaultOpen={false}
        monthlyCost={calc.infraMonthly}
        annualCost={calc.infraMonthly * 12}
      >
        <div style={gridStyle(3)}>
          <div>
            <h4 style={subheadingStyle}>Cloud Run ({fmt(calc.cloudRunTotal)}/mo)</h4>
            <NumInput label="$/vCPU-second" value={infra.cloudRunVcpuSec} onChange={v => setInfra(i => ({ ...i, cloudRunVcpuSec: v }))} prefix="$" step={0.000001} />
            <NumInput label="$/GiB-second" value={infra.cloudRunGibSec} onChange={v => setInfra(i => ({ ...i, cloudRunGibSec: v }))} prefix="$" step={0.0000001} />
            <NumInput label="$/M requests" value={infra.cloudRunPerMReqs} onChange={v => setInfra(i => ({ ...i, cloudRunPerMReqs: v }))} prefix="$" step={0.01} />
          </div>
          <div>
            <h4 style={subheadingStyle}>Cloud SQL ({fmt(calc.cloudSqlTotal)}/mo)</h4>
            <NumInput label="Instance $/mo" value={infra.cloudSqlInstanceMonthly} onChange={v => setInfra(i => ({ ...i, cloudSqlInstanceMonthly: v }))} prefix="$" />
            <NumInput label="Storage GB" value={infra.cloudSqlStorageGb} onChange={v => setInfra(i => ({ ...i, cloudSqlStorageGb: v }))} suffix="GB" />
            <NumInput label="$/GB/mo (SSD)" value={infra.cloudSqlStoragePerGb} onChange={v => setInfra(i => ({ ...i, cloudSqlStoragePerGb: v }))} prefix="$" step={0.01} />
            <NumInput label="HA Multiplier" value={infra.cloudSqlHaMultiplier} onChange={v => setInfra(i => ({ ...i, cloudSqlHaMultiplier: v }))} suffix="x" step={0.5} />
          </div>
          <div>
            <h4 style={subheadingStyle}>Redis ({fmt(calc.redisTotal)}/mo)</h4>
            <NumInput label="$/GB/hour" value={infra.redisPerGbHour} onChange={v => setInfra(i => ({ ...i, redisPerGbHour: v }))} prefix="$" step={0.001} />
            <NumInput label="Capacity" value={infra.redisCapacityGb} onChange={v => setInfra(i => ({ ...i, redisCapacityGb: v }))} suffix="GB" />
          </div>
        </div>
        <div style={gridStyle(3)}>
          <div>
            <h4 style={subheadingStyle}>Networking ({fmt(calc.egressMonthly)}/mo)</h4>
            <NumInput label="Egress $/GB" value={infra.egressPerGb} onChange={v => setInfra(i => ({ ...i, egressPerGb: v }))} prefix="$" step={0.01} />
            <NumInput label="Cross-region $/GB" value={infra.crossRegionPerGb} onChange={v => setInfra(i => ({ ...i, crossRegionPerGb: v }))} prefix="$" step={0.001} />
          </div>
          <div>
            <h4 style={subheadingStyle}>Logging ({fmt(calc.loggingMonthly)}/mo)</h4>
            <NumInput label="$/GiB ingested" value={infra.loggingPerGib} onChange={v => setInfra(i => ({ ...i, loggingPerGib: v }))} prefix="$" step={0.1} />
            <NumInput label="Free GiB/mo" value={infra.loggingFreeGib} onChange={v => setInfra(i => ({ ...i, loggingFreeGib: v }))} suffix="GiB" />
          </div>
          <div>
            <h4 style={subheadingStyle}>Other</h4>
            <NumInput label="Regions" value={users.regions} onChange={v => setUsers(u => ({ ...u, regions: v }))} suffix="regions" />
            <NumInput label="Artifact Registry GB" value={infra.artifactUsageGb} onChange={v => setInfra(i => ({ ...i, artifactUsageGb: v }))} suffix="GB" />
          </div>
        </div>
      </CollapsibleSection>

      {/* ─── AI (Gemini) Costs ─── */}
      <CollapsibleSection
        title="AI Engine (Gemini)"
        subtitle="Vertex AI token pricing + usage patterns"
        defaultOpen={false}
        monthlyCost={calc.aiMonthly}
        annualCost={calc.aiMonthly * 12}
      >
        <div style={gridStyle(2)}>
          <div>
            <h4 style={subheadingStyle}>Token Pricing</h4>
            <NumInput label="Input $/M tokens" value={ai.inputPerMTokens} onChange={v => setAi(a => ({ ...a, inputPerMTokens: v }))} prefix="$" step={0.01} />
            <NumInput label="Output $/M tokens" value={ai.outputPerMTokens} onChange={v => setAi(a => ({ ...a, outputPerMTokens: v }))} prefix="$" step={0.01} />
            <NumInput label="Batch Input $/M" value={ai.batchInputPerMTokens} onChange={v => setAi(a => ({ ...a, batchInputPerMTokens: v }))} prefix="$" step={0.01} />
            <NumInput label="Batch Output $/M" value={ai.batchOutputPerMTokens} onChange={v => setAi(a => ({ ...a, batchOutputPerMTokens: v }))} prefix="$" step={0.01} />
            <NumInput label="Batch usage %" value={ai.batchRatio} onChange={v => setAi(a => ({ ...a, batchRatio: v }))} suffix="%" />
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
              Effective cost/call: ${calc.costPerAiCall.toFixed(6)}
            </div>
          </div>
          <div>
            <h4 style={subheadingStyle}>Usage Per Tier</h4>
            <NumInput label="Basic AI calls/day" value={usage.basicAiCallsPerDay} onChange={v => setUsage(u => ({ ...u, basicAiCallsPerDay: v }))} />
            <NumInput label="Pro AI calls/day" value={usage.proAiCallsPerDay} onChange={v => setUsage(u => ({ ...u, proAiCallsPerDay: v }))} />
            <NumInput label="Elite AI calls/day" value={usage.eliteAiCallsPerDay} onChange={v => setUsage(u => ({ ...u, eliteAiCallsPerDay: v }))} />
            <NumInput label="Avg input tokens" value={usage.avgInputTokens} onChange={v => setUsage(u => ({ ...u, avgInputTokens: v }))} />
            <NumInput label="Avg output tokens" value={usage.avgOutputTokens} onChange={v => setUsage(u => ({ ...u, avgOutputTokens: v }))} />
            <NumInput label="Cache hit reduction %" value={usage.cacheHitReduction} onChange={v => setUsage(u => ({ ...u, cacheHitReduction: v }))} suffix="%" />
          </div>
        </div>
        <div style={{ ...rowStyle, fontWeight: 600 }}>
          <span>AI cost by tier (monthly):</span>
          <span style={{ fontFamily: "var(--font-data)" }}>
            Basic: {fmt(calc.basicAiMonthly, 0)} | Pro: {fmt(calc.proAiMonthly, 0)} | Elite: {fmt(calc.eliteAiMonthly, 0)}
          </span>
        </div>
      </CollapsibleSection>

      {/* ─── Firebase ─── */}
      <CollapsibleSection
        title="Firebase"
        subtitle="Auth, SMS/OTP, FCM (free), Analytics (free)"
        defaultOpen={false}
        monthlyCost={calc.firebaseMonthly}
        annualCost={calc.firebaseMonthly * 12}
      >
        <div style={gridStyle(3)}>
          <NumInput label="Free MAU limit" value={firebase.authFreeMAU} onChange={v => setFirebase(f => ({ ...f, authFreeMAU: v }))} wide />
          <NumInput label="$/MAU above free" value={firebase.authPerMAUAboveFree} onChange={v => setFirebase(f => ({ ...f, authPerMAUAboveFree: v }))} prefix="$" step={0.001} />
          <NumInput label="OTPs/user/year" value={firebase.avgOtpsPerUserPerYear} onChange={v => setFirebase(f => ({ ...f, avgOtpsPerUserPerYear: v }))} />
          <NumInput label="SMS cost India" value={firebase.smsPerOtpIndia} onChange={v => setFirebase(f => ({ ...f, smsPerOtpIndia: v }))} prefix="$" step={0.001} />
          <NumInput label="SMS cost US" value={firebase.smsPerOtpUS} onChange={v => setFirebase(f => ({ ...f, smsPerOtpUS: v }))} prefix="$" step={0.001} />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          FCM (push notifications), Analytics, Crashlytics, Remote Config = all free
        </div>
      </CollapsibleSection>

      {/* ─── Payment Processing ─── */}
      <CollapsibleSection
        title="Payment Processing"
        subtitle="Razorpay (India) + Stripe (US) or App Store"
        defaultOpen={false}
        monthlyCost={calc.paymentMonthly}
        annualCost={calc.paymentMonthly * 12}
      >
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={payment.useAppStore}
              onChange={e => setPayment(p => ({ ...p, useAppStore: e.target.checked }))}
            />
            <span style={{ color: payment.useAppStore ? "#ef4444" : "var(--text-primary)" }}>
              Process through App Store / Play Store ({payment.appStorePercent}% cut)
            </span>
          </label>
        </div>
        {!payment.useAppStore ? (
          <div style={gridStyle(2)}>
            <div>
              <h4 style={subheadingStyle}>Razorpay (India)</h4>
              <NumInput label="Fee %" value={payment.razorpayPercent} onChange={v => setPayment(p => ({ ...p, razorpayPercent: v }))} suffix="%" step={0.1} />
              <NumInput label="Fixed fee/txn" value={payment.razorpayFixedINR} onChange={v => setPayment(p => ({ ...p, razorpayFixedINR: v }))} prefix="₹" />
            </div>
            <div>
              <h4 style={subheadingStyle}>Stripe (US)</h4>
              <NumInput label="Fee %" value={payment.stripePercent} onChange={v => setPayment(p => ({ ...p, stripePercent: v }))} suffix="%" step={0.1} />
              <NumInput label="Fixed fee/txn" value={payment.stripeFixedUSD} onChange={v => setPayment(p => ({ ...p, stripeFixedUSD: v }))} prefix="$" step={0.01} />
            </div>
          </div>
        ) : (
          <div style={gridStyle(2)}>
            <NumInput label="App Store cut %" value={payment.appStorePercent} onChange={v => setPayment(p => ({ ...p, appStorePercent: v }))} suffix="%" />
            <div style={{ padding: 12, backgroundColor: "#ef444411", borderRadius: 6, fontSize: 12, color: "#ef4444" }}>
              At {payment.appStorePercent}% App Store cut, you lose {fmt(calc.paymentMonthly * 12)}/yr.
              Switch to Razorpay/Stripe (web checkout) to save ~{fmt(calc.paymentMonthly * 12 * 0.8)}/yr.
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* ─── Ops ─── */}
      <CollapsibleSection
        title="Operations"
        subtitle="Domain, email, tools, legal, accounting"
        defaultOpen={false}
        monthlyCost={calc.opsMonthly}
        annualCost={calc.opsMonthly * 12}
      >
        <div style={gridStyle(4)}>
          <NumInput label="Domain (annual)" value={ops.domainAnnual} onChange={v => setOps(o => ({ ...o, domainAnnual: v }))} prefix="$" />
          <NumInput label="Email service /mo" value={ops.emailServiceMonthly} onChange={v => setOps(o => ({ ...o, emailServiceMonthly: v }))} prefix="$" />
          <NumInput label="SMS notifications /mo" value={ops.smsNotificationsMonthly} onChange={v => setOps(o => ({ ...o, smsNotificationsMonthly: v }))} prefix="$" />
          <NumInput label="Error monitoring /mo" value={ops.errorMonitoringMonthly} onChange={v => setOps(o => ({ ...o, errorMonitoringMonthly: v }))} prefix="$" />
          <NumInput label="GitHub /mo" value={ops.githubMonthly} onChange={v => setOps(o => ({ ...o, githubMonthly: v }))} prefix="$" />
          <NumInput label="CI/CD /mo" value={ops.ciCdMonthly} onChange={v => setOps(o => ({ ...o, ciCdMonthly: v }))} prefix="$" />
          <NumInput label="Web hosting /mo" value={ops.webHostingMonthly} onChange={v => setOps(o => ({ ...o, webHostingMonthly: v }))} prefix="$" />
          <NumInput label="Analytics tool /mo" value={ops.analyticsToolMonthly} onChange={v => setOps(o => ({ ...o, analyticsToolMonthly: v }))} prefix="$" />
          <NumInput label="Support tool /mo" value={ops.supportToolMonthly} onChange={v => setOps(o => ({ ...o, supportToolMonthly: v }))} prefix="$" />
          <NumInput label="Legal/compliance /mo" value={ops.legalMonthly} onChange={v => setOps(o => ({ ...o, legalMonthly: v }))} prefix="$" />
          <NumInput label="Cricket data API /mo" value={ops.cricketDataApiMonthly} onChange={v => setOps(o => ({ ...o, cricketDataApiMonthly: v }))} prefix="$" />
          <NumInput label="Accounting/CA /mo" value={ops.accountingMonthly} onChange={v => setOps(o => ({ ...o, accountingMonthly: v }))} prefix="$" />
          <NumInput label="Misc buffer /mo" value={ops.miscMonthly} onChange={v => setOps(o => ({ ...o, miscMonthly: v }))} prefix="$" />
        </div>
      </CollapsibleSection>

      {/* ─── Team ─── */}
      <CollapsibleSection
        title="Team"
        subtitle="Salaries and contractor costs (in INR)"
        defaultOpen={false}
        monthlyCost={calc.teamMonthly}
        annualCost={calc.teamMonthly * 12}
      >
        <div style={gridStyle(3)}>
          <NumInput label="Founder salary /mo" value={team.founderSalaryMonthly} onChange={v => setTeam(t => ({ ...t, founderSalaryMonthly: v }))} prefix="₹" wide />
          <NumInput label="Dev 1 /mo" value={team.dev1Monthly} onChange={v => setTeam(t => ({ ...t, dev1Monthly: v }))} prefix="₹" wide />
          <NumInput label="Dev 2 /mo" value={team.dev2Monthly} onChange={v => setTeam(t => ({ ...t, dev2Monthly: v }))} prefix="₹" wide />
          <NumInput label="Designer /mo" value={team.designerMonthly} onChange={v => setTeam(t => ({ ...t, designerMonthly: v }))} prefix="₹" wide />
          <NumInput label="Other /mo" value={team.otherMonthly} onChange={v => setTeam(t => ({ ...t, otherMonthly: v }))} prefix="₹" wide />
        </div>
      </CollapsibleSection>

      {/* ─── Marketing ─── */}
      <CollapsibleSection
        title="Marketing & User Acquisition"
        subtitle="Monthly budget + blended CAC"
        defaultOpen={false}
        monthlyCost={calc.marketingMonthly}
        annualCost={calc.marketingMonthly * 12}
      >
        <div style={gridStyle(3)}>
          <NumInput label="Monthly budget" value={marketing.monthlyBudget} onChange={v => setMarketing(m => ({ ...m, monthlyBudget: v }))} prefix="₹" wide />
          <NumInput label="Blended CAC (India)" value={marketing.blendedCacINR} onChange={v => setMarketing(m => ({ ...m, blendedCacINR: v }))} prefix="₹" />
          <NumInput label="Blended CAC (US)" value={marketing.blendedCacUSD} onChange={v => setMarketing(m => ({ ...m, blendedCacUSD: v }))} prefix="$" />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          At ₹{marketing.blendedCacINR} CAC and ₹{marketing.monthlyBudget.toLocaleString()} budget →
          ~{marketing.blendedCacINR > 0 ? Math.round(marketing.monthlyBudget / marketing.blendedCacINR) : 0} new users/month
        </div>
      </CollapsibleSection>

      {/* ─── Revenue Detail ─── */}
      <CollapsibleSection title="Revenue Breakdown" defaultOpen={false}>
        <div style={gridStyle(2)}>
          <div>
            <h4 style={subheadingStyle}>India ({calc.indiaUsers.toLocaleString()} users)</h4>
            {[
              { label: `Basic (${calc.indiaBasic})`, value: calc.revenueIndiaBasic },
              { label: `Pro (${calc.indiaPro})`, value: calc.revenueIndiaPro },
              { label: `Elite (${calc.indiaElite})`, value: calc.revenueIndiaElite },
              { label: `Day Pass (${calc.indiaDayPass} × ${users.dayPassesPerUserPerYear})`, value: calc.revenueIndiaDayPass },
            ].map(r => (
              <div key={r.label} style={rowStyle}>
                <span>{r.label}</span>
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 600 }}>{fmtINR(r.value)}</span>
              </div>
            ))}
            <div style={{ ...rowStyle, fontWeight: 700, borderBottom: "none" }}>
              <span>Total India</span>
              <span style={{ fontFamily: "var(--font-data)" }}>{fmtINR(calc.revenueIndiaTotal)} ({fmt(calc.revenueIndiaUSD)})</span>
            </div>
          </div>
          <div>
            <h4 style={subheadingStyle}>US ({calc.usUsers.toLocaleString()} users)</h4>
            {[
              { label: `Basic (${calc.usBasic})`, value: calc.revenueUsBasic },
              { label: `Pro (${calc.usPro})`, value: calc.revenueUsPro },
              { label: `Elite (${calc.usElite})`, value: calc.revenueUsElite },
              { label: `Day Pass (${calc.usDayPass} × ${users.dayPassesPerUserPerYear})`, value: calc.revenueUsDayPass },
            ].map(r => (
              <div key={r.label} style={rowStyle}>
                <span>{r.label}</span>
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 600 }}>${r.value.toFixed(0)}</span>
              </div>
            ))}
            <div style={{ ...rowStyle, fontWeight: 700, borderBottom: "none" }}>
              <span>Total US</span>
              <span style={{ fontFamily: "var(--font-data)" }}>{fmt(calc.revenueUsTotal)}</span>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ─── Footer ─── */}
      <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "var(--text-muted)" }}>
        All calculations are estimates. GCP prices as of March 2026. Verify against GCP Pricing Calculator before budget commitment.
        <br />
        Day Pass break-even: {calc.dayPassBreakeven} passes to match Elite yearly.
        Prompt users to switch after 10 passes.
      </div>
    </div>
  );
}
