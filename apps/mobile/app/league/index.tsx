import { FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftcrick/ui";
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
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5} marginBottom="$4">
              {formatUIText("my leagues")}
            </Text>
            <XStack gap="$3">
              <Button variant="primary" size="md" flex={1} onPress={() => router.push("/league/create" as any)}>
                {formatUIText("create league")}
              </Button>
              <Button variant="secondary" size="md" flex={1} onPress={() => router.push("/league/join" as any)}>
                {formatUIText("join league")}
              </Button>
            </XStack>
          </YStack>
        }
        renderItem={({ item, index }: { item: any; index: number }) => {
          const league = item.league;
          if (!league) return null;
          return (
            <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
              <Card pressable onPress={() => router.push(`/league/${league.id}` as any)} marginBottom="$3" padding="$4">
                <XStack justifyContent="space-between" alignItems="flex-start">
                  <YStack flex={1}>
                    <Text {...textStyles.playerName} fontSize={17}>
                      {league.name}
                    </Text>
                    <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginTop={2}>
                      {league.tournament}
                    </Text>
                  </YStack>
                  <YStack alignItems="flex-end">
                    <Badge variant="role" size="sm">
                      {formatBadgeText(league.format.replace("_", " "))}
                    </Badge>
                    <Text {...textStyles.hint} marginTop="$1">
                      {formatUIText(item.role === "owner" ? "owner" : item.role === "admin" ? "admin" : "member")}
                    </Text>
                  </YStack>
                </XStack>
              </Card>
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <YStack alignItems="center" marginTop="$8">
              <EggLoadingSpinner size={48} message={formatUIText("loading leagues")} />
            </YStack>
          ) : (
            <YStack alignItems="center" marginTop="$8">
              <Text fontSize={DesignSystem.emptyState.iconSize} marginBottom="$4">
                {DesignSystem.emptyState.icon}
              </Text>
              <Text {...textStyles.hint} textAlign="center" lineHeight={20}>
                {formatUIText("no leagues yet\ncreate or join a league to get started")}
              </Text>
            </YStack>
          )
        }
      />
    </YStack>
  );
}
