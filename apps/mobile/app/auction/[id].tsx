import { FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect, useRef } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeBackButton } from "../../components/SafeBackButton";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  AnnouncementBanner,
  EggLoadingSpinner,
  AlertModal,
  Paywall,
  TierBadge,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  DraftPlayLogo,
  formatTeamName,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";
import { usePaywall } from "../../hooks/usePaywall";

import { HeaderControls } from "../../components/HeaderControls";

type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

/** Format raw role enum to compact badge text */
function formatRoleShort(role: string): string {
  const r = (role ?? "").toUpperCase().replace(/[\s-]/g, "_");
  switch (r) {
    case "BATSMAN": case "BAT": return "BAT";
    case "BOWLER": case "BOWL": return "BOWL";
    case "ALL_ROUNDER": case "ALLROUNDER": case "AR": return "AR";
    case "WICKET_KEEPER": case "WICKETKEEPER": case "WK": return "WK";
    default: return role.substring(0, 4).toUpperCase();
  }
}

export default function AuctionRoomScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTamaguiTheme();

  // Get DB user ID (user.id is Firebase UID, but auction uses DB UUIDs)
  const { data: profile } = trpc.auth.getProfile.useQuery();
  const dbUserId = (profile as any)?.userId ?? user?.id;

  // Clock sync: calculate offset between server time and client time
  const { data: serverTimeData } = trpc.draft.serverTime.useQuery(undefined, { refetchInterval: 60000 }); // re-sync every 60s
  const clockOffset = useRef(0);
  useEffect(() => {
    if (serverTimeData?.now) {
      clockOffset.current = (serverTimeData.now as number) - Date.now();
    }
  }, [serverTimeData]);
  const serverNow = () => Date.now() + clockOffset.current;

  const poolExhausted = useRef(false);
  const { data: auctionState, refetch } = trpc.draft.getAuctionState.useQuery(
    { roomId: roomId!, poolExhausted: poolExhausted.current },
    { refetchInterval: 5000 },
  );
  // Get league info to filter players by tournament
  const { data: draftRoom } = trpc.draft.getRoom.useQuery({ roomId: roomId! }, { enabled: !!roomId });
  const leagueId = draftRoom?.leagueId ?? auctionState?.leagueId;
  const { data: leagueData } = trpc.league.getById.useQuery({ id: leagueId! }, { enabled: !!leagueId });
  const tournamentName = (leagueData as any)?.tournament;
  // Fetch players for the tournament only, fall back to all players
  const { data: tournamentPlayers } = trpc.player.listByTournament.useQuery(
    { tournamentName: tournamentName! },
    { enabled: !!tournamentName },
  );
  const { data: allPlayers } = trpc.player.list.useQuery(undefined, { enabled: !tournamentName });
  const players = tournamentPlayers ?? allPlayers;
  const hasFinalised = useRef(false);
  const [buzzFeed, setBuzzFeed] = useState<Array<{ message: string; type: string; ts: number }>>([]);

  const nominateMutation = trpc.draft.nominate.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => setNominateAlert({ title: "nomination failed", message: err.message }),
  });
  const advancePhaseMutation = trpc.draft.advancePhase.useMutation({
    onSuccess: (data: any) => {
      // Force immediate refetch so UI updates with new phase/deadline
      refetch().then(() => {
        hasFinalised.current = false;
      });

      // Add buzz messages to feed
      if (data?.buzzMessages?.length > 0) {
        setBuzzFeed((prev) => [
          ...data.buzzMessages.map((m: any) => ({ ...m, ts: Date.now() })),
          ...prev,
        ].slice(0, 20)); // keep last 20
      }

      // If the server phase is now "sold", auto-advance to "nominating" after 3s
      if (data?.phase === "sold") {
        setTimeout(() => {
          advancePhaseMutation.mutate({ roomId: roomId!, expectedPhase: "sold" });
        }, 3000);
      }

      // Auction completed — navigate to report card
      if (data?.auctionCompleted) {
        setTimeout(() => {
          router.push(`/auction/report?roomId=${roomId}` as any);
        }, 3000);
      }
    },
  });
  const bidMutation = trpc.draft.placeBid.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => setNominateAlert({ title: "bid failed", message: err.message }),
  });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(1);
  const [nominateAlert, setNominateAlert] = useState<{ title: string; message: string; onConfirm?: () => void } | null>(null);
  const [statsPlayerId, setStatsPlayerId] = useState<string | null>(null);
  const [soldFilter, setSoldFilter] = useState<string | null>(null); // null = all, "me" = mine, or a userId
  const [showStrategyQuiz, setShowStrategyQuiz] = useState(false);
  const [strategy, setStrategy] = useState({ starPower: 5, battingBias: 5, formVsRep: 5, riskAppetite: 5 });

  // Pause/resume
  const pauseMutation = trpc.draft.pauseAuction.useMutation({ onSuccess: () => refetch() });
  const resumeMutation = trpc.draft.resumeAuction.useMutation({ onSuccess: () => refetch() });
  const [wonPlayer, setWonPlayer] = useState<string | null>(null);
  const { gate, paywallProps } = usePaywall();

  // Target squad
  const [showTargets, setShowTargets] = useState(false);
  const targetSquadQuery = trpc.auctionAi.getTargetSquad.useQuery(
    { roomId: roomId! },
    { enabled: !!roomId, staleTime: 10_000 },
  );
  const toggleTargetMutation = trpc.auctionAi.toggleTarget.useMutation({
    onSuccess: () => targetSquadQuery.refetch(),
  });
  const autoBuildMutation = trpc.auctionAi.autoBuildTargets.useMutation({
    onSuccess: () => targetSquadQuery.refetch(),
  });
  const evolveMutation = trpc.auctionAi.evolveTargets.useMutation({
    onSuccess: () => targetSquadQuery.refetch(),
  });
  const targetPlayerIds = new Set(
    (targetSquadQuery.data?.targets ?? [])
      .filter((t: any) => t.status === "target")
      .map((t: any) => t.playerId),
  );


  // Player stats for popup
  const { data: playerStatsData } = trpc.auctionAi.playerStats.useQuery(
    { playerId: statsPlayerId! },
    { enabled: !!statsPlayerId },
  );

  // Detect when current user wins a player (from polling data, not mutation response)
  const prevSoldCount = useRef(0);
  useEffect(() => {
    const soldPlayers = auctionState?.soldPlayers ?? [];
    if (soldPlayers.length > prevSoldCount.current && prevSoldCount.current > 0) {
      // New sale detected — check if current user won
      const latestSale = soldPlayers[soldPlayers.length - 1];
      if (latestSale && latestSale.userId === dbUserId) {
        const pName = (players ?? []).find((p: any) => p.id === latestSale.playerId)?.name ?? "Player";
        setWonPlayer(pName);
        setTimeout(() => setWonPlayer(null), 4000);
      }
    }
    prevSoldCount.current = soldPlayers.length;
    // Auto-evolve target squad when new players are sold
    if (soldPlayers.length > 0 && targetSquadQuery.data?.targets?.length) {
      evolveMutation.mutate({ roomId: roomId! });
    }
  }, [auctionState?.soldPlayers?.length]);

  // AI bid suggestion for the currently nominated player
  const currentPlayerId = auctionState?.currentPlayerId;
  const { data: bidSuggestion } = trpc.auctionAi.bidSuggestion.useQuery(
    { roomId: roomId!, playerId: currentPlayerId! },
    { enabled: !!roomId && !!currentPlayerId },
  );

  // Compute current visual phase + countdown from the 3 pre-set deadlines
  const [visualPhase, setVisualPhase] = useState<string>("bidding");

  useEffect(() => {
    const biddingEnd = auctionState?.biddingEndsAt ? new Date(auctionState.biddingEndsAt).getTime() : null;
    const goingOnceEnd = auctionState?.goingOnceEndsAt ? new Date(auctionState.goingOnceEndsAt).getTime() : null;
    const goingTwiceEnd = auctionState?.goingTwiceEndsAt ? new Date(auctionState.goingTwiceEndsAt).getTime() : null;

    // Only run timer when there's a player being auctioned
    if (!biddingEnd || !auctionState?.currentPlayerId) {
      setCountdown(null);
      setVisualPhase(auctionState?.phase ?? "nominating");
      return;
    }
    hasFinalised.current = false;

    const interval = setInterval(() => {
      // Freeze timer when paused — show remaining time without ticking
      if ((auctionState as any)?.isPaused) {
        const remaining = (auctionState as any)?.pauseRemainingMs;
        if (remaining != null) {
          setCountdown(Math.ceil(remaining / 1000));
        }
        return; // don't advance phases while paused
      }

      const now = serverNow();

      if (now < biddingEnd) {
        setVisualPhase("bidding");
        setCountdown(Math.ceil((biddingEnd - now) / 1000));
      } else if (goingOnceEnd && now < goingOnceEnd) {
        setVisualPhase("going_once");
        setCountdown(Math.ceil((goingOnceEnd - now) / 1000));
      } else if (goingTwiceEnd && now < goingTwiceEnd) {
        setVisualPhase("going_twice");
        setCountdown(Math.ceil((goingTwiceEnd - now) / 1000));
      } else {
        // All deadlines passed — finalise the sale (once)
        setVisualPhase("sold");
        setCountdown(0);
        if (!hasFinalised.current && !advancePhaseMutation.isPending) {
          hasFinalised.current = true;
          advancePhaseMutation.mutate({ roomId: roomId!, expectedPhase: auctionState?.phase });
        }
      }
    }, 200);
    return () => clearInterval(interval);
  }, [auctionState?.biddingEndsAt, auctionState?.goingOnceEndsAt, auctionState?.goingTwiceEndsAt, auctionState?.currentPlayerId]);

  // Fallback: if polling detects "sold" phase (e.g. other client advanced), auto-advance
  useEffect(() => {
    if (auctionState?.phase !== "sold") return;
    const timeout = setTimeout(() => {
      if (!advancePhaseMutation.isPending) {
        advancePhaseMutation.mutate({ roomId: roomId!, expectedPhase: "sold" });
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [auctionState?.phase]);

  const isMyNomination = auctionState?.currentNominator === dbUserId;
  const myBudget = auctionState?.budgets?.[dbUserId ?? ""] ?? 0;
  const myTeamSize = auctionState?.teamSizes?.[dbUserId ?? ""] ?? 0;
  const squadSize = (auctionState as any)?.squadRuleDetails?.squadSize ?? (auctionState as any)?.maxPlayersPerTeam ?? 14;
  const mySquadFull = myTeamSize >= squadSize;

  // Compute my role counts for squad rule progress
  const myRoleCounts = (() => {
    const counts: Record<string, number> = { WK: 0, BAT: 0, BOWL: 0, AR: 0 };
    const myPlayers = (auctionState?.soldPlayers ?? []).filter((sp: any) => sp.userId === dbUserId);
    for (const sp of myPlayers) {
      const p = (players ?? []).find((pl: any) => pl.id === sp.playerId);
      if (p) {
        const role = formatRoleShort((p as any).role ?? "");
        if (role in counts) counts[role]!++;
      }
    }
    return counts;
  })();
  const soldPlayerIds = new Set((auctionState?.soldPlayers ?? []).map((p: any) => p.playerId));
  const availablePlayers = (players ?? []).filter((p: any) => !soldPlayerIds.has(p.id));

  // Signal to server when the tournament player pool is exhausted
  useEffect(() => {
    if (players && players.length > 0 && availablePlayers.length === 0 && !poolExhausted.current) {
      poolExhausted.current = true;
      refetch(); // re-fetch with poolExhausted=true so server can auto-complete
    }
  }, [availablePlayers.length]);
  const currentPlayer = auctionState?.currentPlayerId ? (players ?? []).find((p: any) => p.id === auctionState.currentPlayerId) : null;
  const bidIncrement = (auctionState as any)?.bidIncrement ?? 1;
  const minBidNow = auctionState?.highestBid
    ? Math.round((auctionState.highestBid.amount + bidIncrement) * 10) / 10
    : 1;

  useEffect(() => { setBidAmount(minBidNow); }, [auctionState?.currentPlayerId, minBidNow]);

  const phaseLabel = (phase: string) => {
    switch (phase) {
      case "nominating": return formatUIText("nominating...");
      case "bidding": return formatBadgeText("bidding");
      case "going_once": return formatUIText("going once...");
      case "going_twice": return formatUIText("going twice...");
      case "sold": return formatBadgeText("sold!");
      case "completed": return formatBadgeText("auction complete!");
      default: return formatUIText(phase);
    }
  };

  const handleNominate = (playerId: string, playerName: string) => {
    // Build AI context for the nomination popup
    const player = (players ?? []).find((p: any) => p.id === playerId);
    const roleShort = formatRoleShort(player?.role ?? "");
    const r = (auctionState as any)?.squadRuleDetails;
    const have = myRoleCounts[roleShort] ?? 0;
    const min = r ? (r[`min${roleShort}`] ?? 0) : 0;
    const max = r ? (r[`max${roleShort}`] ?? 99) : 99;

    let aiHint = "";
    if (have >= max) {
      aiHint = `⚠️ You're at max ${roleShort} (${have}/${max}). You can't bid on this player — consider baiting others.`;
    } else if (have < min) {
      aiHint = `✅ You need ${roleShort} (${have}/${min} min). This is a strategic pick for your squad.`;
    } else {
      const slotsLeft = squadSize - myTeamSize;
      const avgBudget = slotsLeft > 0 ? (myBudget / slotsLeft).toFixed(1) : "0";
      aiHint = `ℹ️ ${roleShort} requirement met (${have}/${min}). Budget: ~${avgBudget} Cr per remaining slot.`;
    }

    const credits = (player as any)?.credits;
    const creditStr = credits ? ` Fair value: ~${credits.toFixed(1)} Cr.` : "";

    setNominateAlert({
      title: `nominate ${playerName}?`,
      message: `${roleShort} · ${formatTeamName((player as any)?.team ?? "")}${creditStr}\n\n${aiHint}`,
      onConfirm: () => {
        setNominateAlert(null);
        nominateMutation.mutate({ roomId: roomId!, playerId });
      },
    });
  };

  const handleBid = (amount: number) => {
    bidMutation.mutate({ roomId: roomId!, amount });
  };

  const [searchQuery, setSearchQuery] = useState("");
  const filteredAvailable = searchQuery
    ? availablePlayers.filter((p: any) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : availablePlayers;
  const filteredSold = searchQuery
    ? (auctionState?.soldPlayers ?? []).filter((sp: any) => {
        const player = (players ?? []).find((p: any) => p.id === sp.playerId);
        return player && (player as any).name.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : (auctionState?.soldPlayers ?? []);

  return (
    <YStack flex={1} backgroundColor="$background" testID="auction-room-screen">
      {/* Header */}
      <YStack backgroundColor="$backgroundSurface" padding="$4">
        <XStack justifyContent="space-between" alignItems="center">
          <XStack alignItems="center" gap="$2">
            <SafeBackButton />
            <YStack>
              <Text testID="auction-phase" fontFamily="$mono" fontSize={14} fontWeight="800" letterSpacing={1} color="$accentBackground">
                {phaseLabel(auctionState?.currentPlayerId ? visualPhase : (auctionState?.phase ?? "waiting"))}
              </Text>
              <Text testID="auction-sold-count" fontFamily="$body" fontSize={12} color="$color" marginTop={2}>
                {formatUIText("sold")}: {auctionState?.soldPlayers?.length ?? 0} {formatUIText("players")}
              </Text>
            </YStack>
          </XStack>
          <XStack alignItems="center" gap="$3">
            <YStack alignItems="flex-end">
              <Text {...textStyles.hint}>
                {formatBadgeText("your budget")}
              </Text>
              <Text testID="auction-my-budget" fontFamily="$mono" fontWeight="900" fontSize={DesignSystem.fontSize["4xl"]} color="$accentBackground">
                {myBudget > 0 ? `${myBudget % 1 === 0 ? myBudget.toFixed(0) : myBudget.toFixed(1)} Cr` : "—"}
              </Text>
            </YStack>
            <HeaderControls />
          </XStack>
        </XStack>
        {countdown !== null && (
          <YStack testID="auction-countdown" marginTop="$3" alignSelf="center" alignItems="center" gap="$1">
            <YStack
              backgroundColor={countdown <= 3 ? "$error" : countdown <= 5 ? "$colorCricket" : "$accentBackground"}
              borderRadius={DesignSystem.radius.md}
              paddingHorizontal="$6"
              paddingVertical="$2"
            >
              <Text fontFamily="$mono" fontWeight="900" fontSize={28} color={countdown <= 5 ? "$color" : "$accentColor"}>
                {countdown}s
              </Text>
            </YStack>
            {(visualPhase === "going_once" || visualPhase === "going_twice") && (
              <Text fontFamily="$mono" fontWeight="800" fontSize={16} color={countdown !== null && countdown <= 3 ? "$error" : "$colorCricket"} letterSpacing={1}>
                {visualPhase === "going_once" ? "GOING ONCE..." : "GOING TWICE..."}
              </Text>
            )}
            {visualPhase === "sold" && (
              <Text fontFamily="$mono" fontWeight="800" fontSize={16} color="$colorAccent" letterSpacing={1}>
                SOLD!
              </Text>
            )}
          </YStack>
        )}
        {/* Squad progress + pause row */}
        <XStack marginTop="$2" alignItems="center" gap="$2" flexWrap="wrap">
          {/* Pause / Resume button */}
          {auctionState?.status === "in_progress" && (auctionState as any)?.maxPausesPerMember > 0 && (() => {
            const isPaused = (auctionState as any)?.isPaused;
            const isMePauser = (auctionState as any)?.pausedBy === dbUserId;
            const pausesLeft = (auctionState as any)?.maxPausesPerMember - ((auctionState as any)?.pausesUsed?.[dbUserId!] ?? 0);
            const canAct = isPaused ? isMePauser : pausesLeft > 0;
            return (
              <XStack
                onPress={() => {
                  if (!canAct) return;
                  if (isPaused) resumeMutation.mutate({ roomId: roomId! });
                  else pauseMutation.mutate({ roomId: roomId! });
                }}
                cursor={canAct ? "pointer" : "default"}
                pressStyle={canAct ? { opacity: 0.8, scale: 0.97 } : {}}
                paddingHorizontal={10}
                paddingVertical={6}
                borderRadius={8}
                backgroundColor={isPaused ? (isMePauser ? "$accentBackground" : "#4a1c1c") : "rgba(212, 164, 61, 0.12)"}
                borderWidth={1}
                borderColor={isPaused ? (isMePauser ? "$accentBackground" : "$error") : "$colorCricket"}
                opacity={canAct ? 1 : 0.4}
                alignItems="center"
                gap={4}
              >
                <Ionicons
                  name={isPaused ? (isMePauser ? "play-circle" : "pause-circle") : "pause-circle-outline"}
                  size={16}
                  color={isPaused ? (isMePauser ? "#fff" : "#E5484D") : "#D4A43D"}
                />
                <Text fontFamily="$mono" fontSize={11} fontWeight="700"
                  color={isPaused ? (isMePauser ? "white" : "$error") : "$colorCricket"}
                >
                  {isPaused ? (isMePauser ? "resume" : "paused") : `pause (${pausesLeft})`}
                </Text>
              </XStack>
            );
          })()}

          {/* Team size pill */}
          <XStack paddingHorizontal={8} paddingVertical={4} borderRadius={8} backgroundColor="$backgroundPress" alignItems="center" gap={3}>
            <Ionicons name="people-outline" size={12} color="#9A9894" />
            <Text fontFamily="$mono" fontSize={10} fontWeight="700" color="$color">
              {myTeamSize}/{squadSize}
            </Text>
          </XStack>

          {/* Role progress pills */}
          {(auctionState as any)?.squadRuleDetails && (() => {
            const r = (auctionState as any).squadRuleDetails;
            return [
              { label: "WK", min: r.minWK, max: r.maxWK, have: myRoleCounts.WK ?? 0 },
              { label: "BAT", min: r.minBAT, max: r.maxBAT, have: myRoleCounts.BAT ?? 0 },
              { label: "BOWL", min: r.minBOWL, max: r.maxBOWL, have: myRoleCounts.BOWL ?? 0 },
              { label: "AR", min: r.minAR, max: r.maxAR, have: myRoleCounts.AR ?? 0 },
            ].map((role) => {
              const isFull = role.have >= role.max;
              const metMin = role.have >= role.min;
              const needsMore = !metMin;
              // 3 states: red (at max), yellow (below min), green (met min, room for more)
              const stateColor = isFull ? "#E5484D" : needsMore ? "#D4A43D" : "#5DB882";
              const stateBg = isFull ? "rgba(229, 72, 77, 0.1)" : needsMore ? "rgba(212, 164, 61, 0.1)" : "rgba(93, 184, 130, 0.08)";
              const stateBorder = isFull ? "rgba(229, 72, 77, 0.3)" : needsMore ? "rgba(212, 164, 61, 0.3)" : "rgba(93, 184, 130, 0.2)";
              return (
                <XStack
                  key={role.label}
                  paddingHorizontal={6}
                  paddingVertical={4}
                  borderRadius={8}
                  backgroundColor={stateBg}
                  borderWidth={1}
                  borderColor={stateBorder}
                  gap={3}
                  alignItems="center"
                >
                  <Text fontFamily="$mono" fontSize={9} fontWeight="700" style={{ color: stateColor }}>
                    {role.label}
                  </Text>
                  <Text fontFamily="$mono" fontSize={9} fontWeight="700" style={{ color: stateColor }}>
                    {role.have}
                  </Text>
                  <Text fontFamily="$mono" fontSize={7} color="$colorMuted">
                    {needsMore ? `need ${role.min}` : `max ${role.max}`}
                  </Text>
                </XStack>
              );
            });
          })()}
        </XStack>
        {/* Target squad toggle */}
        <XStack justifyContent="flex-end" marginTop="$1">
          <XStack
            onPress={() => setShowTargets(!showTargets)}
            cursor="pointer"
            pressStyle={{ opacity: 0.8 }}
            paddingHorizontal={8}
            paddingVertical={3}
            borderRadius={8}
            backgroundColor={showTargets ? "rgba(212, 164, 61, 0.12)" : "$backgroundPress"}
            gap={4}
            alignItems="center"
          >
            <Ionicons name="star" size={12} color={showTargets ? "#D4A43D" : "#666"} />
            <Text fontFamily="$mono" fontSize={10} fontWeight="600" color={showTargets ? "$colorCricket" : "$colorMuted"}>
              targets ({(targetSquadQuery.data?.targets ?? []).filter((t: any) => t.status === "target").length})
            </Text>
          </XStack>
        </XStack>
      </YStack>

      {/* Target squad panel */}
      {showTargets && (
        <YStack backgroundColor="$backgroundSurface" padding="$3" borderBottomWidth={1} borderBottomColor="$borderColor">
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
            <XStack alignItems="center" gap="$2">
              <Ionicons name="star" size={14} color="#D4A43D" />
              <Text fontFamily="$mono" fontSize={12} fontWeight="700" color="$color">
                {formatUIText("target squad")}
              </Text>
            </XStack>
            <XStack gap="$2">
              <XStack
                onPress={() => setShowStrategyQuiz(true)}
                cursor="pointer"
                pressStyle={{ opacity: 0.8 }}
                paddingHorizontal={8}
                paddingVertical={4}
                borderRadius={6}
                backgroundColor="$accentBackground"
                gap={4}
                alignItems="center"
              >
                <Ionicons name="sparkles" size={12} color="#fff" />
                <Text fontFamily="$mono" fontSize={9} fontWeight="700" color="$accentColor">
                  {autoBuildMutation.isPending ? "building..." : "ai build"}
                </Text>
              </XStack>
            </XStack>
          </XStack>

          {(targetSquadQuery.data?.targets ?? []).length === 0 ? (
            <YStack alignItems="center" paddingVertical="$3" gap="$2">
              <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center">
                {formatUIText("no targets yet. tap ★ on players or use AI Build.")}
              </Text>
            </YStack>
          ) : (
            <FlatList
              data={targetSquadQuery.data?.targets ?? []}
              keyExtractor={(item: any) => item.playerId}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item: target }: { item: any }) => {
                const player = (players ?? []).find((p: any) => p.id === target.playerId);
                if (!player) return null;
                const isGone = target.status === "gone";
                const isAcquired = target.status === "acquired";
                return (
                  <YStack
                    marginRight="$2"
                    padding="$2"
                    borderRadius={8}
                    backgroundColor={isAcquired ? "rgba(93, 184, 130, 0.1)" : isGone ? "rgba(229, 72, 77, 0.08)" : "$backgroundPress"}
                    borderWidth={1}
                    borderColor={isAcquired ? "rgba(93, 184, 130, 0.3)" : isGone ? "rgba(229, 72, 77, 0.2)" : "transparent"}
                    opacity={isGone ? 0.5 : 1}
                    minWidth={90}
                    alignItems="center"
                  >
                    <Text fontFamily="$body" fontWeight="600" fontSize={11} color="$color" numberOfLines={1} textAlign="center">
                      {(player as any).name}
                    </Text>
                    <XStack alignItems="center" gap="$1" marginTop={2}>
                      <Badge variant="default" size="sm">{formatRoleShort((player as any).role ?? "")}</Badge>
                      {isAcquired && <Ionicons name="checkmark-circle" size={10} color="#5DB882" />}
                      {isGone && <Ionicons name="close-circle" size={10} color="#E5484D" />}
                      {target.boughtAt && (
                        <Text fontFamily="$mono" fontSize={8} color="$colorCricket">{target.boughtAt} Cr</Text>
                      )}
                    </XStack>
                    {isGone && target.replacedBy && (() => {
                      const rep = (players ?? []).find((p: any) => p.id === target.replacedBy);
                      return rep ? (
                        <Text fontFamily="$mono" fontSize={7} color="$colorMuted" marginTop={2}>
                          → {(rep as any).name?.split(" ")[0]}
                        </Text>
                      ) : null;
                    })()}
                  </YStack>
                );
              }}
            />
          )}
        </YStack>
      )}

      {/* Pause overlay */}
      {(auctionState as any)?.isPaused && (
        <YStack backgroundColor="#4a1c1c" paddingVertical="$3" paddingHorizontal="$4" alignItems="center" borderBottomWidth={1} borderBottomColor="$error">
          <Text fontFamily="$mono" fontWeight="800" fontSize={15} color="$error">
            AUCTION PAUSED
          </Text>
          <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop={4}>
            {(auctionState as any)?.pausedBy === dbUserId
              ? "You paused the auction. Tap resume when ready."
              : `Paused by ${(auctionState as any)?.memberNames?.[(auctionState as any)?.pausedBy] ?? "a member"}`}
          </Text>
        </YStack>
      )}

      {/* Won player confetti banner */}
      {wonPlayer && (
        <YStack backgroundColor="$colorAccent" paddingVertical="$3" paddingHorizontal="$4" alignItems="center">
          <Text fontFamily="$mono" fontWeight="800" fontSize={16} color="white" textAlign="center">
            {"🎉 "}You won {wonPlayer}!{" 🎉"}
          </Text>
        </YStack>
      )}

      {/* Auction Complete Banner */}
      {auctionState?.status === "completed" && (
        <YStack backgroundColor="$accentBackground" paddingVertical="$4" paddingHorizontal="$4" alignItems="center" gap="$2">
          <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$accentColor">
            {"🏏 "}Auction Complete!{" 🏏"}
          </Text>
          <Text fontFamily="$body" fontSize={13} color="$accentColor" textAlign="center">
            All squads are locked. View your report card to see how you did.
          </Text>
          <Button
            variant="secondary"
            size="md"
            marginTop="$2"
            onPress={() => router.push(`/auction/report?roomId=${roomId}` as any)}
          >
            View Report Card
          </Button>
        </YStack>
      )}

      <AnnouncementBanner />

      {/* Current Player Being Auctioned */}
      {currentPlayer && (
        <Card testID="auction-current-player" margin="$4" padding="$5" borderWidth={2} borderColor="$accentBackground">
          <Text {...textStyles.hint} letterSpacing={1}>
            {formatBadgeText("now auctioning")}
          </Text>
          <XStack alignItems="center" gap="$3" marginTop="$2">
            <InitialsAvatar
              name={(currentPlayer as any).name}
              playerRole={((currentPlayer as any).role ?? "BAT").toUpperCase() as RoleKey}
              ovr={(currentPlayer as any).credits ?? 80}
              size={46}
              imageUrl={(currentPlayer as any).photoUrl}
            />
            <YStack flex={1}>
              <XStack alignItems="center" gap="$2">
                <Text testID="auction-current-name" {...textStyles.playerName} fontSize={18}>
                  {(currentPlayer as any).name}
                </Text>
                <YStack
                  onPress={() => setStatsPlayerId((currentPlayer as any).id)}
                  cursor="pointer"
                  pressStyle={{ opacity: 0.7 }}
                >
                  <Ionicons name="stats-chart" size={16} color="#5DB882" />
                </YStack>
              </XStack>
              <XStack alignItems="center" gap="$2" marginTop={2}>
                <Badge variant="default" size="sm">
                  {formatRoleShort((currentPlayer as any).role ?? "")}
                </Badge>
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  {formatTeamName((currentPlayer as any).team)}
                </Text>
              </XStack>
              {(() => {
                const s = (currentPlayer as any).stats ?? {};
                const parts: string[] = [];
                if (s.average > 0) parts.push(`Avg ${s.average.toFixed(1)}`);
                if (s.strikeRate > 0) parts.push(`SR ${s.strikeRate.toFixed(0)}`);
                if (s.economyRate > 0) parts.push(`Econ ${s.economyRate.toFixed(1)}`);
                if (s.matchesPlayed > 0) parts.push(`${s.matchesPlayed} matches`);
                return parts.length > 0 ? (
                  <Text fontFamily="$body" fontSize={10} color="$colorMuted" marginTop={2}>
                    {parts.join(" · ")}
                  </Text>
                ) : null;
              })()}
              {(currentPlayer as any).stats?.formNote && (
                <Text fontFamily="$body" fontSize={10} color="$colorSecondary" marginTop={2} numberOfLines={2}>
                  {(currentPlayer as any).stats.formNote}
                </Text>
              )}
            </YStack>
          </XStack>
          {auctionState?.highestBid && (
            <XStack marginTop="$3" justifyContent="space-between" alignItems="center">
              <XStack alignItems="baseline" gap="$2">
                <Text testID="auction-highest-bid" fontFamily="$mono" fontWeight="900" fontSize={28} color="$colorCricket">
                  {auctionState.highestBid.amount} Cr
                </Text>
                {auctionState.highestBid.userId === dbUserId ? (
                  <Badge variant="default" size="sm" backgroundColor="$colorAccent">YOUR BID</Badge>
                ) : (
                  <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                    {(auctionState as any)?.buyerVisibility === "during_auction" && (auctionState as any)?.memberNames?.[auctionState.highestBid.userId]
                      ? (auctionState as any).memberNames[auctionState.highestBid.userId]
                      : formatUIText("opponent's bid")}
                  </Text>
                )}
              </XStack>
            </XStack>
          )}
          {/* Show bid controls only if user is NOT the highest bidder AND squad is not full */}
          {(visualPhase === "bidding" || visualPhase === "going_once" || visualPhase === "going_twice")
            && auctionState?.currentPlayerId
            && auctionState?.highestBid?.userId !== dbUserId
            && myTeamSize < (auctionState?.maxPlayersPerTeam ?? 11) && (
            <YStack marginTop="$3" gap="$2">
              {/* Quick bid buttons row */}
              <XStack gap="$2">
                {[0, bidIncrement, bidIncrement * 2, bidIncrement * 5, bidIncrement * 10, bidIncrement * 20].map((inc) => {
                  const val = Math.round((minBidNow + inc) * 10) / 10;
                  return (
                    <YStack
                      key={inc}
                      flex={1} paddingVertical="$2" borderRadius={DesignSystem.radius.md}
                      backgroundColor={bidAmount === val ? "$accentBackground" : "$backgroundSurface"}
                      borderWidth={1}
                      borderColor={bidAmount === val ? "$accentBackground" : "$borderColor"}
                      alignItems="center" justifyContent="center"
                      opacity={val > myBudget ? 0.3 : bidAmount === val ? 1 : 0.7}
                      onPress={() => val <= myBudget && setBidAmount(val)}
                      cursor="pointer" pressStyle={{ scale: 0.97 }}
                    >
                      <Text fontFamily="$mono" fontWeight="700" fontSize={13} color={bidAmount === val ? "$accentColor" : "$color"}>
                        {val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}
                      </Text>
                    </YStack>
                  );
                })}
              </XStack>
              {/* Fine-tune + bid row */}
              <XStack gap="$2" alignItems="center">
                <YStack
                  width={36} height={36} borderRadius={18}
                  backgroundColor="$backgroundSurface" borderWidth={1} borderColor="$borderColor"
                  alignItems="center" justifyContent="center"
                  opacity={bidAmount <= minBidNow ? 0.3 : 1}
                  onPress={() => setBidAmount((v: number) => Math.max(minBidNow, Math.round((v - bidIncrement) * 10) / 10))}
                  cursor="pointer" pressStyle={{ scale: 0.95 }}
                >
                  <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color">−</Text>
                </YStack>
                <YStack flex={1} alignItems="center">
                  <Text fontFamily="$mono" fontWeight="900" fontSize={24} color="$accentBackground">
                    {bidAmount % 1 === 0 ? bidAmount.toFixed(0) : bidAmount.toFixed(1)} Cr
                  </Text>
                </YStack>
                <YStack
                  width={36} height={36} borderRadius={18}
                  backgroundColor="$backgroundSurface" borderWidth={1} borderColor="$borderColor"
                  alignItems="center" justifyContent="center"
                  opacity={bidAmount >= myBudget ? 0.3 : 1}
                  onPress={() => setBidAmount((v: number) => Math.min(myBudget, Math.round((v + bidIncrement) * 10) / 10))}
                  cursor="pointer" pressStyle={{ scale: 0.95 }}
                >
                  <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color">+</Text>
                </YStack>
                <Button
                  testID="auction-place-bid"
                  variant="primary"
                  size="md"
                  paddingHorizontal="$5"
                  onPress={() => handleBid(bidAmount)}
                  disabled={bidMutation.isPending || bidAmount > myBudget}
                >
                  {bidMutation.isPending ? "..." : "Bid"}
                </Button>
              </XStack>
            </YStack>
          )}
          {/* Squad full message */}
          {auctionState?.currentPlayerId
            && myTeamSize >= (auctionState?.maxPlayersPerTeam ?? 11)
            && auctionState?.highestBid?.userId !== dbUserId && (
            <YStack marginTop="$3" backgroundColor="$backgroundSurface" borderRadius={DesignSystem.radius.md} padding="$3" alignItems="center">
              <Text fontFamily="$mono" fontWeight="700" fontSize={13} color="$colorMuted">
                {formatUIText("your squad is full — watching only")}
              </Text>
            </YStack>
          )}
          {/* Winning message when user has highest bid */}
          {(visualPhase === "bidding" || visualPhase === "going_once" || visualPhase === "going_twice")
            && auctionState?.currentPlayerId
            && auctionState?.highestBid?.userId === dbUserId && (
            <YStack marginTop="$3" backgroundColor="$colorAccentLight" borderRadius={DesignSystem.radius.md} padding="$3" alignItems="center">
              <Text fontFamily="$mono" fontWeight="700" fontSize={13} color="$colorAccent">
                {formatUIText("you're the highest bidder — sit tight!")}
              </Text>
            </YStack>
          )}
          {/* AI Bid Insight Card */}
          {bidSuggestion && (
            <YStack
              testID="auction-ai-insight"
              marginTop="$3"
              backgroundColor="$backgroundSurface"
              borderRadius={DesignSystem.radius.md}
              padding="$3"
              borderWidth={1}
              borderColor="$accentBackground"
              onPress={bidSuggestion.gated ? () => gate("pro", "AI Bid Insights", "Get fair value estimates, risk ratings, and projected points for every player") : undefined}
              cursor={bidSuggestion.gated ? "pointer" : undefined}
            >
              <XStack justifyContent="space-between" alignItems="flex-start">
                <YStack flex={1} gap="$1">
                  <XStack alignItems="center" gap="$2">
                    <Text fontFamily="$body" fontSize={12} color="$color">
                      {bidSuggestion.recommendation === "strong bid" ? "Strong bid" :
                       bidSuggestion.recommendation === "steal opportunity" ? "Steal!" :
                       bidSuggestion.recommendation === "let go" ? "Let go" : "Bid cautiously"}
                    </Text>
                    <Badge
                      variant="default"
                      size="sm"
                      backgroundColor={
                        bidSuggestion.teamNeed === "critical" ? "$error" :
                        bidSuggestion.teamNeed === "high" ? "$colorCricket" :
                        bidSuggestion.teamNeed === "low" ? "$colorMuted" : "$accentBackground"
                      }
                    >
                      {bidSuggestion.teamNeed === "critical" ? "NEED" :
                       bidSuggestion.teamNeed === "high" ? "WANT" :
                       bidSuggestion.teamNeed === "none" ? "FULL" : "OK"}
                    </Badge>
                  </XStack>
                  {bidSuggestion.teamNeedReason && (
                    <Text fontFamily="$body" fontSize={10} color="$colorMuted" numberOfLines={1}>
                      {bidSuggestion.teamNeedReason}
                    </Text>
                  )}
                </YStack>
                {!bidSuggestion.gated && bidSuggestion.fairValueLow != null && (
                  <YStack alignItems="flex-end">
                    <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                      {formatBadgeText("fair value")}
                    </Text>
                    <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$colorCricket">
                      {Math.min(bidSuggestion.fairValueLow, bidSuggestion.fairValueHigh)}-{Math.max(bidSuggestion.fairValueLow, bidSuggestion.fairValueHigh)} Cr
                    </Text>
                  </YStack>
                )}
              </XStack>
              {!bidSuggestion.gated && bidSuggestion.riskRating && (
                <XStack marginTop="$2" gap="$3">
                  <Text fontFamily="$body" fontSize={10} color="$colorMuted">
                    Risk: <Text fontFamily="$mono" fontSize={10} fontWeight="600" color={
                      bidSuggestion.riskRating === "low" ? "$colorAccent" :
                      bidSuggestion.riskRating === "high" ? "$error" : "$colorCricket"
                    }>{bidSuggestion.riskRating.toUpperCase()}</Text>
                  </Text>
                  <Text fontFamily="$body" fontSize={10} color="$colorMuted">
                    Projected: <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$color">{bidSuggestion.projectedPoints} pts</Text>
                  </Text>
                </XStack>
              )}
              {bidSuggestion.gated && (
                <XStack marginTop="$2" alignItems="center" gap="$2" opacity={0.6}>
                  <TierBadge tier="pro" size="sm" />
                  <Text fontFamily="$body" fontSize={10} color="$colorMuted">
                    {formatUIText("fair value, risk rating & projections")}
                  </Text>
                </XStack>
              )}
            </YStack>
          )}
        </Card>
      )}

      {/* Nomination prompt */}
      {!currentPlayer && auctionState?.phase === "nominating" && (
        <YStack padding="$4">
          {mySquadFull ? (
            <YStack backgroundColor="$backgroundSurface" borderRadius={DesignSystem.radius.md} padding="$4" alignItems="center" gap="$1">
              <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$colorAccent">
                {formatUIText("your squad is complete!")}
              </Text>
              <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center">
                {formatUIText("you have 11 players. sit back and watch the remaining picks.")}
              </Text>
            </YStack>
          ) : isMyNomination ? (() => {
            // AI nomination suggestion — target list first, then rule-based
            const r = (auctionState as any)?.squadRuleDetails;
            const available = filteredAvailable;
            let topPick: any = null;
            let topPickReason = "";
            let baitPick: any = null;

            // Priority 1: Next player from target list
            const activeTargets = (targetSquadQuery.data?.targets ?? [])
              .filter((t: any) => t.status === "target")
              .sort((a: any, b: any) => a.priority - b.priority);
            for (const target of activeTargets) {
              const targetPlayer = available.find((p: any) => p.id === target.playerId);
              if (targetPlayer) {
                topPick = targetPlayer;
                topPickReason = `#${target.priority} on your target list`;
                break;
              }
            }

            // Priority 2: Squad rule needs (if no target found)
            if (!topPick && r && available.length > 0) {
              const neededRoles: string[] = [];
              if ((myRoleCounts.WK ?? 0) < (r.minWK ?? 0)) neededRoles.push("WK");
              if ((myRoleCounts.BAT ?? 0) < (r.minBAT ?? 0)) neededRoles.push("BAT");
              if ((myRoleCounts.BOWL ?? 0) < (r.minBOWL ?? 0)) neededRoles.push("BOWL");
              if ((myRoleCounts.AR ?? 0) < (r.minAR ?? 0)) neededRoles.push("AR");

              const neededPlayers = available.filter((p: any) => neededRoles.includes(formatRoleShort(p.role ?? "")));
              if (neededPlayers.length > 0) {
                topPick = neededPlayers.sort((a: any, b: any) => (b.credits ?? 0) - (a.credits ?? 0))[0];
                topPickReason = `best ${formatRoleShort(topPick.role)} available — you need ${neededRoles.join(", ")}`;
              } else {
                // All mins met — pick best value player overall
                topPick = [...available].sort((a: any, b: any) => (b.credits ?? 0) - (a.credits ?? 0))[0];
                topPickReason = "highest value available — all role minimums met";
              }

              // Bait suggestion — expensive player in a role you DON'T need (to drain others' budgets)
              const fullRoles = ["WK", "BAT", "BOWL", "AR"].filter((role) => (myRoleCounts[role] ?? 0) >= (r[`max${role}`] ?? 99));
              if (fullRoles.length > 0) {
                const baitPlayers = available.filter((p: any) => fullRoles.includes(formatRoleShort(p.role ?? "")));
                if (baitPlayers.length > 0) {
                  baitPick = baitPlayers.sort((a: any, b: any) => (b.credits ?? 0) - (a.credits ?? 0))[0];
                }
              }
            } else if (available.length > 0) {
              // No squad rule — just suggest best value
              topPick = [...available].sort((a: any, b: any) => (b.credits ?? 0) - (a.credits ?? 0))[0];
              topPickReason = "highest value available";
            }

            return (
            <YStack backgroundColor="rgba(212, 164, 61, 0.1)" borderRadius={DesignSystem.radius.md} padding="$3" borderWidth={1} borderColor="rgba(212, 164, 61, 0.3)">
              <XStack alignItems="center" gap="$2" marginBottom="$2">
                <Ionicons name="hand-right-outline" size={18} color="#D4A43D" />
                <Text testID="auction-nominate-prompt" fontFamily="$mono" fontWeight="700" fontSize={14} color="$colorCricket">
                  {formatUIText("your turn to nominate!")}
                </Text>
              </XStack>

              {/* AI suggestion */}
              {topPick && (
                <YStack backgroundColor="$backgroundSurface" borderRadius={8} padding="$2" marginBottom={baitPick ? "$2" : 0}>
                  <XStack alignItems="center" gap="$2">
                    <Ionicons name="sparkles" size={14} color="#5DB882" />
                    <Text fontFamily="$mono" fontSize={10} fontWeight="700" color="$colorAccent">
                      {formatUIText("suggested pick")}
                    </Text>
                  </XStack>
                  <XStack
                    marginTop={4}
                    alignItems="center"
                    gap="$2"
                    backgroundColor="rgba(93, 184, 130, 0.08)"
                    borderRadius={8}
                    padding="$2"
                    borderWidth={1}
                    borderColor="rgba(93, 184, 130, 0.2)"
                    onPress={() => handleNominate(topPick.id, topPick.name)}
                    cursor="pointer"
                    pressStyle={{ opacity: 0.8 }}
                  >
                    <InitialsAvatar
                      name={topPick.name}
                      playerRole={((topPick.role ?? "BAT").toUpperCase()) as RoleKey}
                      ovr={topPick.credits ?? 80}
                      size={28}
                      imageUrl={topPick.photoUrl}
                    />
                    <YStack flex={1}>
                      <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>
                        {topPick.name}
                      </Text>
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                        {formatRoleShort(topPick.role)} {formatTeamName(topPick.team)} — {topPickReason}
                      </Text>
                    </YStack>
                    <Ionicons name="arrow-forward-circle" size={20} color="#5DB882" />
                  </XStack>
                </YStack>
              )}

              {/* Bait suggestion */}
              {baitPick && (
                <YStack backgroundColor="$backgroundSurface" borderRadius={8} padding="$2">
                  <XStack alignItems="center" gap="$2">
                    <Ionicons name="flame-outline" size={14} color="#D4A43D" />
                    <Text fontFamily="$mono" fontSize={10} fontWeight="700" color="$colorCricket">
                      {formatUIText("bait nomination")}
                    </Text>
                    <Text fontFamily="$mono" fontSize={8} color="$colorMuted">
                      drain their budgets
                    </Text>
                  </XStack>
                  <XStack
                    marginTop={4}
                    alignItems="center"
                    gap="$2"
                    backgroundColor="rgba(212, 164, 61, 0.08)"
                    borderRadius={8}
                    padding="$2"
                    borderWidth={1}
                    borderColor="rgba(212, 164, 61, 0.15)"
                    onPress={() => handleNominate(baitPick.id, baitPick.name)}
                    cursor="pointer"
                    pressStyle={{ opacity: 0.8 }}
                  >
                    <InitialsAvatar
                      name={baitPick.name}
                      playerRole={((baitPick.role ?? "BAT").toUpperCase()) as RoleKey}
                      ovr={baitPick.credits ?? 80}
                      size={28}
                      imageUrl={baitPick.photoUrl}
                    />
                    <YStack flex={1}>
                      <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>
                        {baitPick.name}
                      </Text>
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                        {formatRoleShort(baitPick.role)} {formatTeamName(baitPick.team)} — you don't need this role
                      </Text>
                    </YStack>
                    <Ionicons name="arrow-forward-circle" size={20} color="#D4A43D" />
                  </XStack>
                </YStack>
              )}

              {!topPick && (
                <Text fontFamily="$body" fontSize={11} color="$colorMuted" marginTop={4}>
                  {formatUIText("tap a player from the available list")}
                </Text>
              )}
            </YStack>
            );
          })() : (
            <XStack alignItems="center" gap="$2" justifyContent="center" paddingVertical="$2">
              <YStack width={8} height={8} borderRadius={4} backgroundColor="$colorCricket" opacity={0.6} />
              <Text fontFamily="$mono" fontWeight="500" fontSize={13} color="$colorMuted">
                {formatUIText("waiting for nomination...")}
              </Text>
            </XStack>
          )}
        </YStack>
      )}

      {/* Buzz Bot Feed */}
      {buzzFeed.length > 0 && (
        <YStack backgroundColor="$backgroundSurface" borderBottomWidth={1} borderBottomColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2">
          <FlatList
            data={buzzFeed.slice(0, 3)}
            keyExtractor={(_, i) => `buzz-${i}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }: { item: any }) => (
              <XStack
                backgroundColor="$backgroundPress"
                borderRadius={DesignSystem.radius.md}
                paddingHorizontal="$3"
                paddingVertical="$1"
                marginRight="$2"
                alignItems="center"
                gap="$1"
              >
                <Text fontFamily="$mono" fontSize={10} color="$accentBackground">guru</Text>
                <Text fontFamily="$body" fontSize={11} color="$color" numberOfLines={1}>{item.message}</Text>
              </XStack>
            )}
          />
        </YStack>
      )}

      {/* Budget strategy hint */}
      {!mySquadFull && myTeamSize > 0 && (
        <XStack paddingHorizontal="$4" paddingVertical={4} backgroundColor="$backgroundSurface" alignItems="center" gap="$2">
          <Ionicons name="bulb-outline" size={12} color="#D4A43D" />
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            {(() => {
              const slotsRemaining = squadSize - myTeamSize;
              const avgPerSlot = slotsRemaining > 0 ? Math.round(myBudget / slotsRemaining * 10) / 10 : 0;
              const r = (auctionState as any)?.squadRuleDetails;
              const rolesNeeded: string[] = [];
              if (r) {
                if ((myRoleCounts.WK ?? 0) < r.minWK) rolesNeeded.push("WK");
                if ((myRoleCounts.BAT ?? 0) < r.minBAT) rolesNeeded.push("BAT");
                if ((myRoleCounts.BOWL ?? 0) < r.minBOWL) rolesNeeded.push("BOWL");
                if ((myRoleCounts.AR ?? 0) < r.minAR) rolesNeeded.push("AR");
              }
              const needStr = rolesNeeded.length > 0 ? ` Need: ${rolesNeeded.join(", ")}.` : "";
              return `${myBudget.toFixed(1)} Cr for ${slotsRemaining} slots = ${avgPerSlot.toFixed(1)} Cr avg.${needStr}`;
            })()}
          </Text>
        </XStack>
      )}

      {/* Search bar */}
      <XStack paddingHorizontal="$3" paddingVertical="$2" backgroundColor="$backgroundSurface" borderBottomWidth={1} borderBottomColor="$borderColor">
        <XStack flex={1} backgroundColor="$backgroundPress" borderRadius={DesignSystem.radius.md} paddingHorizontal="$3" paddingVertical="$2" alignItems="center" gap="$2">
          <Ionicons name="search" size={14} color="#999" />
          <TextInput
            placeholder="search players..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ flex: 1, color: "#fff", fontSize: 13, fontFamily: "monospace", padding: 0 }}
          />
          {searchQuery.length > 0 && (
            <YStack onPress={() => setSearchQuery("")} cursor="pointer">
              <Ionicons name="close-circle" size={16} color="#666" />
            </YStack>
          )}
        </XStack>
      </XStack>

      <XStack flex={1}>
        {/* Available Players */}
        <YStack width="50%" borderRightWidth={1} borderRightColor="$borderColor">
          <Text {...textStyles.sectionHeader} padding="$3" paddingBottom="$2">
            {formatUIText("available")} ({filteredAvailable.length})
          </Text>
          <FlatList
            testID="auction-available-list"
            data={filteredAvailable}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item, index }: { item: any; index: number }) => {
              // Rule-based need indicator per player
              const roleShort = formatRoleShort(item.role ?? "");
              const r = (auctionState as any)?.squadRuleDetails;
              const have = myRoleCounts[roleShort] ?? 0;
              const min = r ? (r[`min${roleShort}`] ?? 0) : 0;
              const max = r ? (r[`max${roleShort}`] ?? 99) : 99;
              const needTag = mySquadFull ? "FULL"
                : have < min ? "NEED"
                : have >= max ? "SKIP"
                : "OK";
              const needColor = needTag === "NEED" ? "#E5484D" : needTag === "SKIP" ? "#9A9894" : needTag === "FULL" ? "#9A9894" : "#5DB882";
              const isTarget = targetPlayerIds.has(item.id);

              return (
              <Animated.View entering={FadeInDown.delay(30 + index * 20).springify()}>
                <Card
                  pressable
                  padding="$3"
                  marginHorizontal="$2"
                  marginBottom="$1"
                  opacity={isMyNomination && !currentPlayer && !mySquadFull ? 1 : (needTag === "SKIP" ? 0.4 : 0.6)}
                  onPress={() => isMyNomination && !currentPlayer && !mySquadFull ? handleNominate(item.id, item.name) : null}
                  disabled={!isMyNomination || !!currentPlayer || mySquadFull}
                  borderColor={isTarget ? "$colorCricket" : "$borderColor"}
                  borderWidth={isTarget ? 1.5 : undefined}
                >
                  <XStack alignItems="center" gap="$2">
                    <InitialsAvatar
                      name={item.name}
                      playerRole={((item.role ?? "BAT").toUpperCase()) as RoleKey}
                      ovr={item.credits ?? 80}
                      size={32}
                      imageUrl={(item as any).photoUrl}
                    />
                    <YStack flex={1}>
                      <XStack alignItems="center" gap="$1">
                        <Text {...textStyles.playerName} fontSize={13} numberOfLines={1} flex={1}>
                          {item.name}
                        </Text>
                        {r && needTag !== "OK" && (
                          <Text fontFamily="$mono" fontSize={7} fontWeight="800" style={{ color: needColor }}>
                            {needTag}
                          </Text>
                        )}
                      </XStack>
                      <XStack alignItems="center" gap="$1">
                        <Badge variant="default" size="sm">
                          {roleShort}
                        </Badge>
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                          {formatTeamName(item.team)}
                        </Text>
                      </XStack>
                    </YStack>
                    <XStack gap="$1" alignItems="center">
                      <YStack
                        onPress={(e: any) => { e.stopPropagation(); toggleTargetMutation.mutate({ roomId: roomId!, playerId: item.id }); }}
                        cursor="pointer"
                        padding="$1"
                        pressStyle={{ opacity: 0.7, scale: 1.2 }}
                      >
                        <Ionicons name={isTarget ? "star" : "star-outline"} size={14} color={isTarget ? "#D4A43D" : "#666"} />
                      </YStack>
                      <YStack
                        onPress={(e: any) => { e.stopPropagation(); setStatsPlayerId(item.id); }}
                        cursor="pointer"
                        padding="$1"
                        pressStyle={{ opacity: 0.7 }}
                      >
                        <Ionicons name="stats-chart" size={14} color="#5DB882" />
                      </YStack>
                    </XStack>
                  </XStack>
                </Card>
              </Animated.View>
            );}}
            ListEmptyComponent={
              <YStack alignItems="center" paddingVertical="$8">
                <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
                <Text {...textStyles.hint} textAlign="center">
                  {formatUIText("no players remaining")}
                </Text>
              </YStack>
            }
          />
        </YStack>

        {/* Sold Players */}
        <YStack width="50%">
          <Text {...textStyles.sectionHeader} padding="$3" paddingBottom={0}>
            {formatUIText("sold")} ({filteredSold.length})
          </Text>
          {/* Member filter pills */}
          <XStack paddingHorizontal="$2" paddingVertical={6} gap={4} flexWrap="wrap">
            {[
              { id: null, label: "all" },
              { id: dbUserId, label: "mine" },
              ...(auctionState?.pickOrder ?? [])
                .filter((uid: string) => uid !== dbUserId)
                .map((uid: string) => {
                  const name = (auctionState as any)?.memberNames?.[uid]?.split(" ")[0] ?? "?";
                  return { id: uid, label: name.length > 8 ? name.slice(0, 7) + "..." : name };
                }),
            ].map((filterItem) => {
              const isActive = soldFilter === filterItem.id;
              const count = filterItem.id === null
                ? filteredSold.length
                : filteredSold.filter((sp: any) => sp.userId === filterItem.id).length;
              return (
                <XStack
                  key={filterItem.id ?? "all"}
                  onPress={() => setSoldFilter(isActive ? null : filterItem.id)}
                  cursor="pointer"
                  pressStyle={{ opacity: 0.8 }}
                  paddingHorizontal={8}
                  paddingVertical={3}
                  borderRadius={12}
                  backgroundColor={isActive ? "$accentBackground" : "$backgroundPress"}
                  gap={3}
                  alignItems="center"
                >
                  <Text fontFamily="$mono" fontSize={9} fontWeight={isActive ? "700" : "500"} color={isActive ? "$accentColor" : "$colorMuted"}>
                    {filterItem.label}
                  </Text>
                  <Text fontFamily="$mono" fontSize={8} color={isActive ? "$accentColor" : "$colorMuted"}>
                    {count}
                  </Text>
                </XStack>
              );
            })}
          </XStack>
          <FlatList
            testID="auction-sold-list"
            data={[...(soldFilter
              ? filteredSold.filter((sp: any) => sp.userId === soldFilter)
              : filteredSold
            )].reverse()}
            keyExtractor={(item: any, idx: number) => `${item.playerId}-${idx}`}
            renderItem={({ item }: { item: any }) => {
              const player = (players ?? []).find((p: any) => p.id === item.playerId);
              const rawBuyerName = item.userId === dbUserId
                ? "you"
                : (auctionState as any)?.buyerVisibility === "during_auction" && (auctionState as any)?.memberNames?.[item.userId]
                  ? (auctionState as any).memberNames[item.userId]
                  : `#${item.pickNumber}`;
              const buyerName = rawBuyerName.length > 10 ? rawBuyerName.slice(0, 9) + "..." : rawBuyerName;
              return (
                <Card
                  padding="$2"
                  paddingHorizontal="$3"
                  marginHorizontal="$2"
                  marginBottom="$1"
                  borderColor={item.userId === dbUserId ? "$colorAccentLight" : "$borderColor"}
                >
                  <XStack justifyContent="space-between" alignItems="center">
                    <YStack flex={1}>
                      <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>
                        {(player as any)?.name ?? "?"}
                      </Text>
                      <XStack alignItems="center" gap="$1" marginTop={1}>
                        <Badge variant="default" size="sm">
                          {formatRoleShort((player as any)?.role ?? "")}
                        </Badge>
                        <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                          {formatTeamName((player as any)?.team ?? "")}
                        </Text>
                        <Text fontFamily="$mono" fontSize={9} color="$colorCricket" fontWeight="700">{item.amount} Cr</Text>
                      </XStack>
                    </YStack>
                    <Text fontFamily="$mono" fontSize={9} fontWeight="600" color={item.userId === dbUserId ? "$colorAccent" : "$colorMuted"} numberOfLines={1}>
                      {buyerName}
                    </Text>
                  </XStack>
                </Card>
              );
            }}
          />
        </YStack>
      </XStack>
      {nominateAlert && (
        <AlertModal
          visible={!!nominateAlert}
          title={nominateAlert.title}
          message={nominateAlert.message}
          onDismiss={() => setNominateAlert(null)}
          actions={nominateAlert.onConfirm
            ? [
                { label: "cancel", variant: "ghost", onPress: () => setNominateAlert(null) },
                { label: "nominate", variant: "primary", onPress: nominateAlert.onConfirm },
              ]
            : [{ label: "ok", variant: "primary", onPress: () => setNominateAlert(null) }]
          }
        />
      )}
      {/* Player Stats Popup */}
      {statsPlayerId && playerStatsData && (
        <YStack
          style={{ position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0 }}
          zIndex={200}
          alignItems="center"
          justifyContent="center"
          backgroundColor="$colorOverlay"
          onPress={() => setStatsPlayerId(null)}
        >
          <YStack
            backgroundColor="$backgroundSurface"
            borderRadius={20}
            padding="$5"
            width="90%"
            maxWidth={340}
            borderWidth={1}
            borderColor="$borderColor"
            shadowColor="$shadowColor"
            shadowOffset={{ width: 0, height: 16 }}
            shadowOpacity={0.25}
            shadowRadius={32}
            elevation={10}
            onPress={(e: any) => e.stopPropagation()}
          >
            {/* Header: Name + Credits */}
            <XStack justifyContent="space-between" alignItems="flex-start" marginBottom="$3">
              <YStack flex={1}>
                <Text fontFamily="$body" fontWeight="700" fontSize={18} color="$color">
                  {playerStatsData.name}
                </Text>
                <XStack alignItems="center" gap="$2" marginTop={2}>
                  <Badge variant="default" size="sm">{formatRoleShort(playerStatsData.role ?? "")}</Badge>
                  <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{formatTeamName(playerStatsData.team ?? "")}</Text>
                  {playerStatsData.nationality && (
                    <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{playerStatsData.nationality}</Text>
                  )}
                </XStack>
              </YStack>
              <YStack alignItems="center">
                <Text fontFamily="$mono" fontWeight="900" fontSize={22} color="$accentBackground">
                  {playerStatsData.credits?.toFixed(1)}
                </Text>
                <Text fontFamily="$mono" fontSize={9} color="$colorMuted">Cr</Text>
              </YStack>
            </XStack>

            {/* Stats Grid — 3 columns */}
            <XStack marginBottom="$3" gap="$2">
              {playerStatsData.matchesPlayed != null && (
                <YStack flex={1} backgroundColor="$backgroundPress" borderRadius={8} padding="$2" alignItems="center">
                  <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatBadgeText("matches")}</Text>
                  <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">{playerStatsData.matchesPlayed}</Text>
                </YStack>
              )}
              {playerStatsData.average != null && playerStatsData.average > 0 && (
                <YStack flex={1} backgroundColor="$backgroundPress" borderRadius={8} padding="$2" alignItems="center">
                  <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatBadgeText("avg")}</Text>
                  <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">{playerStatsData.average.toFixed(1)}</Text>
                </YStack>
              )}
              {playerStatsData.strikeRate != null && playerStatsData.strikeRate > 0 && (
                <YStack flex={1} backgroundColor="$backgroundPress" borderRadius={8} padding="$2" alignItems="center">
                  <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatBadgeText("sr")}</Text>
                  <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">{playerStatsData.strikeRate.toFixed(0)}</Text>
                </YStack>
              )}
            </XStack>
            {/* Bowling stats row — only if player has bowling data */}
            {(playerStatsData.economyRate ?? 0) > 0 && (
              <XStack marginBottom="$3" gap="$2">
                <YStack flex={1} backgroundColor="$backgroundPress" borderRadius={8} padding="$2" alignItems="center">
                  <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatBadgeText("econ")}</Text>
                  <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">{playerStatsData.economyRate!.toFixed(1)}</Text>
                </YStack>
                {playerStatsData.bowlingAverage != null && playerStatsData.bowlingAverage > 0 && (
                  <YStack flex={1} backgroundColor="$backgroundPress" borderRadius={8} padding="$2" alignItems="center">
                    <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatBadgeText("bowl avg")}</Text>
                    <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">{playerStatsData.bowlingAverage.toFixed(1)}</Text>
                  </YStack>
                )}
                {playerStatsData.bowlingStrikeRate != null && playerStatsData.bowlingStrikeRate > 0 && (
                  <YStack flex={1} backgroundColor="$backgroundPress" borderRadius={8} padding="$2" alignItems="center">
                    <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatBadgeText("bowl sr")}</Text>
                    <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">{playerStatsData.bowlingStrikeRate.toFixed(0)}</Text>
                  </YStack>
                )}
              </XStack>
            )}

            {/* Form + Status + Style in one row */}
            <XStack gap="$3" alignItems="center" marginBottom="$2">
              {playerStatsData.recentForm != null && (
                <XStack alignItems="center" gap="$1">
                  <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("form")}</Text>
                  <Text fontFamily="$mono" fontWeight="700" fontSize={14} color={
                    playerStatsData.recentForm >= 7 ? "$colorAccent" :
                    playerStatsData.recentForm >= 4 ? "$colorCricket" : "$error"
                  }>{playerStatsData.recentForm}/10</Text>
                </XStack>
              )}
              {playerStatsData.injuryStatus && (
                <Badge variant="default" size="sm" backgroundColor={playerStatsData.injuryStatus === "fit" ? "$colorAccent" : "$error"}>
                  {playerStatsData.injuryStatus.toUpperCase()}
                </Badge>
              )}
              {playerStatsData.battingStyle && (
                <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{playerStatsData.battingStyle}</Text>
              )}
            </XStack>

            {playerStatsData.formNote && (
              <Text fontFamily="$body" fontSize={11} color="$colorSecondary" lineHeight={16}>
                {playerStatsData.formNote}
              </Text>
            )}
          </YStack>
        </YStack>
      )}
      <Paywall {...paywallProps} />

      {/* Strategy Quiz Modal */}
      {showStrategyQuiz && (
        <YStack
          style={{ position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0 }}
          zIndex={300}
          alignItems="center"
          justifyContent="center"
          backgroundColor="$colorOverlay"
          onPress={() => setShowStrategyQuiz(false)}
        >
          <YStack
            backgroundColor="$backgroundSurface"
            borderRadius={20}
            padding="$5"
            width="92%"
            maxWidth={400}
            borderWidth={1}
            borderColor="$borderColor"
            onPress={(e: any) => e.stopPropagation()}
          >
            <XStack alignItems="center" gap="$2" marginBottom="$4">
              <Ionicons name="sparkles" size={20} color="#D4A43D" />
              <Text fontFamily="$mono" fontWeight="800" fontSize={16} color="$color">
                {formatUIText("build your strategy")}
              </Text>
            </XStack>
            <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginBottom="$4">
              {formatUIText("answer 4 questions to generate a personalized target squad. run this anytime — it rebuilds from available players.")}
            </Text>

            {/* Q1: Star Power */}
            {(() => {
              const questions = [
                {
                  key: "starPower" as const,
                  label: "star power vs depth",
                  left: "deep bench",
                  right: "all-star XI",
                  icon: "diamond-outline" as const,
                },
                {
                  key: "battingBias" as const,
                  label: "batting vs bowling priority",
                  left: "batting heavy",
                  right: "bowling heavy",
                  icon: "swap-horizontal-outline" as const,
                },
                {
                  key: "formVsRep" as const,
                  label: "form vs reputation",
                  left: "proven stars",
                  right: "in-form players",
                  icon: "trending-up-outline" as const,
                },
                {
                  key: "riskAppetite" as const,
                  label: "risk appetite",
                  left: "safe picks",
                  right: "high ceiling",
                  icon: "flash-outline" as const,
                },
              ];

              return questions.map((q) => (
                <YStack key={q.key} marginBottom="$3">
                  <XStack alignItems="center" gap="$1" marginBottom={4}>
                    <Ionicons name={q.icon} size={13} color="#9A9894" />
                    <Text fontFamily="$mono" fontSize={11} fontWeight="700" color="$color">
                      {q.label}
                    </Text>
                  </XStack>
                  <XStack justifyContent="space-between" marginBottom={4}>
                    <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{q.left}</Text>
                    <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{q.right}</Text>
                  </XStack>
                  <XStack gap={4}>
                    {[1, 3, 5, 7, 10].map((val) => {
                      const isSelected = strategy[q.key] === val;
                      const isClose = Math.abs(strategy[q.key] - val) <= 1;
                      return (
                        <YStack
                          key={val}
                          flex={1}
                          height={32}
                          borderRadius={8}
                          backgroundColor={isSelected ? "$accentBackground" : isClose ? "rgba(93, 184, 130, 0.15)" : "$backgroundPress"}
                          borderWidth={isSelected ? 2 : 1}
                          borderColor={isSelected ? "$accentBackground" : "transparent"}
                          alignItems="center"
                          justifyContent="center"
                          onPress={() => setStrategy((s) => ({ ...s, [q.key]: val }))}
                          cursor="pointer"
                          pressStyle={{ scale: 0.95 }}
                        >
                          <Text fontFamily="$mono" fontSize={11} fontWeight={isSelected ? "900" : "500"} color={isSelected ? "$accentColor" : "$colorMuted"}>
                            {val}
                          </Text>
                        </YStack>
                      );
                    })}
                  </XStack>
                </YStack>
              ));
            })()}

            <XStack gap="$3" marginTop="$2">
              <Button
                variant="secondary"
                size="md"
                flex={1}
                onPress={() => setShowStrategyQuiz(false)}
              >
                {formatUIText("cancel")}
              </Button>
              <Button
                variant="primary"
                size="md"
                flex={1}
                disabled={autoBuildMutation.isPending}
                onPress={() => {
                  autoBuildMutation.mutate({ roomId: roomId!, strategy });
                  setShowStrategyQuiz(false);
                }}
              >
                <XStack alignItems="center" gap="$1">
                  <Ionicons name="sparkles" size={14} color="#fff" />
                  <Text fontFamily="$mono" fontSize={12} fontWeight="700" color="white">
                    {autoBuildMutation.isPending ? formatUIText("building...") : formatUIText("build squad")}
                  </Text>
                </XStack>
              </Button>
            </XStack>
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}
