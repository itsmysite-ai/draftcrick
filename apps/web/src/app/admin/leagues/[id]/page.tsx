"use client";

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { trpc } from "@/lib/trpc";

const FORMAT_LABELS: Record<string, string> = {
  cricket_manager: "Cricket Manager",
  salary_cap: "Salary Cap",
  draft: "Draft",
  auction: "Auction",
  prediction: "Prediction",
};

export default function AdminLeagueDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const leagueQuery = trpc.admin.leagues.get.useQuery(
    { leagueId: id },
    { enabled: !!id }
  );

  if (!id) return <div>Missing league id</div>;
  if (leagueQuery.isLoading) return <div>Loading…</div>;
  if (!leagueQuery.data) return <div>League not found</div>;

  const league = leagueQuery.data;

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/admin/leagues"
          style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}
        >
          ← Admin Leagues
        </Link>
        <EditableNameHeader leagueId={id} initialName={league.name} />
        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 13, color: "var(--text-secondary)", flexWrap: "wrap" }}>
          <Tag>{FORMAT_LABELS[league.format] ?? league.format}</Tag>
          <Tag>{league.tournament}</Tag>
          <Tag>{league.isPrivate ? "Private" : "Public"}</Tag>
          <Tag>max {league.maxMembers}</Tag>
          <Tag>status: {league.status}</Tag>
          <Tag>{league.members?.length ?? 0} member(s)</Tag>
        </div>
      </div>

      <ShareSection inviteCode={league.inviteCode ?? ""} leagueName={league.name} />

      <CoAdminsSection
        leagueId={id}
        members={(league.members ?? []) as MemberRow[]}
      />

      <PrizesSection leagueId={id} />

      {league.format === "cricket_manager" ? (
        <CricketManagerSection leagueId={id} tournament={league.tournament} />
      ) : (
        <div
          style={{
            padding: 24,
            backgroundColor: "var(--bg-surface)",
            borderRadius: 8,
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            fontSize: 14,
          }}
        >
          This league format uses the standard contest flow. Contests are auto-created from the
          league&apos;s tournament schedule. Manage them via the Contests page.
        </div>
      )}
    </div>
  );
}

// ─── Shared types ──────────────────────────────────────────────────────────

type MemberRow = {
  leagueId: string;
  userId: string;
  role: string;
  joinedAt: string | Date;
  email: string | null;
  username: string | null;
  displayName: string | null;
};

// ─── Editable name header ──────────────────────────────────────────────────

function EditableNameHeader({
  leagueId,
  initialName,
}: {
  leagueId: string;
  initialName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const utils = trpc.useUtils();
  const updateMut = trpc.admin.leagues.update.useMutation({
    onSuccess: () => {
      utils.admin.leagues.get.invalidate({ leagueId });
      setEditing(false);
    },
  });

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>{initialName}</h1>
        <button
          onClick={() => {
            setName(initialName);
            setEditing(true);
          }}
          style={actionBtn("neutral")}
        >
          edit name
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed || trimmed === initialName) {
          setEditing(false);
          return;
        }
        updateMut.mutate({ leagueId, name: trimmed });
      }}
      style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
        style={{ ...inputStyle, flex: 1, fontSize: 20, fontWeight: 700 }}
      />
      <button
        type="submit"
        disabled={updateMut.isPending}
        style={actionBtn("accent")}
      >
        {updateMut.isPending ? "saving…" : "save"}
      </button>
      <button type="button" onClick={() => setEditing(false)} style={actionBtn("neutral")}>
        cancel
      </button>
    </form>
  );
}

// ─── Share + QR ────────────────────────────────────────────────────────────

function ShareSection({
  inviteCode,
  leagueName,
}: {
  inviteCode: string;
  leagueName: string;
}) {
  const shareUrl = inviteCode
    ? `https://app.draftplay.ai/league/join?code=${inviteCode}`
    : "";

  if (!inviteCode) return null;

  return (
    <Section title="Share link + QR">
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 260 }}>
          <label style={labelStyle}>Invite URL</label>
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                } catch {
                  /* clipboard may be blocked */
                }
              }}
              style={actionBtn("neutral")}
            >
              copy link
            </button>
            <button onClick={() => downloadQr(leagueName, shareUrl)} style={actionBtn("neutral")}>
              download QR (PNG)
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 10, lineHeight: 1.5 }}>
            Hand this to the influencer for publicity. Anyone with the link can join the league.
          </p>
        </div>
        <div style={{ padding: 16, backgroundColor: "white", borderRadius: 8 }} id="league-qr-wrap">
          <QRCodeSVG value={shareUrl} size={180} level="M" />
        </div>
      </div>
    </Section>
  );
}

function downloadQr(leagueName: string, url: string) {
  const svg = document.querySelector("#league-qr-wrap svg");
  if (!svg) return;
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(objectUrl);
      return;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return;
      const pngUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${leagueName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
    URL.revokeObjectURL(objectUrl);
  };
  img.src = objectUrl;
  // URL stays used to bind `url` into bundlers that tree-shake unused params.
  void url;
}

// ─── Co-admins ─────────────────────────────────────────────────────────────

function CoAdminsSection({
  leagueId,
  members,
}: {
  leagueId: string;
  members: MemberRow[];
}) {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addMut = trpc.admin.leagues.addCoAdmin.useMutation({
    onSuccess: () => {
      setEmail("");
      setError(null);
      utils.admin.leagues.get.invalidate({ leagueId });
    },
    onError: (err: { message: string }) => setError(err.message),
  });
  const removeMut = trpc.admin.leagues.removeCoAdmin.useMutation({
    onSuccess: () => utils.admin.leagues.get.invalidate({ leagueId }),
  });

  const owner = members.find((m) => m.role === "owner");
  const coAdmins = members.filter((m) => m.role === "admin");

  return (
    <Section title="League admins">
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
        Co-admins appear as league managers to members on mobile. The owner (the platform admin who
        created this league) always retains full control.
      </p>

      {owner && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>OWNER</div>
          <MemberRowCard member={owner} />
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>CO-ADMINS</div>
      {coAdmins.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", marginBottom: 12 }}>
          none yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {coAdmins.map((m) => (
            <MemberRowCard
              key={m.userId}
              member={m}
              onRemove={() =>
                removeMut.mutate({ leagueId, userId: m.userId })
              }
            />
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = email.trim();
          if (!trimmed) return;
          addMut.mutate({ leagueId, email: trimmed });
        }}
        style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <div style={{ flex: "1 1 280px" }}>
          <label style={labelStyle}>Add by email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            style={inputStyle}
          />
        </div>
        <button type="submit" disabled={addMut.isPending} style={actionBtn("accent")}>
          {addMut.isPending ? "adding…" : "add co-admin"}
        </button>
      </form>
      {error && (
        <div style={{ fontSize: 12, color: "var(--red)", marginTop: 8 }}>{error}</div>
      )}
    </Section>
  );
}

function MemberRowCard({
  member,
  onRemove,
}: {
  member: MemberRow;
  onRemove?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        backgroundColor: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 6,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {member.displayName || member.username || member.email || member.userId}
        </div>
        {member.email && (
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{member.email}</div>
        )}
      </div>
      {onRemove && (
        <button onClick={onRemove} style={actionBtn("danger")}>
          remove
        </button>
      )}
    </div>
  );
}

// ─── Prizes ────────────────────────────────────────────────────────────────

function PrizesSection({ leagueId }: { leagueId: string }) {
  const utils = trpc.useUtils();
  const prizesQuery = trpc.admin.leagues.listPrizes.useQuery({ leagueId });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const createMut = trpc.admin.leagues.createPrize.useMutation({
    onSuccess: () => {
      utils.admin.leagues.listPrizes.invalidate({ leagueId });
      setShowForm(false);
    },
  });
  const updateMut = trpc.admin.leagues.updatePrize.useMutation({
    onSuccess: () => {
      utils.admin.leagues.listPrizes.invalidate({ leagueId });
      setEditingId(null);
    },
  });
  const deleteMut = trpc.admin.leagues.deletePrize.useMutation({
    onSuccess: () => utils.admin.leagues.listPrizes.invalidate({ leagueId }),
  });

  const prizes = prizesQuery.data ?? [];

  return (
    <Section title="Prizes">
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
        Free-form rewards announced to league members. <strong>Goods / services / experiences only — no
        cash</strong>. Editable any time.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
        {prizes.map((p) =>
          editingId === p.id ? (
            <PrizeForm
              key={p.id}
              initial={p}
              onCancel={() => setEditingId(null)}
              onSubmit={(data) =>
                updateMut.mutate({ prizeId: p.id, ...data })
              }
              submitting={updateMut.isPending}
            />
          ) : (
            <PrizeCard
              key={p.id}
              prize={p}
              onEdit={() => setEditingId(p.id)}
              onDelete={() => {
                if (confirm(`Delete prize "${p.title}"?`)) {
                  deleteMut.mutate({ prizeId: p.id });
                }
              }}
            />
          )
        )}
      </div>

      {showForm ? (
        <PrizeForm
          onCancel={() => setShowForm(false)}
          onSubmit={(data) => createMut.mutate({ leagueId, ...data })}
          submitting={createMut.isPending}
        />
      ) : (
        <button onClick={() => setShowForm(true)} style={actionBtn("accent")}>
          + add prize
        </button>
      )}
    </Section>
  );
}

type PrizeRow = {
  id: string;
  leagueId: string;
  rankFrom: number;
  rankTo: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type PrizeFormData = {
  rankFrom: number;
  rankTo: number;
  title: string;
  description?: string;
  imageUrl?: string;
  displayOrder: number;
};

function PrizeCard({
  prize,
  onEdit,
  onDelete,
}: {
  prize: PrizeRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const rankLabel =
    prize.rankFrom === prize.rankTo
      ? `Rank ${prize.rankFrom}`
      : `Ranks ${prize.rankFrom}–${prize.rankTo}`;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: 12,
        border: "1px solid var(--border)",
        borderRadius: 8,
        backgroundColor: "var(--bg)",
      }}
    >
      {prize.imageUrl ? (
        <img
          src={prize.imageUrl}
          alt={prize.title}
          style={{
            width: 72,
            height: 72,
            objectFit: "cover",
            borderRadius: 6,
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 72,
            height: 72,
            backgroundColor: "var(--bg-surface)",
            borderRadius: 6,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: "var(--text-secondary)",
          }}
        >
          no image
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, marginBottom: 2 }}>
          {rankLabel}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{prize.title}</div>
        {prize.description && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.4 }}>
            {prize.description}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onEdit} style={actionBtn("neutral")}>
          edit
        </button>
        <button onClick={onDelete} style={actionBtn("danger")}>
          delete
        </button>
      </div>
    </div>
  );
}

function PrizeForm({
  initial,
  onCancel,
  onSubmit,
  submitting,
}: {
  initial?: PrizeRow;
  onCancel: () => void;
  onSubmit: (data: PrizeFormData) => void;
  submitting: boolean;
}) {
  const [rankFrom, setRankFrom] = useState(initial?.rankFrom ?? 1);
  const [rankTo, setRankTo] = useState(initial?.rankTo ?? 1);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [displayOrder, setDisplayOrder] = useState(initial?.displayOrder ?? 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          rankFrom,
          rankTo: Math.max(rankTo, rankFrom),
          title: title.trim(),
          description: description.trim() || undefined,
          imageUrl: imageUrl.trim() || undefined,
          displayOrder,
        });
      }}
      style={{
        padding: 12,
        border: "1px solid var(--border)",
        borderRadius: 8,
        backgroundColor: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>Rank from</label>
          <input
            type="number"
            min={1}
            required
            value={rankFrom}
            onChange={(e) => setRankFrom(Number(e.target.value) || 1)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Rank to</label>
          <input
            type="number"
            min={1}
            required
            value={rankTo}
            onChange={(e) => setRankTo(Number(e.target.value) || 1)}
            style={inputStyle}
          />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Title</label>
        <input
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Signed jersey from @influencer"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Description (optional)</label>
        <textarea
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="Details about the prize. No cash — goods/services/experiences only."
        />
      </div>
      <div>
        <label style={labelStyle}>Image URL (optional)</label>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          style={inputStyle}
        />
        {imageUrl && (
          <img
            src={imageUrl}
            alt="preview"
            style={{ marginTop: 8, maxWidth: 160, maxHeight: 120, borderRadius: 4, border: "1px solid var(--border)" }}
          />
        )}
      </div>
      <div style={{ maxWidth: 160 }}>
        <label style={labelStyle}>Display order</label>
        <input
          type="number"
          min={0}
          value={displayOrder}
          onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)}
          style={inputStyle}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={submitting || !title.trim()} style={actionBtn("accent")}>
          {submitting ? "saving…" : initial ? "save" : "add prize"}
        </button>
        <button type="button" onClick={onCancel} style={actionBtn("neutral")}>
          cancel
        </button>
      </div>
    </form>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginBottom: 24,
        padding: 20,
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  );
}

// ─── Cricket Manager section (rounds + composer) ───────────────────────────

function CricketManagerSection({
  leagueId,
  tournament,
}: {
  leagueId: string;
  tournament: string;
}) {
  const roundsQuery = trpc.cricketManager.getLeagueRounds.useQuery({ leagueId });
  const [showComposer, setShowComposer] = useState(false);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Rounds</h2>
        <button
          onClick={() => setShowComposer((v) => !v)}
          style={{
            padding: "8px 16px",
            backgroundColor: showComposer ? "var(--bg-surface)" : "var(--accent)",
            color: showComposer ? "var(--text-primary)" : "white",
            border: showComposer ? "1px solid var(--border)" : "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showComposer ? "Cancel" : "+ Compose Round"}
        </button>
      </div>

      {showComposer && (
        <RoundComposer
          leagueId={leagueId}
          tournament={tournament}
          nextRoundNumber={(roundsQuery.data?.length ?? 0) + 1}
          onCreated={() => {
            setShowComposer(false);
            roundsQuery.refetch();
          }}
        />
      )}

      <div style={{ marginTop: 16 }}>
        {roundsQuery.isLoading ? (
          <div style={{ color: "var(--text-secondary)" }}>Loading rounds…</div>
        ) : (roundsQuery.data ?? []).length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              backgroundColor: "var(--bg-surface)",
              border: "1px dashed var(--border)",
              borderRadius: 8,
              color: "var(--text-secondary)",
              fontSize: 14,
            }}
          >
            No rounds yet. Compose your first round above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(roundsQuery.data ?? []).map((r: any) => (
              <RoundRow
                key={r.id}
                round={r}
                tournament={tournament}
                onChanged={() => roundsQuery.refetch()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RoundRow({
  round,
  tournament,
  onChanged,
}: {
  round: any;
  tournament: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const deleteRound = trpc.cricketManager.deleteRound.useMutation({
    onSuccess: onChanged,
    onError: (err) => alert(err.message),
  });

  // Edit and delete are only valid until the round becomes settled OR a
  // match in it has started — the backend enforces both, but we hide the
  // buttons for settled rounds proactively. For "live" rounds we still
  // show but the backend will reject if any match has started; that's
  // intentional so the admin can attempt and see the reason.
  const canMutate = round.status !== "settled";

  return (
    <div
      style={{
        padding: 16,
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 12,
                fontWeight: 700,
                backgroundColor: "rgba(61,153,104,0.1)",
                color: "var(--accent)",
                padding: "2px 8px",
                borderRadius: 4,
              }}
            >
              R{round.roundNumber}
            </span>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{round.name}</div>
            <Tag>{round.status}</Tag>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)" }}>
            {round.matchesTotal} matches · window {formatDate(round.windowStart)} →{" "}
            {formatDate(round.windowEnd)} · lock {formatDate(round.lockTime)}
            {round.totalEntries > 0 && ` · ${round.totalEntries} entries`}
          </div>
        </div>

        {canMutate && (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setEditing((v) => !v)}
              style={actionBtn("neutral")}
            >
              {editing ? "Cancel" : "Edit"}
            </button>
            <button
              onClick={() => {
                const msg =
                  round.totalEntries > 0
                    ? `Delete round "${round.name}"? ${round.totalEntries} entr${
                        round.totalEntries === 1 ? "y" : "ies"
                      } will also be removed.`
                    : `Delete round "${round.name}"?`;
                if (confirm(msg))
                  deleteRound.mutate({ roundId: round.id });
              }}
              style={actionBtn("danger")}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {editing && (
        <RoundEditor
          round={round}
          tournament={tournament}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function RoundEditor({
  round,
  tournament,
  onCancel,
  onSaved,
}: {
  round: any;
  tournament: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const matchesQuery = trpc.admin.matches.list.useQuery({
    tournament,
    limit: 500,
  });
  const updateRound = trpc.cricketManager.updateRound.useMutation({
    onSuccess: onSaved,
    onError: (err) => setError(err.message),
  });

  const [name, setName] = useState<string>(round.name ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(round.matchIds ?? [])
  );
  const [error, setError] = useState<string | null>(null);

  const sortedMatches = useMemo(() => {
    return [...(matchesQuery.data ?? [])].sort(
      (a: any, b: any) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }, [matchesQuery.data]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function handleSave() {
    setError(null);
    if (selected.size === 0) {
      setError("Select at least one match");
      return;
    }
    updateRound.mutate({
      roundId: round.id,
      name: name.trim() || round.name,
      matchIds: Array.from(selected),
    });
  }

  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: "1px solid var(--border)",
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Round name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </div>

      <label style={labelStyle}>
        Matches ({selected.size} selected)
      </label>
      <div
        style={{
          maxHeight: 300,
          overflow: "auto",
          border: "1px solid var(--border)",
          borderRadius: 6,
          backgroundColor: "var(--bg)",
        }}
      >
        {matchesQuery.isLoading ? (
          <div style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>
            Loading matches…
          </div>
        ) : sortedMatches.length === 0 ? (
          <div style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>
            No matches found.
          </div>
        ) : (
          sortedMatches.map((m: any) => {
            const isSelected = selected.has(m.id);
            const isStarted = m.status === "live" || m.status === "completed";
            return (
              <label
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--border)",
                  cursor: isStarted ? "not-allowed" : "pointer",
                  opacity: isStarted ? 0.4 : 1,
                  backgroundColor: isSelected
                    ? "rgba(61,153,104,0.06)"
                    : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isStarted}
                  onChange={() => toggle(m.id)}
                />
                <div style={{ flex: 1, fontSize: 13 }}>
                  {m.teamHome} vs {m.teamAway}
                  <span style={{ color: "var(--text-secondary)", marginLeft: 8, fontSize: 11 }}>
                    {formatDate(m.startTime)} · {m.status}
                  </span>
                </div>
              </label>
            );
          })
        )}
      </div>

      {error && (
        <div style={{ marginTop: 8, color: "var(--danger)", fontSize: 13 }}>{error}</div>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={actionBtn("neutral")}>
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={updateRound.isPending}
          style={actionBtn("accent")}
        >
          {updateRound.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function RoundComposer({
  leagueId,
  tournament,
  nextRoundNumber,
  onCreated,
}: {
  leagueId: string;
  tournament: string;
  nextRoundNumber: number;
  onCreated: () => void;
}) {
  const matchesQuery = trpc.admin.matches.list.useQuery({
    tournament,
    limit: 500,
  });
  const compose = trpc.cricketManager.composeRound.useMutation({
    onSuccess: onCreated,
  });

  const [roundNumber, setRoundNumber] = useState(nextRoundNumber);
  const [name, setName] = useState(`Round ${nextRoundNumber}`);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const sortedMatches = useMemo(() => {
    return [...(matchesQuery.data ?? [])].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }, [matchesQuery.data]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.size === 0) {
      setError("Select at least one match");
      return;
    }
    compose.mutate({
      leagueId,
      roundNumber,
      name: name.trim() || `Round ${roundNumber}`,
      matchIds: Array.from(selected),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: 16,
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 120 }}>
          <label style={labelStyle}>Round #</label>
          <input
            type="number"
            value={roundNumber}
            onChange={(e) => setRoundNumber(Number(e.target.value))}
            min={1}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Round name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            placeholder="Round 1 — Opening Fixtures"
          />
        </div>
      </div>

      <label style={labelStyle}>
        Matches ({selected.size} selected) — sorted by date
      </label>
      <div
        style={{
          maxHeight: 360,
          overflow: "auto",
          border: "1px solid var(--border)",
          borderRadius: 6,
          backgroundColor: "var(--bg)",
        }}
      >
        {matchesQuery.isLoading ? (
          <div style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>
            Loading matches…
          </div>
        ) : sortedMatches.length === 0 ? (
          <div style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>
            No matches found for tournament "{tournament}".
          </div>
        ) : (
          sortedMatches.map((m: any) => {
            const isSelected = selected.has(m.id);
            return (
              <label
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  backgroundColor: isSelected
                    ? "rgba(61,153,104,0.06)"
                    : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(m.id)}
                />
                <div style={{ flex: 1, display: "flex", gap: 10, alignItems: "center" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      minWidth: 130,
                    }}
                  >
                    {formatDate(m.startTime)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {m.teamHome} vs {m.teamAway}
                  </span>
                  <Tag>{m.status}</Tag>
                </div>
              </label>
            );
          })
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            backgroundColor: "rgba(229,72,77,0.1)",
            color: "var(--red)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      {compose.error && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            backgroundColor: "rgba(229,72,77,0.1)",
            color: "var(--red)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {compose.error.message}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button
          type="submit"
          disabled={compose.isPending}
          style={{
            padding: "8px 16px",
            backgroundColor: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: compose.isPending ? "not-allowed" : "pointer",
          }}
        >
          {compose.isPending ? "Composing…" : `Compose Round (${selected.size} matches)`}
        </button>
      </div>
    </form>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 4,
        backgroundColor: "rgba(94,93,90,0.1)",
        color: "var(--text-secondary)",
        fontFamily: "var(--font-data)",
      }}
    >
      {children}
    </span>
  );
}

function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  backgroundColor: "var(--bg)",
  color: "var(--text-primary)",
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-primary)",
  marginBottom: 4,
};

function actionBtn(variant: "neutral" | "accent" | "danger"): React.CSSProperties {
  const colors = {
    neutral: { border: "var(--border)", color: "var(--text-primary)" },
    accent: { border: "var(--accent)", color: "var(--accent)" },
    danger: { border: "var(--red)", color: "var(--red)" },
  }[variant];
  return {
    fontSize: 12,
    padding: "6px 10px",
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    backgroundColor: "transparent",
    color: colors.color,
    cursor: "pointer",
    fontWeight: 500,
  };
}
