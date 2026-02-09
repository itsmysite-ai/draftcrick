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
import { useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { Colors, Gradients, Radius, Spacing, Font, FontFamily, card } from "../../lib/design";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function HeroHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.hero, { paddingTop: insets.top + 12 }]}>
      <LinearGradient colors={Gradients.heroWash as any} style={StyleSheet.absoluteFill} />
      <View style={s.heroRow}>
        <View>
          <Text style={s.logo}>
            DraftCrick
          </Text>
          <Text style={s.tagline}>Fantasy Cricket, Reimagined</Text>
        </View>
        <View style={s.heroIcons}>
          <Pressable style={({ hovered }) => [s.iconBtn, hovered && s.iconBtnHover]}>
            <Ionicons name="search-outline" size={20} color={Colors.textSecondary} />
          </Pressable>
          <Pressable style={({ hovered }) => [s.iconBtn, hovered && s.iconBtnHover]}>
            <Ionicons name="notifications-outline" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function FeaturedCard({ match, index, onPress }: { match: any; index: number; onPress: () => void }) {
  const startTime = new Date(match.startTime);
  const isLive = match.status === "live";
  const timeStr = startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateStr = startTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <Animated.View entering={FadeInRight.delay(index * 80).springify()}>
      <Pressable
        onPress={onPress}
        style={({ pressed, hovered }) => [
          s.featuredCard,
          isLive && s.featuredLive,
          hovered && s.cardHover,
          pressed && s.cardPress,
        ]}
      >
        <View style={s.featuredHeader}>
          <View style={s.tournamentBadge}>
            <Text style={s.tournamentText}>{match.tournament ?? "Cricket"}</Text>
          </View>
          {isLive && (
            <View style={s.liveBadge}>
              <View style={s.liveDot} />
              <Text style={s.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={s.teamsRow}>
          <View style={s.teamCol}>
            <View style={s.teamBadge}>
              <Text style={s.teamInitials}>{match.teamHome.substring(0, 3).toUpperCase()}</Text>
            </View>
            <Text style={s.teamName} numberOfLines={1}>{match.teamHome}</Text>
          </View>
          <Text style={s.vsLabel}>VS</Text>
          <View style={s.teamCol}>
            <View style={s.teamBadge}>
              <Text style={s.teamInitials}>{match.teamAway.substring(0, 3).toUpperCase()}</Text>
            </View>
            <Text style={s.teamName} numberOfLines={1}>{match.teamAway}</Text>
          </View>
        </View>

        <View style={s.featuredFooter}>
          <View style={s.infoRow}>
            <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
            <Text style={s.infoText}>{isLive ? "In Progress" : `${dateStr} ${timeStr}`}</Text>
          </View>
          <View style={s.ctaChip}>
            <Text style={s.ctaText}>{isLive ? "Watch" : "Play"}</Text>
            <Ionicons name="chevron-forward" size={12} color={Colors.textInverse} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function QuickAction({ icon, label, onPress, delay }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={{ flex: 1 }}>
      <Pressable
        onPress={onPress}
        style={({ pressed, hovered }) => [s.quickAction, hovered && s.cardHover, pressed && s.cardPress]}
      >
        <Ionicons name={icon} size={22} color={Colors.accent} />
        <Text style={s.quickLabel}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function MatchCard({ match, index, onPress }: { match: any; index: number; onPress: () => void }) {
  const t = new Date(match.startTime);
  const time = t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const date = t.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <Animated.View entering={FadeInDown.delay(150 + index * 60).springify()}>
      <Pressable
        onPress={onPress}
        style={({ pressed, hovered }) => [s.matchCard, hovered && s.cardHover, pressed && s.cardPress]}
      >
        <View style={s.matchMeta}>
          <View style={s.tournamentBadge}>
            <Text style={s.tournamentText}>{match.tournament ?? "Cricket"}</Text>
          </View>
        </View>
        <View style={s.teamsRow}>
          <View style={s.teamCol}>
            <View style={s.teamBadgeSmall}>
              <Text style={s.teamInitialsSmall}>{match.teamHome.substring(0, 3).toUpperCase()}</Text>
            </View>
            <Text style={s.teamNameSmall} numberOfLines={1}>{match.teamHome}</Text>
          </View>
          <Text style={s.vsLabelSmall}>VS</Text>
          <View style={s.teamCol}>
            <View style={s.teamBadgeSmall}>
              <Text style={s.teamInitialsSmall}>{match.teamAway.substring(0, 3).toUpperCase()}</Text>
            </View>
            <Text style={s.teamNameSmall} numberOfLines={1}>{match.teamAway}</Text>
          </View>
        </View>
        <View style={s.matchBottom}>
          <View style={s.infoRow}>
            <Ionicons name="location-outline" size={11} color={Colors.textTertiary} />
            <Text style={s.infoText} numberOfLines={1}>{match.venue ?? "TBD"}</Text>
          </View>
          <View style={s.infoRow}>
            <Ionicons name="calendar-outline" size={11} color={Colors.amber} />
            <Text style={[s.infoText, { color: Colors.amber }]}>{date} {time}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const live = trpc.match.live.useQuery();
  const upcoming = trpc.match.list.useQuery({ status: "upcoming", limit: 10 });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([live.refetch(), upcoming.refetch()]);
    setRefreshing(false);
  }, [live, upcoming]);

  const featured = [...(live.data ?? []), ...(upcoming.data?.matches?.slice(0, 2) ?? [])];

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <HeroHeader />

        {/* Featured */}
        {featured.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Featured</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: 12 }}
              decelerationRate="fast" snapToInterval={SCREEN_WIDTH * 0.8 + 12}
            >
              {featured.map((m, i) => (
                <FeaturedCard key={m.id} match={m} index={i} onPress={() => router.push(`/match/${m.id}`)} />
              ))}
            </ScrollView>
          </View>
        ) : (
          <Animated.View entering={FadeInDown.delay(80)} style={s.section}>
            <Pressable style={({ hovered }) => [s.emptyHero, hovered && s.cardHover]}>
              <Ionicons name="baseball-outline" size={32} color={Colors.accent} />
              <Text style={s.emptyTitle}>Season Starting Soon</Text>
              <Text style={s.emptyDesc}>Featured matches will appear here</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Quick Actions */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { marginHorizontal: Spacing.xl }]}>Quick Actions</Text>
          <View style={s.quickGrid}>
            <QuickAction icon="trophy-outline" label="Contests" onPress={() => router.push("/(tabs)/contests")} delay={80} />
            <QuickAction icon="pulse-outline" label="Live" onPress={() => router.push("/(tabs)/live")} delay={120} />
            <QuickAction icon="people-outline" label="Leagues" onPress={() => router.push("/(tabs)/social")} delay={160} />
            <QuickAction icon="sparkles-outline" label="Guru" onPress={() => router.push("/guru" as never)} delay={200} />
          </View>
        </View>

        {/* Upcoming */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Upcoming</Text>
          {upcoming.isLoading ? (
            <ActivityIndicator color={Colors.accent} style={{ padding: 32 }} />
          ) : upcoming.data?.matches?.length ? (
            upcoming.data.matches.map((m, i) => (
              <MatchCard key={m.id} match={m} index={i} onPress={() => router.push(`/match/${m.id}`)} />
            ))
          ) : (
            <View style={s.emptyCard}>
              <Ionicons name="calendar-outline" size={28} color={Colors.textTertiary} />
              <Text style={s.emptyTitle}>No upcoming matches</Text>
              <Text style={s.emptyDesc}>New matches will appear when scheduled</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Hero
  hero: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing["2xl"] },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { fontFamily: FontFamily.headingBold, fontSize: Font["2xl"], color: Colors.text, letterSpacing: -0.5 },
  tagline: { fontFamily: FontFamily.body, fontSize: Font.sm, color: Colors.textSecondary, marginTop: 2 },
  heroIcons: { flexDirection: "row", gap: Spacing.sm },
  iconBtn: {
    width: 38, height: 38, borderRadius: Radius.sm,
    backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  iconBtnHover: { backgroundColor: Colors.bgSurfaceHover },

  // Sections
  section: { marginBottom: Spacing["2xl"] },
  sectionTitle: {
    fontFamily: FontFamily.heading, fontSize: Font.xl, color: Colors.text,
    paddingHorizontal: Spacing.xl, marginBottom: Spacing.md,
  },

  // Featured cards
  featuredCard: {
    width: SCREEN_WIDTH * 0.8, ...card, padding: Spacing.lg,
  },
  featuredLive: { borderColor: "rgba(255, 77, 79, 0.25)" },
  cardHover: { backgroundColor: Colors.bgSurfaceHover },
  cardPress: { backgroundColor: Colors.bgSurfacePress, transform: [{ scale: 0.98 }] },

  featuredHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  tournamentBadge: { backgroundColor: Colors.accentMuted, paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.xl },
  tournamentText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, color: Colors.accent, textTransform: "uppercase", letterSpacing: 0.5 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.redMuted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.xl },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.red },
  liveText: { fontFamily: FontFamily.bodyBold, fontSize: Font.xs, color: Colors.red },

  teamsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg },
  teamCol: { flex: 1, alignItems: "center", gap: 6 },
  teamBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  teamInitials: { fontFamily: FontFamily.headingBold, fontSize: Font.md, color: Colors.textSecondary },
  teamName: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md, color: Colors.text, textAlign: "center" },
  vsLabel: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, color: Colors.textTertiary, marginHorizontal: 8 },

  featuredFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontFamily: FontFamily.body, fontSize: Font.xs, color: Colors.textTertiary },
  ctaChip: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: Colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.sm,
  },
  ctaText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm, color: Colors.textInverse },

  // Quick actions
  quickGrid: { flexDirection: "row", paddingHorizontal: Spacing.xl, gap: Spacing.md },
  quickAction: {
    alignItems: "center", gap: Spacing.sm, padding: Spacing.lg,
    ...card,
  },
  quickLabel: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm, color: Colors.textSecondary },

  // Upcoming match cards
  matchCard: { marginHorizontal: Spacing.xl, marginBottom: Spacing.md, padding: Spacing.lg, ...card },
  matchMeta: { marginBottom: Spacing.md },
  teamBadgeSmall: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  teamInitialsSmall: { fontFamily: FontFamily.heading, fontSize: Font.xs, color: Colors.textTertiary },
  teamNameSmall: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md, color: Colors.text, textAlign: "center" },
  vsLabelSmall: { fontFamily: FontFamily.body, fontSize: Font.xs, color: Colors.textTertiary },
  matchBottom: {
    flexDirection: "row", justifyContent: "space-between",
    paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border,
  },

  // Empty states
  emptyHero: {
    marginHorizontal: Spacing.xl, padding: Spacing["3xl"],
    ...card, alignItems: "center", gap: Spacing.md,
  },
  emptyCard: {
    marginHorizontal: Spacing.xl, padding: Spacing["3xl"],
    ...card, alignItems: "center", gap: Spacing.sm,
  },
  emptyTitle: { fontFamily: FontFamily.heading, fontSize: Font.lg, color: Colors.text },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: Font.md, color: Colors.textTertiary, textAlign: "center" },
});
