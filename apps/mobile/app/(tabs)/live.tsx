import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
import { Colors, Gradients, Radius, Shadow, Spacing, Font } from "../../lib/design";

function PulsingDot({ size = 10, color = Colors.red }: { size?: number; color?: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.6, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [scale, opacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            backgroundColor: color,
          },
          pulseStyle,
        ]}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function LiveMatchCard({ match, index, onPress }: { match: any; index: number; onPress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.liveCard}
      >
        <LinearGradient
          colors={["rgba(255, 77, 79, 0.06)", "transparent"]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.liveCardHeader}>
          <View style={styles.tournamentRow}>
            <Text style={styles.tournament}>{match.tournament ?? "Cricket"}</Text>
          </View>
          <View style={styles.liveBadge}>
            <PulsingDot size={4} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.liveTeams}>
          <View style={styles.liveTeamSide}>
            <View style={styles.liveTeamLogo}>
              <Text style={styles.liveTeamLogoText}>
                {match.teamHome.substring(0, 2).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.liveTeamName} numberOfLines={1}>{match.teamHome}</Text>
            {match.result && (
              <Text style={styles.liveScore}>{match.result}</Text>
            )}
          </View>

          <View style={styles.liveVsCircle}>
            <Text style={styles.liveVsText}>VS</Text>
          </View>

          <View style={styles.liveTeamSide}>
            <View style={styles.liveTeamLogo}>
              <Text style={styles.liveTeamLogoText}>
                {match.teamAway.substring(0, 2).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.liveTeamName} numberOfLines={1}>{match.teamAway}</Text>
          </View>
        </View>

        <View style={styles.liveCardFooter}>
          <View style={styles.venueRow}>
            <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.venueText} numberOfLines={1}>{match.venue ?? ""}</Text>
          </View>
          <View style={styles.watchBtn}>
            <Ionicons name="play-circle" size={16} color={Colors.red} />
            <Text style={styles.watchBtnText}>Watch</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function LiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const liveMatches = trpc.match.live.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await liveMatches.refetch();
    setRefreshing(false);
  }, [liveMatches]);

  if (liveMatches.isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  const data = liveMatches.data ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <PulsingDot size={6} />
          <Text style={styles.headerTitle}>Live Matches</Text>
        </View>
        {data.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{data.length}</Text>
          </View>
        )}
      </View>

      {data.length === 0 ? (
        <Animated.View entering={FadeIn.delay(100)} style={styles.emptyCenter}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="pulse-outline" size={48} color={Colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No live matches</Text>
          <Text style={styles.emptySub}>
            Live scoring updates appear here during matches.{"\n"}
            Check back during match time!
          </Text>
          <View style={styles.emptyFeatures}>
            {[
              { icon: "flash-outline" as const, text: "Real-time scores" },
              { icon: "stats-chart-outline" as const, text: "Fantasy points" },
              { icon: "notifications-outline" as const, text: "Wicket alerts" },
            ].map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons name={f.icon} size={16} color={Colors.accent} />
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <LiveMatchCard
              match={item}
              index={index}
              onPress={() => router.push(`/match/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: Font["2xl"],
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: Colors.redMuted,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  countBadgeText: {
    fontSize: Font.sm,
    fontWeight: "700",
    color: Colors.red,
  },
  listContent: {
    padding: Spacing.xl,
    paddingBottom: 120,
  },
  liveCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 79, 0.15)",
    marginBottom: Spacing.md,
    overflow: "hidden",
    ...Shadow.sm,
  },
  liveCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  tournamentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tournament: {
    fontSize: Font.xs,
    fontWeight: "700",
    color: Colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.redMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  liveBadgeText: {
    fontSize: Font.xs,
    fontWeight: "800",
    color: Colors.red,
    letterSpacing: 0.5,
  },
  liveTeams: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  liveTeamSide: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  liveTeamLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  liveTeamLogoText: {
    fontSize: Font.md,
    fontWeight: "900",
    color: Colors.text,
  },
  liveTeamName: {
    fontSize: Font.lg,
    fontWeight: "800",
    color: Colors.text,
    textAlign: "center",
  },
  liveScore: {
    fontSize: Font.md,
    fontWeight: "700",
    color: Colors.amber,
  },
  liveVsCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  liveVsText: {
    fontSize: Font.xs,
    fontWeight: "800",
    color: Colors.textTertiary,
  },
  liveCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  venueText: {
    fontSize: Font.xs,
    color: Colors.textTertiary,
  },
  watchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  watchBtnText: {
    fontSize: Font.sm,
    fontWeight: "600",
    color: Colors.red,
  },
  emptyCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Font.xl,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySub: {
    fontSize: Font.md,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing["2xl"],
  },
  emptyFeatures: {
    gap: Spacing.md,
    alignSelf: "stretch",
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  featureText: {
    fontSize: Font.md,
    color: Colors.textSecondary,
  },
});
