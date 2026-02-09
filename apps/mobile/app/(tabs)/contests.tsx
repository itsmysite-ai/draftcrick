import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { Colors, Radius, Spacing, Font, FontFamily, card } from "../../lib/design";

function ContestCard({ item, index, onPress }: { item: any; index: number; onPress: () => void }) {
  const contest = item.contest;
  const match = contest?.match;
  const status = contest?.status ?? "open";
  const sc: Record<string, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
    live: { color: Colors.red, bg: Colors.redMuted, icon: "pulse" },
    settled: { color: Colors.accent, bg: Colors.accentMuted, icon: "checkmark-circle" },
    open: { color: Colors.amber, bg: Colors.amberMuted, icon: "time-outline" },
    upcoming: { color: Colors.cyan, bg: "rgba(0, 217, 245, 0.1)", icon: "calendar-outline" },
  };
  const cfg = sc[status] ?? sc.open;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable onPress={onPress} style={({ pressed, hovered }) => [
        s.contestCard, hovered && s.hover, pressed && s.press,
      ]}>
        <View style={s.contestTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.contestName} numberOfLines={1}>{contest?.name ?? "Contest"}</Text>
            {match && <Text style={s.contestMatch}>{match.teamHome} vs {match.teamAway}</Text>}
          </View>
          <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={10} color={cfg.color} />
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
  const q = trpc.contest.myContests.useQuery(undefined, { retry: false });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  }, [q]);

  if (q.error?.data?.code === "UNAUTHORIZED") {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <Animated.View entering={FadeIn.delay(80)} style={s.empty}>
          <Ionicons name="trophy-outline" size={40} color={Colors.textTertiary} />
          <Text style={s.emptyTitle}>My Contests</Text>
          <Text style={s.emptyDesc}>Sign in to view and manage your contests</Text>
          <Pressable onPress={() => router.push("/auth/login")} style={({ hovered }) => [s.primaryBtn, hovered && { backgroundColor: Colors.accentDark }]}>
            <Text style={s.primaryBtnText}>Sign In</Text>
            <Ionicons name="arrow-forward" size={14} color={Colors.textInverse} />
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  if (q.isLoading) {
    return (
      <View style={[s.container, s.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  const data = q.data ?? [];

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>My Contests</Text>
        <View style={s.badge}><Text style={s.badgeText}>{data.length}</Text></View>
      </View>
      {data.length === 0 ? (
        <Animated.View entering={FadeIn.delay(80)} style={s.empty}>
          <Ionicons name="trophy-outline" size={40} color={Colors.textTertiary} />
          <Text style={s.emptyTitle}>No contests yet</Text>
          <Text style={s.emptyDesc}>Browse upcoming matches to find contests</Text>
        </Animated.View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <ContestCard item={item} index={index} onPress={() => item.contest ? router.push(`/contest/${item.contest.id}`) : undefined} />
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg },
  headerTitle: { fontFamily: FontFamily.headingBold, fontSize: Font["2xl"], color: Colors.text },
  badge: { backgroundColor: Colors.accentMuted, paddingHorizontal: 10, paddingVertical: 2, borderRadius: Radius.xl },
  badgeText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm, color: Colors.accent },
  contestCard: { ...card, marginBottom: Spacing.md, overflow: "hidden" },
  hover: { backgroundColor: Colors.bgSurfaceHover },
  press: { backgroundColor: Colors.bgSurfacePress, transform: [{ scale: 0.98 }] },
  contestTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: Spacing.lg, paddingBottom: Spacing.md },
  contestName: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.lg, color: Colors.text, marginBottom: 2 },
  contestMatch: { fontFamily: FontFamily.body, fontSize: Font.sm, color: Colors.textSecondary },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.xl },
  statusText: { fontFamily: FontFamily.bodyBold, fontSize: Font.xs, letterSpacing: 0.3 },
  statsRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: Spacing.md, marginHorizontal: Spacing.lg },
  stat: { flex: 1, alignItems: "center" },
  statLabel: { fontFamily: FontFamily.body, fontSize: Font.xs, color: Colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 },
  statVal: { fontFamily: FontFamily.bodyBold, fontSize: Font.lg, color: Colors.text },
  statDiv: { width: 1, backgroundColor: Colors.border },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: Spacing["3xl"], gap: Spacing.md },
  emptyTitle: { fontFamily: FontFamily.heading, fontSize: Font.xl, color: Colors.text },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: Font.md, color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    backgroundColor: Colors.accent, paddingHorizontal: Spacing["2xl"], paddingVertical: Spacing.md, borderRadius: Radius.sm, marginTop: Spacing.md,
  },
  primaryBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md, color: Colors.textInverse },
});
