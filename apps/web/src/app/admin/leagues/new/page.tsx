"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

type Format =
  | "cricket_manager"
  | "salary_cap"
  | "draft"
  | "auction"
  | "prediction";

const FORMAT_OPTIONS: Array<{ value: Format; label: string; description: string }> = [
  {
    value: "cricket_manager",
    label: "Cricket Manager",
    description:
      "Admin-curated rounds grouping matches. Members pick 11, set batting order + bowling priority, race NRR across rounds.",
  },
  {
    value: "salary_cap",
    label: "Salary Cap",
    description: "Classic fantasy: pick players within a budget each match.",
  },
  {
    value: "draft",
    label: "Snake Draft",
    description: "Members draft unique squads that score across matches.",
  },
  {
    value: "auction",
    label: "Auction",
    description: "Members bid on players to build their squads.",
  },
  {
    value: "prediction",
    label: "Prediction",
    description: "Predict match outcomes and events.",
  },
];

export default function NewAdminLeaguePage() {
  const router = useRouter();
  const [format, setFormat] = useState<Format>("cricket_manager");
  const [name, setName] = useState("");
  const [tournament, setTournament] = useState<string>("");
  // 100000 is the "practically unlimited" sentinel — the existing
  // count-vs-cap comparison logic across the codebase still works (count
  // will never realistically reach 100k members), so we don't need a DB
  // migration to add a separate "unlimited" flag.
  const UNLIMITED_MEMBERS = 100000;
  const [maxMembers, setMaxMembers] = useState(100);
  const [unlimitedMembers, setUnlimitedMembers] = useState(false);
  const effectiveMaxMembers = unlimitedMembers ? UNLIMITED_MEMBERS : maxMembers;
  const [entryFee, setEntryFee] = useState(0);
  const [prizePool, setPrizePool] = useState(0);
  const [ballLimit, setBallLimit] = useState(120);
  const [minBowlers, setMinBowlers] = useState(5);
  const [maxOversPerBowler, setMaxOversPerBowler] = useState(4);
  const [roundPct, setRoundPct] = useState(10);
  const [finalPct, setFinalPct] = useState(50);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tournaments = trpc.admin.tournaments.list.useQuery();
  const tournamentOptions = useMemo(
    () => (tournaments.data ?? []).map((t: { id: string; name: string }) => t),
    [tournaments.data]
  );

  const create = trpc.admin.leagues.create.useMutation({
    onSuccess: (league) => {
      if (league) router.push(`/admin/leagues/${league.id}`);
    },
    onError: (err) => setError(err.message ?? "Failed to create league"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !tournament) {
      setError("Name and tournament are required");
      return;
    }

    const rules: Record<string, unknown> = {};
    if (format === "cricket_manager") {
      rules.cricketManager = {
        ballLimit,
        minBowlersInSquad: minBowlers,
        maxOversPerBowler,
        prizePool,
        entryFee,
        prizeDistribution: [
          { rank: 1, percent: 50 },
          { rank: 2, percent: 30 },
          { rank: 3, percent: 20 },
        ],
        roundPrizeSplit: { perRoundPct: roundPct, finalPct },
      };
    }

    create.mutate({
      name: name.trim(),
      format,
      sport: "cricket",
      tournament,
      isPrivate: false,
      maxMembers: effectiveMaxMembers,
      template: "custom",
      rules,
    });
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/admin/leagues"
          style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}
        >
          ← Admin Leagues
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>New Admin League</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
          Leagues created here are public and owned by the platform. Behaviour is identical to
          user-created leagues.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Field label="Format">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as Format)}
            style={inputStyle}
          >
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p style={hintStyle}>
            {FORMAT_OPTIONS.find((o) => o.value === format)?.description}
          </p>
        </Field>

        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="IPL 2026 Mega League"
            style={inputStyle}
            maxLength={100}
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </Field>

        <Field label="Tournament">
          <select
            value={tournament}
            onChange={(e) => setTournament(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select tournament…</option>
            {tournamentOptions.map((t: { id: string; name: string }) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Max Members">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="number"
              value={unlimitedMembers ? "" : maxMembers}
              placeholder={unlimitedMembers ? "unlimited" : ""}
              onChange={(e) => setMaxMembers(Number(e.target.value))}
              min={1}
              max={100000}
              disabled={unlimitedMembers}
              style={{
                ...inputStyle,
                opacity: unlimitedMembers ? 0.5 : 1,
                flex: 1,
              }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={unlimitedMembers}
                onChange={(e) => setUnlimitedMembers(e.target.checked)}
              />
              no limit
            </label>
          </div>
        </Field>

        <Field label="Entry Fee (Pop Coins, one-time)">
          <input
            type="number"
            value={entryFee}
            onChange={(e) => setEntryFee(Number(e.target.value))}
            min={0}
            style={inputStyle}
          />
        </Field>

        <Field label="Prize Pool (Pop Coins, guaranteed)">
          <input
            type="number"
            value={prizePool}
            onChange={(e) => setPrizePool(Number(e.target.value))}
            min={0}
            style={inputStyle}
          />
        </Field>

        {format === "cricket_manager" && (
          <>
            <Divider label="Cricket Manager config" />

            <Field label="Ball limit per innings">
              <input
                type="number"
                value={ballLimit}
                onChange={(e) => setBallLimit(Number(e.target.value))}
                min={30}
                max={300}
                style={inputStyle}
              />
              <p style={hintStyle}>Default 120 (20 overs × 6 balls).</p>
            </Field>

            <Field label="Min bowlers in squad">
              <input
                type="number"
                value={minBowlers}
                onChange={(e) => setMinBowlers(Number(e.target.value))}
                min={3}
                max={7}
                style={inputStyle}
              />
            </Field>

            <Field label="Max overs per bowler">
              <input
                type="number"
                value={maxOversPerBowler}
                onChange={(e) => setMaxOversPerBowler(Number(e.target.value))}
                min={1}
                max={10}
                style={inputStyle}
              />
            </Field>

            <Field label="Prize split — per-round % of pool">
              <input
                type="number"
                value={roundPct}
                onChange={(e) => setRoundPct(Number(e.target.value))}
                min={0}
                max={100}
                style={inputStyle}
              />
              <p style={hintStyle}>
                % of total pool awarded at the end of each round. Rest is saved for final
                standings.
              </p>
            </Field>

            <Field label="Prize split — final % of pool">
              <input
                type="number"
                value={finalPct}
                onChange={(e) => setFinalPct(Number(e.target.value))}
                min={0}
                max={100}
                style={inputStyle}
              />
            </Field>
          </>
        )}

        {error && (
          <div
            style={{
              padding: 12,
              backgroundColor: "rgba(229,72,77,0.1)",
              color: "var(--red)",
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={create.isPending}
          style={{
            padding: "10px 24px",
            backgroundColor: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: create.isPending ? "not-allowed" : "pointer",
            opacity: create.isPending ? 0.6 : 1,
          }}
        >
          {create.isPending ? "Creating…" : "Create League"}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  backgroundColor: "var(--bg-surface)",
  color: "var(--text-primary)",
  fontSize: 14,
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  marginTop: 4,
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-primary)",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div
      style={{
        marginTop: 24,
        marginBottom: 12,
        paddingTop: 12,
        borderTop: "1px solid var(--border)",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: 0.8,
      }}
    >
      {label}
    </div>
  );
}
