import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
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
import { Colors, Gradients, Radius, Shadow, Spacing, Font } from "../../lib/design";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function HeroHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
      <LinearGradient
        colors={Gradients.hero as any}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroTop}>
        <View>
          <Text style={styles.logoText}>
            Draft<Text style={styles.logoAccent}>Crick</Text>
          </Text>
          <Text style={styles.heroTagline}>Compete. Draft. Win.</Text>
        </View>
        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="search-outline" size={22} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function FeaturedMatchCard({
  match,
  index,
  onPress,
}: {
  match: any;
  index: number;
  onPress: () => void;
}) {
  const startTime = new Date(match.startTime);
  const isLive = match.status === "live";
  const timeStr = startTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const dateStr = startTime.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const gradientColors = isLive ? Gradients.live : index === 0 ? Gradients.primary : Gradients.purple;

  return (
    <Animated.View entering={FadeInRight.delay(index * 100).springify()}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.featuredCard}
      >
        <LinearGradient
          colors={gradientColors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.featuredGradient}
        />
        <View style={styles.featuredContent}>
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredBadgeText}>
              {isLive ? "LIVE" : match.tournament ?? "CRICKET"}
            </Text>
            {isLive && <View style={styles.pulseDot} />}
          </View>

          <View style={styles.featuredTeams}>
            <View style={styles.featuredTeamBlock}>
              <View style={styles.teamLogo}>
                <Text style={styles.teamLogoText}>
                  {match.teamHome.substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.featuredTeamName} numberOfLines={1}>
                {match.teamHome}
              </Text>
            </View>

            <View style={styles.vsContainer}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            <View style={styles.featuredTeamBlock}>
              <View style={styles.teamLogo}>
                <Text style={styles.teamLogoText}>
                  {match.teamAway.substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.featuredTeamName} numberOfLines={1}>
                {match.teamAway}
              </Text>
            </View>
          </View>

          <View style={styles.featuredFooter}>
            <View style={styles.timeChip}>
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.timeChipText}>
                {isLive ? "In Progress" : `${dateStr} ${timeStr}`}
              </Text>
            </View>
            <View style={styles.ctaBtn}>
              <Text style={styles.ctaBtnText}>{isLive ? "Watch" : "Play"}</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.textInverse} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function QuickAction({
  icon,
  label,
  gradient,
  onPress,
  delay,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  gradient: readonly string[];
  onPress: () => void;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.quickActionWrap}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.quickAction}>
        <LinearGradient
          colors={gradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.quickActionIcon}
        >
          <Ionicons name={icon} size={22} color="#fff" />
        </LinearGradient>
        <Text style={styles.quickActionLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function UpcomingMatchCard({
  match,
  index,
  onPress,
}: {
  match: any;
  index: number;
  onPress: () => void;
}) {
  const startTime = new Date(match.startTime);
  const timeStr = startTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const dateStr = startTime.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <Animated.View entering={FadeInDown.delay(200 + index * 80).springify()}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.matchCard}
      >
        <View style={styles.matchCardInner}>
          <View style={styles.matchMeta}>
            <View style={styles.tournamentChip}>
              <Text style={styles.tournamentText}>
                {match.tournament ?? "Cricket"}
              </Text>
            </View>
          </View>

          <View style={styles.matchTeamsRow}>
            <View style={styles.matchTeam}>
              <View style={styles.matchTeamLogo}>
                <Text style={styles.matchTeamLogoText}>
                  {match.teamHome.substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.matchTeamName} numberOfLines={1}>
                {match.teamHome}
              </Text>
            </View>

            <View style={styles.matchVsWrap}>
              <View style={styles.matchVsDivider} />
              <Text style={styles.matchVs}>VS</Text>
              <View style={styles.matchVsDivider} />
            </View>

            <View style={styles.matchTeam}>
              <View style={styles.matchTeamLogo}>
                <Text style={styles.matchTeamLogoText}>
                  {match.teamAway.substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.matchTeamName} numberOfLines={1}>
                {match.teamAway}
              </Text>
            </View>
          </View>

          <View style={styles.matchBottom}>
            <View style={styles.matchInfoRow}>
              <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
              <Text style={styles.matchVenue} numberOfLines={1}>
                {match.venue ?? "TBD"}
              </Text>
            </View>
            <View style={styles.matchInfoRow}>
              <Ionicons name="calendar-outline" size={12} color={Colors.amber} />
              <Text style={styles.matchDate}>{`${dateStr} ${timeStr}`}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const liveMatches = trpc.match.live.useQuery();
  const upcomingMatches = trpc.match.list.useQuery({
    status: "upcoming",
    limit: 10,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([liveMatches.refetch(), upcomingMatches.refetch()]);
    setRefreshing(false);
  }, [liveMatches, upcomingMatches]);

  const allFeatured = [
    ...(liveMatches.data ?? []),
    ...(upcomingMatches.data?.matches?.slice(0, 2) ?? []),
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            progressBackgroundColor={Colors.bg}
          />
        }
      >
        <HeroHeader />

        {/* Featured Matches */}
        {allFeatured.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured</Text>
              <Ionicons name="flame" size={18} color={Colors.amber} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredScroll}
              decelerationRate="fast"
              snapToInterval={SCREEN_WIDTH * 0.78 + 12}
            >
              {allFeatured.map((match, i) => (
                <FeaturedMatchCard
                  key={match.id}
                  match={match}
                  index={i}
                  onPress={() => router.push(`/match/${match.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        ) : (
          <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
            <View style={styles.emptyHero}>
              <LinearGradient
                colors={Gradients.primary as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyHeroGradient}
              >
                <Ionicons name="baseball-outline" size={40} color="rgba(255,255,255,0.9)" />
                <Text style={styles.emptyHeroTitle}>Season Starting Soon</Text>
                <Text style={styles.emptyHeroSub}>
                  Featured matches will appear here when available
                </Text>
              </LinearGradient>
            </View>
          </Animated.View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: Spacing.xl, marginBottom: Spacing.md }]}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickAction
              icon="trophy-outline"
              label="Contests"
              gradient={Gradients.primary}
              onPress={() => router.push("/(tabs)/contests")}
              delay={100}
            />
            <QuickAction
              icon="pulse-outline"
              label="Live"
              gradient={Gradients.hot}
              onPress={() => router.push("/(tabs)/live")}
              delay={150}
            />
            <QuickAction
              icon="people-outline"
              label="Leagues"
              gradient={Gradients.purple}
              onPress={() => router.push("/(tabs)/social")}
              delay={200}
            />
            <QuickAction
              icon="sparkles-outline"
              label="Guru"
              gradient={Gradients.gold}
              onPress={() => router.push("/guru" as never)}
              delay={250}
            />
          </View>
        </View>

        {/* Upcoming Matches */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming</Text>
            <Ionicons name="calendar-outline" size={16} color={Colors.textTertiary} />
          </View>
          {upcomingMatches.isLoading ? (
            <ActivityIndicator color={Colors.accent} style={{ padding: 32 }} />
          ) : upcomingMatches.data?.matches && upcomingMatches.data.matches.length > 0 ? (
            upcomingMatches.data.matches.map((match, i) => (
              <UpcomingMatchCard
                key={match.id}
                match={match}
                index={i}
                onPress={() => router.push(`/match/${match.id}`)}
              />
            ))
          ) : (
            <Animated.View entering={FadeInDown.delay(300)} style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>No upcoming matches</Text>
              <Text style={styles.emptySub}>
                New matches will appear here when scheduled
              </Text>
            </Animated.View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  hero: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["2xl"],
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoText: {
    fontSize: Font["3xl"],
    fontWeight: "900",
    color: Colors.text,
    letterSpacing: -1,
  },
  logoAccent: {
    color: Colors.accent,
  },
  heroTagline: {
    fontSize: Font.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  heroActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Font.xl,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.3,
  },
  featuredScroll: {
    paddingHorizontal: Spacing.xl,
    gap: 12,
  },
  featuredCard: {
    width: SCREEN_WIDTH * 0.78,
    borderRadius: Radius.xl,
    overflow: "hidden",
    ...Shadow.lg,
  },
  featuredGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  featuredContent: {
    padding: Spacing.xl,
  },
  featuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.lg,
  },
  featuredBadgeText: {
    fontSize: Font.xs,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  featuredTeams: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  featuredTeamBlock: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.sm,
  },
  teamLogo: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  teamLogoText: {
    fontSize: Font.md,
    fontWeight: "900",
    color: "#fff",
  },
  featuredTeamName: {
    fontSize: Font.md,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  vsContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  vsText: {
    fontSize: Font.xs,
    fontWeight: "800",
    color: "rgba(255,255,255,0.7)",
  },
  featuredFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeChipText: {
    fontSize: Font.sm,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  ctaBtnText: {
    fontSize: Font.sm,
    fontWeight: "700",
    color: Colors.textInverse,
  },
  quickActionsGrid: {
    flexDirection: "row",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  quickActionWrap: {
    flex: 1,
  },
  quickAction: {
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: {
    fontSize: Font.sm,
    fontWeight: "600",
    color: Colors.text,
  },
  matchCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  matchCardInner: {
    padding: Spacing.lg,
  },
  matchMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  tournamentChip: {
    backgroundColor: Colors.accentMuted,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  tournamentText: {
    fontSize: Font.xs,
    fontWeight: "700",
    color: Colors.accent,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  matchTeamsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  matchTeam: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  matchTeamLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  matchTeamLogoText: {
    fontSize: Font.sm,
    fontWeight: "800",
    color: Colors.textSecondary,
  },
  matchTeamName: {
    fontSize: Font.md,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  matchVsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  matchVsDivider: {
    width: 16,
    height: 1,
    backgroundColor: Colors.border,
  },
  matchVs: {
    fontSize: Font.xs,
    fontWeight: "700",
    color: Colors.textTertiary,
  },
  matchBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  matchInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  matchVenue: {
    fontSize: Font.xs,
    color: Colors.textTertiary,
    maxWidth: 140,
  },
  matchDate: {
    fontSize: Font.xs,
    color: Colors.amber,
    fontWeight: "600",
  },
  emptyHero: {
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.xl,
    overflow: "hidden",
  },
  emptyHeroGradient: {
    padding: Spacing["3xl"],
    alignItems: "center",
    gap: Spacing.md,
  },
  emptyHeroTitle: {
    fontSize: Font.xl,
    fontWeight: "800",
    color: "#fff",
  },
  emptyHeroSub: {
    fontSize: Font.sm,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  emptyCard: {
    marginHorizontal: Spacing.xl,
    padding: Spacing["3xl"],
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Font.md,
    fontWeight: "700",
    color: Colors.text,
  },
  emptySub: {
    fontSize: Font.sm,
    color: Colors.textTertiary,
    textAlign: "center",
  },
});
