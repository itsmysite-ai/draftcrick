import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  FadeIn,
} from "react-native-reanimated";
import {
  Radius,
  Spacing,
  Font,
  FontFamily,
  RoleColors,
} from "../../lib/design";
import { useTheme } from "../../providers/ThemeProvider";

// ─── Sample player data (replace with tRPC query later) ─────────────
const PLAYERS = [
  { id: 1, name: "Virat Kohli", role: "BAT" as const, team: "IND", ovr: 97, stats: { avg: 53.4, sr: 93.2, runs: 13848 } },
  { id: 2, name: "Jasprit Bumrah", role: "BOWL" as const, team: "IND", ovr: 96, stats: { wkts: 178, econ: 4.2, avg: 21.7 } },
  { id: 3, name: "Pat Cummins", role: "BOWL" as const, team: "AUS", ovr: 95, stats: { wkts: 196, econ: 4.8, avg: 22.1 } },
  { id: 4, name: "Joe Root", role: "BAT" as const, team: "ENG", ovr: 95, stats: { avg: 50.6, sr: 56.2, runs: 12402 } },
  { id: 5, name: "Rashid Khan", role: "BOWL" as const, team: "AFG", ovr: 94, stats: { wkts: 172, econ: 4.1, avg: 19.8 } },
  { id: 6, name: "Ben Stokes", role: "AR" as const, team: "ENG", ovr: 94, stats: { avg: 36.7, sr: 71.4, wkts: 104 } },
  { id: 7, name: "Kane Williamson", role: "BAT" as const, team: "NZ", ovr: 93, stats: { avg: 54.3, sr: 52.1, runs: 8889 } },
  { id: 8, name: "Shakib Al Hasan", role: "AR" as const, team: "BAN", ovr: 93, stats: { avg: 34.8, sr: 68.3, wkts: 237 } },
  { id: 9, name: "Rishabh Pant", role: "WK" as const, team: "IND", ovr: 92, stats: { avg: 44.1, sr: 73.9, runs: 2648 } },
  { id: 10, name: "Kagiso Rabada", role: "BOWL" as const, team: "SA", ovr: 92, stats: { wkts: 168, econ: 5.1, avg: 23.4 } },
  { id: 11, name: "Travis Head", role: "BAT" as const, team: "AUS", ovr: 91, stats: { avg: 42.8, sr: 68.5, runs: 3210 } },
  { id: 12, name: "Quinton de Kock", role: "WK" as const, team: "SA", ovr: 91, stats: { avg: 38.6, sr: 71.2, runs: 5765 } },
];

type Player = (typeof PLAYERS)[number];
type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

// ─── Initials helpers ────────────────────────────────────────────────
function getInitials(name: string) {
  const parts = name.split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── InitialsAvatar ──────────────────────────────────────────────────
function InitialsAvatar({
  name,
  role,
  ovr,
  size = 46,
  roleColors,
  textPrimary,
  bg,
}: {
  name: string;
  role: RoleKey;
  ovr: number;
  size?: number;
  roleColors: typeof RoleColors;
  textPrimary: string;
  bg: string;
}) {
  const rs = roleColors[role];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: rs.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: FontFamily.mono,
          fontSize: size * 0.36,
          fontWeight: "500",
          color: rs.text,
          letterSpacing: 1,
        }}
      >
        {getInitials(name)}
      </Text>
      <View
        style={{
          position: "absolute",
          bottom: -5,
          right: -5,
          backgroundColor: textPrimary,
          paddingHorizontal: 5,
          paddingVertical: 1,
          borderRadius: 6,
        }}
      >
        <Text
          style={{
            fontFamily: FontFamily.mono,
            fontSize: 9,
            fontWeight: "700",
            color: bg,
            lineHeight: 16,
          }}
        >
          {ovr}
        </Text>
      </View>
    </View>
  );
}

// ─── StatLabel ───────────────────────────────────────────────────────
function StatLabel({
  label,
  value,
  textPrimary,
  textMuted,
}: {
  label: string;
  value: string | number;
  textPrimary: string;
  textMuted: string;
}) {
  return (
    <Text style={{ fontFamily: FontFamily.mono, fontSize: 11 }}>
      <Text style={{ color: textPrimary, fontWeight: "500" }}>{value}</Text>
      {" "}
      <Text style={{ color: textMuted, fontSize: 10 }}>{label}</Text>
    </Text>
  );
}

// ─── Main ────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode, toggleMode, t, roles } = useTheme();

  const [myTeam, setMyTeam] = useState<Player[]>([]);
  const [allDrafted, setAllDrafted] = useState<number[]>([]);
  const [round, setRound] = useState(1);
  const [pick, setPick] = useState(1);
  const [tab, setTab] = useState<"draft" | "team">("draft");
  const [roleFilter, setRoleFilter] = useState<"all" | RoleKey>("all");
  const [clock, setClock] = useState(90);

  // Draft clock
  useEffect(() => {
    const iv = setInterval(() => setClock((c) => (c <= 0 ? 90 : c - 1)), 1000);
    return () => clearInterval(iv);
  }, []);

  const handleDraft = (player: Player) => {
    setMyTeam((prev) => [...prev, player]);
    setAllDrafted((prev) => [...prev, player.id]);
    setPick((p) => p + 1);
    if (pick % 4 === 0) setRound((r) => r + 1);
    setClock(90);
  };

  const available = PLAYERS.filter((p) => !allDrafted.includes(p.id));
  const filtered =
    roleFilter === "all"
      ? available
      : available.filter((p) => p.role === roleFilter);
  const happiness = Math.min(100, Math.round((myTeam.length / 6) * 100));

  const happinessEmoji =
    happiness >= 80 ? "😄" : happiness >= 50 ? "🙂" : happiness >= 20 ? "😐" : "🥺";

  const happinessGradientColor =
    happiness >= 60
      ? t.accent
      : happiness >= 30
      ? t.cricket
      : t.hatch;

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Animated.View
          entering={FadeIn.delay(0)}
          style={[
            s.header,
            {
              paddingTop: insets.top + 8,
              borderBottomColor: t.border,
            },
          ]}
        >
          <View>
            <View style={s.headerLogoRow}>
              <Text style={{ fontSize: 22 }}>🥚</Text>
              <Text
                style={[
                  s.logoText,
                  { color: t.text },
                ]}
              >
                tami·draft
              </Text>
              <View
                style={[
                  s.cricketBadge,
                  { backgroundColor: t.accentLight },
                ]}
              >
                <Text
                  style={[
                    s.cricketBadgeText,
                    { color: t.accent },
                  ]}
                >
                  🏏 cricket
                </Text>
              </View>
            </View>
            <Text
              style={[
                s.subtitle,
                { color: t.textTertiary },
              ]}
            >
              fantasy cricket companion
            </Text>
          </View>

          <View style={s.headerRight}>
            {/* Mode Toggle */}
            <Pressable
              onPress={toggleMode}
              style={[
                s.modeToggle,
                {
                  backgroundColor:
                    mode === "dark" ? t.accent : t.bgSurfaceAlt,
                },
              ]}
            >
              <View
                style={[
                  s.modeKnob,
                  {
                    backgroundColor:
                      mode === "dark" ? t.bgSurface : "#fff",
                    left: mode === "dark" ? 23 : 3,
                  },
                ]}
              >
                <Text style={{ fontSize: 10 }}>
                  {mode === "dark" ? "🌙" : "☀️"}
                </Text>
              </View>
            </Pressable>

            {/* Clock */}
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={[
                  s.clockMeta,
                  { color: t.textTertiary },
                ]}
              >
                rd {round} · pick {pick}
              </Text>
              <Text
                style={[
                  s.clockTime,
                  {
                    color: clock < 15 ? t.hatch : t.text,
                  },
                ]}
              >
                {String(Math.floor(clock / 60))}:
                {String(clock % 60).padStart(2, "0")}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Happiness ── */}
        <Animated.View entering={FadeInDown.delay(30).springify()}>
          <View
            style={[
              s.happinessCard,
              {
                backgroundColor: t.bgSurface,
                borderColor: t.border,
              },
            ]}
          >
            <Text style={{ fontSize: 20, lineHeight: 24 }}>
              {happinessEmoji}
            </Text>
            <View style={{ flex: 1 }}>
              <View style={s.happinessRow}>
                <Text
                  style={[s.happinessLabel, { color: t.textTertiary }]}
                >
                  team happiness
                </Text>
                <Text
                  style={[s.happinessLabel, { color: t.textTertiary }]}
                >
                  {myTeam.length}/6 drafted
                </Text>
              </View>
              <View
                style={[
                  s.progressTrack,
                  { backgroundColor: t.bgSurfaceAlt },
                ]}
              >
                <View
                  style={[
                    s.progressFill,
                    {
                      width: `${happiness}%`,
                      backgroundColor: happinessGradientColor,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Tabs ── */}
        <View
          style={[
            s.tabContainer,
            { backgroundColor: t.bgSurfaceAlt },
          ]}
        >
          {([
            { key: "draft" as const, label: "Available", count: available.length },
            { key: "team" as const, label: "My Squad", count: myTeam.length },
          ]).map((tb) => (
            <Pressable
              key={tb.key}
              onPress={() => setTab(tb.key)}
              style={[
                s.tabBtn,
                {
                  backgroundColor:
                    tab === tb.key ? t.bgSurface : "transparent",
                },
                tab === tb.key && s.tabBtnActive,
              ]}
            >
              <Text
                style={[
                  s.tabLabel,
                  {
                    color:
                      tab === tb.key ? t.text : t.textTertiary,
                  },
                ]}
              >
                {tb.label}
              </Text>
              <Text
                style={[
                  s.tabCount,
                  {
                    color:
                      tab === tb.key
                        ? t.textSecondary
                        : t.textTertiary,
                  },
                ]}
              >
                {tb.count}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Role Filter ── */}
        {tab === "draft" && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterRow}
          >
            {([
              { key: "all" as const, label: "All" },
              { key: "BAT" as const, label: "🏏 Batsmen" },
              { key: "BOWL" as const, label: "🎯 Bowlers" },
              { key: "AR" as const, label: "⚡ All-Round" },
              { key: "WK" as const, label: "🧤 Keepers" },
            ]).map((f) => (
              <Pressable
                key={f.key}
                onPress={() => setRoleFilter(f.key)}
                style={[
                  s.filterPill,
                  {
                    backgroundColor:
                      roleFilter === f.key ? t.text : t.bgSurface,
                    borderColor:
                      roleFilter === f.key ? t.text : t.border,
                  },
                ]}
              >
                <Text
                  style={[
                    s.filterPillText,
                    {
                      color:
                        roleFilter === f.key
                          ? t.bg
                          : t.textSecondary,
                    },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* ── Player List ── */}
        <View style={s.playerList}>
          {tab === "draft" ? (
            filtered.length > 0 ? (
              filtered.map((p, i) => {
                const rs = roles[p.role];
                return (
                  <Animated.View
                    key={p.id}
                    entering={FadeInDown.delay(60 + i * 40).springify()}
                  >
                    <View
                      style={[
                        s.playerCard,
                        {
                          backgroundColor: t.bgSurface,
                          borderColor: t.border,
                        },
                      ]}
                    >
                      <InitialsAvatar
                        name={p.name}
                        role={p.role}
                        ovr={p.ovr}
                        roleColors={roles}
                        textPrimary={t.text}
                        bg={t.bg}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[
                            s.playerName,
                            { color: t.text },
                          ]}
                        >
                          {p.name}
                        </Text>
                        <View style={s.playerMeta}>
                          <View
                            style={[
                              s.roleBadge,
                              {
                                backgroundColor: rs.lightBg,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                s.roleBadgeText,
                                { color: rs.lightText },
                              ]}
                            >
                              {p.role}
                            </Text>
                          </View>
                          <Text
                            style={[
                              s.teamCode,
                              { color: t.textTertiary },
                            ]}
                          >
                            {p.team}
                          </Text>
                          <Text style={{ color: t.border }}>·</Text>
                          {Object.entries(p.stats).map(([k, v]) => (
                            <StatLabel
                              key={k}
                              label={k}
                              value={v}
                              textPrimary={t.text}
                              textMuted={t.textTertiary}
                            />
                          ))}
                        </View>
                      </View>
                      <Pressable
                        onPress={() => handleDraft(p)}
                        style={[
                          s.draftBtn,
                          { backgroundColor: t.bgSurfaceAlt },
                        ]}
                      >
                        <Text
                          style={[
                            s.draftBtnText,
                            { color: t.textTertiary },
                          ]}
                        >
                          draft
                        </Text>
                      </Pressable>
                    </View>
                  </Animated.View>
                );
              })
            ) : (
              <View style={s.emptyState}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>🏏</Text>
                <Text
                  style={[
                    s.emptyText,
                    { color: t.textTertiary },
                  ]}
                >
                  no players in this role
                </Text>
              </View>
            )
          ) : myTeam.length > 0 ? (
            myTeam.map((p, i) => {
              const rs = roles[p.role];
              return (
                <Animated.View
                  key={p.id}
                  entering={FadeInDown.delay(60 + i * 40).springify()}
                >
                  <View
                    style={[
                      s.playerCard,
                      {
                        backgroundColor: t.bgSurface,
                        borderColor: t.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.squadIndex,
                        { color: t.textTertiary },
                      ]}
                    >
                      {i + 1}
                    </Text>
                    <InitialsAvatar
                      name={p.name}
                      role={p.role}
                      ovr={p.ovr}
                      size={40}
                      roleColors={roles}
                      textPrimary={t.text}
                      bg={t.bg}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          s.playerName,
                          { color: t.text },
                        ]}
                      >
                        {p.name}
                      </Text>
                      <View style={s.playerMeta}>
                        <View
                          style={[
                            s.roleBadge,
                            { backgroundColor: rs.lightBg },
                          ]}
                        >
                          <Text
                            style={[
                              s.roleBadgeText,
                              { color: rs.lightText },
                            ]}
                          >
                            {p.role}
                          </Text>
                        </View>
                        <Text
                          style={[
                            s.teamCode,
                            { color: t.textTertiary },
                          ]}
                        >
                          {p.team}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              );
            })
          ) : (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🥚</Text>
              <Text
                style={[
                  s.emptyText,
                  { color: t.textTertiary },
                ]}
              >
                draft cricketers to hatch your squad
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  headerLogoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoText: {
    fontFamily: FontFamily.mono,
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: -0.5,
  },
  cricketBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  cricketBadgeText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    fontWeight: "600",
  },
  subtitle: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    marginTop: 3,
    marginLeft: 30,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  // Mode toggle
  modeToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    position: "relative",
  },
  modeKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    position: "absolute",
    top: 3,
    alignItems: "center",
    justifyContent: "center",
  },

  // Clock
  clockMeta: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
  },
  clockTime: {
    fontFamily: FontFamily.mono,
    fontSize: 22,
    fontWeight: "500",
    letterSpacing: 1,
    lineHeight: 28,
  },

  // Happiness
  happinessCard: {
    marginHorizontal: Spacing.lg,
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
  },
  happinessRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  happinessLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Tabs
  tabContainer: {
    flexDirection: "row",
    gap: 4,
    marginHorizontal: Spacing.lg,
    marginBottom: 14,
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabBtnActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
  },
  tabCount: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
  },

  // Role filter
  filterRow: {
    paddingHorizontal: Spacing.lg,
    gap: 6,
    paddingBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    fontWeight: "500",
  },

  // Player list
  playerList: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  playerCard: {
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
  },
  playerName: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 14,
    marginBottom: 3,
  },
  playerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontFamily: FontFamily.mono,
    fontWeight: "600",
    fontSize: 10,
  },
  teamCode: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
  },
  squadIndex: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    width: 20,
    textAlign: "center",
  },

  // Draft button
  draftBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
  },
  draftBtnText: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    fontWeight: "500",
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontFamily: FontFamily.mono,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
  },
});
