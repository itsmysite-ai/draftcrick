import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  Button,
  BackButton,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { HeaderControls } from "../../components/HeaderControls";

type Mode = "salary_cap" | "draft" | "auction";

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  salary_cap: "pick players within a budget — most popular format",
  draft: "snake draft — take turns picking players",
  auction: "bid on players with virtual currency",
};

export default function CreateTournamentLeagueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();

  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<Mode>("salary_cap");
  const [leagueId, setLeagueId] = useState<string | null>(null);

  // Fetch available tournaments
  const tournamentsQuery = trpc.sports.dashboard.useQuery(undefined, {
    staleTime: 60 * 60_000,
  });

  const createMutation = trpc.tournament.create.useMutation({
    onSuccess: (result) => {
      router.replace(`/tournament-league/${result!.id}` as any);
    },
  });

  const tournaments = (tournamentsQuery.data as any)?.tournaments ?? [];

  const handleCreate = () => {
    if (!leagueId || !selectedTournament) return;
    createMutation.mutate({
      leagueId,
      tournamentId: selectedTournament,
      mode: selectedMode,
    });
  };

  return (
    <YStack flex={1} backgroundColor="$background" testID="create-tournament-league">
      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}>
        {/* Header */}
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingTop={insets.top + 8}
          paddingBottom="$3"
        >
          <XStack alignItems="center" gap="$3">
            <SafeBackButton />
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color">
              {formatUIText("create tournament league")}
            </Text>
          </XStack>
          <HeaderControls />
        </XStack>

        {/* Step 1: Select Tournament */}
        <Text {...textStyles.sectionHeader} marginBottom="$2" marginTop="$2">
          {formatUIText("1. select tournament")}
        </Text>

        {tournamentsQuery.isLoading ? (
          <EggLoadingSpinner />
        ) : tournaments.length === 0 ? (
          <Text {...textStyles.hint}>{formatUIText("no tournaments available")}</Text>
        ) : (
          tournaments.map((t: any) => (
            <Card
              key={t.id ?? t.name}
              pressable
              padding="$4"
              marginBottom="$2"
              borderColor={selectedTournament === (t.id ?? t.name) ? "$accentBackground" : "$borderColor"}
              onPress={() => setSelectedTournament(t.id ?? t.name)}
              testID={`tournament-${t.id ?? t.name}`}
            >
              <XStack alignItems="center" gap="$3">
                <Text fontSize={20}>🏏</Text>
                <YStack flex={1}>
                  <Text fontFamily="$body" fontWeight="600" fontSize={14} color={selectedTournament === (t.id ?? t.name) ? "$accentBackground" : "$color"}>
                    {t.name}
                  </Text>
                  <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                    {t.format ?? "T20"} · {t.status ?? "upcoming"}
                  </Text>
                </YStack>
                {selectedTournament === (t.id ?? t.name) && (
                  <Text fontSize={16} color="$accentBackground">✓</Text>
                )}
              </XStack>
            </Card>
          ))
        )}

        {/* Step 2: Choose Mode */}
        <Text {...textStyles.sectionHeader} marginBottom="$2" marginTop="$4">
          {formatUIText("2. choose format")}
        </Text>

        {(["salary_cap", "draft", "auction"] as Mode[]).map((m) => (
          <Card
            key={m}
            pressable
            padding="$4"
            marginBottom="$2"
            borderColor={selectedMode === m ? "$accentBackground" : "$borderColor"}
            onPress={() => setSelectedMode(m)}
            testID={`mode-${m}`}
          >
            <XStack alignItems="center" gap="$3">
              <YStack flex={1}>
                <Text fontFamily="$body" fontWeight="600" fontSize={14} color={selectedMode === m ? "$accentBackground" : "$color"}>
                  {formatUIText(m.replace(/_/g, " "))}
                </Text>
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                  {formatUIText(MODE_DESCRIPTIONS[m])}
                </Text>
              </YStack>
              {selectedMode === m && (
                <Text fontSize={16} color="$accentBackground">✓</Text>
              )}
            </XStack>
          </Card>
        ))}

        {/* Create Button */}
        <Button
          variant="primary"
          size="lg"
          marginTop="$6"
          onPress={handleCreate}
          disabled={createMutation.isPending || !selectedTournament || !leagueId}
          opacity={!selectedTournament || !leagueId ? 0.4 : 1}
          testID="create-tournament-league-btn"
        >
          {createMutation.isPending
            ? formatUIText("creating...")
            : formatUIText("create tournament league")}
        </Button>

        {!leagueId && (
          <Text {...textStyles.hint} textAlign="center" marginTop="$2">
            {formatUIText("you need to create a league first before linking a tournament")}
          </Text>
        )}

        {createMutation.error && (
          <Text fontFamily="$body" color="$error" textAlign="center" marginTop="$3" fontSize={13}>
            {createMutation.error.message}
          </Text>
        )}
      </ScrollView>
    </YStack>
  );
}
