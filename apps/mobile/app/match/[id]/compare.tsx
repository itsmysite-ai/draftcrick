import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  Button,
  BackButton,
  InitialsAvatar,
  ModeToggle,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftplay/ui";
import { trpc } from "../../../lib/trpc";
import { useTheme } from "../../../providers/ThemeProvider";

export default function ComparePlayersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = decodeURIComponent(id ?? "");
  const router = useRouter();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [selected, setSelected] = useState<string[]>([]);

  // Fetch players for this match
  const playersQuery = trpc.player.getByMatch.useQuery(
    { matchId },
    { enabled: !!matchId, staleTime: 60 * 60_000 },
  );

  const playerList = useMemo(() => {
    const list = (playersQuery.data as any)?.players ?? playersQuery.data ?? [];
    if (!Array.isArray(list)) return [];
    return list.map((ps: any) => {
      const p = ps.player ?? ps;
      return p?.id ? { id: p.id, name: p.name, role: p.role ?? "unknown", team: p.team } : null;
    }).filter(Boolean) as { id: string; name: string; role: string; team: string }[];
  }, [playersQuery.data]);

  // Compare query — only runs when 2-3 players selected
  const compareQuery = trpc.analytics.comparePlayer.useQuery(
    { playerIds: selected },
    { enabled: selected.length >= 2 && selected.length <= 3, staleTime: 60 * 60_000 },
  );

  const togglePlayer = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, id];
    });
  };

  const STAT_ROWS = [
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background?.val }}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={insets.top + 8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <BackButton onPress={() => router.back()} />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("compare players")}
          </Text>
        </XStack>
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>

      {/* Player Selection */}
      <YStack paddingHorizontal="$4" marginBottom="$4">
        <Text {...textStyles.sectionHeader} marginBottom="$2">
          {formatUIText("select 2-3 players")}
        </Text>
        <Text {...textStyles.hint} marginBottom="$3">
          {selected.length}/3 {formatUIText("selected")}
        </Text>

        {playersQuery.isLoading ? (
          <EggLoadingSpinner size={32} message={formatUIText("loading players")} />
        ) : (
          <YStack gap="$1">
            {playerList.map((p) => {
              const isSelected = selected.includes(p.id);
              return (
                <Card
                  key={p.id}
                  pressable
                  onPress={() => togglePlayer(p.id)}
                  padding="$3"
                  marginBottom="$1"
                  borderWidth={isSelected ? 2 : 1}
                  borderColor={isSelected ? "$accentBackground" : "$borderColor"}
                >
                  <XStack alignItems="center" gap="$2">
                    <InitialsAvatar name={p.name} playerRole={p.role?.toUpperCase()} ovr={0} size={28} />
                    <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" flex={1} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <XStack gap="$1">
                      <Badge variant="default" size="sm">{formatBadgeText(p.role)}</Badge>
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{p.team}</Text>
                    </XStack>
                    {isSelected && (
                      <Badge variant="live" size="sm">{formatBadgeText("selected")}</Badge>
                    )}
                  </XStack>
                </Card>
              );
            })}
          </YStack>
        )}
      </YStack>

      {/* Comparison Results */}
      {selected.length >= 2 && (
        <Animated.View entering={FadeInDown.springify()}>
          <YStack paddingHorizontal="$4">
            <Text {...textStyles.sectionHeader} marginBottom="$3">
              {formatUIText("comparison")}
            </Text>

            {compareQuery.isLoading ? (
              <EggLoadingSpinner size={32} message={formatUIText("comparing players")} />
            ) : compareQuery.data && compareQuery.data.length >= 2 ? (
              <Card padding="$4">
                {/* Player headers */}
                <XStack marginBottom="$3">
                  <YStack flex={1} />
                  {compareQuery.data.map((p: any) => (
                    <YStack key={p.playerId} flex={1} alignItems="center" gap={2}>
                      <InitialsAvatar name={p.name} playerRole={p.role?.toUpperCase()} ovr={0} size={32} />
                      <Text fontFamily="$body" fontWeight="600" fontSize={10} color="$color" textAlign="center" numberOfLines={2}>
                        {p.name}
                      </Text>
                      <Badge variant="default" size="sm">{formatBadgeText(p.role)}</Badge>
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{p.matches} matches</Text>
                    </YStack>
                  ))}
                </XStack>

                {/* Stat rows */}
                {STAT_ROWS.map(({ key, label }) => {
                  const values = compareQuery.data!.map((p: any) => Number(p[key] ?? 0));
                  const best = key === "consistency" || key === "economyRate"
                    ? Math.min(...values.filter((v) => v > 0))
                    : Math.max(...values);

                  return (
                    <XStack key={key} paddingVertical="$1" borderBottomWidth={1} borderBottomColor="$borderColor" alignItems="center">
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted" flex={1}>{label}</Text>
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
                            {val}
                          </Text>
                        );
                      })}
                    </XStack>
                  );
                })}
              </Card>
            ) : compareQuery.isError ? (
              <Text {...textStyles.hint} textAlign="center">{formatUIText("comparison failed")}</Text>
            ) : null}
          </YStack>
        </Animated.View>
      )}
    </ScrollView>
  );
}
