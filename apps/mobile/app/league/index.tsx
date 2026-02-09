import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { trpc } from "../../lib/trpc";

const BG = "#111210";
const CARD = "#1C1D1B";
const ACCENT = "#5DB882";
const GOLD = "#D4A43D";
const TEXT = "#EDECEA";
const MUTED = "#5E5D5A";

export default function LeaguesListScreen() {
  const router = useRouter();
  const { data: memberships, isLoading, refetch } = trpc.league.myLeagues.useQuery();
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
      case "salary_cap": return "#5DA8B8";
      case "prediction": return "#A088CC";
      default: return MUTED;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <FlatList
        data={memberships ?? []}
        keyExtractor={(item: any) => item.leagueId ?? item.league?.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: TEXT, fontSize: 24, fontWeight: "800", marginBottom: 16 }}>My Leagues</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => router.push("/league/create" as any)}
                style={{ flex: 1, backgroundColor: ACCENT, borderRadius: 14, padding: 14, alignItems: "center" }}
              >
                <Text style={{ color: BG, fontWeight: "800", fontSize: 15 }}>Create League</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/league/join" as any)}
                style={{ flex: 1, backgroundColor: CARD, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: ACCENT }}
              >
                <Text style={{ color: ACCENT, fontWeight: "800", fontSize: 15 }}>Join League</Text>
              </Pressable>
            </View>
          </View>
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
                  <Text style={{ color: TEXT, fontSize: 17, fontWeight: "700" }}>{league.name}</Text>
                  <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{league.tournament}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={{
                    backgroundColor: formatColor(league.format) + "20",
                    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
                  }}>
                    <Text style={{ color: formatColor(league.format), fontSize: 11, fontWeight: "700" }}>
                      {league.format.replace("_", " ").toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>
                    {item.role === "owner" ? "Owner" : item.role === "admin" ? "Admin" : "Member"}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <Text style={{ color: MUTED, textAlign: "center", marginTop: 32 }}>Loading...</Text>
          ) : (
            <View style={{ alignItems: "center", marginTop: 32 }}>
              <Text style={{ color: MUTED, fontSize: 16 }}>No leagues yet</Text>
              <Text style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>Create or join a league to get started</Text>
            </View>
          )
        }
      />
    </View>
  );
}
