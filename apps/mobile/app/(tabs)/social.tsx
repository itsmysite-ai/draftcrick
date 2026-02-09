import {
  View, Text, StyleSheet, FlatList, Pressable, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { Radius, Spacing, Font, FontFamily } from "../../lib/design";
import { useTheme } from "../../providers/ThemeProvider";

function LeagueCard({ item, index, onPress }: { item: any; index: number; onPress: () => void }) {
  const { t } = useTheme();
  const league = item.league;
  if (!league) return null;

  const FMT: Record<string, { color: string; label: string }> = {
    draft: { color: t.accent, label: "DRAFT" },
    auction: { color: t.amber, label: "AUCTION" },
    salary_cap: { color: t.blue, label: "SALARY CAP" },
  };

  const fmt = FMT[league.format] ?? FMT.draft;

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 50).springify()}>
      <Pressable onPress={onPress} style={({ pressed, hovered }) => [
        s.leagueCard,
        { backgroundColor: t.bgSurface, borderColor: t.border },
        hovered && { backgroundColor: t.bgSurfaceHover },
        pressed && { backgroundColor: t.bgSurfacePress, transform: [{ scale: 0.98 }] },
      ]}>
        <View style={s.leagueTop}>
          <View style={{ flex: 1, marginRight: Spacing.md }}>
            <Text style={[s.leagueName, { color: t.text }]} numberOfLines={1}>{league.name}</Text>
            <Text style={[s.leagueTourney, { color: t.textSecondary }]}>{league.tournament}</Text>
          </View>
          <View style={[s.fmtBadge, { backgroundColor: fmt.color + "18" }]}>
            <Text style={[s.fmtText, { color: fmt.color }]}>{fmt.label}</Text>
          </View>
        </View>
        <View style={[s.leagueBottom, { borderTopColor: t.border }]}>
          <View style={s.row}>
            <Ionicons
              name={item.role === "owner" ? "shield" : item.role === "admin" ? "shield-half" : "person-outline"}
              size={12} color={item.role === "owner" ? t.amber : t.textTertiary}
            />
            <Text style={[s.roleText, { color: t.textSecondary }, item.role === "owner" && { color: t.amber }]}>
              {item.role === "owner" ? "Owner" : item.role === "admin" ? "Admin" : "Member"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={t.textTertiary} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function SocialScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const { data: memberships, isLoading, refetch } = trpc.league.myLeagues.useQuery(undefined, { retry: false });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  return (
    <View style={[s.container, { paddingTop: insets.top, backgroundColor: t.bg }]}>
      <View style={[s.header, { borderBottomColor: t.borderSubtle }]}>
        <Text style={[s.headerTitle, { color: t.text }]}>Leagues</Text>
      </View>

      <FlatList
        data={memberships ?? []}
        keyExtractor={(item: any) => item.leagueId ?? item.league?.id ?? Math.random().toString()}
        contentContainerStyle={{ paddingHorizontal: Spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <Animated.View entering={FadeInDown.delay(30).springify()} style={s.ctaRow}>
              <Pressable onPress={() => router.push("/league/create" as any)} style={({ pressed, hovered }) => [
                s.ctaCreate, { backgroundColor: t.accent },
                hovered && { opacity: 0.85 },
                pressed && { opacity: 0.7 },
              ]}>
                <Ionicons name="add-circle-outline" size={20} color={t.textInverse} />
                <Text style={[s.ctaCreateText, { color: t.textInverse }]}>Create League</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/league/join" as any)} style={({ pressed, hovered }) => [
                s.ctaJoin,
                { backgroundColor: t.bgSurface, borderColor: t.border },
                hovered && { backgroundColor: t.bgSurfaceHover },
                pressed && { backgroundColor: t.bgSurfacePress, transform: [{ scale: 0.98 }] },
              ]}>
                <Ionicons name="enter-outline" size={20} color={t.accent} />
                <Text style={[s.ctaJoinText, { color: t.accent }]}>Join League</Text>
              </Pressable>
            </Animated.View>
            {(memberships?.length ?? 0) > 0 && (
              <View style={s.sectionRow}>
                <Text style={[s.sectionTitle, { color: t.text }]}>My Leagues</Text>
                <Pressable onPress={() => router.push("/league" as any)}>
                  <Text style={[s.viewAll, { color: t.accent }]}>View All</Text>
                </Pressable>
              </View>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <LeagueCard item={item} index={index} onPress={() => item.league ? router.push(`/league/${item.league.id}` as any) : undefined} />
        )}
        ListEmptyComponent={
          isLoading ? (
            <Text style={[s.loading, { color: t.textTertiary }]}>Loading leagues...</Text>
          ) : (
            <Animated.View entering={FadeIn.delay(100)} style={[
              s.emptyCard,
              { backgroundColor: t.bgSurface, borderColor: t.border },
            ]}>
              <Ionicons name="people-outline" size={36} color={t.textTertiary} />
              <Text style={[s.emptyTitle, { color: t.text }]}>No leagues yet</Text>
              <Text style={[s.emptyDesc, { color: t.textSecondary }]}>Create a league or join one with an invite code</Text>
            </Animated.View>
          )
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, borderBottomWidth: 1 },
  headerTitle: { fontFamily: FontFamily.headingBold, fontSize: Font["2xl"] },

  ctaRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing["2xl"] },
  ctaCreate: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    borderRadius: Radius.sm, padding: Spacing.lg,
  },
  ctaCreateText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md },
  ctaJoin: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, padding: Spacing.lg,
  },
  ctaJoinText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md },

  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  sectionTitle: { fontFamily: FontFamily.heading, fontSize: Font.lg },
  viewAll: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm },

  leagueCard: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  leagueTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: Spacing.md },
  leagueName: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.lg, marginBottom: 2 },
  leagueTourney: { fontFamily: FontFamily.body, fontSize: Font.sm },
  fmtBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.xl },
  fmtText: { fontFamily: FontFamily.bodyBold, fontSize: Font.xs, letterSpacing: 0.5 },
  leagueBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: Spacing.md, borderTopWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  roleText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm },

  loading: { fontFamily: FontFamily.body, textAlign: "center", marginTop: Spacing["3xl"] },
  emptyCard: { borderRadius: Radius.md, borderWidth: 1, padding: Spacing["3xl"], alignItems: "center", gap: Spacing.md },
  emptyTitle: { fontFamily: FontFamily.heading, fontSize: Font.lg },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: Font.md, textAlign: "center", lineHeight: 22 },
});
