"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { FULL_LEAGUE_TEMPLATES, DEFAULT_T20_SCORING } from "@draftplay/shared";

type Format =
  | "cricket_manager"
  | "salary_cap"
  | "draft"
  | "auction"
  | "prediction";

type Template = "casual" | "competitive" | "pro" | "custom";

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
  const [template, setTemplate] = useState<Template>("casual");
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

  // ── Salary cap custom overrides ────────────────────────────────────
  // Seeded from the casual template so the custom path has sensible
  // starting values rather than all-zeros.
  const [scTeamSize, setScTeamSize] = useState(11);
  const [scMinBat, setScMinBat] = useState(1);
  const [scMaxBat, setScMaxBat] = useState(6);
  const [scMinBowl, setScMinBowl] = useState(1);
  const [scMaxBowl, setScMaxBowl] = useState(6);
  const [scMinAr, setScMinAr] = useState(1);
  const [scMaxAr, setScMaxAr] = useState(6);
  const [scMinWk, setScMinWk] = useState(1);
  const [scMaxWk, setScMaxWk] = useState(4);
  const [scMaxFromOneTeam, setScMaxFromOneTeam] = useState(7);
  const [scBudget, setScBudget] = useState(100);
  const [scCaptainMult, setScCaptainMult] = useState(2);
  const [scViceCaptainMult, setScViceCaptainMult] = useState(1.5);

  // ── Draft custom overrides ─────────────────────────────────────────
  const [drMaxRounds, setDrMaxRounds] = useState(11);
  const [drTimePerPick, setDrTimePerPick] = useState(60);
  const [drSnake, setDrSnake] = useState(true);

  // ── Auction custom overrides ───────────────────────────────────────
  const [auBudget, setAuBudget] = useState(100);
  const [auMinBid, setAuMinBid] = useState(1);
  const [auBidIncrement, setAuBidIncrement] = useState(1);
  const [auMaxBidTime, setAuMaxBidTime] = useState(15);
  const [auMaxPlayersPerTeam, setAuMaxPlayersPerTeam] = useState(11);

  // ── Scoring rules (cricket) — seeded from the T20 default ──────────
  const [sRunPoints, setSRunPoints] = useState(DEFAULT_T20_SCORING.runPoints ?? 1);
  const [sBoundaryBonus, setSBoundaryBonus] = useState(DEFAULT_T20_SCORING.boundaryBonus ?? 1);
  const [sSixBonus, setSSixBonus] = useState(DEFAULT_T20_SCORING.sixBonus ?? 2);
  const [sHalfCenturyBonus, setSHalfCenturyBonus] = useState(DEFAULT_T20_SCORING.halfCenturyBonus ?? 20);
  const [sCenturyBonus, setSCenturyBonus] = useState(DEFAULT_T20_SCORING.centuryBonus ?? 50);
  const [sDuckPenalty, setSDuckPenalty] = useState(DEFAULT_T20_SCORING.duckPenalty ?? -5);
  const [sWicketPoints, setSWicketPoints] = useState(DEFAULT_T20_SCORING.wicketPoints ?? 25);
  const [sMaidenOverPoints, setSMaidenOverPoints] = useState(DEFAULT_T20_SCORING.maidenOverPoints ?? 15);
  const [sThreeWicketBonus, setSThreeWicketBonus] = useState(DEFAULT_T20_SCORING.threeWicketBonus ?? 15);
  const [sFiveWicketBonus, setSFiveWicketBonus] = useState(DEFAULT_T20_SCORING.fiveWicketBonus ?? 30);
  const [sCatchPoints, setSCatchPoints] = useState(DEFAULT_T20_SCORING.catchPoints ?? 10);
  const [sStumpingPoints, setSStumpingPoints] = useState(DEFAULT_T20_SCORING.stumpingPoints ?? 15);
  const [sRunOutDirect, setSRunOutDirect] = useState(DEFAULT_T20_SCORING.runOutDirectPoints ?? 15);
  const [sRunOutIndirect, setSRunOutIndirect] = useState(DEFAULT_T20_SCORING.runOutIndirectPoints ?? 10);
  const [sPotmBonus, setSPotmBonus] = useState(DEFAULT_T20_SCORING.playerOfMatchBonus ?? 25);

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
    // Entry fee + prize pool live at the top level of rules for all
    // non-CM formats. autoCreateContestsForLeague reads
    // `rules.entryFee` — if this isn't set, auto-created contests ship
    // with entryFee=0 and prizePool=0 no matter what the admin typed.
    if (format !== "cricket_manager") {
      rules.entryFee = entryFee;
      rules.prizePool = prizePool;
    }
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
    } else if (template === "custom") {
      // Custom → apply format-specific overrides from the UI. Other
      // categories fall back to CASUAL defaults server-side via the
      // deepMergeRules helper so the league is still playable.

      // Scoring rules apply to every cricket match-based format. Users
      // can tune them from the form; remaining CricketScoringRules
      // fields (strikeRateBonus / economyRateBonus tiers) inherit the
      // T20 defaults on the backend.
      rules.scoring = {
        runPoints: sRunPoints,
        boundaryBonus: sBoundaryBonus,
        sixBonus: sSixBonus,
        halfCenturyBonus: sHalfCenturyBonus,
        centuryBonus: sCenturyBonus,
        duckPenalty: sDuckPenalty,
        wicketPoints: sWicketPoints,
        maidenOverPoints: sMaidenOverPoints,
        threeWicketBonus: sThreeWicketBonus,
        fiveWicketBonus: sFiveWicketBonus,
        catchPoints: sCatchPoints,
        stumpingPoints: sStumpingPoints,
        runOutDirectPoints: sRunOutDirect,
        runOutIndirectPoints: sRunOutIndirect,
        playerOfMatchBonus: sPotmBonus,
      };

      if (format === "salary_cap") {
        rules.teamComposition = {
          teamSize: scTeamSize,
          minBatsmen: scMinBat,
          maxBatsmen: scMaxBat,
          minBowlers: scMinBowl,
          maxBowlers: scMaxBowl,
          minAllRounders: scMinAr,
          maxAllRounders: scMaxAr,
          minWicketKeepers: scMinWk,
          maxWicketKeepers: scMaxWk,
          maxFromOneTeam: scMaxFromOneTeam,
        };
        rules.salary = { totalBudget: scBudget };
        rules.boosters = {
          captainMultiplier: scCaptainMult,
          viceCaptainMultiplier: scViceCaptainMult,
        };
      } else if (format === "draft") {
        rules.draft = {
          maxRounds: drMaxRounds,
          timePerPick: drTimePerPick,
          snakeDraftEnabled: drSnake,
        };
      } else if (format === "auction") {
        rules.auction = {
          auctionBudget: auBudget,
          minBid: auMinBid,
          bidIncrement: auBidIncrement,
          maxBidTime: auMaxBidTime,
          maxPlayersPerTeam: auMaxPlayersPerTeam,
        };
      }
    }

    create.mutate({
      name: name.trim(),
      format,
      sport: "cricket",
      tournament,
      isPrivate: false,
      maxMembers: effectiveMaxMembers,
      // Non-CM formats honor the selected template; CM ignores it because
      // its rules are all in the cricketManager sub-object.
      template: format === "cricket_manager" ? "custom" : template,
      rules,
    });
  }

  // Pull the active template's settings so we can show them to the admin
  // as a read-only summary (so they know what's being applied without
  // needing to click into custom).
  const activeTemplate = useMemo(() => {
    if (format === "cricket_manager" || template === "custom") return null;
    return FULL_LEAGUE_TEMPLATES[template as "casual" | "competitive" | "pro"];
  }, [template, format]);

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

        {format !== "cricket_manager" && (
          <>
            <Divider label="Rules template" />
            <Field label="Preset">
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as Template)}
                style={inputStyle}
              >
                <option value="casual">Casual</option>
                <option value="competitive">Competitive</option>
                <option value="pro">Pro</option>
                <option value="custom">Custom</option>
              </select>
              <p style={hintStyle}>
                Casual / Competitive / Pro apply the matching preset rules (team composition, boosters, transfers, playoffs, salary).
                Pick Custom to override below.
              </p>
            </Field>

            {activeTemplate && (
              <TemplateSummary rules={activeTemplate} format={format} />
            )}

            {template === "custom" && format !== "prediction" && (
              <>
                <Divider label="Scoring — batting" />
                <TwoCol
                  left={
                    <Field label="Run (per run)">
                      <input
                        type="number"
                        step={0.5}
                        value={sRunPoints}
                        onChange={(e) => setSRunPoints(Number(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                  right={
                    <Field label="Duck penalty">
                      <input
                        type="number"
                        value={sDuckPenalty}
                        onChange={(e) => setSDuckPenalty(Number(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                />
                <TwoCol
                  left={
                    <Field label="Boundary bonus (per 4)">
                      <input
                        type="number"
                        value={sBoundaryBonus}
                        onChange={(e) => setSBoundaryBonus(Number(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                  right={
                    <Field label="Six bonus (per 6)">
                      <input
                        type="number"
                        value={sSixBonus}
                        onChange={(e) => setSSixBonus(Number(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                />
                <TwoCol
                  left={
                    <Field label="Half-century bonus">
                      <input
                        type="number"
                        value={sHalfCenturyBonus}
                        onChange={(e) => setSHalfCenturyBonus(Number(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                  right={
                    <Field label="Century bonus">
                      <input
                        type="number"
                        value={sCenturyBonus}
                        onChange={(e) => setSCenturyBonus(Number(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                />

                <Divider label="Scoring — bowling" />
                <TwoCol
                  left={
                    <Field label="Wicket points">
                      <input
                        type="number"
                        value={sWicketPoints}
                        onChange={(e) => setSWicketPoints(Number(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                  right={
                    <Field label="Maiden over bonus">
                      <input
                        type="number"
                        value={sMaidenOverPoints}
                        onChange={(e) => setSMaidenOverPoints(Number(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                />
                <TwoCol
                  left={
                    <Field label="3-wicket bonus">
                      <input
                        type="number"
                        value={sThreeWicketBonus}
                        onChange={(e) => setSThreeWicketBonus(Number(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                  right={
                    <Field label="5-wicket bonus">
                      <input
                        type="number"
                        value={sFiveWicketBonus}
                        onChange={(e) => setSFiveWicketBonus(Number(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                />

                <Divider label="Scoring — fielding + match" />
                <TwoCol
                  left={
                    <Field label="Catch points">
                      <input
                        type="number"
                        value={sCatchPoints}
                        onChange={(e) => setSCatchPoints(Number(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                  right={
                    <Field label="Stumping points">
                      <input
                        type="number"
                        value={sStumpingPoints}
                        onChange={(e) => setSStumpingPoints(Number(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                />
                <TwoCol
                  left={
                    <Field label="Run-out (direct)">
                      <input
                        type="number"
                        value={sRunOutDirect}
                        onChange={(e) => setSRunOutDirect(Number(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                  right={
                    <Field label="Run-out (indirect)">
                      <input
                        type="number"
                        value={sRunOutIndirect}
                        onChange={(e) => setSRunOutIndirect(Number(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                />
                <Field label="Player of the match bonus">
                  <input
                    type="number"
                    value={sPotmBonus}
                    onChange={(e) => setSPotmBonus(Number(e.target.value) || 0)}
                    style={inputStyle}
                  />
                </Field>
              </>
            )}

            {template === "custom" && format === "salary_cap" && (
              <>
                <Divider label="Salary cap — custom rules" />

                <Field label="Total budget (credits)">
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={scBudget}
                    onChange={(e) => setScBudget(Number(e.target.value) || 100)}
                    style={inputStyle}
                  />
                </Field>

                <Divider label="Team composition" />
                <TwoCol
                  left={
                    <Field label="Team size">
                      <input
                        type="number"
                        min={6}
                        max={15}
                        value={scTeamSize}
                        onChange={(e) => setScTeamSize(Number(e.target.value) || 11)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                  right={
                    <Field label="Max from one team">
                      <input
                        type="number"
                        min={1}
                        max={11}
                        value={scMaxFromOneTeam}
                        onChange={(e) => setScMaxFromOneTeam(Number(e.target.value) || 7)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                />

                <RoleRangeRow label="Batsmen" min={scMinBat} max={scMaxBat} onMin={setScMinBat} onMax={setScMaxBat} />
                <RoleRangeRow label="Bowlers" min={scMinBowl} max={scMaxBowl} onMin={setScMinBowl} onMax={setScMaxBowl} />
                <RoleRangeRow label="All-rounders" min={scMinAr} max={scMaxAr} onMin={setScMinAr} onMax={setScMaxAr} />
                <RoleRangeRow label="Wicket-keepers" min={scMinWk} max={scMaxWk} onMin={setScMinWk} onMax={setScMaxWk} />

                <Divider label="Boosters" />
                <TwoCol
                  left={
                    <Field label="Captain multiplier">
                      <input
                        type="number"
                        step={0.5}
                        min={1}
                        max={5}
                        value={scCaptainMult}
                        onChange={(e) => setScCaptainMult(Number(e.target.value) || 2)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                  right={
                    <Field label="Vice-captain multiplier">
                      <input
                        type="number"
                        step={0.25}
                        min={1}
                        max={3}
                        value={scViceCaptainMult}
                        onChange={(e) => setScViceCaptainMult(Number(e.target.value) || 1.5)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                />
              </>
            )}

            {template === "custom" && format === "draft" && (
              <>
                <Divider label="Draft — custom rules" />
                <Field label="Max rounds">
                  <input
                    type="number"
                    min={5}
                    max={30}
                    value={drMaxRounds}
                    onChange={(e) => setDrMaxRounds(Number(e.target.value) || 11)}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Time per pick (seconds)">
                  <input
                    type="number"
                    min={10}
                    max={300}
                    value={drTimePerPick}
                    onChange={(e) => setDrTimePerPick(Number(e.target.value) || 60)}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Snake draft">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={drSnake}
                      onChange={(e) => setDrSnake(e.target.checked)}
                    />
                    reverse order every other round
                  </label>
                </Field>
              </>
            )}

            {template === "custom" && format === "auction" && (
              <>
                <Divider label="Auction — custom rules" />
                <TwoCol
                  left={
                    <Field label="Auction budget">
                      <input
                        type="number"
                        min={10}
                        max={1000}
                        value={auBudget}
                        onChange={(e) => setAuBudget(Number(e.target.value) || 100)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                  right={
                    <Field label="Max players per team">
                      <input
                        type="number"
                        min={5}
                        max={25}
                        value={auMaxPlayersPerTeam}
                        onChange={(e) =>
                          setAuMaxPlayersPerTeam(Number(e.target.value) || 11)
                        }
                        style={inputStyle}
                      />
                    </Field>
                  }
                />
                <TwoCol
                  left={
                    <Field label="Min bid">
                      <input
                        type="number"
                        step={0.5}
                        min={0.5}
                        max={50}
                        value={auMinBid}
                        onChange={(e) => setAuMinBid(Number(e.target.value) || 1)}
                        style={inputStyle}
                      />
                    </Field>
                  }
                  right={
                    <Field label="Bid increment">
                      <input
                        type="number"
                        step={0.5}
                        min={0.5}
                        max={10}
                        value={auBidIncrement}
                        onChange={(e) =>
                          setAuBidIncrement(Number(e.target.value) || 1)
                        }
                        style={inputStyle}
                      />
                    </Field>
                  }
                />
                <Field label="Max bid time (seconds)">
                  <input
                    type="number"
                    min={5}
                    max={60}
                    value={auMaxBidTime}
                    onChange={(e) => setAuMaxBidTime(Number(e.target.value) || 15)}
                    style={inputStyle}
                  />
                </Field>
              </>
            )}
          </>
        )}

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

function TwoCol({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {left}
      {right}
    </div>
  );
}

function RoleRangeRow({
  label,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string;
  min: number;
  max: number;
  onMin: (n: number) => void;
  onMax: (n: number) => void;
}) {
  return (
    <TwoCol
      left={
        <Field label={`${label} — min`}>
          <input
            type="number"
            min={0}
            max={11}
            value={min}
            onChange={(e) => onMin(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </Field>
      }
      right={
        <Field label={`${label} — max`}>
          <input
            type="number"
            min={0}
            max={11}
            value={max}
            onChange={(e) => onMax(Number(e.target.value) || 0)}
            style={inputStyle}
          />
        </Field>
      }
    />
  );
}

function TemplateSummary({
  rules,
  format,
}: {
  rules: any;
  format: Format;
}) {
  const rows: Array<{ label: string; value: string }> = [];
  const tc = rules.teamComposition;
  if (tc) {
    rows.push({ label: "team size", value: `${tc.teamSize}` });
    rows.push({
      label: "role ranges",
      value: `BAT ${tc.minBatsmen}-${tc.maxBatsmen} · BOWL ${tc.minBowlers}-${tc.maxBowlers} · AR ${tc.minAllRounders}-${tc.maxAllRounders} · WK ${tc.minWicketKeepers}-${tc.maxWicketKeepers}`,
    });
    rows.push({ label: "max from one team", value: `${tc.maxFromOneTeam}` });
  }
  if (rules.boosters) {
    rows.push({
      label: "captain / vc",
      value: `${rules.boosters.captainMultiplier}× / ${rules.boosters.viceCaptainMultiplier}×`,
    });
  }
  if (format === "salary_cap" && rules.salary) {
    rows.push({ label: "budget", value: `${rules.salary.totalBudget} credits` });
    rows.push({
      label: "player price range",
      value: `${rules.salary.playerPriceMin}-${rules.salary.playerPriceMax} credits`,
    });
  }
  if (format === "draft" && rules.draft) {
    rows.push({ label: "draft rounds", value: `${rules.draft.maxRounds}` });
    rows.push({ label: "time per pick", value: `${rules.draft.timePerPick}s` });
    rows.push({
      label: "snake order",
      value: rules.draft.snakeDraftEnabled ? "yes" : "no",
    });
  }
  if (format === "auction" && rules.auction) {
    rows.push({ label: "budget", value: `${rules.auction.auctionBudget}` });
    rows.push({
      label: "bid",
      value: `min ${rules.auction.minBid}, increment ${rules.auction.bidIncrement}`,
    });
    rows.push({
      label: "max players per team",
      value: `${rules.auction.maxPlayersPerTeam}`,
    });
  }
  if (rules.transfers) {
    rows.push({
      label: "transfers",
      value: `${rules.transfers.freeTransfersPerWeek} free/wk${rules.transfers.transferPenaltyPoints > 0 ? ` (−${rules.transfers.transferPenaltyPoints} per extra)` : ""}`,
    });
  }
  if (rules.playoffs?.playoffsEnabled) {
    rows.push({
      label: "playoffs",
      value: `${rules.playoffs.playoffFormat} · size ${rules.playoffs.playoffSize}`,
    });
  }

  return (
    <div
      style={{
        marginBottom: 16,
        padding: 12,
        backgroundColor: "var(--bg)",
        border: "1px dashed var(--border)",
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>
        preset includes
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", gap: 8, fontSize: 12 }}>
            <span style={{ color: "var(--text-secondary)", minWidth: 120 }}>{r.label}</span>
            <span style={{ color: "var(--text-primary)" }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
