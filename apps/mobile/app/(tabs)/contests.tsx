import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { Colors, Radius, Spacing, Font, FontFamily, card } from "../../lib/design";

// ─── Match-based contest browser card ──────────────────────────────────
function MatchContestCard({ match, index, onPress }: { match: any; index: number; onPress: () => void }) {
  const teamA = match.teamA || match.teamHome || "TBA";
  const teamB = match.teamB || match.teamAway || "TBA";
  const tournament = match.tournamentName || match.tournament || "Cricket";
  const isLive = match.status === "live";

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable onPress={onPress} style={({ pressed, hovered }) => [
        s.matchContest,
        hovered && { backgroundColor: Colors.bgSurfaceHover },
        pressed && { backgroundColor: Colors.bgSurfacePress, transform: [{ scale: 0.98 }] },
      ]}>
        <View style={s.mcHeader}>
          <View style={s.tournamentBadge}>
            <Text style={s.tournamentText}>{tournament}</Text>
          </View>
          <View style={[s.statusDot, { backgroundColor: isLive ? Colors.red : Colors.blue }]}>
            <Text style={s.statusDotText}>{isLive ? "LIVE" : "UPCOMING"}</Text>
          </View>
        </View>
        <Text style={s.mcTeams}>{teamA} vs {teamB}</Text>
        <View style={s.mcFooter}>
          <View style={s.mcInfo}>
            <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
            <Text style={s.mcTime}>{match.time || "TBD"}</Text>
          </View>
          {match.format && (
            <View style={s.formatBadge}>
              <Text style={s.formatText}>{match.format}</Text>
            </View>
          )}
          <Pressable onPress={onPress} style={({ hovered }) => [s.joinBtn, hovered && { opacity: 0.85 }]}>
            <Text style={s.joinText}>Draft</Text>
            <Ionicons name="chevron-forward" size={12} color={Colors.textInverse} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── User's contest card ───────────────────────────────────────────────
function UserContestCard({ item, index, onPress }: { item: any; index: number; onPress: () => void }) {
  const contest = item.contest;
  const match = contest?.match;
  const status = contest?.status ?? "open";
  const sc: Record<string, { color: string; bg: string }> = {
    live: { color: Colors.red, bg: Colors.redMuted },
    settled: { color: Colors.accent, bg: Colors.accentMuted },
    open: { color: Colors.amber, bg: Colors.amberMuted },
    upcoming: { color: Colors.cyan, bg: "rgba(93, 168, 184, 0.1)" },
  };
  const cfg = sc[status] ?? sc.open;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable onPress={onPress} style={({ pressed, hovered }) => [
        s.contestCard,
        hovered && { backgroundColor: Colors.bgSurfaceHover },
        pressed && { backgroundColor: Colors.bgSurfacePress, transform: [{ scale: 0.98 }] },
      ]}>
        <View style={s.contestTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.contestName} numberOfLines={1}>{contest?.name ?? "Contest"}</Text>
            {match && <Text style={s.contestMatch}>{match.teamHome} vs {match.teamAway}</Text>}
          </View>
          <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[s.statusText, { color: cfg.color }]}>{status.toUpperCase()}</Text>
          </View>
        </View>
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statLabel}>Points</Text>
            <Text style={s.statVal}>{item.totalPoints.toFixed(1)}</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={s.statLabel}>Prize Pool</Text>
            <Text style={[s.statVal, { color: Colors.accent }]}>
              {contest ? (contest.prizePool > 0 ? `₹${contest.prizePool.toLocaleString()}` : "FREE") : "-"}
            </Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={s.statLabel}>Entry</Text>
            <Text style={s.statVal}>
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
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={[s.accentBar, { backgroundColor: Colors.amber }]} />
          <Text style={s.headerTitle}>Contests</Text>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={s.tabs}>
        <Pressable
          onPress={() => setTab("browse")}
          style={[s.tab, tab === "browse" && s.tabActive]}
        >
          <Text style={[s.tabText, tab === "browse" && s.tabTextActive]}>Browse Matches</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("my")}
          style={[s.tab, tab === "my" && s.tabActive]}
        >
          <Text style={[s.tabText, tab === "my" && s.tabTextActive]}>
            My Contests{userContests.length > 0 ? ` (${userContests.length})` : ""}
          </Text>
        </Pressable>
      </View>

      {tab === "browse" ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 120 }}
        >
          {aiData.isLoading ? (
            <ActivityIndicator color={Colors.accent} style={{ paddingVertical: 40 }} />
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
              <Ionicons name="trophy-outline" size={36} color={Colors.textTertiary} />
              <Text style={s.emptyTitle}>No available matches</Text>
              <Text style={s.emptyDesc}>Contests will appear when matches are scheduled</Text>
            </Animated.View>
          )}
        </ScrollView>
      ) : (
        /* My Contests */
        isUnauth ? (
          <Animated.View entering={FadeIn.delay(80)} style={s.empty}>
            <Ionicons name="trophy-outline" size={40} color={Colors.textTertiary} />
            <Text style={s.emptyTitle}>Sign in to view contests</Text>
            <Text style={s.emptyDesc}>Create and track your fantasy contests</Text>
            <Pressable
              onPress={() => router.push("/auth/login")}
              style={({ hovered }) => [s.primaryBtn, hovered && { opacity: 0.85 }]}
            >
              <Text style={s.primaryBtnText}>Sign In</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.textInverse} />
            </Pressable>
          </Animated.View>
        ) : myContests.isLoading ? (
          <View style={s.centered}>
            <ActivityIndicator color={Colors.accent} size="large" />
          </View>
        ) : userContests.length === 0 ? (
          <Animated.View entering={FadeIn.delay(80)} style={s.empty}>
            <Ionicons name="trophy-outline" size={40} color={Colors.textTertiary} />
            <Text style={s.emptyTitle}>No contests yet</Text>
            <Text style={s.emptyDesc}>Browse matches and join your first contest</Text>
            <Pressable onPress={() => setTab("browse")} style={({ hovered }) => [s.primaryBtn, hovered && { opacity: 0.85 }]}>
              <Text style={s.primaryBtnText}>Browse Matches</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <FlatList
            data={userContests}
            keyExtractor={(i) => i.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
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
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header — consistent with other tabs
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  accentBar: { width: 4, height: 20, borderRadius: 2 },
  headerTitle: { fontFamily: FontFamily.headingBold, fontSize: Font["2xl"], color: Colors.text },

  // Tabs
  tabs: {
    flexDirection: "row",
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: Radius.xs,
  },
  tabActive: {
    backgroundColor: Colors.bgSurfacePress,
  },
  tabText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: Font.sm,
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.text,
  },

  // Match-based contest card — consistent card style
  matchContest: { ...card, marginBottom: Spacing.md, padding: Spacing["2xl"] },
  mcHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  tournamentBadge: { backgroundColor: Colors.accentMuted, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.xl },
  tournamentText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, color: Colors.accent, textTransform: "uppercase", letterSpacing: 0.5 },
  statusDot: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.xl },
  statusDotText: { fontFamily: FontFamily.bodyBold, fontSize: 9, color: Colors.text, letterSpacing: 0.3 },
  mcTeams: { fontFamily: FontFamily.heading, fontSize: Font.xl, color: Colors.text, marginBottom: Spacing.lg },
  mcFooter: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  mcInfo: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  mcTime: { fontFamily: FontFamily.body, fontSize: Font.sm, color: Colors.textTertiary },
  formatBadge: { backgroundColor: Colors.bgSurfacePress, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.xl },
  formatText: { fontFamily: FontFamily.bodySemiBold, fontSize: 10, color: Colors.textSecondary, letterSpacing: 0.3 },
  joinBtn: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: Colors.accent, paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.sm,
  },
  joinText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm, color: Colors.textInverse },

  // User contest card
  contestCard: { ...card, marginBottom: Spacing.md, overflow: "hidden" },
  contestTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: Spacing["2xl"], paddingBottom: Spacing.md },
  contestName: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.lg, color: Colors.text, marginBottom: 2 },
  contestMatch: { fontFamily: FontFamily.body, fontSize: Font.sm, color: Colors.textSecondary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.xl },
  statusText: { fontFamily: FontFamily.bodyBold, fontSize: Font.xs, letterSpacing: 0.3 },
  statsRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: Spacing.md, marginHorizontal: Spacing["2xl"] },
  stat: { flex: 1, alignItems: "center" },
  statLabel: { fontFamily: FontFamily.body, fontSize: Font.xs, color: Colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  statVal: { fontFamily: FontFamily.bodyBold, fontSize: Font.lg, color: Colors.text },
  statDiv: { width: 1, backgroundColor: Colors.border },

  // Empty
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: Spacing["3xl"], gap: Spacing.md },
  emptyBlock: { alignItems: "center", gap: Spacing.md, paddingVertical: Spacing["4xl"] },
  emptyTitle: { fontFamily: FontFamily.heading, fontSize: Font.xl, color: Colors.text },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: Font.md, color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    backgroundColor: Colors.accent, paddingHorizontal: Spacing["2xl"], paddingVertical: Spacing.md, borderRadius: Radius.sm, marginTop: Spacing.md,
  },
  primaryBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md, color: Colors.textInverse },
});
