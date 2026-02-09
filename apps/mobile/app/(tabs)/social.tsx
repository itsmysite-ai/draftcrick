import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { Colors, Gradients, Radius, Shadow, Spacing, Font } from "../../lib/design";

const FORMAT_CONFIG: Record<string, { gradient: readonly string[]; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  draft: { gradient: Gradients.primary, icon: "swap-horizontal", label: "DRAFT" },
  auction: { gradient: Gradients.gold, icon: "cash-outline", label: "AUCTION" },
  salary_cap: { gradient: Gradients.blue, icon: "card-outline", label: "SALARY CAP" },
};

function LeagueCard({ item, index, onPress }: { item: any; index: number; onPress: () => void }) {
  const league = item.league;
  if (!league) return null;

  const fc = FORMAT_CONFIG[league.format] ?? FORMAT_CONFIG.draft;

  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 60).springify()}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.leagueCard}
      >
        <View style={styles.leagueCardInner}>
          <View style={styles.leagueTop}>
            <View style={styles.leagueInfo}>
              <Text style={styles.leagueName} numberOfLines={1}>{league.name}</Text>
              <Text style={styles.leagueTournament}>{league.tournament}</Text>
            </View>
            <View style={styles.formatBadge}>
              <LinearGradient
                colors={fc.gradient as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name={fc.icon} size={10} color="#fff" />
              <Text style={styles.formatText}>{fc.label}</Text>
            </View>
          </View>

          <View style={styles.leagueBottom}>
            <View style={styles.leagueMeta}>
              <Ionicons
                name={item.role === "owner" ? "shield" : item.role === "admin" ? "shield-half" : "person"}
                size={12}
                color={item.role === "owner" ? Colors.amber : Colors.textSecondary}
              />
              <Text style={[
                styles.leagueMetaText,
                item.role === "owner" && { color: Colors.amber },
              ]}>
                {item.role === "owner" ? "Owner" : item.role === "admin" ? "Admin" : "Member"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function SocialScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: memberships, isLoading, refetch } = trpc.league.myLeagues.useQuery(undefined, { retry: false });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leagues</Text>
      </View>

      <FlatList
        data={memberships ?? []}
        keyExtractor={(item: any) => item.leagueId ?? item.league?.id ?? Math.random().toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* CTA Buttons */}
            <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.ctaRow}>
              <TouchableOpacity
                onPress={() => router.push("/league/create" as any)}
                activeOpacity={0.85}
                style={styles.ctaCardCreate}
              >
                <LinearGradient
                  colors={Gradients.primary as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="add-circle-outline" size={24} color={Colors.textInverse} />
                <Text style={styles.ctaCreateText}>Create League</Text>
                <Text style={styles.ctaCreateSub}>Start your own</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/league/join" as any)}
                activeOpacity={0.85}
                style={styles.ctaCardJoin}
              >
                <Ionicons name="enter-outline" size={24} color={Colors.accent} />
                <Text style={styles.ctaJoinText}>Join League</Text>
                <Text style={styles.ctaJoinSub}>Use invite code</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Section Header */}
            {(memberships?.length ?? 0) > 0 && (
              <Animated.View entering={FadeIn.delay(100)} style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>My Leagues</Text>
                <TouchableOpacity onPress={() => router.push("/league" as any)}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <LeagueCard
            item={item}
            index={index}
            onPress={() => item.league ? router.push(`/league/${item.league.id}` as any) : undefined}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>Loading leagues...</Text>
            </View>
          ) : (
            <Animated.View entering={FadeIn.delay(200)} style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="people-outline" size={40} color={Colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>No leagues yet</Text>
              <Text style={styles.emptySub}>
                Create a league to play with friends, or join one with an invite code
              </Text>
            </Animated.View>
          )
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  headerTitle: {
    fontSize: Font["2xl"],
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.3,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
  },
  ctaRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  ctaCardCreate: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
    overflow: "hidden",
    ...Shadow.md,
  },
  ctaCreateText: {
    fontSize: Font.md,
    fontWeight: "800",
    color: Colors.textInverse,
  },
  ctaCreateSub: {
    fontSize: Font.xs,
    color: "rgba(0,0,0,0.5)",
  },
  ctaCardJoin: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
  },
  ctaJoinText: {
    fontSize: Font.md,
    fontWeight: "800",
    color: Colors.accent,
  },
  ctaJoinSub: {
    fontSize: Font.xs,
    color: Colors.textTertiary,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Font.lg,
    fontWeight: "700",
    color: Colors.text,
  },
  viewAllText: {
    fontSize: Font.sm,
    fontWeight: "600",
    color: Colors.accent,
  },
  leagueCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    overflow: "hidden",
    ...Shadow.sm,
  },
  leagueCardInner: {
    padding: Spacing.lg,
  },
  leagueTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  leagueInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  leagueName: {
    fontSize: Font.lg,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 2,
  },
  leagueTournament: {
    fontSize: Font.sm,
    color: Colors.textSecondary,
  },
  formatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  formatText: {
    fontSize: Font.xs,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  leagueBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  leagueMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  leagueMetaText: {
    fontSize: Font.sm,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  loadingWrap: {
    padding: Spacing["3xl"],
    alignItems: "center",
  },
  loadingText: {
    color: Colors.textTertiary,
    fontSize: Font.md,
  },
  emptyCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing["3xl"],
    alignItems: "center",
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: Font.lg,
    fontWeight: "700",
    color: Colors.text,
  },
  emptySub: {
    fontSize: Font.md,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
