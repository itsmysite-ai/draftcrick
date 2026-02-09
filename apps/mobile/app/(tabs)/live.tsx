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
import { Colors, Radius, Spacing, Font, FontFamily, card } from "../../lib/design";

function PulsingDot({ size = 8 }: { size?: number }) {
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
      <Animated.View style={[{ position: "absolute", width: size * 2, height: size * 2, borderRadius: size, backgroundColor: Colors.red }, style]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.red }} />
    </View>
  );
}

function LiveCard({ match, index, onPress }: { match: any; index: number; onPress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Pressable onPress={onPress} style={({ pressed, hovered }) => [
        s.liveCard, hovered && s.hover, pressed && s.press,
      ]}>
        <View style={s.liveHeader}>
          <Text style={s.tournament}>{match.tournament ?? "Cricket"}</Text>
          <View style={s.liveBadge}>
            <PulsingDot size={4} />
            <Text style={s.liveLabel}>LIVE</Text>
          </View>
        </View>
        <View style={s.teams}>
          <View style={s.teamSide}>
            <View style={s.teamBadge}>
              <Text style={s.teamInit}>{match.teamHome.substring(0, 3).toUpperCase()}</Text>
            </View>
            <Text style={s.teamName} numberOfLines={1}>{match.teamHome}</Text>
            {match.result && <Text style={s.score}>{match.result}</Text>}
          </View>
          <Text style={s.vs}>VS</Text>
          <View style={s.teamSide}>
            <View style={s.teamBadge}>
              <Text style={s.teamInit}>{match.teamAway.substring(0, 3).toUpperCase()}</Text>
            </View>
            <Text style={s.teamName} numberOfLines={1}>{match.teamAway}</Text>
          </View>
        </View>
        <View style={s.liveFooter}>
          <View style={s.row}><Ionicons name="location-outline" size={11} color={Colors.textTertiary} /><Text style={s.venue}>{match.venue ?? ""}</Text></View>
          <View style={s.row}><Ionicons name="play-circle" size={14} color={Colors.red} /><Text style={s.watchText}>Watch</Text></View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function LiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const q = trpc.match.live.useQuery(undefined, { refetchInterval: 10_000 });

  const onRefresh = useCallback(async () => { setRefreshing(true); await q.refetch(); setRefreshing(false); }, [q]);

  if (q.isLoading) return (
    <View style={[s.container, s.centered, { paddingTop: insets.top }]}>
      <ActivityIndicator color={Colors.accent} size="large" />
    </View>
  );

  const data = q.data ?? [];
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <View style={s.headerLeft}><PulsingDot size={5} /><Text style={s.headerTitle}>Live Matches</Text></View>
        {data.length > 0 && <View style={s.countBadge}><Text style={s.countText}>{data.length}</Text></View>}
      </View>
      {data.length === 0 ? (
        <Animated.View entering={FadeIn.delay(80)} style={s.empty}>
          <Ionicons name="pulse-outline" size={40} color={Colors.textTertiary} />
          <Text style={s.emptyTitle}>No live matches</Text>
          <Text style={s.emptyDesc}>Live scoring updates appear here during matches</Text>
          <View style={s.features}>
            {([["flash-outline", "Real-time scores"], ["stats-chart-outline", "Fantasy points"], ["notifications-outline", "Wicket alerts"]] as const).map(([icon, text], i) => (
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
          renderItem={({ item, index }) => <LiveCard match={item} index={index} onPress={() => router.push(`/match/${item.id}`)} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  headerTitle: { fontFamily: FontFamily.headingBold, fontSize: Font["2xl"], color: Colors.text },
  countBadge: { backgroundColor: Colors.redMuted, paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.xl },
  countText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm, color: Colors.red },

  liveCard: { ...card, borderColor: "rgba(255,77,79,0.15)", marginBottom: Spacing.md, overflow: "hidden" },
  hover: { backgroundColor: Colors.bgSurfaceHover },
  press: { backgroundColor: Colors.bgSurfacePress, transform: [{ scale: 0.98 }] },

  liveHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  tournament: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, color: Colors.accent, textTransform: "uppercase", letterSpacing: 0.5 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.redMuted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.xl },
  liveLabel: { fontFamily: FontFamily.bodyBold, fontSize: Font.xs, color: Colors.red },

  teams: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  teamSide: { flex: 1, alignItems: "center", gap: 5 },
  teamBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  teamInit: { fontFamily: FontFamily.headingBold, fontSize: Font.md, color: Colors.text },
  teamName: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.lg, color: Colors.text, textAlign: "center" },
  score: { fontFamily: FontFamily.bodyBold, fontSize: Font.md, color: Colors.amber },
  vs: { fontFamily: FontFamily.body, fontSize: Font.xs, color: Colors.textTertiary },

  liveFooter: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  venue: { fontFamily: FontFamily.body, fontSize: Font.xs, color: Colors.textTertiary },
  watchText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm, color: Colors.red },

  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: Spacing["3xl"], gap: Spacing.md },
  emptyTitle: { fontFamily: FontFamily.heading, fontSize: Font.xl, color: Colors.text },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: Font.md, color: Colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: Spacing.md },
  features: { ...card, gap: Spacing.md, padding: Spacing.xl, alignSelf: "stretch" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  featureText: { fontFamily: FontFamily.body, fontSize: Font.md, color: Colors.textSecondary },
});
