import { ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Card, Badge, Button } from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTamaguiTheme();
  const match = trpc.match.getById.useQuery({ id: id! }, { enabled: !!id });
  const contests = trpc.contest.listByMatch.useQuery({ matchId: id! }, { enabled: !!id });
  const matchPlayers = trpc.player.getByMatch.useQuery({ matchId: id! }, { enabled: !!id });

  if (match.isLoading) return (<YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center"><ActivityIndicator color={theme.accentBackground.val} size="large" /></YStack>);
  const m = match.data;
  if (!m) return (<YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center"><Text fontFamily="$body" color="$error" fontSize={16}>Match not found</Text></YStack>);

  const isLive = m.status === "live";
  const isUpcoming = m.status === "upcoming";
  const startTime = new Date(m.startTime);
  const timeStr = startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateStr = startTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <YStack padding="$5" alignItems="center" borderBottomWidth={1} borderBottomColor="$borderColor">
        <XStack alignItems="center" gap="$2" marginBottom="$3">
          <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$accentBackground">{m.tournament ?? "Cricket"}</Text>
          {isLive && <Badge variant="live" size="sm" fontWeight="800" letterSpacing={1}>LIVE</Badge>}
        </XStack>
        <XStack alignItems="center" gap="$6">
          <YStack alignItems="center" flex={1}><Text fontFamily="$heading" fontWeight="800" fontSize={22} color="$color">{m.teamHome}</Text></YStack>
          <Text fontFamily="$body" fontSize={14} color="$colorMuted" fontWeight="600">VS</Text>
          <YStack alignItems="center" flex={1}><Text fontFamily="$heading" fontWeight="800" fontSize={22} color="$color">{m.teamAway}</Text></YStack>
        </XStack>
        <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginTop="$3">{m.venue ?? ""}</Text>
        <Text fontFamily="$mono" fontSize={13} fontWeight="600" color="$colorCricket" marginTop="$1">{isLive ? "In Progress" : `${dateStr} at ${timeStr}`}</Text>
      </YStack>
      {isUpcoming && (<YStack padding="$4"><Button variant="primary" size="lg" onPress={() => router.push(`/team/create?matchId=${id}&contestId=`)}>Build Team</Button></YStack>)}
      <YStack padding="$5">
        <Text fontFamily="$heading" fontWeight="700" fontSize={18} color="$color" marginBottom="$3">Contests ({contests.data?.length ?? 0})</Text>
        {contests.isLoading ? <ActivityIndicator color={theme.accentBackground.val} /> : contests.data && contests.data.length > 0 ? (
          contests.data.map((c) => (
            <Card key={c.id} pressable onPress={() => router.push(`/contest/${c.id}`)} marginBottom="$3" padding="$4">
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                <Text fontFamily="$body" fontWeight="700" fontSize={15} color="$color">{c.name}</Text>
                <Badge backgroundColor="$colorCricketLight" color="$colorCricket" size="sm" fontWeight="700">{c.contestType?.toUpperCase()}</Badge>
              </XStack>
              <XStack justifyContent="space-between" marginBottom="$3">
                <YStack><Text fontFamily="$mono" fontSize={11} color="$colorMuted">Prize Pool</Text><Text fontFamily="$body" fontWeight="700" fontSize={14} color="$color" marginTop={2}>{"\u20B9"}{c.prizePool}</Text></YStack>
                <YStack><Text fontFamily="$mono" fontSize={11} color="$colorMuted">Entry</Text><Text fontFamily="$body" fontWeight="700" fontSize={14} color="$color" marginTop={2}>{c.entryFee === 0 ? "FREE" : `\u20B9${c.entryFee}`}</Text></YStack>
                <YStack><Text fontFamily="$mono" fontSize={11} color="$colorMuted">Spots</Text><Text fontFamily="$body" fontWeight="700" fontSize={14} color="$color" marginTop={2}>{c.currentEntries}/{c.maxEntries}</Text></YStack>
              </XStack>
              <YStack height={4} backgroundColor="$borderColor" borderRadius={2}><YStack height={4} backgroundColor="$accentBackground" borderRadius={2} width={`${Math.min(100, (c.currentEntries / c.maxEntries) * 100)}%` as any} /></YStack>
            </Card>
          ))
        ) : (<Card padding="$5" alignItems="center"><Text fontFamily="$body" color="$colorMuted" fontSize={14} textAlign="center">No contests available for this match yet</Text></Card>)}
      </YStack>
      <YStack padding="$5">
        <Text fontFamily="$heading" fontWeight="700" fontSize={18} color="$color" marginBottom="$3">Players ({matchPlayers.data?.length ?? 0})</Text>
        {matchPlayers.isLoading ? <ActivityIndicator color={theme.accentBackground.val} /> : matchPlayers.data && matchPlayers.data.length > 0 ? (
          matchPlayers.data.map((ps) => (
            <Card key={ps.id} pressable onPress={() => router.push(`/player/${ps.player?.id ?? ps.playerId}`)} marginBottom="$1" padding="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <YStack flex={1}>
                  <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">{ps.player?.name ?? "Unknown"}</Text>
                  <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop={2} textTransform="capitalize">{ps.player?.team} · {ps.player?.role?.replace("_", " ") ?? ""}</Text>
                </YStack>
                <YStack alignItems="center" marginLeft="$3">
                  <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$colorCricket">{Number(ps.fantasyPoints ?? 0).toFixed(1)}</Text>
                  <Text fontFamily="$mono" fontSize={10} color="$colorMuted">pts</Text>
                </YStack>
              </XStack>
            </Card>
          ))
        ) : (<Card padding="$5" alignItems="center"><Text fontFamily="$body" color="$colorMuted" fontSize={14} textAlign="center">{isUpcoming ? "Playing XI announced ~30 min before toss" : "No player data available"}</Text></Card>)}
      </YStack>
    </ScrollView>
  );
}
