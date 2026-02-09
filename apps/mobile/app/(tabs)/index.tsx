import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { Colors, Radius, Spacing, Font, FontFamily, card } from "../../lib/design";

// ─── Pulsing Dot ─────────────────────────────────────────────────────
function PulsingDot({ color = Colors.red, size = 6 }: { color?: string; size?: number }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.8, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1, true,
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

// ─── Match Card ──────────────────────────────────────────────────────
function MatchCard({ match, index, onPress }: { match: any; index: number; onPress: () => void }) {
  const isLive = match.status === "live";
  const teamA = match.teamA || match.teamHome || "TBA";
  const teamB = match.teamB || match.teamAway || "TBA";
  const tournament = match.tournamentName || match.tournament || "Cricket";

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 50).springify()}>
      <Pressable
        onPress={onPress}
        style={({ pressed, hovered }) => [
          s.matchCard,
          hovered && { backgroundColor: Colors.bgSurfaceHover },
          pressed && { backgroundColor: Colors.bgSurfacePress, transform: [{ scale: 0.98 }] },
        ]}
      >
        <View style={s.matchHeader}>
          <View style={s.tournBadge}>
            <Text style={s.tournText}>{tournament}</Text>
          </View>
          <View style={s.matchStatus}>
            {isLive && <PulsingDot size={4} />}
            <Text style={[s.statusLabel, { color: isLive ? Colors.red : Colors.blue }]}>
              {(match.status || "upcoming").toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={s.matchTeams}>
          <View style={s.teamSide}>
            <View style={s.teamCircle}>
              <Text style={s.teamInit}>{teamA.substring(0, 3).toUpperCase()}</Text>
            </View>
            <Text style={s.teamName} numberOfLines={1}>{teamA}</Text>
          </View>
          <View style={s.vsCol}>
            <Text style={s.vsText}>VS</Text>
            {match.format && <Text style={s.formatLabel}>{match.format}</Text>}
          </View>
          <View style={s.teamSide}>
            <View style={s.teamCircle}>
              <Text style={s.teamInit}>{teamB.substring(0, 3).toUpperCase()}</Text>
            </View>
            <Text style={s.teamName} numberOfLines={1}>{teamB}</Text>
          </View>
        </View>

        {match.scoreSummary && (
          <Text style={s.scoreSummary}>{match.scoreSummary}</Text>
        )}

        <View style={s.matchFooter}>
          <View style={s.matchMeta}>
            <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
            <Text style={s.matchTime}>{match.time || "TBD"}</Text>
            {match.venue && (
              <>
                <Text style={s.matchDot}>·</Text>
                <Text style={s.matchTime} numberOfLines={1}>{match.venue}</Text>
              </>
            )}
          </View>
          <Pressable
            onPress={onPress}
            style={({ hovered }) => [
              s.draftBtn,
              isLive ? { backgroundColor: Colors.red } : { backgroundColor: Colors.accent },
              hovered && { opacity: 0.85 },
            ]}
          >
            <Text style={[s.draftBtnText, isLive ? { color: "#FFF" } : { color: Colors.textInverse }]}>
              {isLive ? "Watch" : "Draft"}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Tournament Card ─────────────────────────────────────────────────
function TournamentCard({ tournament, index, onPress }: { tournament: any; index: number; onPress: () => void }) {
  const catColors: Record<string, string> = {
    international: Colors.blue,
    domestic: Colors.amber,
    league: Colors.accent,
    bilateral: Colors.cyan,
    qualifier: Colors.purple,
  };
  const cat = (tournament.category || "league").toLowerCase();
  const color = catColors[cat] || Colors.accent;

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 50).springify()}>
      <Pressable
        onPress={onPress}
        style={({ pressed, hovered }) => [
          s.tournCard,
          hovered && { backgroundColor: Colors.bgSurfaceHover },
          pressed && { backgroundColor: Colors.bgSurfacePress, transform: [{ scale: 0.98 }] },
        ]}
      >
        <View style={s.tournCardHeader}>
          <View style={[s.catBadge, { backgroundColor: color + "18" }]}>
            <Text style={[s.catText, { color }]}>{(tournament.category || "league").toUpperCase()}</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
        </View>
        <Text style={s.tournName} numberOfLines={2}>{tournament.name}</Text>
        {(tournament.startDate || tournament.endDate) && (
          <Text style={s.tournDates}>
            {tournament.startDate && new Date(tournament.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            {tournament.endDate && ` — ${new Date(tournament.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Main ────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  // Gemini-powered sports dashboard (cached 24hr server-side)
  const dashboard = trpc.sports.dashboard.useQuery(
    { sport: "cricket" },
    { staleTime: 60 * 60 * 1000, retry: 1 },
  );
  const dbLive = trpc.match.live.useQuery(undefined, { retry: false });
  const dbUp = trpc.match.list.useQuery({ status: "upcoming", limit: 10 }, { retry: false });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([dashboard.refetch(), dbLive.refetch(), dbUp.refetch()]);
    setRefreshing(false);
  }, [dashboard, dbLive, dbUp]);

  // Merge AI + DB data
  const ai = dashboard.data?.matches ?? [];
  const aiT = dashboard.data?.tournaments ?? [];
  const dbLiveD = dbLive.data ?? [];
  const dbUpD = dbUp.data?.matches ?? [];

  const toAI = (m: any) => ({
    id: m.id, teamA: m.teamHome, teamB: m.teamAway, tournamentName: m.tournament,
    time: new Date(m.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    date: new Date(m.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    status: m.status, format: m.format?.toUpperCase() || "T20", venue: m.venue,
    sport: "cricket" as const, scoreSummary: null, sourceUrl: null,
  });

  const matches = ai.length > 0 ? ai : [...dbLiveD.map(toAI), ...dbUpD.map(toAI)];
  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches.filter((m) => m.status === "upcoming");
  const all = [...live, ...upcoming];
  const isLoading = dashboard.isLoading && dbLive.isLoading;

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* ─── Header ─── */}
        <Animated.View entering={FadeIn.delay(0)} style={[s.header, { paddingTop: insets.top + 8 }]}>
          <View style={s.headerLeft}>
            <Text style={s.logoText}>
              <Text style={s.logoBold}>DraftCrick</Text>
            </Text>
          </View>
          <View style={s.headerRight}>
            <Pressable
              onPress={() => router.push("/guru" as never)}
              style={({ hovered }) => [s.hdrBtn, hovered && { backgroundColor: Colors.bgSurfaceHover }]}
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

        {/* ─── Hero ─── */}
        <Animated.View entering={FadeInDown.delay(30).springify()} style={s.hero}>
          <View style={s.heroBadge}>
            <Text style={s.heroBadgeText}>Fantasy Cricket, Reimagined</Text>
          </View>
          <Text style={s.heroTitle}>
            Your draft starts here.
          </Text>
          <Text style={s.heroSub}>
            {all.length > 0
              ? `${all.length} match${all.length !== 1 ? "es" : ""} happening today. Pick your contest and start drafting.`
              : "Check back soon for upcoming fixtures and tournaments."}
          </Text>
        </Animated.View>

        {/* ─── Live & Upcoming Matches ─── */}
        <View style={s.sectionHeader}>
          <View style={s.sectionLeft}>
            <View style={[s.accentBar, { backgroundColor: Colors.accent }]} />
            <Text style={s.sectionTitle}>Matches</Text>
          </View>
          {live.length > 0 && (
            <View style={s.liveBadge}>
              <PulsingDot color={Colors.red} size={4} />
              <Text style={s.liveText}>{live.length} LIVE</Text>
            </View>
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.accent} style={{ paddingVertical: 40 }} />
        ) : all.length > 0 ? (
          <View style={s.cardList}>
            {all.map((m, i) => (
              <MatchCard
                key={m.id}
                match={m}
                index={i}
                onPress={() => m.id.startsWith("ai-") ? router.push("/(tabs)/contests") : router.push(`/match/${m.id}`)}
              />
            ))}
          </View>
        ) : (
          <Animated.View entering={FadeInDown.delay(100)} style={s.emptyCard}>
            <Ionicons name="calendar-outline" size={28} color={Colors.textTertiary} />
            <Text style={s.emptyTitle}>No matches scheduled</Text>
            <Text style={s.emptyDesc}>Check back soon for upcoming fixtures</Text>
          </Animated.View>
        )}

        {/* ─── Tournaments ─── */}
        {aiT.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <View style={s.sectionLeft}>
                <View style={[s.accentBar, { backgroundColor: Colors.amber }]} />
                <Text style={s.sectionTitle}>Tournaments</Text>
              </View>
              <Text style={s.countBadgeText}>{aiT.length}</Text>
            </View>
            <View style={s.cardList}>
              {aiT.map((t, i) => (
                <TournamentCard
                  key={t.id}
                  tournament={t}
                  index={i}
                  onPress={() => router.push("/(tabs)/contests")}
                />
              ))}
            </View>
          </>
        )}

        {/* ─── Quick Actions ─── */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={s.quickRow}>
          {([
            { icon: "trophy-outline" as const, label: "Contests", route: "/(tabs)/contests" },
            { icon: "people-outline" as const, label: "Leagues", route: "/(tabs)/social" },
            { icon: "sparkles-outline" as const, label: "Cricket Guru", route: "/guru" },
          ]).map((item) => (
            <Pressable
              key={item.label}
              onPress={() => router.push(item.route as never)}
              style={({ pressed, hovered }) => [
                s.quickCard,
                hovered && { backgroundColor: Colors.bgSurfaceHover },
                pressed && { backgroundColor: Colors.bgSurfacePress, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Ionicons name={item.icon} size={20} color={Colors.accent} />
              <Text style={s.quickLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  // Header — matches web: logo left, actions right
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logoText: { fontSize: Font["2xl"], letterSpacing: -0.5 },
  logoBold: { fontFamily: FontFamily.headingBold, color: Colors.text },
  headerRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  hdrBtn: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  avatarBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },

  // Hero — matches web hero style
  hero: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing.xl,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: Colors.accentMuted,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.xl,
    marginBottom: Spacing.lg,
  },
  heroBadgeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: Font.sm,
    color: Colors.accent,
  },
  heroTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: Font["3xl"],
    color: Colors.text,
    lineHeight: 36,
    marginBottom: Spacing.sm,
  },
  heroSub: {
    fontFamily: FontFamily.body,
    fontSize: Font.lg,
    color: Colors.textSecondary,
    lineHeight: 24,
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing["2xl"],
    marginBottom: Spacing.lg,
  },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  accentBar: { width: 4, height: 20, borderRadius: 2 },
  sectionTitle: { fontFamily: FontFamily.heading, fontSize: Font.xl, color: Colors.text },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, color: Colors.red, letterSpacing: 0.5 },
  countBadgeText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm, color: Colors.textSecondary },

  // Card list
  cardList: { paddingHorizontal: Spacing.xl, gap: Spacing.md },

  // Match card — matches web feature card style: charcoal bg, #243044 border, 12px radius, 24px padding
  matchCard: {
    ...card,
    padding: Spacing["2xl"],
  },
  matchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  tournBadge: {
    backgroundColor: Colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.xl,
  },
  tournText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: Font.xs,
    color: Colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  matchStatus: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusLabel: { fontFamily: FontFamily.bodyBold, fontSize: Font.xs, letterSpacing: 0.3 },

  matchTeams: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  teamSide: { flex: 1, alignItems: "center", gap: 6 },
  teamCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  teamInit: { fontFamily: FontFamily.headingBold, fontSize: Font.md, color: Colors.text },
  teamName: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md, color: Colors.text, textAlign: "center" },
  vsCol: { alignItems: "center", gap: 2, paddingHorizontal: Spacing.md },
  vsText: { fontFamily: FontFamily.body, fontSize: Font.xs, color: Colors.textTertiary },
  formatLabel: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 },
  scoreSummary: {
    fontFamily: FontFamily.bodyBold,
    fontSize: Font.md,
    color: Colors.amber,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  matchFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  matchMeta: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  matchTime: { fontFamily: FontFamily.body, fontSize: Font.xs, color: Colors.textTertiary },
  matchDot: { fontFamily: FontFamily.body, fontSize: Font.xs, color: Colors.textTertiary },
  draftBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  draftBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm },

  // Tournament card
  tournCard: {
    ...card,
    padding: Spacing["2xl"],
  },
  tournCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.xl,
  },
  catText: { fontFamily: FontFamily.bodyBold, fontSize: Font.xs, letterSpacing: 0.5 },
  tournName: {
    fontFamily: FontFamily.heading,
    fontSize: Font.xl,
    color: Colors.text,
    marginBottom: 4,
  },
  tournDates: {
    fontFamily: FontFamily.body,
    fontSize: Font.sm,
    color: Colors.textTertiary,
  },

  // Quick actions — similar to web feature grid
  quickRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing["3xl"],
  },
  quickCard: {
    flex: 1,
    ...card,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  quickLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: Font.sm,
    color: Colors.textSecondary,
  },

  // Empty
  emptyCard: {
    marginHorizontal: Spacing.xl,
    padding: Spacing["3xl"],
    ...card,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyTitle: { fontFamily: FontFamily.heading, fontSize: Font.lg, color: Colors.text },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: Font.md, color: Colors.textTertiary, textAlign: "center" },
});
