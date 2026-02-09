import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { Colors, Radius, Spacing, Font, FontFamily, card } from "../../lib/design";

const FMT: Record<string, { color: string; label: string }> = {
  draft: { color: Colors.accent, label: "DRAFT" },
  auction: { color: Colors.amber, label: "AUCTION" },
  salary_cap: { color: Colors.blue, label: "SALARY CAP" },
};

function LeagueCard({ item, index, onPress }: { item: any; index: number; onPress: () => void }) {
  const league = item.league;
  if (!league) return null;
  const fmt = FMT[league.format] ?? FMT.draft;

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 50).springify()}>
      <Pressable onPress={onPress} style={({ pressed, hovered }) => [
        s.leagueCard, hovered && s.hover, pressed && s.press,
      ]}>
        <View style={s.leagueTop}>
          <View style={{ flex: 1, marginRight: Spacing.md }}>
            <Text style={s.leagueName} numberOfLines={1}>{league.name}</Text>
            <Text style={s.leagueTourney}>{league.tournament}</Text>
          </View>
          <View style={[s.fmtBadge, { backgroundColor: fmt.color + "18" }]}>
            <Text style={[s.fmtText, { color: fmt.color }]}>{fmt.label}</Text>
          </View>
        </View>
        <View style={s.leagueBottom}>
          <View style={s.row}>
            <Ionicons
              name={item.role === "owner" ? "shield" : item.role === "admin" ? "shield-half" : "person-outline"}
              size={12} color={item.role === "owner" ? Colors.amber : Colors.textTertiary}
            />
            <Text style={[s.roleText, item.role === "owner" && { color: Colors.amber }]}>
              {item.role === "owner" ? "Owner" : item.role === "admin" ? "Admin" : "Member"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function SocialScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: memberships, isLoading, refetch } = trpc.league.myLeagues.useQuery(undefined, { retry: false });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}><Text style={s.headerTitle}>Leagues</Text></View>

      <FlatList
        data={memberships ?? []}
        keyExtractor={(item: any) => item.leagueId ?? item.league?.id ?? Math.random().toString()}
        contentContainerStyle={{ paddingHorizontal: Spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <Animated.View entering={FadeInDown.delay(30).springify()} style={s.ctaRow}>
              <Pressable onPress={() => router.push("/league/create" as any)} style={({ pressed, hovered }) => [s.ctaCreate, hovered && { opacity: 0.85 }, pressed && { opacity: 0.7 }]}>
                <Ionicons name="add-circle-outline" size={20} color={Colors.textInverse} />
                <Text style={s.ctaCreateText}>Create League</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/league/join" as any)} style={({ pressed, hovered }) => [s.ctaJoin, hovered && s.hover, pressed && s.press]}>
                <Ionicons name="enter-outline" size={20} color={Colors.accent} />
                <Text style={s.ctaJoinText}>Join League</Text>
              </Pressable>
            </Animated.View>
            {(memberships?.length ?? 0) > 0 && (
              <View style={s.sectionRow}>
                <Text style={s.sectionTitle}>My Leagues</Text>
                <Pressable onPress={() => router.push("/league" as any)}><Text style={s.viewAll}>View All</Text></Pressable>
              </View>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <LeagueCard item={item} index={index} onPress={() => item.league ? router.push(`/league/${item.league.id}` as any) : undefined} />
        )}
        ListEmptyComponent={
          isLoading ? (
            <Text style={s.loading}>Loading leagues...</Text>
          ) : (
            <Animated.View entering={FadeIn.delay(100)} style={s.emptyCard}>
              <Ionicons name="people-outline" size={36} color={Colors.textTertiary} />
              <Text style={s.emptyTitle}>No leagues yet</Text>
              <Text style={s.emptyDesc}>Create a league or join one with an invite code</Text>
            </Animated.View>
          )
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg },
  headerTitle: { fontFamily: FontFamily.headingBold, fontSize: Font["2xl"], color: Colors.text },

  ctaRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing["2xl"] },
  ctaCreate: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    backgroundColor: Colors.accent, borderRadius: Radius.sm, padding: Spacing.lg,
  },
  ctaCreateText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md, color: Colors.textInverse },
  ctaJoin: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    ...card, padding: Spacing.lg,
  },
  ctaJoinText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md, color: Colors.accent },

  hover: { backgroundColor: Colors.bgSurfaceHover },
  press: { backgroundColor: Colors.bgSurfacePress, transform: [{ scale: 0.98 }] },

  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  sectionTitle: { fontFamily: FontFamily.heading, fontSize: Font.lg, color: Colors.text },
  viewAll: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm, color: Colors.accent },

  leagueCard: { ...card, padding: Spacing.lg, marginBottom: Spacing.md },
  leagueTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: Spacing.md },
  leagueName: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.lg, color: Colors.text, marginBottom: 2 },
  leagueTourney: { fontFamily: FontFamily.body, fontSize: Font.sm, color: Colors.textSecondary },
  fmtBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.xl },
  fmtText: { fontFamily: FontFamily.bodyBold, fontSize: Font.xs, letterSpacing: 0.5 },
  leagueBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  roleText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm, color: Colors.textSecondary },

  loading: { fontFamily: FontFamily.body, color: Colors.textTertiary, textAlign: "center", marginTop: Spacing["3xl"] },
  emptyCard: { ...card, padding: Spacing["3xl"], alignItems: "center", gap: Spacing.md },
  emptyTitle: { fontFamily: FontFamily.heading, fontSize: Font.lg, color: Colors.text },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: Font.md, color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
});
