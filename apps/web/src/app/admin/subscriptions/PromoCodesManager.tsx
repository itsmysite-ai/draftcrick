"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { DataTable } from "../_components/DataTable";

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
  fontFamily: "var(--font-data)",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid var(--border)",
  fontSize: 14,
};

const btnStyle: React.CSSProperties = {
  padding: "8px 20px",
  backgroundColor: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

interface CreateForm {
  code: string;
  description: string;
  discountType: "percentage" | "fixed_amount" | "free_trial";
  discountValue: number;
  applicableTiers: ("pro" | "elite")[];
  maxRedemptions: number | null;
  maxPerUser: number;
  validUntil: string;
  durationMonths: number;
  influencerName: string;
  influencerCommission: number;
}

const defaultForm: CreateForm = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: 20,
  applicableTiers: ["pro", "elite"],
  maxRedemptions: null,
  maxPerUser: 1,
  validUntil: "",
  durationMonths: 1,
  influencerName: "",
  influencerCommission: 0,
};

export function PromoCodesManager() {
  const promos = trpc.subscription.admin.listPromoCodes.useQuery();
  const create = trpc.subscription.admin.createPromoCode.useMutation({
    onSuccess: () => {
      promos.refetch();
      setForm(defaultForm);
      setShowCreate(false);
    },
  });
  const toggle = trpc.subscription.admin.togglePromoCode.useMutation({
    onSuccess: () => promos.refetch(),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(defaultForm);
  const [selectedPromo, setSelectedPromo] = useState<string | null>(null);

  const redemptions = trpc.subscription.admin.getPromoRedemptions.useQuery(
    { promoCodeId: selectedPromo! },
    { enabled: !!selectedPromo }
  );

  const handleCreate = () => {
    create.mutate({
      code: form.code,
      description: form.description || undefined,
      discountType: form.discountType,
      discountValue: form.discountType === "free_trial" ? 100 : form.discountValue,
      applicableTiers: form.applicableTiers,
      maxRedemptions: form.maxRedemptions,
      maxPerUser: form.maxPerUser,
      validUntil: form.validUntil ? new Date(form.validUntil) : null,
      durationMonths: form.durationMonths,
      influencerName: form.influencerName || undefined,
      influencerCommission: form.influencerCommission || undefined,
    });
  };

  return (
    <div>
      {/* Create Button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Create promo codes for influencer partnerships and user discount campaigns.
        </p>
        <button onClick={() => setShowCreate(!showCreate)} style={btnStyle}>
          {showCreate ? "Cancel" : "+ New Promo Code"}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div style={sectionStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Create Promo Code</h3>

          <div style={labelStyle}>
            <span>Code</span>
            <input
              type="text"
              placeholder="DRAFTPRO20"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              style={{ ...inputStyle, width: 200, textTransform: "uppercase" }}
            />
          </div>

          <div style={labelStyle}>
            <span>Description</span>
            <input
              type="text"
              placeholder="Summer 2026 campaign"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ ...inputStyle, width: 280 }}
            />
          </div>

          <div style={labelStyle}>
            <span>Discount Type</span>
            <select
              value={form.discountType}
              onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}
              style={{ ...inputStyle, width: 160 }}
            >
              <option value="percentage">Percentage Off</option>
              <option value="fixed_amount">Fixed Amount (Paise)</option>
              <option value="free_trial">Free Trial</option>
            </select>
          </div>

          {form.discountType !== "free_trial" && (
            <div style={labelStyle}>
              <span>{form.discountType === "percentage" ? "Discount %" : "Discount (Paise)"}</span>
              <input
                type="number"
                min={1}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                style={{ ...inputStyle, width: 100 }}
              />
            </div>
          )}

          <div style={labelStyle}>
            <span>Applicable Tiers</span>
            <div style={{ display: "flex", gap: 8 }}>
              {(["pro", "elite"] as const).map((tier) => (
                <label key={tier} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={form.applicableTiers.includes(tier)}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...form.applicableTiers, tier]
                        : form.applicableTiers.filter((t) => t !== tier);
                      setForm({ ...form, applicableTiers: updated as ("pro" | "elite")[] });
                    }}
                  />
                  {tier.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          <div style={labelStyle}>
            <span>Max Total Redemptions</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                min={0}
                value={form.maxRedemptions ?? ""}
                placeholder="unlimited"
                onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value === "" ? null : Number(e.target.value) })}
                style={{ ...inputStyle, width: 100 }}
              />
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{form.maxRedemptions === null ? "unlimited" : ""}</span>
            </div>
          </div>

          <div style={labelStyle}>
            <span>Max Per User</span>
            <input
              type="number"
              min={1}
              value={form.maxPerUser}
              onChange={(e) => setForm({ ...form, maxPerUser: Number(e.target.value) })}
              style={{ ...inputStyle, width: 80 }}
            />
          </div>

          <div style={labelStyle}>
            <span>Duration (months)</span>
            <input
              type="number"
              min={1}
              value={form.durationMonths}
              onChange={(e) => setForm({ ...form, durationMonths: Number(e.target.value) })}
              style={{ ...inputStyle, width: 80 }}
            />
          </div>

          <div style={labelStyle}>
            <span>Valid Until</span>
            <input
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              style={{ ...inputStyle, width: 160 }}
            />
          </div>

          <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginTop: 16, marginBottom: 8, textTransform: "uppercase" }}>
            Influencer (Optional)
          </h4>

          <div style={labelStyle}>
            <span>Influencer Name</span>
            <input
              type="text"
              placeholder="@username"
              value={form.influencerName}
              onChange={(e) => setForm({ ...form, influencerName: e.target.value })}
              style={{ ...inputStyle, width: 200 }}
            />
          </div>

          <div style={labelStyle}>
            <span>Commission (Paise / redemption)</span>
            <input
              type="number"
              min={0}
              value={form.influencerCommission}
              onChange={(e) => setForm({ ...form, influencerCommission: Number(e.target.value) })}
              style={{ ...inputStyle, width: 100 }}
            />
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <button
              onClick={handleCreate}
              disabled={!form.code || form.applicableTiers.length === 0 || create.isPending}
              style={{
                ...btnStyle,
                opacity: !form.code || create.isPending ? 0.6 : 1,
                cursor: !form.code || create.isPending ? "not-allowed" : "pointer",
              }}
            >
              {create.isPending ? "Creating..." : "Create Promo Code"}
            </button>
          </div>

          {create.isError && (
            <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>Error: {create.error.message}</p>
          )}
        </div>
      )}

      {/* Promo Codes List */}
      <DataTable
        loading={promos.isLoading}
        data={promos.data ?? []}
        columns={[
          { key: "code", header: "Code", width: "120px", render: (row) => (
            <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, letterSpacing: "0.05em" }}>{row.code}</span>
          )},
          {
            key: "discountType",
            header: "Discount",
            width: "140px",
            render: (row) => {
              if (row.discountType === "percentage") return `${row.discountValue}% off`;
              if (row.discountType === "fixed_amount") return `₹${(row.discountValue / 100).toFixed(0)} off`;
              return "Free Trial";
            },
          },
          {
            key: "applicableTiers",
            header: "Tiers",
            width: "100px",
            render: (row) => (row.applicableTiers as string[]).map((t: string) => t.toUpperCase()).join(", "),
          },
          {
            key: "redemptions",
            header: "Used",
            width: "100px",
            render: (row) => `${row.currentRedemptions}${row.maxRedemptions ? ` / ${row.maxRedemptions}` : ""}`,
          },
          {
            key: "influencerName",
            header: "Influencer",
            width: "120px",
            render: (row) => row.influencerName || "-",
          },
          {
            key: "validUntil",
            header: "Expires",
            width: "100px",
            render: (row) => row.validUntil ? new Date(row.validUntil).toLocaleDateString() : "Never",
          },
          {
            key: "isActive",
            header: "Status",
            width: "80px",
            render: (row) => (
              <button
                onClick={() => toggle.mutate({ id: row.id, isActive: !row.isActive })}
                style={{
                  padding: "3px 10px",
                  borderRadius: 4,
                  border: "none",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: row.isActive ? "var(--accent)" : "var(--border)",
                  color: row.isActive ? "#fff" : "var(--text-secondary)",
                }}
              >
                {row.isActive ? "Active" : "Disabled"}
              </button>
            ),
          },
          {
            key: "details",
            header: "",
            width: "80px",
            render: (row) => (
              <button
                onClick={() => setSelectedPromo(selectedPromo === row.id ? null : row.id)}
                style={{
                  padding: "3px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontSize: 11,
                  backgroundColor: "transparent",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                {selectedPromo === row.id ? "Hide" : "Redemptions"}
              </button>
            ),
          },
        ]}
      />

      {/* Redemptions Detail */}
      {selectedPromo && (
        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Redemption History</h3>
          <DataTable
            loading={redemptions.isLoading}
            data={redemptions.data ?? []}
            emptyMessage="No redemptions yet"
            columns={[
              {
                key: "user",
                header: "User",
                render: (row: any) => row.user?.username ?? row.userId,
              },
              {
                key: "discountAppliedPaise",
                header: "Discount Applied",
                render: (row: any) => `₹${(row.discountAppliedPaise / 100).toFixed(0)}`,
              },
              {
                key: "createdAt",
                header: "Redeemed At",
                render: (row: any) => new Date(row.createdAt).toLocaleString(),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
