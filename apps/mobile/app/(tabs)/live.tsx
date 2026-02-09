import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, Easing,
} from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { Radius, Spacing, Font, FontFamily } from "../../lib/design";
import { useTheme } from "../../providers/ThemeProvider";

function PulsingDot({ size = 6, color }: { size?: number; color?: string }) {
  const { t } = useTheme();
  const dotColor = color ?? t.red;

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
      <Animated.View style={[{ position: "absolute", width: size * 2, height: size * 2, borderRadius: size, backgroundColor: dotColor }, style]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: dotColor }} />
    </View>
  );
}

function LiveMatchCard({ match, index, onPress }: { match: any; index: number; onPress: () => void }) {
  const { t } = useTheme();
  const isLive = match.status === "live";
  const teamA = match.teamA || match.teamHome || "TBA";
  const teamB = match.teamB || match.teamAway || "TBA";
  const tournament = match.tournamentName || match.tournament || "Cricket";

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable onPress={onPress} style={({ pressed, hovered }) => [
        s.liveCard,
        { backgroundColor: t.bgSurface, borderColor: t.border },
        hovered && { backgroundColor: t.bgSurfaceHover },
        pressed && { backgroundColor: t.bgSurfacePress, transform: [{ scale: 0.98 }] },
      ]}>
        <View style={s.liveHeader}>
          <View style={[s.tournamentBadge, { backgroundColor: t.accentMuted }]}>
            <Text style={[s.tournament, { color: t.accent }]}>{tournament}</Text>
          </View>
          <View style={s.liveBadge}>
            {isLive && <PulsingDot size={4} />}
            <Text style={[s.liveLabel, { color: isLive ? t.red : t.blue }]}>
              {(match.status || "upcoming").toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={s.teams}>
          <View style={s.teamSide}>
            <View style={[s.teamBadge, { backgroundColor: t.bgLight, borderColor: t.border }]}>
              <Text style={[s.teamInit, { color: t.text }]}>{teamA.substring(0, 3).toUpperCase()}</Text>
            </View>
            <Text style={[s.teamName, { color: t.text }]} numberOfLines={1}>{teamA}</Text>
          </View>
          <View style={s.vsWrap}>
            <Text style={[s.vs, { color: t.textTertiary }]}>VS</Text>
            {match.format && (
              <Text style={[s.format, { color: t.textTertiary }]}>{match.format}</Text>
            )}
          </View>
          <View style={s.teamSide}>
            <View style={[s.teamBadge, { backgroundColor: t.bgLight, borderColor: t.border }]}>
              <Text style={[s.teamInit, { color: t.text }]}>{teamB.substring(0, 3).toUpperCase()}</Text>
            </View>
            <Text style={[s.teamName, { color: t.text }]} numberOfLines={1}>{teamB}</Text>
          </View>
        </View>

        {match.scoreSummary && (
          <View style={s.scoreRow}>
            <Text style={[s.scoreText, { color: t.amber }]}>{match.scoreSummary}</Text>
          </View>
        )}

        <View style={[s.liveFooter, { borderTopColor: t.border }]}>
          <View style={s.row}>
            <Ionicons name="time-outline" size={12} color={t.textTertiary} />
            <Text style={[s.venue, { color: t.textTertiary }]}>{match.time || match.venue || ""}</Text>
          </View>
          <Pressable
            onPress={onPress}
            style={({ hovered }) => [
              s.watchBtn,
              isLive ? { backgroundColor: t.red } : { backgroundColor: t.accentMuted },
              hovered && { opacity: 0.85 },
            ]}
          >
            <Text style={[s.watchText, isLive ? { color: t.text } : { color: t.accent }]}>
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
  const { t } = useTheme();
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
    <View style={[s.container, s.centered, { paddingTop: insets.top, backgroundColor: t.bg }]}>
      <ActivityIndicator color={t.accent} size="large" />
    </View>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top, backgroundColor: t.bg }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: t.borderSubtle }]}>
        <View style={s.headerLeft}>
          <View style={[s.accentBar, { backgroundColor: t.red }]} />
          <Text style={[s.headerTitle, { color: t.text }]}>Live & Upcoming</Text>
        </View>
        <View style={s.headerRight}>
          {liveMatches.length > 0 && (
            <View style={s.realTimeBadge}>
              <PulsingDot size={4} />
              <Text style={[s.realTimeLabel, { color: t.textSecondary }]}>REAL-TIME</Text>
            </View>
          )}
          {data.length > 0 && (
            <View style={[s.countBadge, { backgroundColor: t.redMuted }]}>
              <Text style={[s.countText, { color: t.red }]}>{data.length}</Text>
            </View>
          )}
        </View>
      </View>

      {data.length === 0 ? (
        <Animated.View entering={FadeIn.delay(80)} style={s.empty}>
          <Ionicons name="pulse-outline" size={40} color={t.textTertiary} />
          <Text style={[s.emptyTitle, { color: t.text }]}>No matches right now</Text>
          <Text style={[s.emptyDesc, { color: t.textSecondary }]}>Live scoring and real-time updates appear here during matches</Text>
          <View style={[s.features, { backgroundColor: t.bgSurface, borderColor: t.border }]}>
            {([
              ["flash-outline", "Real-time scores & ball-by-ball"],
              ["stats-chart-outline", "Fantasy point tracking"],
              ["notifications-outline", "Wicket & milestone alerts"],
            ] as const).map(([icon, text], i) => (
              <View key={i} style={s.featureRow}>
                <Ionicons name={icon} size={15} color={t.accent} />
                <Text style={[s.featureText, { color: t.textSecondary }]}>{text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      ) : (
        <FlatList data={data} keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
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
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  accentBar: { width: 4, height: 20, borderRadius: 2 },
  headerTitle: { fontFamily: FontFamily.headingBold, fontSize: Font["2xl"] },
  headerRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  realTimeBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  realTimeLabel: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, letterSpacing: 1 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.xl },
  countText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm },

  // Live card
  liveCard: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing["2xl"], marginBottom: Spacing.md },

  liveHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  tournamentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.xl },
  tournament: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, textTransform: "uppercase", letterSpacing: 0.5 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveLabel: { fontFamily: FontFamily.bodyBold, fontSize: Font.xs },

  teams: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg },
  teamSide: { flex: 1, alignItems: "center", gap: 6 },
  teamBadge: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  teamInit: { fontFamily: FontFamily.headingBold, fontSize: Font.md },
  teamName: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md, textAlign: "center" },
  vsWrap: { alignItems: "center", gap: 2 },
  vs: { fontFamily: FontFamily.body, fontSize: Font.xs },
  format: { fontFamily: FontFamily.body, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 },

  scoreRow: { alignItems: "center", marginBottom: Spacing.md },
  scoreText: { fontFamily: FontFamily.bodyBold, fontSize: Font.md },

  liveFooter: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: Spacing.md, borderTopWidth: 1,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  venue: { fontFamily: FontFamily.body, fontSize: Font.xs },
  watchBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.sm },
  watchText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm },

  // Empty
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: Spacing["3xl"], gap: Spacing.md },
  emptyTitle: { fontFamily: FontFamily.heading, fontSize: Font.xl },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: Font.md, textAlign: "center", lineHeight: 22, marginBottom: Spacing.md },
  features: { borderRadius: Radius.md, borderWidth: 1, gap: Spacing.md, padding: Spacing["2xl"], alignSelf: "stretch" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  featureText: { fontFamily: FontFamily.body, fontSize: Font.md },
});
