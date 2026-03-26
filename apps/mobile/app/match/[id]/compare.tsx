import { ScrollView, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../../components/SportText";
import {
  Card,
  Badge,
  Button,
  BackButton,
  InitialsAvatar,
  EggLoadingSpinner,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftplay/ui";
import { trpc } from "../../../lib/trpc";
import { HeaderControls } from "../../../components/HeaderControls";

const ROLE_SHORT: Record<string, string> = {
  wicket_keeper: "wk",
  all_rounder: "ar",
  batsman: "bat",
  bowler: "bowl",
};

export default function ComparePlayersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = decodeURIComponent(id ?? "");
  const router = useRouter();
  const theme = useTamaguiTheme();
  const insets = useSafeAreaInsets();

  const [selected, setSelected] = useState<string[]>([]);

  const playersQuery = trpc.player.getByMatch.useQuery(
    { matchId },
    { enabled: !!matchId, staleTime: 60 * 60_000 },
  );

  const playerList = useMemo(() => {
    const list = (playersQuery.data as any)?.players ?? playersQuery.data ?? [];
    if (!Array.isArray(list)) return [];
    return list.map((ps: any) => {
      const p = ps.player ?? ps;
      return p?.id ? { id: p.id, name: p.name, role: p.role ?? "unknown", team: p.team, photoUrl: p.photoUrl ?? null } : null;
    }).filter(Boolean) as { id: string; name: string; role: string; team: string; photoUrl: string | null }[];
  }, [playersQuery.data]);

  // Group players by team for easier selection
  const teamGroups = useMemo(() => {
    const groups = new Map<string, typeof playerList>();
    for (const p of playerList) {
      const existing = groups.get(p.team) ?? [];
      existing.push(p);
      groups.set(p.team, existing);
    }
    return Array.from(groups.entries());
  }, [playerList]);

  const compareQuery = trpc.analytics.comparePlayer.useQuery(
    { playerIds: selected },
    { enabled: selected.length >= 2 && selected.length <= 3, staleTime: 60 * 60_000 },
  );

  const togglePlayer = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const getStatRows = (isProfile: boolean) => isProfile
    ? [
        { key: "avgRuns", label: "Bat Avg" },
        { key: "strikeRate", label: "Strike Rate" },
        { key: "avgWickets", label: "Bowl Avg" },
        { key: "economyRate", label: "Economy" },
        { key: "formLast3", label: "Form" },
      ]
    : [
        { key: "avgRuns", label: "Avg Runs" },
        { key: "strikeRate", label: "Strike Rate" },
        { key: "highScore", label: "High Score" },
        { key: "fifties", label: "50s" },
        { key: "avgWickets", label: "Avg Wickets" },
        { key: "economyRate", label: "Economy" },
        { key: "bestBowling", label: "Best Bowling" },
        { key: "totalCatches", label: "Catches" },
        { key: "avgFantasyPoints", label: "Avg FPts" },
        { key: "bestFantasyPoints", label: "Best FPts" },
        { key: "formLast3", label: "Form (Last 3)" },
        { key: "consistency", label: "Consistency" },
      ];

  const isProfileData = compareQuery.data?.[0]?.source === "profile";

  return (
    <ScrollView
      testID="compare-screen"
      style={{ flex: 1, backgroundColor: theme.background?.val }}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      {/* Header */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={insets.top + 8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <SafeBackButton />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("compare players")}
          </Text>
        </XStack>
        <HeaderControls />
      </XStack>

      {/* Comparison Results — shown first when players are selected */}
      {selected.length >= 2 && (
        <Animated.View entering={FadeInDown.springify()}>
          <YStack paddingHorizontal="$4" marginBottom="$4">
            {compareQuery.isLoading ? (
              <Card padding="$4">
                <EggLoadingSpinner size={32} message={formatUIText("comparing players")} />
              </Card>
            ) : compareQuery.data && compareQuery.data.length >= 2 ? (
              <Card padding="$3">
                {/* Player headers */}
                <XStack marginBottom="$2" alignItems="flex-end">
                  <YStack width={80} />
                  {compareQuery.data.map((p: any) => {
                    const photo = playerList.find((pl) => pl.id === p.playerId)?.photoUrl;
                    return (
                    <YStack key={p.playerId} flex={1} alignItems="center" gap={2}>
                      <InitialsAvatar name={p.name} playerRole={p.role?.toUpperCase()} ovr={0} size={30} hideBadge imageUrl={photo} />
                      <Text fontFamily="$body" fontWeight="600" fontSize={10} color="$color" textAlign="center" numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text fontFamily="$mono" fontSize={8} color="$colorMuted" textTransform="uppercase">
                        {ROLE_SHORT[p.role] ?? p.role}
                      </Text>
                      {p.matches > 0 && (
                        <Text fontFamily="$mono" fontSize={7} color="$colorMuted">
                          {p.matches} {p.source === "profile" ? "career" : "mat"}
                        </Text>
                      )}
                    </YStack>
                  );
                  })}
                </XStack>

                {/* Stat rows */}
                {getStatRows(isProfileData).map(({ key, label }) => {
                  const values = compareQuery.data!.map((p: any) => Number(p[key] ?? 0));
                  const allZero = values.every((v) => v === 0);
                  if (allZero) return null;
                  const best = key === "consistency" || key === "economyRate"
                    ? Math.min(...values.filter((v) => v > 0))
                    : Math.max(...values);

                  return (
                    <XStack key={key} paddingVertical="$2" borderBottomWidth={1} borderBottomColor="$borderColor" alignItems="center">
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted" width={80}>{label}</Text>
                      {compareQuery.data!.map((p: any) => {
                        const val = Number(p[key] ?? 0);
                        const isBest = val === best && val > 0;
                        return (
                          <Text
                            key={p.playerId}
                            fontFamily="$mono"
                            fontWeight={isBest ? "800" : "500"}
                            fontSize={12}
                            color={isBest ? "$accentBackground" : "$color"}
                            flex={1}
                            textAlign="center"
                          >
                            {val || "—"}
                          </Text>
                        );
                      })}
                    </XStack>
                  );
                })}

                {/* Clear button */}
                <Button
                  size="sm"
                  variant="secondary"
                  marginTop="$3"
                  onPress={() => setSelected([])}
                >
                  {formatUIText("clear selection")}
                </Button>
              </Card>
            ) : compareQuery.isError ? (
              <Text {...textStyles.hint} textAlign="center">{formatUIText("comparison failed")}</Text>
            ) : null}
          </YStack>
        </Animated.View>
      )}

      {/* Player Selection — compact list */}
      <YStack paddingHorizontal="$4">
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
          <Text {...textStyles.sectionHeader}>
            {formatUIText("select 2-3 players")}
          </Text>
          <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
            {selected.length}/3
          </Text>
        </XStack>

        {playersQuery.isLoading ? (
          <EggLoadingSpinner size={32} message={formatUIText("loading players")} />
        ) : (
          <YStack gap="$3">
            {teamGroups.map(([teamName, players]) => (
              <YStack key={teamName}>
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted" marginBottom="$1" textTransform="uppercase" letterSpacing={0.5}>
                  {formatUIText(teamName)}
                </Text>
                <Card padding={0} overflow="hidden">
                  {players.map((p, i) => {
                    const isSelected = selected.includes(p.id);
                    const isLast = i === players.length - 1;
                    const roleShort = ROLE_SHORT[p.role] ?? p.role;
                    return (
                      <XStack
                        key={p.id}
                        pressStyle={{ opacity: 0.7 }}
                        onPress={() => togglePlayer(p.id)}
                        alignItems="center"
                        paddingVertical="$2"
                        paddingHorizontal="$3"
                        gap="$2"
                        borderBottomWidth={isLast ? 0 : 1}
                        borderBottomColor="$borderColor"
                        backgroundColor={isSelected ? "$accentBackground" : "transparent"}
                        opacity={isSelected ? 0.9 : 1}
                        cursor="pointer"
                      >
                        <InitialsAvatar name={p.name} playerRole={p.role?.toUpperCase()} ovr={0} size={24} hideBadge imageUrl={p.photoUrl} />
                        <Text
                          fontFamily="$body"
                          fontWeight={isSelected ? "700" : "500"}
                          fontSize={12}
                          color={isSelected ? "white" : "$color"}
                          flex={1}
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>
                        <Text
                          fontFamily="$mono"
                          fontSize={9}
                          color={isSelected ? "rgba(255,255,255,0.7)" : "$colorMuted"}
                          textTransform="uppercase"
                        >
                          {roleShort}
                        </Text>
                        {isSelected && (
                          <Text fontSize={12} color="white">✓</Text>
                        )}
                      </XStack>
                    );
                  })}
                </Card>
              </YStack>
            ))}
          </YStack>
        )}
      </YStack>
    </ScrollView>
  );
}
