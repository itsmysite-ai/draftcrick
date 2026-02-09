import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { Colors, Radius, Spacing, Font, FontFamily, card } from "../../lib/design";

const { width: SW } = Dimensions.get("window");
const MATCH_W = SW * 0.85;
const TOURNAMENT_W = SW * 0.55;

// Cricket ball image — high quality, royalty-free
const CRICKET_IMG = "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=80";
const CRICKET_IMG_2 = "https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=600&q=80";
const CRICKET_IMG_3 = "https://images.unsplash.com/photo-1580674285054-bed31e145f59?w=600&q=80";
const MATCH_IMAGES = [CRICKET_IMG, CRICKET_IMG_2, CRICKET_IMG_3];

// ─── Pulsing Dot ──────────────────────────────────────────────────────
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

// ─── Section Header ───────────────────────────────────────────────────
function SectionHeader({ title, accentColor = Colors.accent, right, delay = 0 }: {
  title: string; accentColor?: string; right?: React.ReactNode; delay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={s.sectionRow}>
      <View style={s.sectionLeft}>
        <View style={[s.accentBar, { backgroundColor: accentColor }]} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {right}
    </Animated.View>
  );
}

// ─── Scroll Progress Bar ──────────────────────────────────────────────
function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={s.progressWrap}>
      <LinearGradient
        colors={[Colors.accent, Colors.cyan]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.progressFill, { width: `${Math.max(15, progress * 100)}%` }]}
      />
    </View>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────
function MatchCard({ match, index, onPress }: { match: any; index: number; onPress: () => void }) {
  const isLive = match.status === "live";
  const statusColor = isLive ? Colors.red : Colors.blue;
  const img = MATCH_IMAGES[index % MATCH_IMAGES.length];

  return (
    <Animated.View entering={FadeInRight.delay(index * 120).springify()}>
      <Pressable
        onPress={onPress}
        style={({ pressed, hovered }) => [
          s.matchCard,
          hovered && { borderColor: Colors.accent, transform: [{ translateY: -2 }] },
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
      >
        {/* Image */}
        <View style={s.matchImgWrap}>
          <Image source={{ uri: img }} style={s.matchImg} resizeMode="cover" />
          <LinearGradient
            colors={["transparent", "rgba(10,22,40,0.6)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[s.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={s.statusText}>{(match.status || "upcoming").toUpperCase()}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={s.matchContent}>
          <Text style={s.matchTournament} numberOfLines={1}>
            {match.tournamentName || match.tournament || "Cricket"}
          </Text>
          <Text style={s.matchTeams} numberOfLines={1}>
            {match.teamA || match.teamHome} vs {match.teamB || match.teamAway}
          </Text>
          {match.scoreSummary && <Text style={s.matchScore}>{match.scoreSummary}</Text>}
          <View style={s.matchFooter}>
            <View style={s.timeRow}>
              <Ionicons name="time-outline" size={14} color={Colors.textTertiary} />
              <Text style={s.matchTime}>{match.time || "TBD"} Local</Text>
            </View>
            <Pressable
              onPress={onPress}
              style={({ hovered }) => [s.draftBtn, hovered && { backgroundColor: "#D83030" }]}
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
function TournamentCard({ tournament, index, onPress }: { tournament: any; index: number; onPress: () => void }) {
  const catColors: Record<string, string> = {
    international: Colors.accent,
    domestic: Colors.amber,
    league: Colors.blue,
    bilateral: Colors.cyan,
    qualifier: Colors.purple,
    "domestic first-class": Colors.amber,
    "t20 league": Colors.accent,
  };
  const cat = (tournament.category || "league").toLowerCase();
  const color = catColors[cat] || Colors.accent;

  return (
    <Animated.View entering={FadeInDown.delay(200 + index * 100).springify()} style={{ width: TOURNAMENT_W }}>
      <Pressable
        onPress={onPress}
        style={({ pressed, hovered }) => [
          s.tournCard,
          hovered && { borderColor: Colors.accent, transform: [{ translateY: -2 }] },
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
      >
        {/* Image placeholder */}
        <View style={s.tournImgWrap}>
          <LinearGradient colors={["#1E2D42", "#152238"]} style={StyleSheet.absoluteFill} />
          <Ionicons name="trophy" size={40} color="rgba(255,255,255,0.06)" />
          <Text style={s.tournImgLabel}>Tournament</Text>
        </View>

        {/* Category badge */}
        <View style={[s.catBadge, { backgroundColor: color }]}>
          <Text style={s.catText}>{(tournament.category || "league").toUpperCase()}</Text>
        </View>

        <Text style={s.tournName} numberOfLines={2}>{tournament.name}</Text>

        <Pressable onPress={onPress} style={s.viewScheduleRow}>
          <Text style={s.viewScheduleText}>View Schedule</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.accent} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [matchScroll, setMatchScroll] = useState(0);
  const [tournScroll, setTournScroll] = useState(0);

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
  const matchMax = all.length > 1 ? (all.length - 1) * (MATCH_W + 14) : 1;
  const tournMax = aiT.length > 1 ? (aiT.length - 1) * (TOURNAMENT_W + 12) : 1;

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
            <View style={s.logoIcon}>
              <Ionicons name="trophy" size={16} color={Colors.accent} />
            </View>
            <Text style={s.logoText}>
              <Text style={s.logoBold}>DRAFT</Text>
              <Text style={s.logoLight}>CRICK</Text>
            </Text>
          </View>
          <View style={s.headerRight}>
            <Pressable onPress={() => router.push("/guru" as never)} style={({ hovered }) => [s.hdrBtn, hovered && s.hdrBtnHov]}>
              <Ionicons name="sparkles" size={18} color={Colors.accent} />
            </Pressable>
            <Pressable onPress={() => router.push("/(tabs)/profile")} style={({ hovered }) => [s.avatarBtn, hovered && { borderColor: Colors.accent }]}>
              <Ionicons name="person" size={16} color={Colors.textSecondary} />
            </Pressable>
          </View>
        </Animated.View>

        {/* ─── Live Draft Central Hero ─── */}
        <Animated.View entering={FadeInDown.delay(40).springify()} style={s.heroCard}>
          <Text style={s.heroTitle}>Live Draft Central</Text>
          <Text style={s.heroSub}>
            Gemini has found{" "}
            <Text style={s.heroAccent}>{all.length}</Text>{" "}
            live matches happening today. Pick your contest and start drafting.
          </Text>
        </Animated.View>

        {/* ─── Today's Live Matches ─── */}
        <SectionHeader
          title="Today's Live Matches"
          delay={80}
          right={
            live.length > 0 ? (
              <View style={s.rtBadge}>
                <PulsingDot color={Colors.red} size={5} />
                <Text style={s.rtText}>REAL-TIME</Text>
              </View>
            ) : undefined
          }
        />

        {isLoading ? (
          <ActivityIndicator color={Colors.accent} style={{ paddingVertical: 40 }} />
        ) : all.length > 0 ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: 14 }}
              decelerationRate="fast"
              snapToInterval={MATCH_W + 14}
              onScroll={(e) => setMatchScroll(e.nativeEvent.contentOffset.x)}
              scrollEventThrottle={16}
            >
              {all.map((m, i) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  index={i}
                  onPress={() => m.id.startsWith("ai-") ? router.push("/(tabs)/contests") : router.push(`/match/${m.id}`)}
                />
              ))}
            </ScrollView>
            <ProgressBar progress={matchMax > 0 ? matchScroll / matchMax : 0} />
          </>
        ) : (
          <Animated.View entering={FadeInDown.delay(100)} style={s.emptyCard}>
            <Ionicons name="calendar-outline" size={28} color={Colors.textTertiary} />
            <Text style={s.emptyTitle}>No matches scheduled</Text>
            <Text style={s.emptyDesc}>Check back soon for upcoming fixtures</Text>
          </Animated.View>
        )}

        {/* ─── Current Tournaments ─── */}
        {aiT.length > 0 && (
          <>
            <SectionHeader title="Current Tournaments" accentColor={Colors.amber} delay={200} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: 12 }}
              onScroll={(e) => setTournScroll(e.nativeEvent.contentOffset.x)}
              scrollEventThrottle={16}
            >
              {aiT.map((t, i) => (
                <TournamentCard
                  key={t.id}
                  tournament={t}
                  index={i}
                  onPress={() => router.push("/(tabs)/contests")}
                />
              ))}
            </ScrollView>
            <ProgressBar progress={tournMax > 0 ? tournScroll / tournMax : 0} />
          </>
        )}

        {/* ─── Powered by Gemini ─── */}
        <Animated.View entering={FadeInDown.delay(350)} style={s.geminiFooter}>
          <Text style={s.geminiText}>DATA SOURCES POWERED BY GEMINI</Text>
          {dashboard.data?.lastFetched && (
            <Text style={s.geminiSub}>
              Updated {new Date(dashboard.data.lastFetched).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  logoIcon: { width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: Colors.accentMuted, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: Font.lg, letterSpacing: 1 },
  logoBold: { fontFamily: FontFamily.headingBold, color: Colors.text },
  logoLight: { fontFamily: FontFamily.heading, color: Colors.accent },
  headerRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  hdrBtn: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  hdrBtnHov: { backgroundColor: Colors.bgSurfaceHover },
  avatarBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bgSurface, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },

  // Hero
  heroCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    ...card,
    padding: Spacing.xl,
  },
  heroTitle: { fontFamily: FontFamily.headingBold, fontSize: Font["2xl"], color: Colors.text, marginBottom: Spacing.sm },
  heroSub: { fontFamily: FontFamily.body, fontSize: Font.md, color: Colors.textSecondary, lineHeight: 22 },
  heroAccent: { fontFamily: FontFamily.bodyBold, color: Colors.accent },

  // Section
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.xl, marginTop: Spacing["2xl"], marginBottom: Spacing.lg },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  accentBar: { width: 4, height: 24, borderRadius: 2 },
  sectionTitle: { fontFamily: FontFamily.headingBold, fontSize: Font.xl, color: Colors.text },
  rtBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  rtText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, color: Colors.textSecondary, letterSpacing: 1 },

  // Progress bar
  progressWrap: { height: 4, marginHorizontal: Spacing.xl, marginTop: Spacing.md, borderRadius: 2, backgroundColor: Colors.bgSurface, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },

  // Match card
  matchCard: { width: MATCH_W, ...card, overflow: "hidden" },
  matchImgWrap: { height: 160, backgroundColor: Colors.bgSurface },
  matchImg: { width: "100%", height: "100%" },
  statusBadge: { position: "absolute", top: Spacing.md, left: Spacing.md, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.xs },
  statusText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, color: "#FFF", letterSpacing: 0.3 },
  matchContent: { padding: Spacing.lg },
  matchTournament: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, color: Colors.blue, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  matchTeams: { fontFamily: FontFamily.headingBold, fontSize: Font.xl, color: Colors.text, marginBottom: Spacing.md },
  matchScore: { fontFamily: FontFamily.bodyBold, fontSize: Font.md, color: Colors.amber, marginBottom: Spacing.sm },
  matchFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  matchTime: { fontFamily: FontFamily.body, fontSize: Font.sm, color: Colors.textTertiary },
  draftBtn: { backgroundColor: Colors.red, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.sm },
  draftBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm, color: "#FFF" },

  // Tournament card
  tournCard: { ...card, overflow: "hidden" },
  tournImgWrap: { height: 140, backgroundColor: Colors.bgSurface, alignItems: "center", justifyContent: "center" },
  tournImgLabel: { fontFamily: FontFamily.body, fontSize: Font.xs, color: "rgba(255,255,255,0.15)", marginTop: 4 },
  catBadge: { alignSelf: "flex-start", marginHorizontal: Spacing.lg, marginTop: Spacing.md, paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.xs },
  catText: { fontFamily: FontFamily.bodySemiBold, fontSize: 9, color: "#FFF", letterSpacing: 0.5 },
  tournName: { fontFamily: FontFamily.headingBold, fontSize: Font.lg, color: Colors.text, paddingHorizontal: Spacing.lg, marginTop: Spacing.sm },
  viewScheduleRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  viewScheduleText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm, color: Colors.accent },

  // Gemini
  geminiFooter: { marginTop: Spacing["3xl"], marginHorizontal: Spacing.xl, ...card, paddingVertical: Spacing.md, alignItems: "center" },
  geminiText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, color: Colors.textTertiary, letterSpacing: 1.5 },
  geminiSub: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textTertiary, marginTop: 2 },

  // Empty
  emptyCard: { marginHorizontal: Spacing.xl, padding: Spacing["3xl"], ...card, alignItems: "center", gap: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.heading, fontSize: Font.lg, color: Colors.text },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: Font.md, color: Colors.textTertiary, textAlign: "center" },
});
