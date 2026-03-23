"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { DataTable } from "../_components/DataTable";

const PAGE_SIZE = 25;

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
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 13,
  backgroundColor: "var(--bg)",
  color: "var(--text-primary)",
};

export default function UsersPage() {
  const { staffRole } = useAuth();
  const isAdmin = staffRole === "admin";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const usersList = trpc.admin.users.list.useQuery({
    search: search || undefined,
    limit: PAGE_SIZE + 1,
    offset: page * PAGE_SIZE,
  });
  const updateRole = trpc.admin.users.updateRole.useMutation({
    onSuccess: () => usersList.refetch(),
  });

  const data = (usersList.data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (usersList.data ?? []).length > PAGE_SIZE;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Users</h1>

      <input
        placeholder="Search by username or email..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        style={{ ...inputStyle, width: 320, marginBottom: 20, fontSize: 14, padding: "8px 12px" }}
      />

      {selectedUserId ? (
        <UserDetailPanel
          userId={selectedUserId}
          onBack={() => setSelectedUserId(null)}
          isAdmin={isAdmin}
        />
      ) : (
        <DataTable
          loading={usersList.isLoading}
          data={data}
          page={page}
          onPageChange={setPage}
          pageSize={PAGE_SIZE}
          hasMore={hasMore}
          columns={[
            {
              key: "username",
              header: "Username",
              render: (row) => (
                <button
                  onClick={() => setSelectedUserId(row.id)}
                  style={{
                    background: "none", border: "none", color: "var(--accent)",
                    cursor: "pointer", fontWeight: 500, fontSize: 13, padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  {row.username}
                </button>
              ),
            },
            { key: "displayName", header: "Name" },
            { key: "email", header: "Email" },
            {
              key: "role",
              header: "Role",
              width: "140px",
              render: (row) => isAdmin ? (
                <select
                  value={row.role}
                  onChange={(e) => updateRole.mutate({ userId: row.id, role: e.target.value as any })}
                  style={{ ...inputStyle, fontSize: 12, padding: "4px 8px" }}
                >
                  <option value="user">user</option>
                  <option value="support">support</option>
                  <option value="moderator">moderator</option>
                  <option value="admin">admin</option>
                </select>
              ) : (
                <span style={{
                  padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                  fontFamily: "var(--font-data)",
                  backgroundColor: row.role === "admin" ? "rgba(229,72,77,0.1)" :
                    row.role === "support" ? "rgba(16,185,129,0.15)" : "var(--border)",
                  color: row.role === "admin" ? "var(--red)" :
                    row.role === "support" ? "var(--accent)" : "var(--text-muted)",
                }}>
                  {row.role}
                </span>
              ),
            },
            {
              key: "createdAt",
              header: "Joined",
              width: "160px",
              render: (row) => new Date(row.createdAt).toLocaleDateString(),
            },
          ]}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// User Detail Panel — shows full user info, subscription, events, actions
// ---------------------------------------------------------------------------

function UserDetailPanel({ userId, onBack, isAdmin }: { userId: string; onBack: () => void; isAdmin: boolean }) {
  const detail = trpc.admin.users.getDetail.useQuery({ userId });
  const overrideTier = trpc.admin.users.overrideTier.useMutation({
    onSuccess: () => detail.refetch(),
  });
  const grantDayPass = trpc.admin.users.grantDayPass.useMutation({
    onSuccess: () => detail.refetch(),
  });

  const [overrideForm, setOverrideForm] = useState<{ tier: string; reason: string } | null>(null);
  const [showDayPass, setShowDayPass] = useState(false);
  const [dayPassReason, setDayPassReason] = useState("");

  if (detail.isLoading) {
    return <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading user details...</p>;
  }

  if (detail.isError) {
    return (
      <div>
        <button onClick={onBack} style={backBtnStyle}>← Back to Users</button>
        <p style={{ color: "var(--red)", fontSize: 14 }}>Error: {detail.error.message}</p>
      </div>
    );
  }

  if (!detail.data) {
    return (
      <div>
        <button onClick={onBack} style={backBtnStyle}>← Back to Users</button>
        <p style={{ color: "var(--red)", fontSize: 14 }}>User not found.</p>
      </div>
    );
  }

  const { user, profile, wallet, subscription, events, recentTransactions } = detail.data;

  return (
    <div>
      <button onClick={onBack} style={backBtnStyle}>← Back to Users</button>

      {/* User Info */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>User Information</h2>
        <DetailRow label="ID" value={user.id} mono />
        <DetailRow label="Firebase UID" value={user.firebaseUid} mono />
        <DetailRow label="Username" value={user.username} />
        <DetailRow label="Display Name" value={user.displayName} />
        <DetailRow label="Email" value={user.email ?? "-"} />
        <DetailRow label="Phone" value={user.phone ?? "-"} />
        <DetailRow label="Role" value={user.role} />
        <DetailRow label="KYC Status" value={user.kycStatus} />
        <DetailRow label="Language" value={user.preferredLang} />
        <DetailRow label="Age Confirmed" value={user.ageConfirmed ? "Yes" : "No"} />
        <DetailRow label="Terms Accepted" value={user.termsAcceptedAt ? new Date(user.termsAcceptedAt).toLocaleString() : "Not yet"} />
        <DetailRow label="Country" value={(user.preferences as any)?.country ?? "-"} />
        <DetailRow label="State" value={(user.preferences as any)?.state ?? "-"} />
        <DetailRow label="Sports" value={(user.preferences as any)?.sports?.join(", ") ?? "-"} />
        <DetailRow label="Created" value={new Date(user.createdAt).toLocaleString()} />
        <DetailRow label="Updated" value={new Date(user.updatedAt).toLocaleString()} />
        {user.deletedAt && <DetailRow label="Deleted At" value={new Date(user.deletedAt).toLocaleString()} />}
      </div>

      {/* Profile */}
      {profile && (
        <div style={sectionStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Profile</h2>
          <DetailRow label="Favorite Team" value={profile.favoriteTeam ?? "-"} />
          <DetailRow label="Bio" value={profile.bio ?? "-"} />
          <DetailRow label="Win Count" value={String(profile.winCount)} />
          <DetailRow label="Contest Count" value={String(profile.contestCount)} />
          <DetailRow label="Prediction Streak" value={String(profile.predictionStreak)} />
          <DetailRow label="Login Streak" value={String(profile.loginStreak)} />
          <DetailRow label="Last Login" value={profile.lastLoginDate ?? "-"} />
          <DetailRow label="Referral Code" value={profile.referralCode} mono />
          <DetailRow label="Referred By" value={profile.referredBy ?? "-"} mono />
          {Array.isArray(profile.badges) && profile.badges.length > 0 && (
            <DetailRow label="Badges" value={JSON.stringify(profile.badges)} />
          )}
        </div>
      )}

      {/* Wallet */}
      {wallet && (
        <div style={sectionStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Wallet</h2>
          <DetailRow label="Coin Balance" value={String(wallet.coinBalance)} />
          <DetailRow label="Total Earned" value={String(wallet.totalEarned)} />
          <DetailRow label="Total Spent" value={String(wallet.totalSpent)} />
          <DetailRow label="Total Won" value={String(wallet.totalWon)} />
          <DetailRow label="Login Streak" value={String(wallet.loginStreak)} />
          <DetailRow label="Last Daily Claim" value={wallet.lastDailyClaimAt ? new Date(wallet.lastDailyClaimAt).toLocaleString() : "-"} />
        </div>
      )}

      {/* Subscription */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Subscription</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setOverrideForm({ tier: subscription?.tier ?? "basic", reason: "" })}
              style={actionBtnStyle}
            >
              Override Tier
            </button>
            <button
              onClick={() => { setShowDayPass(true); setDayPassReason(""); }}
              style={actionBtnStyle}
            >
              Grant Day Pass
            </button>
          </div>
        </div>
        {subscription ? (
          <>
            <DetailRow label="Tier" value={subscription.tier} highlight={
              subscription.tier === "elite" ? "#D4A017" :
              subscription.tier === "pro" ? "var(--accent)" : undefined
            } />
            <DetailRow label="Status" value={subscription.status} highlight={
              subscription.status === "active" ? "var(--accent)" :
              subscription.status === "cancelled" ? "var(--red)" : undefined
            } />
            <DetailRow label="Billing Cycle" value={subscription.billingCycle} />
            <DetailRow label="Currency" value={subscription.currency ?? "INR"} />
            <DetailRow label="Price (paise)" value={subscription.priceInPaise ? String(subscription.priceInPaise) : "-"} mono />
            <DetailRow label="Payment Provider" value={(subscription as any).paymentProvider ?? "razorpay"} />
            <DetailRow label="Purchase Platform" value={(subscription as any).purchasePlatform ?? "-"} />
            <DetailRow label="Period Start" value={subscription.currentPeriodStart ? new Date(subscription.currentPeriodStart).toLocaleString() : "-"} />
            <DetailRow label="Period End" value={subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleString() : "-"} />
            <DetailRow label="Cancel at Period End" value={subscription.cancelAtPeriodEnd ? "Yes" : "No"} />
            <DetailRow label="Trial Ends" value={subscription.trialEndsAt ? new Date(subscription.trialEndsAt).toLocaleString() : "-"} />
            <DetailRow label="Day Pass Active" value={subscription.dayPassActive ? "Yes" : "No"} />
            {subscription.dayPassActive && subscription.dayPassExpiresAt && (
              <DetailRow label="Day Pass Expires" value={new Date(subscription.dayPassExpiresAt).toLocaleString()} />
            )}
            <DetailRow label="Razorpay Sub ID" value={subscription.razorpaySubscriptionId ?? "-"} mono />
            <DetailRow label="Created" value={new Date(subscription.createdAt).toLocaleString()} />
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No subscription record.</p>
        )}
      </div>

      {/* Override Tier Modal */}
      {overrideForm && (
        <div style={modalOverlayStyle} onClick={() => setOverrideForm(null)}>
          <div style={{ ...sectionStyle, maxWidth: 400, width: "100%", margin: 0 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Override Tier: {user.username}</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={fieldLabelStyle}>New Tier</label>
              <select
                value={overrideForm.tier}
                onChange={(e) => setOverrideForm({ ...overrideForm, tier: e.target.value })}
                style={{ ...inputStyle, width: "100%", fontFamily: "var(--font-data)" }}
              >
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="elite">Elite</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabelStyle}>Reason (required)</label>
              <input
                type="text"
                placeholder="Support ticket #, testing, compensation..."
                value={overrideForm.reason}
                onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setOverrideForm(null)} style={cancelBtnStyle}>Cancel</button>
              <button
                onClick={() => {
                  overrideTier.mutate({ userId, tier: overrideForm.tier as any, reason: overrideForm.reason });
                  setOverrideForm(null);
                }}
                disabled={!overrideForm.reason || overrideTier.isPending}
                style={submitBtnStyle(!overrideForm.reason || overrideTier.isPending)}
              >
                {overrideTier.isPending ? "Overriding..." : "Apply Override"}
              </button>
            </div>
            {overrideTier.isError && (
              <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>Error: {overrideTier.error.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Grant Day Pass Modal */}
      {showDayPass && (
        <div style={modalOverlayStyle} onClick={() => setShowDayPass(false)}>
          <div style={{ ...sectionStyle, maxWidth: 400, width: "100%", margin: 0 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Grant Day Pass: {user.username}</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabelStyle}>Reason (required)</label>
              <input
                type="text"
                placeholder="Compensation, testing, etc."
                value={dayPassReason}
                onChange={(e) => setDayPassReason(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowDayPass(false)} style={cancelBtnStyle}>Cancel</button>
              <button
                onClick={() => {
                  grantDayPass.mutate({ userId, reason: dayPassReason });
                  setShowDayPass(false);
                }}
                disabled={!dayPassReason || grantDayPass.isPending}
                style={submitBtnStyle(!dayPassReason || grantDayPass.isPending)}
              >
                {grantDayPass.isPending ? "Granting..." : "Grant Day Pass"}
              </button>
            </div>
            {grantDayPass.isError && (
              <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>Error: {grantDayPass.error.message}</p>
            )}
          </div>
        </div>
      )}

      {overrideTier.isSuccess && (
        <p style={{ color: "var(--accent)", fontSize: 13, marginBottom: 12 }}>Tier override applied successfully.</p>
      )}
      {grantDayPass.isSuccess && (
        <p style={{ color: "var(--accent)", fontSize: 13, marginBottom: 12 }}>Day pass granted successfully.</p>
      )}

      {/* Subscription Events */}
      {events && events.length > 0 && (
        <div style={sectionStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Subscription Events</h2>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={thStyle}>Event</th>
                <th style={thStyle}>From</th>
                <th style={thStyle}>To</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt: any) => (
                <tr key={evt.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "6px 8px" }}>
                    <span style={{
                      padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                      fontFamily: "var(--font-data)",
                      backgroundColor:
                        evt.event === "admin_override" ? "rgba(212,160,23,0.15)" :
                        evt.event === "cancelled" ? "rgba(229,72,77,0.1)" :
                        evt.event === "payment_failed" ? "rgba(229,72,77,0.1)" :
                        "rgba(16,185,129,0.1)",
                      color:
                        evt.event === "admin_override" ? "#D4A017" :
                        evt.event === "cancelled" || evt.event === "payment_failed" ? "var(--red)" :
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
                  <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--text-muted)", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {evt.metadata ? JSON.stringify(evt.metadata) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Transactions */}
      {recentTransactions && recentTransactions.length > 0 && (
        <div style={sectionStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Recent Transactions (Pop Coins)</h2>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((tx: any) => {
                const isSpend = ["contest_entry", "pack_purchase"].includes(tx.type);
                const displayAmount = isSpend ? -Math.abs(tx.amount) : Math.abs(tx.amount);
                return (
                <tr key={tx.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "6px 8px", fontFamily: "var(--font-data)" }}>{tx.type.replace(/_/g, " ")}</td>
                  <td style={{
                    padding: "6px 8px", fontFamily: "var(--font-data)", fontWeight: 600,
                    color: displayAmount >= 0 ? "var(--accent)" : "var(--red)",
                  }}>
                    {displayAmount >= 0 ? "+" : ""}{displayAmount}
                  </td>
                  <td style={{ padding: "6px 8px" }}>{tx.status}</td>
                  <td style={{ padding: "6px 8px", color: "var(--text-muted)" }}>
                    {new Date(tx.createdAt).toLocaleString()}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components and styles
// ---------------------------------------------------------------------------

function DetailRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: string }) {
  return (
    <div style={labelStyle}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{
        fontFamily: mono ? "var(--font-data)" : undefined,
        fontWeight: highlight ? 600 : undefined,
        color: highlight ?? "var(--text-primary)",
        maxWidth: 300,
        overflow: "hidden",
        textOverflow: "ellipsis",
        textAlign: "right",
      }}>
        {value}
      </span>
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  padding: "6px 14px", border: "1px solid var(--border)", borderRadius: 6,
  fontSize: 13, backgroundColor: "transparent", color: "var(--text-secondary)",
  cursor: "pointer", marginBottom: 20,
};

const actionBtnStyle: React.CSSProperties = {
  padding: "6px 14px", border: "1px solid var(--border)", borderRadius: 6,
  fontSize: 12, fontWeight: 600, backgroundColor: "transparent",
  color: "var(--text-secondary)", cursor: "pointer",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "8px 16px", border: "1px solid var(--border)", borderRadius: 6,
  fontSize: 13, backgroundColor: "transparent", color: "var(--text-secondary)", cursor: "pointer",
};

const submitBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "8px 16px", border: "none", borderRadius: 6,
  fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
  backgroundColor: disabled ? "var(--border)" : "var(--accent)",
  color: disabled ? "var(--text-muted)" : "#fff",
});

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 1000,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4,
};

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "6px 8px", fontWeight: 600, color: "var(--text-muted)",
};
