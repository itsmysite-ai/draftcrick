import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, Easing,
} from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { Colors, Radius, Spacing, Font, FontFamily, card } from "../../lib/design";

function PulsingDot({ size = 8, color = Colors.red }: { size?: number; color?: string }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.8, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: size * 2, height: size * 2, borderRadius: size, backgroundColor: color }, style]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

function LiveMatchCard({ match, index, onPress }: { match: any; index: number; onPress: () => void }) {
  const isAI = match.id?.startsWith("ai-");
  const isLive = match.status === "live";
  const teamA = match.teamA || match.teamHome || "TBA";
  const teamB = match.teamB || match.teamAway || "TBA";
  const tournament = match.tournamentName || match.tournament || "Cricket";

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Pressable onPress={onPress} style={({ pressed, hovered }) => [
        s.liveCard, hovered && s.hover, pressed && s.press,
      ]}>
        {/* Top gradient bar for live matches */}
        {isLive && (
          <LinearGradient
            colors={["rgba(255,77,79,0.2)", "transparent"]}
            style={s.liveGlow}
          />
        )}

        <View style={s.liveHeader}>
          <View style={s.tournamentBadge}>
            <Text style={s.tournament}>{tournament}</Text>
          </View>
          <View style={s.liveBadge}>
            {isLive && <PulsingDot size={4} />}
            <Text style={[s.liveLabel, !isLive && { color: Colors.blue }]}>
              {(match.status || "upcoming").toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={s.teams}>
          <View style={s.teamSide}>
            <View style={s.teamBadge}>
              <Text style={s.teamInit}>{teamA.substring(0, 3).toUpperCase()}</Text>
            </View>
            <Text style={s.teamName} numberOfLines={1}>{teamA}</Text>
          </View>
          <View style={s.vsWrap}>
            <Text style={s.vs}>VS</Text>
            {match.format && (
              <Text style={s.format}>{match.format}</Text>
            )}
          </View>
          <View style={s.teamSide}>
            <View style={s.teamBadge}>
              <Text style={s.teamInit}>{teamB.substring(0, 3).toUpperCase()}</Text>
            </View>
            <Text style={s.teamName} numberOfLines={1}>{teamB}</Text>
          </View>
        </View>

        {match.scoreSummary && (
          <View style={s.scoreRow}>
            <Text style={s.scoreText}>{match.scoreSummary}</Text>
          </View>
        )}

        <View style={s.liveFooter}>
          <View style={s.row}>
            <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
            <Text style={s.venue}>{match.time || match.venue || ""}</Text>
          </View>
          <Pressable
            onPress={onPress}
            style={({ hovered }) => [s.watchBtn, isLive ? s.watchBtnLive : s.watchBtnUpcoming, hovered && { opacity: 0.8 }]}
          >
            <Text style={[s.watchText, isLive ? { color: "#FFF" } : { color: Colors.accent }]}>
              {isLive ? "Watch Live" : "Draft Now"}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function LiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch from Gemini sports API (cached 24hr)
  const aiData = trpc.sports.dashboard.useQuery(
    { sport: "cricket" },
    { staleTime: 60 * 60 * 1000, retry: 1 }
  );

  // Also fetch DB live matches (real-time 10s poll)
  const dbLive = trpc.match.live.useQuery(undefined, { refetchInterval: 10_000, retry: false });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([aiData.refetch(), dbLive.refetch()]);
    setRefreshing(false);
  }, [aiData, dbLive]);

  // Merge data: AI matches (live+upcoming) + DB live matches
  const aiMatches = aiData.data?.matches ?? [];
  const dbMatches = dbLive.data ?? [];

  const allMatches = aiMatches.length > 0 ? aiMatches : dbMatches.map((m: any) => ({
    id: m.id,
    teamA: m.teamHome,
    teamB: m.teamAway,
    tournamentName: m.tournament,
    time: new Date(m.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    status: m.status,
    format: m.format?.toUpperCase() || "T20",
    venue: m.venue,
    sport: "cricket" as const,
    scoreSummary: m.result || null,
    sourceUrl: null,
  }));

  const liveMatches = allMatches.filter((m) => m.status === "live");
  const upcomingMatches = allMatches.filter((m) => m.status === "upcoming");
  const data = [...liveMatches, ...upcomingMatches];

  const isLoading = aiData.isLoading && dbLive.isLoading;

  if (isLoading) return (
    <View style={[s.container, s.centered, { paddingTop: insets.top }]}>
      <ActivityIndicator color={Colors.accent} size="large" />
    </View>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={[s.accentBar, { backgroundColor: Colors.red }]} />
          <Text style={s.headerTitle}>Live & Upcoming</Text>
        </View>
        <View style={s.headerRight}>
          {liveMatches.length > 0 && (
            <View style={s.realTimeBadge}>
              <PulsingDot size={4} />
              <Text style={s.realTimeLabel}>REAL-TIME</Text>
            </View>
          )}
          {data.length > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countText}>{data.length}</Text>
            </View>
          )}
        </View>
      </View>

      {data.length === 0 ? (
        <Animated.View entering={FadeIn.delay(80)} style={s.empty}>
          <Ionicons name="pulse-outline" size={40} color={Colors.textTertiary} />
          <Text style={s.emptyTitle}>No matches right now</Text>
          <Text style={s.emptyDesc}>Live scoring and real-time updates appear here during matches</Text>
          <View style={s.features}>
            {([
              ["flash-outline", "Real-time scores via Gemini AI"],
              ["stats-chart-outline", "Fantasy point tracking"],
              ["notifications-outline", "Wicket & milestone alerts"],
            ] as const).map(([icon, text], i) => (
              <View key={i} style={s.featureRow}>
                <Ionicons name={icon} size={15} color={Colors.accent} />
                <Text style={s.featureText}>{text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      ) : (
        <FlatList data={data} keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 120 }} showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <LiveMatchCard
              match={item}
              index={index}
              onPress={() => {
                if (item.id.startsWith("ai-")) {
                  router.push("/(tabs)/contests");
                } else {
                  router.push(`/match/${item.id}`);
                }
              }}
            />
          )}
        />
      )}

      {/* Powered by Gemini */}
      {data.length > 0 && aiData.data?.lastFetched && (
        <View style={s.geminiBar}>
          <Text style={s.geminiText}>POWERED BY GEMINI AI</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  accentBar: { width: 4, height: 22, borderRadius: 2 },
  headerTitle: { fontFamily: FontFamily.headingBold, fontSize: Font["2xl"], color: Colors.text },
  headerRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  realTimeBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  realTimeLabel: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, color: Colors.textSecondary, letterSpacing: 1 },
  countBadge: { backgroundColor: Colors.redMuted, paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.xl },
  countText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm, color: Colors.red },

  // Live card
  liveCard: { ...card, borderColor: "rgba(255,77,79,0.15)", marginBottom: Spacing.md, overflow: "hidden" },
  liveGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  hover: { backgroundColor: Colors.bgSurfaceHover },
  press: { backgroundColor: Colors.bgSurfacePress, transform: [{ scale: 0.98 }] },

  liveHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  tournamentBadge: { backgroundColor: Colors.accentMuted, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.xl },
  tournament: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, color: Colors.accent, textTransform: "uppercase", letterSpacing: 0.5 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.xl },
  liveLabel: { fontFamily: FontFamily.bodyBold, fontSize: Font.xs, color: Colors.red },

  teams: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  teamSide: { flex: 1, alignItems: "center", gap: 5 },
  teamBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  teamInit: { fontFamily: FontFamily.headingBold, fontSize: Font.md, color: Colors.text },
  teamName: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.lg, color: Colors.text, textAlign: "center" },
  vsWrap: { alignItems: "center", gap: 2 },
  vs: { fontFamily: FontFamily.body, fontSize: Font.xs, color: Colors.textTertiary },
  format: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 },

  scoreRow: { alignItems: "center", paddingBottom: Spacing.sm },
  scoreText: { fontFamily: FontFamily.bodyBold, fontSize: Font.md, color: Colors.amber },

  liveFooter: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  venue: { fontFamily: FontFamily.body, fontSize: Font.xs, color: Colors.textTertiary },
  watchBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.sm },
  watchBtnLive: { backgroundColor: Colors.red },
  watchBtnUpcoming: { backgroundColor: Colors.accentMuted },
  watchText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm },

  // Empty
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: Spacing["3xl"], gap: Spacing.md },
  emptyTitle: { fontFamily: FontFamily.heading, fontSize: Font.xl, color: Colors.text },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: Font.md, color: Colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: Spacing.md },
  features: { ...card, gap: Spacing.md, padding: Spacing.xl, alignSelf: "stretch" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  featureText: { fontFamily: FontFamily.body, fontSize: Font.md, color: Colors.textSecondary },

  // Gemini bar
  geminiBar: {
    position: "absolute",
    bottom: 90,
    left: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 6,
    alignItems: "center",
  },
  geminiText: { fontFamily: FontFamily.bodySemiBold, fontSize: 9, color: Colors.textTertiary, letterSpacing: 1.5 },
});
