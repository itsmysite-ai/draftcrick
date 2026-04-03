/**
 * Pick Your XI — Team selection for auction/draft leagues.
 *
 * Shows only the user's 14 auctioned squad players.
 * User picks 11 for the match, sets captain and vice-captain.
 * No budget/credits — players are already bought.
 *
 * Route params (via navigation store):
 *   matchId, contestId, teamA, teamB, format, venue, tournament
 */

import { FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import { SafeBackButton } from "../../components/SafeBackButton";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  AlertModal,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  formatTeamName,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";
import { HeaderControls } from "../../components/HeaderControls";
import { useNavigationStore } from "../../lib/navigation-store";

const TEAM_SIZE = 11;
type RoleKey = "BAT" | "BOWL" | "AR" | "WK";
const roleKey = (role: string): RoleKey => {
  const r = (role ?? "").toLowerCase();
  if (r.includes("keeper") || r === "wicket_keeper") return "WK";
  if (r.includes("all") || r === "all_rounder") return "AR";
  if (r.includes("bowl") || r === "bowler") return "BOWL";
  return "BAT";
};
const roleLabel = (role: string) => ({ wicket_keeper: "WK", all_rounder: "AR", bowler: "BOWL", batsman: "BAT" }[role] ?? "BAT");

interface SquadPlayer {
  id: string;
  name: string;
  team: string;
  role: string;
  credits: number;
  nationality: string;
  photoUrl: string | null;
  formNote: string | null;
  average: number | null;
  strikeRate: number | null;
  economyRate: number | null;
  matchesPlayed: number | null;
  recentForm: number | null;
  injuryStatus: string | null;
}

export default function PickXIScreen() {
  const navCtx = useNavigationStore((s) => s.matchContext);
  const matchId = navCtx?.matchId;
  const contestId = navCtx?.contestId;
  const teamA = navCtx?.teamA;
  const teamB = navCtx?.teamB;
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTamaguiTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<"pick" | "captain" | "review">("pick");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [statsPlayer, setStatsPlayer] = useState<SquadPlayer | null>(null);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  // Get DB user ID
  const { data: profile } = trpc.auth.getProfile.useQuery();
  const dbUserId = (profile as any)?.userId;

  // Get contest → league → draft room → squad
  const contestQuery = trpc.contest.getById.useQuery({ id: contestId! }, { enabled: !!contestId });
  const leagueId = (contestQuery.data as any)?.leagueId;
  const draftRoomsQuery = trpc.draft.getRoomsByLeague.useQuery({ leagueId: leagueId! }, { enabled: !!leagueId });
  const completedRoom = (draftRoomsQuery.data ?? []).find((r: any) => r.status === "completed");
  const picksQuery = trpc.draft.getPicks.useQuery({ roomId: completedRoom?.id! }, { enabled: !!completedRoom?.id });

  // Get my squad player IDs
  const myPickPlayerIds = useMemo(() => {
    if (!picksQuery.data || !dbUserId) return [];
    return (picksQuery.data as any[]).filter((p: any) => p.userId === dbUserId).map((p: any) => p.playerId);
  }, [picksQuery.data, dbUserId]);

  // Fetch full player data for squad
  const playersQuery = trpc.player.getByIds.useQuery({ ids: myPickPlayerIds }, { enabled: myPickPlayerIds.length > 0 });

  // Build squad with stats
  const squad: SquadPlayer[] = useMemo(() => {
    if (!playersQuery.data) return [];
    return (playersQuery.data as any[]).map((p: any) => {
      const s = (p.stats as Record<string, unknown>) ?? {};
      return {
        id: p.id,
        name: p.name,
        team: p.team,
        role: p.role,
        credits: (s.adminCredits ?? s.calculatedCredits ?? s.geminiCredits ?? s.credits ?? 8.0) as number,
        nationality: p.nationality ?? "",
        photoUrl: p.photoUrl ?? null,
        formNote: (s.formNote as string) ?? null,
        average: (s.average as number) ?? null,
        strikeRate: (s.strikeRate as number) ?? null,
        economyRate: (s.economyRate as number) ?? null,
        matchesPlayed: (s.matchesPlayed as number) ?? null,
        recentForm: (s.recentForm as number) ?? null,
        injuryStatus: (s.injuryStatus as string) ?? null,
      };
    }).sort((a, b) => b.credits - a.credits);
  }, [playersQuery.data]);

  // Filter to players eligible for THIS match (team matches teamA or teamB)
  const matchEligible = useMemo(() => {
    if (!teamA && !teamB) return squad; // fallback: show all if no match context
    return squad.filter((p) => {
      const pTeam = (p.team ?? "").toLowerCase();
      const a = (teamA ?? "").toLowerCase();
      const b = (teamB ?? "").toLowerCase();
      // Fuzzy match: team name contains or is contained by teamA/teamB
      return (a && (pTeam.includes(a) || a.includes(pTeam))) ||
             (b && (pTeam.includes(b) || b.includes(pTeam)));
    });
  }, [squad, teamA, teamB]);

  // Effective team size: can't exceed number of eligible players
  const effectiveTeamSize = Math.min(TEAM_SIZE, matchEligible.length);

  // Auto-select all eligible players if they fit
  const autoSelectedOnce = useRef(false);
  useEffect(() => {
    if (!autoSelectedOnce.current && matchEligible.length > 0 && selectedIds.size === 0) {
      autoSelectedOnce.current = true;
      if (matchEligible.length <= effectiveTeamSize) {
        setSelectedIds(new Set(matchEligible.map((p) => p.id)));
      }
    }
  }, [matchEligible]);
  const selectedPlayers = matchEligible.filter((p) => selectedIds.has(p.id));

  const togglePlayer = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (captainId === id) setCaptainId(null);
        if (viceCaptainId === id) setViceCaptainId(null);
      } else {
        if (next.size >= effectiveTeamSize) return prev;
        next.add(id);
      }
      return next;
    });
  }, [captainId, viceCaptainId, effectiveTeamSize]);

  // Create team mutation
  const createTeamMutation = trpc.team.create.useMutation({
    onSuccess: () => {
      router.back();
    },
    onError: (err) => {
      setAlert({ title: "error", message: err.message });
    },
  });

  const handleSubmit = () => {
    if (!matchId || !contestId || !captainId || !viceCaptainId) return;
    createTeamMutation.mutate({
      matchId,
      contestId,
      players: selectedPlayers.map((p) => ({ playerId: p.id, role: p.role })),
      captainId,
      viceCaptainId,
    });
  };

  // Loading
  if (!squad.length && myPickPlayerIds.length === 0) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" paddingTop={insets.top}>
        <Text fontFamily="$body" color="$colorMuted">{formatUIText("loading your squad...")}</Text>
      </YStack>
    );
  }

  // ── STEP: Pick 11 players ──
  if (step === "pick") {
    return (
      <YStack flex={1} backgroundColor="$background" testID="pick-xi-screen">
        {/* Header */}
        <YStack backgroundColor="$backgroundSurface" paddingHorizontal="$4" paddingTop={insets.top + 8} paddingBottom="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$3">
              <SafeBackButton />
              <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
                {formatUIText("pick your xi")}
              </Text>
            </XStack>
            <HeaderControls />
          </XStack>
        </YStack>

        {/* Squad banner */}
        <XStack backgroundColor="$accentBackground" paddingVertical="$2" paddingHorizontal="$4" justifyContent="space-between" alignItems="center">
          <Text fontFamily="$mono" fontWeight="700" fontSize={11} color="$accentColor">
            {selectedIds.size >= effectiveTeamSize
              ? formatUIText("all selected — pick captain")
              : formatUIText(`select ${effectiveTeamSize - selectedIds.size} more`)}
          </Text>
          <Text fontFamily="$mono" fontWeight="700" fontSize={11} color="$accentColor">
            {selectedIds.size}/{effectiveTeamSize}
            {matchEligible.length < squad.length && (
              ` (${matchEligible.length} from your squad in this match)`
            )}
          </Text>
        </XStack>

        {/* Match context */}
        {teamA && teamB && (
          <XStack paddingVertical="$2" paddingHorizontal="$4" justifyContent="center" gap="$2">
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
              {formatTeamName(teamA)} vs {formatTeamName(teamB)}
            </Text>
          </XStack>
        )}

        {/* Player list */}
        <FlatList
          data={matchEligible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          renderItem={({ item, index }) => {
            const isSelected = selectedIds.has(item.id);
            const isDisabled = !isSelected && selectedIds.size >= effectiveTeamSize;
            return (
              <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
                <XStack
                  alignItems="center"
                  paddingVertical="$3"
                  borderBottomWidth={1}
                  borderBottomColor="$borderColor"
                  gap="$2"
                  opacity={isDisabled ? 0.4 : 1}
                  onPress={() => !isDisabled && togglePlayer(item.id)}
                  cursor="pointer"
                  pressStyle={{ backgroundColor: "$backgroundPress" }}
                >
                  {/* Selection indicator */}
                  <YStack
                    width={24} height={24} borderRadius={12}
                    borderWidth={2}
                    borderColor={isSelected ? "$accentBackground" : "$borderColor"}
                    backgroundColor={isSelected ? "$accentBackground" : "transparent"}
                    alignItems="center" justifyContent="center"
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color="white" />}
                  </YStack>

                  {/* Avatar */}
                  <InitialsAvatar
                    name={item.name}
                    playerRole={roleKey(item.role)}
                    ovr={Math.round(item.credits * 10)}
                    size={36}
                    imageUrl={item.photoUrl}
                  />

                  {/* Info */}
                  <YStack flex={1}>
                    <XStack alignItems="center" gap="$1">
                      <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" numberOfLines={1}>{item.name}</Text>
                      <YStack onPress={(e: any) => { e.stopPropagation(); setStatsPlayer(item); }} cursor="pointer" padding={2}>
                        <Ionicons name="stats-chart" size={12} color="#5DB882" />
                      </YStack>
                    </XStack>
                    <XStack gap="$1" alignItems="center">
                      <Badge variant="default" size="sm">{roleLabel(item.role)}</Badge>
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatTeamName(item.team)}</Text>
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">· {item.credits.toFixed(1)} Cr</Text>
                    </XStack>
                  </YStack>

                  {/* Form */}
                  {item.recentForm != null && (
                    <YStack alignItems="center" minWidth={28}>
                      <Text fontFamily="$mono" fontWeight="700" fontSize={12} color={
                        item.recentForm >= 7 ? "$colorAccent" : item.recentForm >= 4 ? "$colorCricket" : "$error"
                      }>{item.recentForm}</Text>
                      <Text fontFamily="$mono" fontSize={7} color="$colorMuted">form</Text>
                    </YStack>
                  )}
                </XStack>
              </Animated.View>
            );
          }}
        />

        {/* Bottom button */}
        <YStack position="absolute" bottom={0} left={0} right={0} padding="$4" paddingBottom={insets.bottom + 16} backgroundColor="$background">
          <Button
            variant="primary"
            size="lg"
            disabled={selectedIds.size < effectiveTeamSize}
            opacity={selectedIds.size < effectiveTeamSize ? 0.5 : 1}
            onPress={() => setStep("captain")}
          >
            {selectedIds.size >= effectiveTeamSize
              ? formatUIText("select captain & vc")
              : formatUIText(`select ${effectiveTeamSize - selectedIds.size} more players`)}
          </Button>
        </YStack>

        {/* Stats popup */}
        {statsPlayer && (
          <YStack
            style={{ position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0 }}
            zIndex={200} alignItems="center" justifyContent="center"
            backgroundColor="$colorOverlay" onPress={() => setStatsPlayer(null)}
          >
            <YStack
              backgroundColor="$backgroundSurface" borderRadius={20} padding="$5"
              width="90%" maxWidth={340} borderWidth={1} borderColor="$borderColor"
              onPress={(e: any) => e.stopPropagation()}
            >
              <XStack gap="$3" alignItems="center" marginBottom="$3">
                <InitialsAvatar name={statsPlayer.name} playerRole={roleKey(statsPlayer.role)} ovr={Math.round(statsPlayer.credits * 10)} size={40} imageUrl={statsPlayer.photoUrl} />
                <YStack flex={1}>
                  <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$color">{statsPlayer.name}</Text>
                  <XStack alignItems="center" gap="$2">
                    <Badge variant="default" size="sm">{roleLabel(statsPlayer.role)}</Badge>
                    <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{formatTeamName(statsPlayer.team)}</Text>
                  </XStack>
                </YStack>
                <Text fontFamily="$mono" fontWeight="900" fontSize={20} color="$accentBackground">{statsPlayer.credits.toFixed(1)}</Text>
              </XStack>
              <XStack marginBottom="$3" gap="$2">
                {statsPlayer.matchesPlayed != null && (
                  <YStack flex={1} backgroundColor="$backgroundPress" borderRadius={8} padding="$2" alignItems="center">
                    <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatBadgeText("matches")}</Text>
                    <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">{statsPlayer.matchesPlayed}</Text>
                  </YStack>
                )}
                {statsPlayer.average != null && statsPlayer.average > 0 && (
                  <YStack flex={1} backgroundColor="$backgroundPress" borderRadius={8} padding="$2" alignItems="center">
                    <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatBadgeText("avg")}</Text>
                    <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">{statsPlayer.average.toFixed(1)}</Text>
                  </YStack>
                )}
                {statsPlayer.strikeRate != null && statsPlayer.strikeRate > 0 && (
                  <YStack flex={1} backgroundColor="$backgroundPress" borderRadius={8} padding="$2" alignItems="center">
                    <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatBadgeText("sr")}</Text>
                    <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">{statsPlayer.strikeRate.toFixed(0)}</Text>
                  </YStack>
                )}
              </XStack>
              {statsPlayer.formNote && (
                <Text fontFamily="$body" fontSize={11} color="$colorSecondary">{statsPlayer.formNote}</Text>
              )}
            </YStack>
          </YStack>
        )}

        {alert && (
          <AlertModal visible title={alert.title} message={alert.message} onDismiss={() => setAlert(null)} actions={[{ label: "ok", onPress: () => setAlert(null) }]} />
        )}
      </YStack>
    );
  }

  // ── STEP: Captain / VC selection ──
  if (step === "captain") {
    return (
      <YStack flex={1} backgroundColor="$background">
        <YStack backgroundColor="$backgroundSurface" paddingHorizontal="$4" paddingTop={insets.top + 8} paddingBottom="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$3">
              <YStack onPress={() => setStep("pick")} cursor="pointer"><Ionicons name="chevron-back" size={24} color={theme.color?.val} /></YStack>
              <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
                {formatUIText("choose captain & vc")}
              </Text>
            </XStack>
            <HeaderControls />
          </XStack>
          <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop="$2">
            {formatUIText("captain gets 2x points, vice-captain gets 1.5x")}
          </Text>
        </YStack>

        <FlatList
          data={selectedPlayers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          renderItem={({ item }) => {
            const isCaptain = captainId === item.id;
            const isVC = viceCaptainId === item.id;
            return (
              <XStack alignItems="center" paddingVertical="$3" borderBottomWidth={1} borderBottomColor="$borderColor" gap="$3">
                <InitialsAvatar name={item.name} playerRole={roleKey(item.role)} ovr={Math.round(item.credits * 10)} size={36} imageUrl={item.photoUrl} />
                <YStack flex={1}>
                  <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">{item.name}</Text>
                  <XStack gap="$1">
                    <Badge variant="default" size="sm">{roleLabel(item.role)}</Badge>
                    <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatTeamName(item.team)}</Text>
                  </XStack>
                </YStack>
                <XStack gap="$2">
                  <YStack
                    width={36} height={36} borderRadius={18}
                    backgroundColor={isCaptain ? "$accentBackground" : "$backgroundSurface"}
                    borderWidth={2} borderColor={isCaptain ? "$accentBackground" : "$borderColor"}
                    alignItems="center" justifyContent="center"
                    onPress={() => { setCaptainId(item.id); if (viceCaptainId === item.id) setViceCaptainId(null); }}
                    cursor="pointer"
                  >
                    <Text fontFamily="$mono" fontWeight="800" fontSize={12} color={isCaptain ? "white" : "$colorMuted"}>C</Text>
                  </YStack>
                  <YStack
                    width={36} height={36} borderRadius={18}
                    backgroundColor={isVC ? "$colorCricket" : "$backgroundSurface"}
                    borderWidth={2} borderColor={isVC ? "$colorCricket" : "$borderColor"}
                    alignItems="center" justifyContent="center"
                    onPress={() => { setViceCaptainId(item.id); if (captainId === item.id) setCaptainId(null); }}
                    cursor="pointer"
                  >
                    <Text fontFamily="$mono" fontWeight="800" fontSize={12} color={isVC ? "white" : "$colorMuted"}>VC</Text>
                  </YStack>
                </XStack>
              </XStack>
            );
          }}
        />

        <YStack position="absolute" bottom={0} left={0} right={0} padding="$4" paddingBottom={insets.bottom + 16} backgroundColor="$background">
          <Button
            variant="primary"
            size="lg"
            disabled={!captainId || !viceCaptainId}
            opacity={!captainId || !viceCaptainId ? 0.5 : 1}
            onPress={() => setStep("review")}
          >
            {!captainId ? formatUIText("select a captain") : !viceCaptainId ? formatUIText("select a vice-captain") : formatUIText("review team")}
          </Button>
        </YStack>
      </YStack>
    );
  }

  // ── STEP: Review & Submit ──
  return (
    <YStack flex={1} backgroundColor="$background">
      <YStack backgroundColor="$backgroundSurface" paddingHorizontal="$4" paddingTop={insets.top + 8} paddingBottom="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <XStack alignItems="center" gap="$3">
            <YStack onPress={() => setStep("captain")} cursor="pointer"><Ionicons name="chevron-back" size={24} color={theme.color?.val} /></YStack>
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
              {formatUIText("review your xi")}
            </Text>
          </XStack>
          <HeaderControls />
        </XStack>
      </YStack>

      <FlatList
        data={selectedPlayers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListHeaderComponent={
          <YStack marginBottom="$4">
            {teamA && teamB && (
              <Text fontFamily="$mono" fontSize={12} color="$colorMuted" textAlign="center" marginBottom="$3">
                {formatTeamName(teamA)} vs {formatTeamName(teamB)}
              </Text>
            )}
            <Card padding="$4" marginBottom="$3">
              <XStack justifyContent="space-around">
                <YStack alignItems="center">
                  <Text fontFamily="$mono" fontWeight="900" fontSize={24} color="$accentBackground">{selectedPlayers.length}</Text>
                  <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("players")}</Text>
                </YStack>
                <YStack alignItems="center">
                  <Text fontFamily="$mono" fontWeight="900" fontSize={24} color="$colorCricket">
                    {squad.find((p) => p.id === captainId)?.name?.split(" ").pop() ?? "—"}
                  </Text>
                  <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("captain (2x)")}</Text>
                </YStack>
                <YStack alignItems="center">
                  <Text fontFamily="$mono" fontWeight="900" fontSize={24} color="$color">
                    {squad.find((p) => p.id === viceCaptainId)?.name?.split(" ").pop() ?? "—"}
                  </Text>
                  <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("vc (1.5x)")}</Text>
                </YStack>
              </XStack>
            </Card>
          </YStack>
        }
        renderItem={({ item }) => {
          const isCaptain = captainId === item.id;
          const isVC = viceCaptainId === item.id;
          return (
            <XStack alignItems="center" paddingVertical="$2" borderBottomWidth={1} borderBottomColor="$borderColor" gap="$2">
              <InitialsAvatar name={item.name} playerRole={roleKey(item.role)} ovr={Math.round(item.credits * 10)} size={32} imageUrl={item.photoUrl} />
              <YStack flex={1}>
                <XStack alignItems="center" gap="$1">
                  <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color">{item.name}</Text>
                  {isCaptain && <Badge variant="live" size="sm">C</Badge>}
                  {isVC && <Badge variant="warning" size="sm">VC</Badge>}
                </XStack>
                <XStack gap="$1">
                  <Badge variant="default" size="sm">{roleLabel(item.role)}</Badge>
                  <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatTeamName(item.team)}</Text>
                </XStack>
              </YStack>
              <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="$accentBackground">{item.credits.toFixed(1)} Cr</Text>
            </XStack>
          );
        }}
      />

      <YStack position="absolute" bottom={0} left={0} right={0} padding="$4" paddingBottom={insets.bottom + 16} backgroundColor="$background">
        <Button
          variant="primary"
          size="lg"
          onPress={handleSubmit}
          disabled={createTeamMutation.isPending}
        >
          {createTeamMutation.isPending ? formatUIText("submitting...") : formatUIText("confirm & submit")}
        </Button>
      </YStack>

      {alert && (
        <AlertModal visible title={alert.title} message={alert.message} onDismiss={() => setAlert(null)} actions={[{ label: "ok", onPress: () => setAlert(null) }]} />
      )}
    </YStack>
  );
}
