import { View, Text, Pressable, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { trpc } from "../../lib/trpc";

const BG = "#0A1628";
const CARD = "#1A2332";
const ACCENT = "#00F5A0";
const GOLD = "#FFD600";
const TEXT = "#FFFFFF";
const MUTED = "#6C757D";

export default function SocialScreen() {
  const router = useRouter();
  const { data: memberships, isLoading, refetch } = trpc.league.myLeagues.useQuery(undefined, {
    retry: false,
  });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatColor = (format: string) => {
    switch (format) {
      case "draft": return ACCENT;
      case "auction": return GOLD;
      case "salary_cap": return "#00B4D8";
      default: return MUTED;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <FlatList
        data={memberships ?? []}
        keyExtractor={(item: any) => item.leagueId ?? item.league?.id ?? Math.random().toString()}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        ListHeaderComponent={
          <>
            <Text style={{ color: TEXT, fontSize: 22, fontWeight: "800", marginBottom: 16 }}>Social & Leagues</Text>

            {/* Quick Actions */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              <Pressable
                onPress={() => router.push("/league/create" as any)}
                style={{ flex: 1, backgroundColor: ACCENT, borderRadius: 14, padding: 16, alignItems: "center" }}
              >
                <Text style={{ color: BG, fontWeight: "800", fontSize: 15 }}>Create League</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/league/join" as any)}
                style={{
                  flex: 1, backgroundColor: CARD, borderRadius: 14, padding: 16, alignItems: "center",
                  borderWidth: 1, borderColor: ACCENT,
                }}
              >
                <Text style={{ color: ACCENT, fontWeight: "800", fontSize: 15 }}>Join League</Text>
              </Pressable>
            </View>

            {/* Section Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: TEXT, fontSize: 18, fontWeight: "700" }}>My Leagues</Text>
              {(memberships?.length ?? 0) > 0 && (
                <Pressable onPress={() => router.push("/league" as any)}>
                  <Text style={{ color: ACCENT, fontSize: 13, fontWeight: "600" }}>View All</Text>
                </Pressable>
              )}
            </View>
          </>
        }
        renderItem={({ item }: { item: any }) => {
          const league = item.league;
          if (!league) return null;

          return (
            <Pressable
              onPress={() => router.push(`/league/${league.id}` as any)}
              style={{ backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 10 }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: TEXT, fontSize: 16, fontWeight: "700" }}>{league.name}</Text>
                  <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{league.tournament}</Text>
                </View>
                <View style={{
                  backgroundColor: formatColor(league.format) + "20",
                  paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
                }}>
                  <Text style={{ color: formatColor(league.format), fontSize: 11, fontWeight: "700" }}>
                    {league.format.replace("_", " ").toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <Text style={{ color: MUTED, fontSize: 11 }}>
                  Role: {item.role === "owner" ? "Owner" : item.role === "admin" ? "Admin" : "Member"}
                </Text>
                <Text style={{ color: MUTED, fontSize: 11 }}>
                  Template: {league.template}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <Text style={{ color: MUTED, textAlign: "center", marginTop: 24 }}>Loading your leagues...</Text>
          ) : (
            <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 24, alignItems: "center" }}>
              <Text style={{ color: TEXT, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>No leagues yet</Text>
              <Text style={{ color: MUTED, fontSize: 14, textAlign: "center" }}>
                Create a league to play with friends, or join an existing one with an invite code
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}
