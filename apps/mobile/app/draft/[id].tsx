import { FlatList, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  FilterPill,
  HatchModal,
  ModeToggle,
  AnnouncementBanner,
  EggLoadingSpinner,
  CricketBallIcon,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";
import { useTheme } from "../../providers/ThemeProvider";

type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

const ROLE_FILTERS: ("all" | RoleKey)[] = ["all", "BAT", "BOWL", "AR", "WK"];

/** Format raw role enum to display-friendly text */
function formatRoleDisplay(role: string): string {
  const r = (role ?? "").toUpperCase();
  switch (r) {
    case "BATSMAN": case "BAT": return "Batsman";
    case "BOWLER": case "BOWL": return "Bowler";
    case "ALL_ROUNDER": case "ALL-ROUNDER": case "AR": return "All-Rounder";
    case "WICKET_KEEPER": case "WICKETKEEPER": case "WK": return "Wicket-Keeper";
    default: return role;
  }
}

export default function DraftRoomScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const { data: draftState, refetch: refetchState } = trpc.draft.getState.useQuery({ roomId: roomId! }, { refetchInterval: 3000 });
  const { data: picks, refetch: refetchPicks } = trpc.draft.getPicks.useQuery({ roomId: roomId! });
  const { data: room } = trpc.draft.getRoom.useQuery({ roomId: roomId! });
  const { data: players } = trpc.player.list.useQuery(undefined);
  const startMutation = trpc.draft.start.useMutation({ onSuccess: () => { refetchState(); refetchPicks(); } });
  const pickMutation = trpc.draft.makePick.useMutation({ onSuccess: () => { refetchState(); refetchPicks(); } });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hatchPlayer, setHatchPlayer] = useState<any>(null);
  const [roleFilter, setRoleFilter] = useState<"all" | RoleKey>("all");

  useEffect(() => {
    if (!draftState?.currentPickDeadline) { setCountdown(null); return; }
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(draftState.currentPickDeadline!).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [draftState?.currentPickDeadline]);

  const isMyTurn = draftState?.currentDrafter === user?.id;
  const pickedIds = new Set(draftState?.pickedPlayerIds ?? []);
  const availablePlayers = (players ?? []).filter((p: any) => !pickedIds.has(p.id));
  const filteredPlayers = roleFilter === "all"
    ? availablePlayers
    : availablePlayers.filter((p: any) => {
        const role = (p.role ?? "").toUpperCase();
        return role === roleFilter || role.includes(roleFilter.toLowerCase());
      });

  const handlePick = (playerId: string, player: any) => {
    Alert.alert(
      formatUIText("draft pick"),
      `${formatUIText("select")} ${player.name}?`,
      [
        { text: formatUIText("cancel"), style: "cancel" },
        {
          text: formatUIText("pick"),
          onPress: () => {
            setHatchPlayer({
              name: player.name,
              role: (player.role ?? "BAT").toUpperCase() as RoleKey,
              team: player.team ?? "",
              ovr: player.credits ?? 80,
            });
            pickMutation.mutate({ roomId: roomId!, playerId });
          },
        },
      ],
    );
  };

  return (
    <YStack flex={1} backgroundColor="$background" testID="draft-room-screen">
      {/* Header */}
      <YStack backgroundColor="$backgroundSurface" padding="$4">
        <XStack justifyContent="space-between" alignItems="center">
          <YStack>
            <Text testID="draft-round-info" fontFamily="$mono" fontSize={12} fontWeight="600" color="$colorMuted">
              {formatUIText("round")} {draftState?.currentRound ?? 0} {formatUIText("of")} {draftState?.maxRounds ?? 0}
            </Text>
            <Text testID="draft-turn-status" fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
              {draftState?.status === "waiting"
                ? formatUIText("waiting to start...")
                : draftState?.status === "completed"
                  ? formatUIText("draft complete!")
                  : isMyTurn
                    ? formatUIText("your pick!")
                    : formatUIText("waiting for pick...")}
            </Text>
          </YStack>
          <XStack alignItems="center" gap="$3">
            {countdown !== null && draftState?.status === "in_progress" && (
              <YStack
                testID="draft-countdown"
                backgroundColor={countdown <= 10 ? "$error" : "$accentBackground"}
                borderRadius={DesignSystem.radius.md}
                paddingHorizontal="$4"
                paddingVertical="$2"
              >
                <Text fontFamily="$mono" fontWeight="900" fontSize={DesignSystem.fontSize["4xl"]} color={countdown <= 10 ? "$color" : "$accentColor"}>
                  {countdown}s
                </Text>
              </YStack>
            )}
            <ModeToggle mode={mode} onToggle={toggleMode} />
          </XStack>
        </XStack>
        {draftState?.status === "in_progress" && (
          <Text testID="draft-picks-counter" fontFamily="$mono" fontSize={13} color="$accentBackground" marginTop="$1">
            {formatUIText("picks")}: {draftState.totalPicks} / {(draftState.maxRounds ?? 0) * (draftState.pickOrder?.length ?? 0)}
          </Text>
        )}
      </YStack>

      <AnnouncementBanner />

      {/* Start button */}
      {draftState?.status === "waiting" && (
        <YStack padding="$4">
          <Button testID="draft-start-btn" variant="primary" size="lg" onPress={() => startMutation.mutate({ roomId: roomId! })} disabled={startMutation.isPending}>
            {startMutation.isPending ? formatUIText("starting...") : formatUIText("start draft")}
          </Button>
        </YStack>
      )}

      {/* Role Filter Pills */}
      {draftState?.status === "in_progress" && (
        <XStack paddingHorizontal="$4" paddingVertical="$2" gap="$2" flexWrap="wrap">
          {ROLE_FILTERS.map((f) => (
            <FilterPill key={f} active={roleFilter === f} onPress={() => setRoleFilter(f)} testID={`draft-filter-${f}`}>
              <XStack alignItems="center" gap={4}>
                {f === "BOWL" ? (
                  <CricketBallIcon size={14} />
                ) : f !== "all" ? (
                  <Text fontSize={12}>{DesignSystem.roles[f as RoleKey].emoji}</Text>
                ) : null}
                <Text
                  fontFamily="$body"
                  fontSize={12}
                  fontWeight="500"
                  color={roleFilter === f ? "$background" : "$colorSecondary"}
                >
                  {f === "all" ? "all" : DesignSystem.roles[f as RoleKey].name.toLowerCase()}
                </Text>
              </XStack>
            </FilterPill>
          ))}
        </XStack>
      )}

      <XStack flex={1}>
        {/* Pick Log */}
        <YStack width="40%" borderRightWidth={1} borderRightColor="$borderColor">
          <Text {...textStyles.sectionHeader} padding="$3" paddingBottom="$2">
            {formatUIText("pick log")}
          </Text>
          <FlatList
            testID="draft-pick-log"
            data={[...(picks ?? [])].reverse()}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item, index }: { item: any; index: number }) => (
              <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
                <Card
                  padding="$3"
                  marginHorizontal="$2"
                  marginBottom="$1"
                  borderColor={item.userId === user?.id ? "$colorAccentLight" : "$borderColor"}
                >
                  <XStack alignItems="center" gap="$2">
                    <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                      #{item.pickNumber}
                    </Text>
                    <Badge variant="role" size="sm">
                      {formatBadgeText(`r${item.round}`)}
                    </Badge>
                  </XStack>
                  <Text {...textStyles.playerName} fontSize={13} numberOfLines={1} marginTop={2}>
                    {item.player?.name ?? formatUIText("unknown")}
                  </Text>
                  <Text {...textStyles.hint} numberOfLines={1}>
                    {formatUIText("by")} {item.user?.displayName ?? item.user?.username ?? formatUIText("unknown")}
                  </Text>
                </Card>
              </Animated.View>
            )}
          />
        </YStack>

        {/* Available Players */}
        <YStack flex={1}>
          <Text testID="draft-available-count" {...textStyles.sectionHeader} padding="$3" paddingBottom="$2">
            {formatUIText("available players")} ({filteredPlayers.length})
          </Text>
          <FlatList
            data={filteredPlayers}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item, index }: { item: any; index: number }) => (
              <Animated.View entering={FadeInDown.delay(40 + index * 25).springify()}>
                <Card
                  pressable
                  marginHorizontal="$2"
                  marginBottom="$1"
                  padding="$3"
                  opacity={isMyTurn ? 1 : 0.6}
                  onPress={() => isMyTurn ? handlePick(item.id, item) : null}
                  disabled={!isMyTurn || pickMutation.isPending}
                >
                  <XStack justifyContent="space-between" alignItems="center">
                    <XStack alignItems="center" gap="$2" flex={1}>
                      <InitialsAvatar
                        name={item.name}
                        playerRole={((item.role ?? "BAT").toUpperCase()) as RoleKey}
                        ovr={item.credits ?? 80}
                        size={32}
                      />
                      <YStack flex={1}>
                        <Text {...textStyles.playerName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <XStack alignItems="center" gap="$2">
                          <Badge variant="role" size="sm">
                            {formatRoleDisplay(item.role ?? "")}
                          </Badge>
                          <Text {...textStyles.secondary}>
                            {item.team}
                          </Text>
                        </XStack>
                      </YStack>
                    </XStack>
                    {item.credits && (
                      <Text fontFamily="$mono" fontWeight="700" fontSize={13} color="$accentBackground">
                        {item.credits}{formatUIText("cr")}
                      </Text>
                    )}
                  </XStack>
                </Card>
              </Animated.View>
            )}
            ListEmptyComponent={
              <YStack alignItems="center" paddingVertical="$8">
                <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
                <Text {...textStyles.hint} textAlign="center">
                  {formatUIText("no players available")}
                </Text>
              </YStack>
            }
          />
        </YStack>
      </XStack>

      {/* Hatch Modal */}
      {hatchPlayer && (
        <HatchModal
          player={hatchPlayer}
          onClose={() => setHatchPlayer(null)}
        />
      )}
    </YStack>
  );
}
