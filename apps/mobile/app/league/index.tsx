import { FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Card, Badge, Button } from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";

export default function LeaguesListScreen() {
  const router = useRouter();
  const theme = useTamaguiTheme();
  const { data: memberships, isLoading, refetch } = trpc.league.myLeagues.useQuery();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <YStack flex={1} backgroundColor="$background">
      <FlatList
        data={memberships ?? []}
        keyExtractor={(item: any) => item.leagueId ?? item.league?.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentBackground.val} />}
        ListHeaderComponent={
          <YStack marginBottom="$4">
            <Text fontFamily="$heading" fontWeight="800" fontSize={24} color="$color" marginBottom="$4">My Leagues</Text>
            <XStack gap="$3">
              <Button variant="primary" size="md" flex={1} onPress={() => router.push("/league/create" as any)}>Create League</Button>
              <Button variant="secondary" size="md" flex={1} onPress={() => router.push("/league/join" as any)}>Join League</Button>
            </XStack>
          </YStack>
        }
        renderItem={({ item }: { item: any }) => {
          const league = item.league;
          if (!league) return null;
          return (
            <Card pressable onPress={() => router.push(`/league/${league.id}` as any)} marginBottom="$3" padding="$4">
              <XStack justifyContent="space-between" alignItems="flex-start">
                <YStack flex={1}>
                  <Text fontFamily="$body" fontWeight="700" fontSize={17} color="$color">{league.name}</Text>
                  <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginTop={2}>{league.tournament}</Text>
                </YStack>
                <YStack alignItems="flex-end">
                  <Badge backgroundColor="$colorAccentLight" color="$colorAccent" size="sm" fontWeight="700">{league.format.replace("_", " ").toUpperCase()}</Badge>
                  <Text fontFamily="$body" fontSize={11} color="$colorMuted" marginTop="$1">{item.role === "owner" ? "Owner" : item.role === "admin" ? "Admin" : "Member"}</Text>
                </YStack>
              </XStack>
            </Card>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <Text fontFamily="$body" color="$colorMuted" textAlign="center" marginTop="$8">Loading...</Text>
          ) : (
            <YStack alignItems="center" marginTop="$8">
              <Text fontFamily="$body" color="$colorMuted" fontSize={16}>No leagues yet</Text>
              <Text fontFamily="$body" color="$colorMuted" fontSize={13} marginTop="$1">Create or join a league to get started</Text>
            </YStack>
          )
        }
      />
    </YStack>
  );
}
