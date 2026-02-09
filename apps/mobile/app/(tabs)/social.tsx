import { FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { YStack, XStack, Text } from "tamagui";
import { Card, Badge, Button, formatUIText, formatBadgeText } from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";

function LeagueCard({
  item,
  index,
  onPress,
}: {
  item: any;
  index: number;
  onPress: () => void;
}) {
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
      <Card pressable onPress={onPress} marginBottom="$3">
        <XStack
          justifyContent="space-between"
          alignItems="flex-start"
          marginBottom="$3"
        >
          <YStack flex={1} marginRight="$3">
            <Text
              fontFamily="$body"
              fontWeight="600"
              fontSize={16}
              color="$color"
              numberOfLines={1}
              marginBottom={2}
            >
              {league.name}
            </Text>
            <Text fontFamily="$body" fontSize={12} color="$colorSecondary">
              {league.tournament}
            </Text>
          </YStack>
          <Badge
            backgroundColor={fmt.color + "18"}
            color={fmt.color}
            fontWeight="700"
            letterSpacing={0.5}
          >
            {fmt.label}
          </Badge>
        </XStack>
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingTop="$3"
          borderTopWidth={1}
          borderTopColor="$borderColor"
        >
          <XStack alignItems="center" gap={5}>
            <Ionicons
              name={
                item.role === "owner"
                  ? "shield"
                  : item.role === "admin"
                    ? "shield-half"
                    : "person-outline"
              }
              size={12}
              color={item.role === "owner" ? t.amber : t.textTertiary}
            />
            <Text
              fontFamily="$body"
              fontWeight="600"
              fontSize={11}
              color={
                item.role === "owner" ? "$colorCricket" : "$colorSecondary"
              }
            >
              {formatUIText(item.role === "owner"
                ? "owner"
                : item.role === "admin"
                  ? "admin"
                  : "member")}
            </Text>
          </XStack>
          <Ionicons name="chevron-forward" size={14} color={t.textTertiary} />
        </XStack>
      </Card>
    </Animated.View>
  );
}

export default function SocialScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const {
    data: memberships,
    isLoading,
    refetch,
  } = trpc.league.myLeagues.useQuery(undefined, { retry: false });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background">
      <YStack
        paddingHorizontal="$5"
        paddingVertical="$4"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
      >
        <Text fontFamily="$mono" fontSize={17} fontWeight="500" color="$color" letterSpacing={-0.5}>
          {formatUIText("my leagues")}
        </Text>
      </YStack>

      <FlatList
        data={memberships ?? []}
        keyExtractor={(item: any) =>
          item.leagueId ?? item.league?.id ?? Math.random().toString()
        }
        contentContainerStyle={{ paddingHorizontal: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.accent}
          />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <Animated.View entering={FadeInDown.delay(30).springify()}>
              <XStack gap="$3" marginBottom="$6">
                <Button
                  flex={1}
                  variant="primary"
                  icon={
                    <Ionicons
                      name="add-circle-outline"
                      size={20}
                      color={t.textInverse}
                    />
                  }
                  onPress={() => router.push("/league/create" as any)}
                  size="md"
                >
                  {formatUIText("create league")}
                </Button>
                <Button
                  flex={1}
                  variant="secondary"
                  size="md"
                  icon={
                    <Ionicons
                      name="enter-outline"
                      size={20}
                      color={t.accent}
                    />
                  }
                  onPress={() => router.push("/league/join" as any)}
                >
                  {formatUIText("join league")}
                </Button>
              </XStack>
            </Animated.View>
            {(memberships?.length ?? 0) > 0 && (
              <XStack
                justifyContent="space-between"
                alignItems="center"
                marginBottom="$3"
              >
                <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$color">
                  {formatUIText("my leagues")}
                </Text>
                <Text
                  fontFamily="$mono"
                  fontWeight="500"
                  fontSize={11}
                  color="$accentBackground"
                  onPress={() => router.push("/league" as any)}
                  cursor="pointer"
                >
                  {formatUIText("view all")}
                </Text>
              </XStack>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <LeagueCard
            item={item}
            index={index}
            onPress={() =>
              item.league
                ? router.push(`/league/${item.league.id}` as any)
                : undefined
            }
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <Text
              fontFamily="$body"
              textAlign="center"
              marginTop="$8"
              color="$colorMuted"
            >
              {formatUIText("loading leagues...")}
            </Text>
          ) : (
            <Animated.View entering={FadeIn.delay(100)}>
              <Card alignItems="center" gap="$3" padding="$8">
                <Ionicons
                  name="people-outline"
                  size={36}
                  color={t.textTertiary}
                />
                <Text fontSize={48} marginBottom="$2">🥚</Text>
                <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
                  {formatUIText("no leagues yet")}
                </Text>
                <Text
                  fontFamily="$mono"
                  fontSize={11}
                  textAlign="center"
                  lineHeight={18}
                  color="$colorMuted"
                >
                  {formatUIText("create a league or join one with an invite code")}
                </Text>
              </Card>
            </Animated.View>
          )
        }
        ListFooterComponent={<YStack height={100} />}
      />
    </YStack>
  );
}
