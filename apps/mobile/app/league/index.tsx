import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";

export default function LeaguesListScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const { data: memberships, isLoading, refetch } = trpc.league.myLeagues.useQuery();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatColor = (format: string) => {
    switch (format) {
      case "draft": return t.accent;
      case "auction": return t.gold;
      case "salary_cap": return t.cyan;
      case "prediction": return t.purple;
      default: return t.textTertiary;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <FlatList
        data={memberships ?? []}
        keyExtractor={(item: any) => item.leagueId ?? item.league?.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: t.text, fontSize: 24, fontWeight: "800", marginBottom: 16 }}>My Leagues</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => router.push("/league/create" as any)}
                style={{ flex: 1, backgroundColor: t.accent, borderRadius: 14, padding: 14, alignItems: "center" }}
              >
                <Text style={{ color: t.textInverse, fontWeight: "800", fontSize: 15 }}>Create League</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/league/join" as any)}
                style={{ flex: 1, backgroundColor: t.bgSurface, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: t.accent }}
              >
                <Text style={{ color: t.accent, fontWeight: "800", fontSize: 15 }}>Join League</Text>
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
              style={{ backgroundColor: t.bgSurface, borderRadius: 14, padding: 16, marginBottom: 10 }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>{league.name}</Text>
                  <Text style={{ color: t.textTertiary, fontSize: 13, marginTop: 2 }}>{league.tournament}</Text>
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
                  <Text style={{ color: t.textTertiary, fontSize: 11, marginTop: 4 }}>
                    {item.role === "owner" ? "Owner" : item.role === "admin" ? "Admin" : "Member"}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <Text style={{ color: t.textTertiary, textAlign: "center", marginTop: 32 }}>Loading...</Text>
          ) : (
            <View style={{ alignItems: "center", marginTop: 32 }}>
              <Text style={{ color: t.textTertiary, fontSize: 16 }}>No leagues yet</Text>
              <Text style={{ color: t.textTertiary, fontSize: 13, marginTop: 4 }}>Create or join a league to get started</Text>
            </View>
          )
        }
      />
    </View>
  );
}
