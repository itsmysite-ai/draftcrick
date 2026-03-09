import { ScrollView, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
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
  FilterPill,
  ModeToggle,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useNavigationStore } from "../../lib/navigation-store";
import { useTheme } from "../../providers/ThemeProvider";

type SquadPlayer = {
  playerId: string;
  role: string;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  name?: string;
  team?: string;
  credits?: number;
};

const CHIP_LABELS: Record<string, string> = {
  wildcard: "wildcard",
  triple_captain: "triple captain",
  bench_boost: "bench boost",
  free_hit: "free hit",
  power_play: "power play",
  death_over_specialist: "death over specialist",
};

const CHIP_DESCRIPTIONS: Record<string, string> = {
  wildcard: "unlimited transfers this match",
  triple_captain: "captain gets 3x points",
  bench_boost: "all 15 players score",
  free_hit: "unlimited transfers, reverts next match",
  power_play: "1.5x batting points",
  death_over_specialist: "2x death over wicket points",
};

export default function SubmitTeamScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const navCtx = useNavigationStore((s) => s.matchContext);
  const tournamentLeagueId = navCtx?.contestId ?? ""; // reuse contestId field for tlId
  const matchId = navCtx?.matchId ?? "";

  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const squadQuery = trpc.tournament.getCurrentSquad.useQuery(
    { tournamentLeagueId, matchId },
    { enabled: !!tournamentLeagueId && !!matchId }
  );

  const chipsQuery = trpc.tournament.getAvailableChips.useQuery(
    { tournamentLeagueId },
    { enabled: !!tournamentLeagueId }
  );

  const tradesQuery = trpc.tournament.getTradesRemaining.useQuery(
    { tournamentLeagueId },
    { enabled: !!tournamentLeagueId }
  );

  const submitMutation = trpc.tournament.submitTeam.useMutation({
    onSuccess: () => {
      if (Platform.OS === "web") {
        setAlertMessage(formatUIText("team submitted!"));
        setTimeout(() => router.back(), 1500);
      } else {
        Alert.alert(
          formatUIText("team submitted!"),
          formatUIText("your team has been submitted for this match."),
          [{ text: formatUIText("ok"), onPress: () => router.back() }]
        );
      }
    },
    onError: (error) => {
      setAlertMessage(error.message);
    },
  });

  const useChipMutation = trpc.tournament.useChip.useMutation({
    onSuccess: (_, vars) => {
      setActiveChip(vars.chipType);
      chipsQuery.refetch();
    },
    onError: (error) => {
      setAlertMessage(error.message);
    },
  });

  const squad = (squadQuery.data?.squad ?? []) as SquadPlayer[];
  const playingXi = (squadQuery.data?.playingXi ?? []) as SquadPlayer[];
  const isCarried = squadQuery.data?.isCarried ?? false;
  const chips = chipsQuery.data ?? [];
  const trades = tradesQuery.data;

  // Set captain/VC from squad data on load
  useMemo(() => {
    const captain = squad.find((p) => p.isCaptain);
    const vc = squad.find((p) => p.isViceCaptain);
    if (captain && !captainId) setCaptainId(captain.playerId);
    if (vc && !viceCaptainId) setViceCaptainId(vc.playerId);
  }, [squad]);

  const handleSubmit = () => {
    const finalSquad = squad.map((p) => ({
      ...p,
      isCaptain: p.playerId === captainId,
      isViceCaptain: p.playerId === viceCaptainId,
    }));

    submitMutation.mutate({
      tournamentLeagueId,
      matchId,
      squad: finalSquad,
      playingXi,
    });
  };

  const handleActivateChip = (chipType: string) => {
    useChipMutation.mutate({
      tournamentLeagueId,
      matchId,
      chipType: chipType as any,
    });
  };

  if (squadQuery.isLoading) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <EggLoadingSpinner />
        <Text {...textStyles.hint} marginTop="$3">{formatUIText("loading squad...")}</Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background" testID="submit-team-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}>
        {/* Header */}
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingTop={insets.top + 8}
          paddingBottom="$3"
        >
          <XStack alignItems="center" gap="$3">
            <BackButton onPress={() => router.back()} />
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color">
              {formatUIText("set team")}
            </Text>
          </XStack>
          <ModeToggle mode={mode} onToggle={toggleMode} />
        </XStack>

        {/* Carried indicator */}
        {isCarried && (
          <Card padding="$3" marginBottom="$3" borderColor="$accentBackground">
            <Text fontFamily="$body" fontSize={13} color="$accentBackground" textAlign="center">
              {formatUIText("team carried from previous match — modify as needed")}
            </Text>
          </Card>
        )}

        {/* Trades remaining */}
        {trades && (
          <XStack justifyContent="space-between" marginBottom="$3">
            <Text fontFamily="$mono" fontSize={12} color="$colorMuted">
              {formatUIText("trades used")}: {trades.used}/{trades.total}
            </Text>
            <Text fontFamily="$mono" fontSize={12} color="$colorMuted">
              {trades.remaining} {formatUIText("remaining")}
            </Text>
          </XStack>
        )}

        {/* Alert */}
        {alertMessage && (
          <Card padding="$3" marginBottom="$3" borderColor="$error">
            <Text fontFamily="$body" fontSize={13} color="$error" textAlign="center">
              {alertMessage}
            </Text>
          </Card>
        )}

        {/* Squad */}
        {squad.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6">
            <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
            <Text {...textStyles.hint} marginTop="$3">
              {formatUIText("no squad yet — this is your first match")}
            </Text>
          </YStack>
        ) : (
          <YStack>
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText("playing xi")} ({playingXi.length})
            </Text>
            {playingXi.map((p, i) => (
              <Animated.View key={p.playerId} entering={FadeInDown.delay(i * 20).springify()}>
                <Card padding="$3" marginBottom="$2" testID={`player-${p.playerId}`}>
                  <XStack alignItems="center" gap="$3">
                    <InitialsAvatar name={p.playerId.slice(0, 8)} playerRole={(p.role ?? "BAT") as any} ovr={0} size={32} />
                    <YStack flex={1}>
                      <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                        {(p as SquadPlayer).name ?? p.playerId.slice(0, 12)}
                      </Text>
                      <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                        {formatBadgeText(p.role)}
                      </Text>
                    </YStack>

                    {/* Captain / VC selection */}
                    <XStack gap="$2">
                      <FilterPill
                        active={captainId === p.playerId}
                        onPress={() => {
                          if (viceCaptainId === p.playerId) setViceCaptainId(null);
                          setCaptainId(p.playerId);
                        }}
                      >
                        C
                      </FilterPill>
                      <FilterPill
                        active={viceCaptainId === p.playerId}
                        onPress={() => {
                          if (captainId === p.playerId) setCaptainId(null);
                          setViceCaptainId(p.playerId);
                        }}
                      >
                        VC
                      </FilterPill>
                    </XStack>
                  </XStack>
                </Card>
              </Animated.View>
            ))}
          </YStack>
        )}

        {/* Chips */}
        {chips.length > 0 && (
          <YStack marginTop="$4">
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText("activate a chip")}
            </Text>
            {chips
              .filter((c) => c.remaining > 0)
              .map((chip) => (
                <Card
                  key={chip.chipType}
                  pressable
                  padding="$3"
                  marginBottom="$2"
                  borderColor={activeChip === chip.chipType ? "$accentBackground" : "$borderColor"}
                  onPress={() => handleActivateChip(chip.chipType)}
                  testID={`chip-${chip.chipType}`}
                >
                  <XStack alignItems="center" gap="$3">
                    <Text fontSize={20}>⚡</Text>
                    <YStack flex={1}>
                      <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                        {formatUIText(CHIP_LABELS[chip.chipType] ?? chip.chipType)}
                      </Text>
                      <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                        {formatUIText(CHIP_DESCRIPTIONS[chip.chipType] ?? "")}
                      </Text>
                    </YStack>
                    <Badge variant="subtle">
                      {chip.remaining}/{chip.total}
                    </Badge>
                  </XStack>
                </Card>
              ))}
            {activeChip && (
              <Text fontFamily="$body" fontSize={12} color="$accentBackground" textAlign="center" marginTop="$1">
                {formatUIText("active")}: {formatUIText(CHIP_LABELS[activeChip] ?? activeChip)}
              </Text>
            )}
          </YStack>
        )}

        {/* Submit Button */}
        <Button
          variant="primary"
          size="lg"
          marginTop="$6"
          onPress={handleSubmit}
          disabled={submitMutation.isPending || !captainId || !viceCaptainId || squad.length === 0}
          opacity={!captainId || !viceCaptainId || squad.length === 0 ? 0.4 : 1}
          testID="submit-team-btn"
        >
          {submitMutation.isPending
            ? formatUIText("submitting...")
            : formatUIText("submit team")}
        </Button>

        {!captainId && squad.length > 0 && (
          <Text {...textStyles.hint} textAlign="center" marginTop="$2">
            {formatUIText("select a captain and vice-captain to submit")}
          </Text>
        )}
      </ScrollView>
    </YStack>
  );
}
