import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  StatLabel,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";

type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTamaguiTheme();
  const match = trpc.match.getById.useQuery({ id: id! }, { enabled: !!id });
  const contests = trpc.contest.listByMatch.useQuery({ matchId: id! }, { enabled: !!id });
  const matchPlayers = trpc.player.getByMatch.useQuery({ matchId: id! }, { enabled: !!id });

  if (match.isLoading) return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
      <EggLoadingSpinner size={48} message={formatUIText("loading match")} />
    </YStack>
  );
  const m = match.data;
  if (!m) return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
      <Text fontSize={DesignSystem.emptyState.iconSize} marginBottom="$4">{DesignSystem.emptyState.icon}</Text>
      <Text {...textStyles.hint}>{formatUIText("match not found")}</Text>
    </YStack>
  );

  const isLive = m.status === "live";
  const isUpcoming = m.status === "upcoming";
  const startTime = new Date(m.startTime);
  const timeStr = startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateStr = startTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background.val }}>
      {/* Match Header */}
      <YStack padding="$5" alignItems="center" borderBottomWidth={1} borderBottomColor="$borderColor">
        <XStack alignItems="center" gap="$2" marginBottom="$3">
          <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$accentBackground">
            {m.tournament ?? formatUIText("cricket")}
          </Text>
          {isLive && <Badge variant="live" size="sm">{formatBadgeText("live")}</Badge>}
        </XStack>
        <XStack alignItems="center" gap="$6">
          <YStack alignItems="center" flex={1}>
            <InitialsAvatar name={m.teamHome} playerRole="BAT" ovr={0} size={40} />
            <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$color" marginTop="$1">
              {m.teamHome}
            </Text>
          </YStack>
          <Text fontFamily="$mono" fontSize={14} color="$colorMuted">{formatUIText("vs")}</Text>
          <YStack alignItems="center" flex={1}>
            <InitialsAvatar name={m.teamAway} playerRole="BOWL" ovr={0} size={40} />
            <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$color" marginTop="$1">
              {m.teamAway}
            </Text>
          </YStack>
        </XStack>
        <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginTop="$3">{m.venue ?? ""}</Text>
        <Text fontFamily="$mono" fontSize={13} fontWeight="600" color="$colorCricket" marginTop="$1">
          {isLive ? formatUIText("in progress") : `${dateStr} ${formatUIText("at")} ${timeStr}`}
        </Text>
      </YStack>

      {/* Build Team CTA */}
      {isUpcoming && (
        <YStack padding="$4">
          <Button variant="primary" size="lg" onPress={() => router.push(`/team/create?matchId=${id}&contestId=`)}>
            {formatUIText("build team")}
          </Button>
        </YStack>
      )}

      {/* Contests */}
      <YStack padding="$5">
        <Text {...textStyles.sectionHeader} marginBottom="$3">
          {formatUIText("contests")} ({contests.data?.length ?? 0})
        </Text>
        {contests.isLoading ? (
          <EggLoadingSpinner size={32} message={formatUIText("loading contests")} />
        ) : contests.data && contests.data.length > 0 ? (
          contests.data.map((c, i) => (
            <Animated.View key={c.id} entering={FadeInDown.delay(i * 40).springify()}>
              <Card pressable onPress={() => router.push(`/contest/${c.id}`)} marginBottom="$3" padding="$4">
                <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                  <Text {...textStyles.playerName} fontSize={15}>{c.name}</Text>
                  <Badge variant="role" size="sm">
                    {formatBadgeText(c.contestType ?? "")}
                  </Badge>
                </XStack>
                <XStack justifyContent="space-between" marginBottom="$3">
                  <YStack>
                    <Text {...textStyles.hint}>{formatUIText("prize pool")}</Text>
                    <StatLabel label="" value={`\u20B9${c.prizePool}`} marginTop={2} />
                  </YStack>
                  <YStack>
                    <Text {...textStyles.hint}>{formatUIText("entry")}</Text>
                    <StatLabel label="" value={c.entryFee === 0 ? formatBadgeText("free") : `\u20B9${c.entryFee}`} marginTop={2} />
                  </YStack>
                  <YStack>
                    <Text {...textStyles.hint}>{formatUIText("spots")}</Text>
                    <StatLabel label="" value={`${c.currentEntries}/${c.maxEntries}`} marginTop={2} />
                  </YStack>
                </XStack>
                <YStack height={4} backgroundColor="$borderColor" borderRadius={2}>
                  <YStack height={4} backgroundColor="$accentBackground" borderRadius={2} width={`${Math.min(100, (c.currentEntries / c.maxEntries) * 100)}%` as any} />
                </YStack>
              </Card>
            </Animated.View>
          ))
        ) : (
          <Card padding="$5" alignItems="center">
            <Text fontSize={DesignSystem.emptyState.iconSize} marginBottom="$3">{DesignSystem.emptyState.icon}</Text>
            <Text {...textStyles.hint} textAlign="center">
              {formatUIText("no contests available for this match yet")}
            </Text>
          </Card>
        )}
      </YStack>

      {/* Players */}
      <YStack padding="$5">
        <Text {...textStyles.sectionHeader} marginBottom="$3">
          {formatUIText("players")} ({matchPlayers.data?.length ?? 0})
        </Text>
        {matchPlayers.isLoading ? (
          <EggLoadingSpinner size={32} message={formatUIText("loading players")} />
        ) : matchPlayers.data && matchPlayers.data.length > 0 ? (
          matchPlayers.data.map((ps, i) => (
            <Animated.View key={ps.id} entering={FadeInDown.delay(i * 25).springify()}>
              <Card pressable onPress={() => router.push(`/player/${ps.player?.id ?? ps.playerId}`)} marginBottom="$1" padding="$3">
                <XStack justifyContent="space-between" alignItems="center">
                  <XStack alignItems="center" gap="$2" flex={1}>
                    <InitialsAvatar
                      name={ps.player?.name ?? "?"}
                      playerRole={((ps.player?.role ?? "BAT").toUpperCase().replace("_", "").substring(0, 4)) as RoleKey}
                      ovr={0}
                      size={32}
                    />
                    <YStack flex={1}>
                      <Text {...textStyles.playerName}>{ps.player?.name ?? formatUIText("unknown")}</Text>
                      <XStack alignItems="center" gap="$2" marginTop={2}>
                        <Badge variant="role" size="sm">
                          {formatBadgeText(ps.player?.role?.replace("_", " ") ?? "")}
                        </Badge>
                        <Text {...textStyles.secondary}>{ps.player?.team}</Text>
                      </XStack>
                    </YStack>
                  </XStack>
                  <YStack alignItems="center" marginLeft="$3">
                    <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$colorCricket">
                      {Number(ps.fantasyPoints ?? 0).toFixed(1)}
                    </Text>
                    <Text {...textStyles.hint}>{formatUIText("pts")}</Text>
                  </YStack>
                </XStack>
              </Card>
            </Animated.View>
          ))
        ) : (
          <Card padding="$5" alignItems="center">
            <Text fontSize={DesignSystem.emptyState.iconSize} marginBottom="$3">{DesignSystem.emptyState.icon}</Text>
            <Text {...textStyles.hint} textAlign="center">
              {isUpcoming ? formatUIText("playing xi announced ~30 min before toss") : formatUIText("no player data available")}
            </Text>
          </Card>
        )}
      </YStack>
    </ScrollView>
  );
}
