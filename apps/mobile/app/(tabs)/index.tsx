import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { Colors, Radius, Spacing, Font, FontFamily, card } from "../../lib/design";

const { width: SCREEN_W } = Dimensions.get("window");
const MATCH_CARD_W = SCREEN_W * 0.82;

// ─── Pulsing Dot (for REAL-TIME indicator) ────────────────────────────
function PulsingDot({ color = Colors.red, size = 6 }: { color?: string; size?: number }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.8, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: size * 2, height: size * 2, borderRadius: size, backgroundColor: color }, ring]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

// ─── Section Header with accent bar ───────────────────────────────────
function SectionHeader({
  title,
  accentColor = Colors.accent,
  right,
  delay = 0,
}: {
  title: string;
  accentColor?: string;
  right?: React.ReactNode;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={s.sectionHeader}>
      <View style={s.sectionTitleRow}>
        <View style={[s.accentBar, { backgroundColor: accentColor }]} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {right}
    </Animated.View>
  );
}

// ─── Match Card (horizontal scroll) ──────────────────────────────────
function MatchCard({
  match,
  index,
  onPress,
}: {
  match: any;
  index: number;
  onPress: () => void;
}) {
  const isLive = match.status === "live";
  const statusColor = isLive ? Colors.red : Colors.blue;
  const statusLabel = (match.status || "upcoming").toUpperCase();

  return (
    <Animated.View entering={FadeInRight.delay(index * 100).springify()}>
      <Pressable
        onPress={onPress}
        style={({ pressed, hovered }) => [
          s.matchCard,
          hovered && s.cardHover,
          pressed && s.cardPress,
        ]}
      >
        {/* Background — gradient simulating a cricket field */}
        <LinearGradient
          colors={["#1B4D2E", "#0D2818", "#0A1628"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.matchCardImage}
        >
          <View style={s.cricketBallOverlay}>
            <Ionicons name="baseball-outline" size={60} color="rgba(255,255,255,0.06)" />
          </View>
          <View style={[s.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={s.statusBadgeText}>{statusLabel}</Text>
          </View>
        </LinearGradient>

        <View style={s.matchCardContent}>
          <Text style={s.matchTournament} numberOfLines={1}>
            {match.tournamentName || match.tournament || "Cricket"}
          </Text>
          <Text style={s.matchTeams} numberOfLines={1}>
            {match.teamA || match.teamHome} vs {match.teamB || match.teamAway}
          </Text>

          {match.scoreSummary && (
            <Text style={s.matchScore}>{match.scoreSummary}</Text>
          )}

          <View style={s.matchCardFooter}>
            <View style={s.timeRow}>
              <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
              <Text style={s.matchTime}>{match.time || "TBD"}</Text>
            </View>
            <Pressable
              onPress={onPress}
              style={({ hovered }) => [s.draftBtn, hovered && s.draftBtnHover]}
            >
              <Text style={s.draftBtnText}>{isLive ? "Watch" : "Draft Now"}</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Tournament Card ──────────────────────────────────────────────────
function TournamentCard({
  tournament,
  index,
  onPress,
}: {
  tournament: any;
  index: number;
  onPress: () => void;
}) {
  const categoryColors: Record<string, string> = {
    international: Colors.accent,
    domestic: Colors.amber,
    league: Colors.blue,
    bilateral: Colors.cyan,
    qualifier: Colors.purple,
    friendly: Colors.textTertiary,
  };
  const color = categoryColors[tournament.category] || Colors.accent;

  return (
    <Animated.View
      entering={FadeInDown.delay(200 + index * 80).springify()}
      style={s.tournamentCardWrap}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed, hovered }) => [
          s.tournamentCard,
          hovered && s.cardHover,
          pressed && s.cardPress,
        ]}
      >
        <LinearGradient
          colors={["#1A2332", "#0E1D35"]}
          style={s.tournamentImage}
        >
          <Ionicons name="trophy" size={36} color="rgba(255,255,255,0.08)" />
        </LinearGradient>

        <View style={[s.categoryBadge, { backgroundColor: color }]}>
          <Text style={s.categoryText}>
            {(tournament.category || "league").toUpperCase()}
          </Text>
        </View>

        <Text style={s.tournamentName} numberOfLines={2}>
          {tournament.name}
        </Text>

        <Pressable onPress={onPress} style={s.viewSchedule}>
          <Text style={s.viewScheduleText}>View Schedule</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.accent} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

// ─── Scroll Progress Bar ──────────────────────────────────────────────
function ScrollProgressBar({
  total,
  scrollX,
}: {
  total: number;
  scrollX: number;
}) {
  if (total <= 1) return null;
  const maxScroll = (total - 1) * (MATCH_CARD_W + 12);
  const progress = maxScroll > 0 ? Math.min(scrollX / maxScroll, 1) : 0;

  return (
    <View style={s.progressBarWrap}>
      <View style={s.progressBarTrack}>
        <View
          style={[
            s.progressBarFill,
            { width: `${Math.max(20, progress * 100)}%` },
          ]}
        />
      </View>
    </View>
  );
}

// ─── Main Home Screen ─────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [scrollX, setScrollX] = useState(0);

  // Fetch from Gemini-backed sports endpoint (cached 24hr server-side, 1hr client-side)
  const dashboard = trpc.sports.dashboard.useQuery(
    { sport: "cricket" },
    { staleTime: 60 * 60 * 1000, retry: 1 }
  );

  // Also fetch DB matches as fallback
  const dbLive = trpc.match.live.useQuery(undefined, { retry: false });
  const dbUpcoming = trpc.match.list.useQuery(
    { status: "upcoming", limit: 10 },
    { retry: false }
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([dashboard.refetch(), dbLive.refetch(), dbUpcoming.refetch()]);
    setRefreshing(false);
  }, [dashboard, dbLive, dbUpcoming]);

  // Merge AI matches with DB matches for display
  const aiMatches = dashboard.data?.matches ?? [];
  const aiTournaments = dashboard.data?.tournaments ?? [];
  const dbLiveData = dbLive.data ?? [];
  const dbUpcomingData = dbUpcoming.data?.matches ?? [];

  // Prefer AI data; fall back to DB data if AI returns empty
  const todayMatches = aiMatches.length > 0 ? aiMatches : [
    ...dbLiveData.map((m: any) => ({
      id: m.id,
      teamA: m.teamHome,
      teamB: m.teamAway,
      tournamentName: m.tournament,
      time: new Date(m.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      date: new Date(m.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      status: m.status,
      format: m.format?.toUpperCase() || "T20",
      venue: m.venue,
      sport: "cricket" as const,
      scoreSummary: null,
      sourceUrl: null,
    })),
    ...dbUpcomingData.map((m: any) => ({
      id: m.id,
      teamA: m.teamHome,
      teamB: m.teamAway,
      tournamentName: m.tournament,
      time: new Date(m.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      date: new Date(m.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      status: m.status,
      format: m.format?.toUpperCase() || "T20",
      venue: m.venue,
      sport: "cricket" as const,
      scoreSummary: null,
      sourceUrl: null,
    })),
  ];

  const liveMatches = todayMatches.filter((m) => m.status === "live");
  const upcomingMatches = todayMatches.filter((m) => m.status === "upcoming");
  const allDisplayMatches = [...liveMatches, ...upcomingMatches];
  const hasLive = liveMatches.length > 0;

  const isLoading = dashboard.isLoading && dbLive.isLoading;

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(0).springify()} style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={s.headerLeft}>
            <View style={s.logoIcon}>
              <Ionicons name="trophy" size={16} color={Colors.accent} />
            </View>
            <View>
              <Text style={s.logoText}>
                <Text style={s.logoBold}>DRAFT</Text>
                <Text style={s.logoLight}>CRICK</Text>
              </Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Pressable
              onPress={() => router.push("/guru" as never)}
              style={({ hovered }) => [s.headerBtn, hovered && s.headerBtnHover]}
            >
              <Ionicons name="sparkles" size={18} color={Colors.accent} />
            </Pressable>
            <Pressable
              onPress={() => router.push("/(tabs)/profile")}
              style={({ hovered }) => [s.avatarBtn, hovered && { borderColor: Colors.accent }]}
            >
              <Ionicons name="person" size={16} color={Colors.textSecondary} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Today's Live Matches */}
        <SectionHeader
          title="Today's Live Matches"
          delay={60}
          right={
            hasLive ? (
              <View style={s.realTimeBadge}>
                <PulsingDot color={Colors.red} size={4} />
                <Text style={s.realTimeText}>REAL-TIME</Text>
              </View>
            ) : undefined
          }
        />

        {isLoading ? (
          <ActivityIndicator color={Colors.accent} style={{ paddingVertical: 40 }} />
        ) : allDisplayMatches.length > 0 ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: 12 }}
              decelerationRate="fast"
              snapToInterval={MATCH_CARD_W + 12}
              onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
              scrollEventThrottle={16}
            >
              {allDisplayMatches.map((m, i) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  index={i}
                  onPress={() => {
                    if (m.id.startsWith("ai-")) {
                      router.push("/(tabs)/contests");
                    } else {
                      router.push(`/match/${m.id}`);
                    }
                  }}
                />
              ))}
            </ScrollView>
            <ScrollProgressBar
              total={allDisplayMatches.length}
              scrollX={scrollX}
            />
          </>
        ) : (
          <Animated.View entering={FadeInDown.delay(100)} style={s.emptyMatches}>
            <Ionicons name="calendar-outline" size={32} color={Colors.textTertiary} />
            <Text style={s.emptyTitle}>No matches scheduled</Text>
            <Text style={s.emptyDesc}>Check back soon for upcoming fixtures</Text>
          </Animated.View>
        )}

        {/* Current Tournaments */}
        {aiTournaments.length > 0 && (
          <>
            <SectionHeader title="Current Tournaments" accentColor={Colors.amber} delay={200} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: 12 }}
            >
              {aiTournaments.map((t, i) => (
                <TournamentCard
                  key={t.id}
                  tournament={t}
                  index={i}
                  onPress={() => router.push("/(tabs)/contests")}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* Quick Actions */}
        <View style={{ marginTop: Spacing["2xl"] }}>
          <SectionHeader title="Quick Actions" delay={300} />
          <View style={s.quickGrid}>
            {([
              { icon: "trophy-outline" as const, label: "Contests", route: "/(tabs)/contests" },
              { icon: "pulse-outline" as const, label: "Live", route: "/(tabs)/live" },
              { icon: "people-outline" as const, label: "Leagues", route: "/(tabs)/social" },
              { icon: "sparkles-outline" as const, label: "Guru", route: "/guru" },
            ] as const).map((item, i) => (
              <Animated.View key={item.label} entering={FadeInDown.delay(320 + i * 40).springify()} style={{ flex: 1 }}>
                <Pressable
                  onPress={() => router.push(item.route as never)}
                  style={({ pressed, hovered }) => [
                    s.quickAction,
                    hovered && s.cardHover,
                    pressed && s.cardPress,
                  ]}
                >
                  <Ionicons name={item.icon} size={22} color={Colors.accent} />
                  <Text style={s.quickLabel}>{item.label}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Powered by Gemini */}
        <Animated.View entering={FadeInDown.delay(400)} style={s.geminiFooter}>
          <Text style={s.geminiText}>DATA SOURCES POWERED BY GEMINI</Text>
          {dashboard.data?.lastFetched && (
            <Text style={s.lastUpdated}>
              Last updated: {new Date(dashboard.data.lastFetched).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { fontSize: Font.lg, letterSpacing: 1 },
  logoBold: { fontFamily: FontFamily.headingBold, color: Colors.text },
  logoLight: { fontFamily: FontFamily.heading, color: Colors.accent },
  headerRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnHover: { backgroundColor: Colors.bgSurfaceHover },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgSurface,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    marginTop: Spacing.lg,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  accentBar: { width: 4, height: 22, borderRadius: 2 },
  sectionTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: Font.xl,
    color: Colors.text,
  },
  realTimeBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  realTimeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: Font.xs,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },

  // Match cards
  matchCard: {
    width: MATCH_CARD_W,
    ...card,
    overflow: "hidden",
  },
  cardHover: { backgroundColor: Colors.bgSurfaceHover },
  cardPress: { backgroundColor: Colors.bgSurfacePress, transform: [{ scale: 0.98 }] },

  matchCardImage: {
    height: 140,
    justifyContent: "flex-start",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  cricketBallOverlay: {
    position: "absolute",
    right: 20,
    top: 20,
    opacity: 0.6,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  statusBadgeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: Font.xs,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },

  matchCardContent: { padding: Spacing.lg },
  matchTournament: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: Font.xs,
    color: Colors.blue,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  matchTeams: {
    fontFamily: FontFamily.headingBold,
    fontSize: Font.xl,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  matchScore: {
    fontFamily: FontFamily.bodyBold,
    fontSize: Font.md,
    color: Colors.amber,
    marginBottom: Spacing.sm,
  },
  matchCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  matchTime: {
    fontFamily: FontFamily.body,
    fontSize: Font.sm,
    color: Colors.textTertiary,
  },
  draftBtn: {
    backgroundColor: Colors.red,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  draftBtnHover: { backgroundColor: "#E04040" },
  draftBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: Font.sm,
    color: "#FFFFFF",
  },

  // Scroll progress
  progressBarWrap: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  progressBarTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.bgSurface,
  },
  progressBarFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.accent,
  },

  // Tournament cards
  tournamentCardWrap: { width: SCREEN_W * 0.6 },
  tournamentCard: {
    ...card,
    overflow: "hidden",
  },
  tournamentImage: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryBadge: {
    alignSelf: "flex-start",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  categoryText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  tournamentName: {
    fontFamily: FontFamily.headingBold,
    fontSize: Font.lg,
    color: Colors.text,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  viewSchedule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  viewScheduleText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: Font.sm,
    color: Colors.accent,
  },

  // Quick actions
  quickGrid: { flexDirection: "row", paddingHorizontal: Spacing.xl, gap: Spacing.md },
  quickAction: {
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    ...card,
  },
  quickLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: Font.sm,
    color: Colors.textSecondary,
  },

  // Gemini footer
  geminiFooter: {
    marginTop: Spacing["3xl"],
    marginHorizontal: Spacing.xl,
    ...card,
    padding: Spacing.lg,
    alignItems: "center",
  },
  geminiText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: Font.xs,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
  },
  lastUpdated: {
    fontFamily: FontFamily.body,
    fontSize: Font.xs,
    color: Colors.textTertiary,
    marginTop: 4,
  },

  // Empty states
  emptyMatches: {
    marginHorizontal: Spacing.xl,
    padding: Spacing["3xl"],
    ...card,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: FontFamily.heading,
    fontSize: Font.lg,
    color: Colors.text,
  },
  emptyDesc: {
    fontFamily: FontFamily.body,
    fontSize: Font.md,
    color: Colors.textTertiary,
    textAlign: "center",
  },
});
