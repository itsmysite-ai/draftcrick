import { ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Card, Badge, Button } from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";

export default function ContestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTamaguiTheme();
  const [refreshing, setRefreshing] = useState(false);
  const contest = trpc.contest.getById.useQuery({ id: id! }, { enabled: !!id });
  const standings = trpc.contest.getStandings.useQuery({ contestId: id! }, { enabled: !!id });
  const onRefresh = useCallback(async () => { setRefreshing(true); await Promise.all([contest.refetch(), standings.refetch()]); setRefreshing(false); }, [contest, standings]);

  if (contest.isLoading) return (<YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center"><ActivityIndicator color={theme.accentBackground.val} size="large" /></YStack>);
  const c = contest.data;
  if (!c) return (<YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center"><Text fontFamily="$body" color="$error" fontSize={16}>Contest not found</Text></YStack>);

  const match = c.match;
  const isOpen = c.status === "open";
  const isLive = c.status === "live";
  const statusConfig: Record<string, { color: string; bg: string }> = { live: { color: "$error", bg: "$errorLight" }, settled: { color: "$colorAccent", bg: "$colorAccentLight" }, open: { color: "$colorCricket", bg: "$colorCricketLight" } };
  const cfg = statusConfig[c.status ?? "open"] ?? statusConfig.open!;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background.val }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentBackground.val} />}>
      <YStack padding="$5" borderBottomWidth={1} borderBottomColor="$borderColor">
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
          <Text fontFamily="$heading" fontWeight="800" fontSize={20} color="$color" flex={1}>{c.name}</Text>
          <Badge backgroundColor={cfg.bg as any} color={cfg.color as any} size="sm" fontWeight="800" marginLeft="$2">{c.status?.toUpperCase()}</Badge>
        </XStack>
        {match && (<XStack justifyContent="space-between" alignItems="center"><Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">{match.teamHome} vs {match.teamAway}</Text><Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$accentBackground">{match.tournament ?? "Cricket"}</Text></XStack>)}
      </YStack>
      <XStack flexWrap="wrap" padding="$4" gap="$3">
        {[{ label: "Prize Pool", value: `\u20B9${c.prizePool}` }, { label: "Entry Fee", value: c.entryFee === 0 ? "FREE" : `\u20B9${c.entryFee}` }, { label: "Spots", value: `${c.currentEntries}/${c.maxEntries}` }, { label: "Type", value: c.contestType?.toUpperCase() }].map((item) => (
          <Card key={item.label} flex={1} minWidth="45%" padding="$3">
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted" textTransform="uppercase" letterSpacing={0.3}>{item.label}</Text>
            <Text fontFamily="$body" fontWeight="700" fontSize={18} color="$color" marginTop="$1">{item.value}</Text>
          </Card>
        ))}
      </XStack>
      <YStack paddingHorizontal="$4" marginBottom="$4">
        <YStack height={6} backgroundColor="$borderColor" borderRadius={3}><YStack height={6} backgroundColor="$accentBackground" borderRadius={3} width={`${Math.min(100, (c.currentEntries / c.maxEntries) * 100)}%` as any} /></YStack>
        <Text fontFamily="$mono" fontSize={12} color="$colorMuted" marginTop="$1" textAlign="center">{c.maxEntries - c.currentEntries} spots left</Text>
      </YStack>
      {isOpen && (<YStack paddingHorizontal="$4" marginBottom="$4"><Button variant="primary" size="lg" onPress={() => { if (match) router.push(`/team/create?matchId=${match.id}&contestId=${c.id}`); }}>{c.entryFee === 0 ? "Join Free" : `Join \u20B9${c.entryFee}`}</Button></YStack>)}
      {c.prizeDistribution && Array.isArray(c.prizeDistribution) && (c.prizeDistribution as Array<{ rank: number; amount: number }>).length > 0 && (
        <YStack paddingHorizontal="$4" marginBottom="$6">
          <Text fontFamily="$heading" fontWeight="700" fontSize={18} color="$color" marginBottom="$3">Prize Distribution</Text>
          {(c.prizeDistribution as Array<{ rank: number; amount: number }>).map((prize, i) => (<Card key={i} marginBottom="$1" padding="$3"><XStack justifyContent="space-between" alignItems="center"><Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$colorCricket">#{prize.rank}</Text><Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color">\u20B9{prize.amount}</Text></XStack></Card>))}
        </YStack>
      )}
      <YStack paddingHorizontal="$4" marginBottom="$6">
        <Text fontFamily="$heading" fontWeight="700" fontSize={18} color="$color" marginBottom="$3">Leaderboard</Text>
        {standings.isLoading ? (<ActivityIndicator color={theme.accentBackground.val} style={{ padding: 20 }} />) : standings.data && standings.data.length > 0 ? (
          standings.data.map((entry: { rank: number; userId: string; totalPoints: number }, i: number) => (
            <Card key={entry.userId} marginBottom="$1" padding="$3" borderColor={i < 3 ? "$colorCricketLight" : "$borderColor"}>
              <XStack alignItems="center">
                <YStack width={36} alignItems="center"><Text fontFamily="$mono" fontWeight="800" fontSize={14} color={i === 0 ? "$colorCricket" : i === 1 ? "$colorSecondary" : i === 2 ? "$colorHatch" : "$color"}>#{entry.rank}</Text></YStack>
                <YStack flex={1} marginLeft="$2"><Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">Player {entry.userId.slice(0, 8)}</Text></YStack>
                <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$colorCricket">{entry.totalPoints.toFixed(1)} pts</Text>
              </XStack>
            </Card>
          ))
        ) : (<Card padding="$6" alignItems="center"><Text fontFamily="$body" color="$colorMuted" fontSize={14} textAlign="center">{isOpen ? "Leaderboard will appear once the match starts" : "No entries yet"}</Text></Card>)}
      </YStack>
    </ScrollView>
  );
}
