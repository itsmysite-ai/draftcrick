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
import { useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { Colors, Gradients, Radius, Shadow, Spacing, Font } from "../../lib/design";

function ContestCard({ item, index, onPress }: { item: any; index: number; onPress: () => void }) {
  const contest = item.contest;
  const match = contest?.match;
  const status = contest?.status ?? "open";

  const statusConfig: Record<string, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
    live: { color: Colors.red, bg: Colors.redMuted, icon: "pulse" },
    settled: { color: Colors.accent, bg: Colors.accentMuted, icon: "checkmark-circle" },
    open: { color: Colors.amber, bg: "rgba(255, 184, 0, 0.15)", icon: "time-outline" },
    upcoming: { color: Colors.cyan, bg: "rgba(0, 217, 245, 0.15)", icon: "calendar-outline" },
  };
  const sc = statusConfig[status] ?? statusConfig.open;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.contestCard}
      >
        {status === "live" && (
          <View style={styles.liveStrip}>
            <LinearGradient
              colors={Gradients.live as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        )}

        <View style={styles.contestHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.contestName} numberOfLines={1}>
              {contest?.name ?? "Contest"}
            </Text>
            {match && (
              <Text style={styles.contestMatch}>
                {match.teamHome} vs {match.teamAway}
              </Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
            <Ionicons name={sc.icon} size={10} color={sc.color} />
            <Text style={[styles.statusText, { color: sc.color }]}>
              {status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.contestStats}>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>Points</Text>
            <Text style={styles.statValue}>{item.totalPoints.toFixed(1)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>Prize Pool</Text>
            <Text style={[styles.statValue, { color: Colors.accent }]}>
              {contest ? (contest.prizePool > 0 ? `₹${contest.prizePool.toLocaleString()}` : "FREE") : "-"}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>Entry</Text>
            <Text style={styles.statValue}>
              {contest ? (contest.entryFee === 0 ? "FREE" : `₹${contest.entryFee}`) : "-"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ContestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const myContests = trpc.contest.myContests.useQuery(undefined, { retry: false });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await myContests.refetch();
    setRefreshing(false);
  }, [myContests]);

  if (myContests.error?.data?.code === "UNAUTHORIZED") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Animated.View entering={FadeIn.delay(100)} style={styles.emptyCenter}>
          <LinearGradient
            colors={Gradients.primary as any}
            style={styles.emptyIcon}
          >
            <Ionicons name="trophy-outline" size={36} color="#fff" />
          </LinearGradient>
          <Text style={styles.emptyTitle}>My Contests</Text>
          <Text style={styles.emptySub}>Sign in to view and manage your contests</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/auth/login")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtnGrad}
            >
              <Text style={styles.primaryBtnText}>Sign In</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.textInverse} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  if (myContests.isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  const data = myContests.data ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Contests</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{data.length}</Text>
        </View>
      </View>

      {data.length === 0 ? (
        <Animated.View entering={FadeIn.delay(100)} style={styles.emptyCenter}>
          <View style={styles.emptyIconPlain}>
            <Ionicons name="trophy-outline" size={48} color={Colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No contests yet</Text>
          <Text style={styles.emptySub}>
            Browse upcoming matches to find contests to join
          </Text>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/(tabs)")}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Browse Matches</Text>
            <Ionicons name="arrow-forward" size={14} color={Colors.accent} />
          </TouchableOpacity>
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
            <ContestCard
              item={item}
              index={index}
              onPress={() => item.contest ? router.push(`/contest/${item.contest.id}`) : undefined}
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
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  headerTitle: {
    fontSize: Font["2xl"],
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerBadge: {
    backgroundColor: Colors.accentMuted,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  headerBadgeText: {
    fontSize: Font.sm,
    fontWeight: "700",
    color: Colors.accent,
  },
  listContent: {
    padding: Spacing.xl,
    paddingBottom: 120,
  },
  contestCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    overflow: "hidden",
    ...Shadow.sm,
  },
  liveStrip: {
    height: 3,
    overflow: "hidden",
  },
  contestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  contestName: {
    fontSize: Font.lg,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 2,
  },
  contestMatch: {
    fontSize: Font.sm,
    color: Colors.textSecondary,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusText: {
    fontSize: Font.xs,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  contestStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
  },
  statBlock: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: Font.xs,
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  statValue: {
    fontSize: Font.lg,
    fontWeight: "700",
    color: Colors.text,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  emptyCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyIconPlain: {
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
    marginBottom: Spacing.xl,
  },
  primaryBtn: {
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  primaryBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
  },
  primaryBtnText: {
    fontSize: Font.md,
    fontWeight: "700",
    color: Colors.textInverse,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.accentMuted,
  },
  secondaryBtnText: {
    fontSize: Font.md,
    fontWeight: "600",
    color: Colors.accent,
  },
});
