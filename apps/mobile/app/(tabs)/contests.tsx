import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { Radius, Spacing, Font, FontFamily } from "../../lib/design";
import { useTheme } from "../../providers/ThemeProvider";

// ─── Match-based contest browser card ──────────────────────────────────
function MatchContestCard({ match, index, onPress }: { match: any; index: number; onPress: () => void }) {
  const { t } = useTheme();
  const teamA = match.teamA || match.teamHome || "TBA";
  const teamB = match.teamB || match.teamAway || "TBA";
  const tournament = match.tournamentName || match.tournament || "Cricket";
  const isLive = match.status === "live";

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable onPress={onPress} style={({ pressed, hovered }) => [
        s.matchContest,
        { backgroundColor: t.bgSurface, borderColor: t.border },
        hovered && { backgroundColor: t.bgSurfaceHover },
        pressed && { backgroundColor: t.bgSurfacePress, transform: [{ scale: 0.98 }] },
      ]}>
        <View style={s.mcHeader}>
          <View style={[s.tournamentBadge, { backgroundColor: t.accentMuted }]}>
            <Text style={[s.tournamentText, { color: t.accent }]}>{tournament}</Text>
          </View>
          <View style={[s.statusDot, { backgroundColor: isLive ? t.red : t.blue }]}>
            <Text style={[s.statusDotText, { color: t.text }]}>{isLive ? "LIVE" : "UPCOMING"}</Text>
          </View>
        </View>
        <Text style={[s.mcTeams, { color: t.text }]}>{teamA} vs {teamB}</Text>
        <View style={[s.mcFooter, { borderTopColor: t.border }]}>
          <View style={s.mcInfo}>
            <Ionicons name="time-outline" size={12} color={t.textTertiary} />
            <Text style={[s.mcTime, { color: t.textTertiary }]}>{match.time || "TBD"}</Text>
          </View>
          {match.format && (
            <View style={[s.formatBadge, { backgroundColor: t.bgSurfacePress }]}>
              <Text style={[s.formatText, { color: t.textSecondary }]}>{match.format}</Text>
            </View>
          )}
          <Pressable onPress={onPress} style={({ hovered }) => [s.joinBtn, { backgroundColor: t.accent }, hovered && { opacity: 0.85 }]}>
            <Text style={[s.joinText, { color: t.textInverse }]}>Draft</Text>
            <Ionicons name="chevron-forward" size={12} color={t.textInverse} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── User's contest card ───────────────────────────────────────────────
function UserContestCard({ item, index, onPress }: { item: any; index: number; onPress: () => void }) {
  const { t } = useTheme();
  const contest = item.contest;
  const match = contest?.match;
  const status = contest?.status ?? "open";
  const sc: Record<string, { color: string; bg: string }> = {
    live: { color: t.red, bg: t.redMuted },
    settled: { color: t.accent, bg: t.accentMuted },
    open: { color: t.amber, bg: t.amberMuted },
    upcoming: { color: t.cyan, bg: "rgba(93, 168, 184, 0.1)" },
  };
  const cfg = sc[status] ?? sc.open;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable onPress={onPress} style={({ pressed, hovered }) => [
        s.contestCard,
        { backgroundColor: t.bgSurface, borderColor: t.border },
        hovered && { backgroundColor: t.bgSurfaceHover },
        pressed && { backgroundColor: t.bgSurfacePress, transform: [{ scale: 0.98 }] },
      ]}>
        <View style={s.contestTop}>
          <View style={{ flex: 1 }}>
            <Text style={[s.contestName, { color: t.text }]} numberOfLines={1}>{contest?.name ?? "Contest"}</Text>
            {match && <Text style={[s.contestMatch, { color: t.textSecondary }]}>{match.teamHome} vs {match.teamAway}</Text>}
          </View>
          <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[s.statusText, { color: cfg.color }]}>{status.toUpperCase()}</Text>
          </View>
        </View>
        <View style={[s.statsRow, { borderTopColor: t.border }]}>
          <View style={s.stat}>
            <Text style={[s.statLabel, { color: t.textTertiary }]}>Points</Text>
            <Text style={[s.statVal, { color: t.text }]}>{item.totalPoints.toFixed(1)}</Text>
          </View>
          <View style={[s.statDiv, { backgroundColor: t.border }]} />
          <View style={s.stat}>
            <Text style={[s.statLabel, { color: t.textTertiary }]}>Prize Pool</Text>
            <Text style={[s.statVal, { color: t.accent }]}>
              {contest ? (contest.prizePool > 0 ? `₹${contest.prizePool.toLocaleString()}` : "FREE") : "-"}
            </Text>
          </View>
          <View style={[s.statDiv, { backgroundColor: t.border }]} />
          <View style={s.stat}>
            <Text style={[s.statLabel, { color: t.textTertiary }]}>Entry</Text>
            <Text style={[s.statVal, { color: t.text }]}>
              {contest ? (contest.entryFee === 0 ? "FREE" : `₹${contest.entryFee}`) : "-"}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function ContestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"browse" | "my">("browse");

  // Gemini AI-powered match data for browsing
  const aiData = trpc.sports.dashboard.useQuery(
    { sport: "cricket" },
    { staleTime: 60 * 60 * 1000, retry: 1 }
  );

  // User's contests
  const myContests = trpc.contest.myContests.useQuery(undefined, { retry: false });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([aiData.refetch(), myContests.refetch()]);
    setRefreshing(false);
  }, [aiData, myContests]);

  const isUnauth = myContests.error?.data?.code === "UNAUTHORIZED";
  const aiMatches = aiData.data?.matches?.filter((m) => m.status === "upcoming" || m.status === "live") ?? [];
  const userContests = myContests.data ?? [];

  return (
    <View style={[s.container, { paddingTop: insets.top, backgroundColor: t.bg }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: t.borderSubtle }]}>
        <View style={s.headerLeft}>
          <View style={[s.accentBar, { backgroundColor: t.amber }]} />
          <Text style={[s.headerTitle, { color: t.text }]}>Contests</Text>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={[s.tabs, { backgroundColor: t.bgSurface, borderColor: t.border }]}>
        <Pressable
          onPress={() => setTab("browse")}
          style={[s.tab, tab === "browse" && [s.tabActive, { backgroundColor: t.bgSurfacePress }]]}
        >
          <Text style={[s.tabText, { color: t.textTertiary }, tab === "browse" && { color: t.text }]}>Browse Matches</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("my")}
          style={[s.tab, tab === "my" && [s.tabActive, { backgroundColor: t.bgSurfacePress }]]}
        >
          <Text style={[s.tabText, { color: t.textTertiary }, tab === "my" && { color: t.text }]}>
            My Contests{userContests.length > 0 ? ` (${userContests.length})` : ""}
          </Text>
        </Pressable>
      </View>

      {tab === "browse" ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
          contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 120 }}
        >
          {aiData.isLoading ? (
            <ActivityIndicator color={t.accent} style={{ paddingVertical: 40 }} />
          ) : aiMatches.length > 0 ? (
            aiMatches.map((m, i) => (
              <MatchContestCard
                key={m.id}
                match={m}
                index={i}
                onPress={() => {
                  if (m.id.startsWith("ai-")) {
                    // AI match — show details
                  } else {
                    router.push(`/match/${m.id}`);
                  }
                }}
              />
            ))
          ) : (
            <Animated.View entering={FadeIn.delay(80)} style={s.emptyBlock}>
              <Ionicons name="trophy-outline" size={36} color={t.textTertiary} />
              <Text style={[s.emptyTitle, { color: t.text }]}>No available matches</Text>
              <Text style={[s.emptyDesc, { color: t.textSecondary }]}>Contests will appear when matches are scheduled</Text>
            </Animated.View>
          )}
        </ScrollView>
      ) : (
        /* My Contests */
        isUnauth ? (
          <Animated.View entering={FadeIn.delay(80)} style={s.empty}>
            <Ionicons name="trophy-outline" size={40} color={t.textTertiary} />
            <Text style={[s.emptyTitle, { color: t.text }]}>Sign in to view contests</Text>
            <Text style={[s.emptyDesc, { color: t.textSecondary }]}>Create and track your fantasy contests</Text>
            <Pressable
              onPress={() => router.push("/auth/login")}
              style={({ hovered }) => [s.primaryBtn, { backgroundColor: t.accent }, hovered && { opacity: 0.85 }]}
            >
              <Text style={[s.primaryBtnText, { color: t.textInverse }]}>Sign In</Text>
              <Ionicons name="arrow-forward" size={14} color={t.textInverse} />
            </Pressable>
          </Animated.View>
        ) : myContests.isLoading ? (
          <View style={s.centered}>
            <ActivityIndicator color={t.accent} size="large" />
          </View>
        ) : userContests.length === 0 ? (
          <Animated.View entering={FadeIn.delay(80)} style={s.empty}>
            <Ionicons name="trophy-outline" size={40} color={t.textTertiary} />
            <Text style={[s.emptyTitle, { color: t.text }]}>No contests yet</Text>
            <Text style={[s.emptyDesc, { color: t.textSecondary }]}>Browse matches and join your first contest</Text>
            <Pressable onPress={() => setTab("browse")} style={({ hovered }) => [s.primaryBtn, { backgroundColor: t.accent }, hovered && { opacity: 0.85 }]}>
              <Text style={[s.primaryBtnText, { color: t.textInverse }]}>Browse Matches</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <FlatList
            data={userContests}
            keyExtractor={(i) => i.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
            contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <UserContestCard item={item} index={index} onPress={() => item.contest ? router.push(`/contest/${item.contest.id}`) : undefined} />
            )}
          />
        )
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header — consistent with other tabs
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  accentBar: { width: 4, height: 20, borderRadius: 2 },
  headerTitle: { fontFamily: FontFamily.headingBold, fontSize: Font["2xl"] },

  // Tabs
  tabs: {
    flexDirection: "row",
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: Radius.xs,
  },
  tabActive: {},
  tabText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: Font.sm,
  },

  // Match-based contest card — card styles applied inline via t
  matchContest: {
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    padding: Spacing["2xl"],
  },
  mcHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  tournamentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.xl },
  tournamentText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, textTransform: "uppercase", letterSpacing: 0.5 },
  statusDot: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.xl },
  statusDotText: { fontFamily: FontFamily.bodyBold, fontSize: 9, letterSpacing: 0.3 },
  mcTeams: { fontFamily: FontFamily.heading, fontSize: Font.xl, marginBottom: Spacing.lg },
  mcFooter: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingTop: Spacing.md, borderTopWidth: 1 },
  mcInfo: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  mcTime: { fontFamily: FontFamily.body, fontSize: Font.sm },
  formatBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.xl },
  formatText: { fontFamily: FontFamily.bodySemiBold, fontSize: 10, letterSpacing: 0.3 },
  joinBtn: {
    flexDirection: "row", alignItems: "center", gap: 2,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.sm,
  },
  joinText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm },

  // User contest card
  contestCard: { borderRadius: Radius.md, borderWidth: 1, marginBottom: Spacing.md, overflow: "hidden" },
  contestTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: Spacing["2xl"], paddingBottom: Spacing.md },
  contestName: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.lg, marginBottom: 2 },
  contestMatch: { fontFamily: FontFamily.body, fontSize: Font.sm },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.xl },
  statusText: { fontFamily: FontFamily.bodyBold, fontSize: Font.xs, letterSpacing: 0.3 },
  statsRow: { flexDirection: "row", borderTopWidth: 1, paddingVertical: Spacing.md, marginHorizontal: Spacing["2xl"] },
  stat: { flex: 1, alignItems: "center" },
  statLabel: { fontFamily: FontFamily.body, fontSize: Font.xs, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  statVal: { fontFamily: FontFamily.bodyBold, fontSize: Font.lg },
  statDiv: { width: 1 },

  // Empty
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: Spacing["3xl"], gap: Spacing.md },
  emptyBlock: { alignItems: "center", gap: Spacing.md, paddingVertical: Spacing["4xl"] },
  emptyTitle: { fontFamily: FontFamily.heading, fontSize: Font.xl },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: Font.md, textAlign: "center", lineHeight: 22 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    paddingHorizontal: Spacing["2xl"], paddingVertical: Spacing.md, borderRadius: Radius.sm, marginTop: Spacing.md,
  },
  primaryBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md },
});
