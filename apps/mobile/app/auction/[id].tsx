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
  const [showRoster, setShowRoster] = useState(false);
  const [rosterTab, setRosterTab] = useState<"mine" | "all">("mine");

  // Pause/resume
  const pauseMutation = trpc.draft.pauseAuction.useMutation({ onSuccess: () => refetch() });
  const resumeMutation = trpc.draft.resumeAuction.useMutation({ onSuccess: () => refetch() });
  const [wonPlayer, setWonPlayer] = useState<string | null>(null);
  const { gate, paywallProps } = usePaywall();

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
  const mySquadFull = myTeamSize >= ((auctionState as any)?.maxPlayersPerTeam ?? 11);
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
    setNominateAlert({
      title: "nominate",
      message: `put ${playerName} up for auction?`,
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
              <Text testID="auction-my-team-size" {...textStyles.hint}>
                {formatUIText("team")}: {myTeamSize}/{(auctionState as any)?.squadRuleDetails?.squadSize ?? (auctionState as any)?.maxPlayersPerTeam ?? 14} {formatUIText("players")}
              </Text>
            </YStack>
            <HeaderControls />
          </XStack>
          {/* Active squad rule display */}
          {(auctionState as any)?.squadRuleDetails && (
            <XStack
              marginTop="$1"
              paddingHorizontal="$4"
              paddingVertical={4}
              backgroundColor="$backgroundSurface"
              borderRadius={8}
              alignItems="center"
              gap="$2"
            >
              <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorAccent">
                {(auctionState as any).squadRuleDetails.name}
              </Text>
              <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                WK:{(auctionState as any).squadRuleDetails.minWK}-{(auctionState as any).squadRuleDetails.maxWK}{" "}
                BAT:{(auctionState as any).squadRuleDetails.minBAT}-{(auctionState as any).squadRuleDetails.maxBAT}{" "}
                BOWL:{(auctionState as any).squadRuleDetails.minBOWL}-{(auctionState as any).squadRuleDetails.maxBOWL}{" "}
                AR:{(auctionState as any).squadRuleDetails.minAR}-{(auctionState as any).squadRuleDetails.maxAR}
              </Text>
            </XStack>
          )}
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
        {/* Pause + Roster buttons */}
        <XStack justifyContent="space-between" marginTop="$2" alignItems="center">
          {/* Pause button */}
          {auctionState?.status === "in_progress" && (auctionState as any)?.maxPausesPerMember > 0 && (
            <YStack
              onPress={() => {
                if ((auctionState as any)?.isPaused) {
                  resumeMutation.mutate({ roomId: roomId! });
                } else {
                  pauseMutation.mutate({ roomId: roomId! });
                }
              }}
              cursor="pointer"
              pressStyle={{ opacity: 0.8 }}
              paddingHorizontal="$3"
              paddingVertical="$1"
              borderRadius={DesignSystem.radius.md}
              backgroundColor={(auctionState as any)?.isPaused ? "$error" : "$backgroundSurface"}
              opacity={
                (auctionState as any)?.isPaused
                  ? ((auctionState as any)?.pausedBy === dbUserId || false) ? 1 : 0.5
                  : ((auctionState as any)?.pausesUsed?.[dbUserId!] ?? 0) >= (auctionState as any)?.maxPausesPerMember ? 0.4 : 1
              }
              disabled={
                (auctionState as any)?.isPaused
                  ? (auctionState as any)?.pausedBy !== dbUserId
                  : ((auctionState as any)?.pausesUsed?.[dbUserId!] ?? 0) >= (auctionState as any)?.maxPausesPerMember
              }
            >
              <Text fontFamily="$mono" fontSize={11} fontWeight="600" color={(auctionState as any)?.isPaused ? "white" : "$colorMuted"}>
                {(auctionState as any)?.isPaused
                  ? (auctionState as any)?.pausedBy === dbUserId ? "resume" : "paused"
                  : `pause (${(auctionState as any)?.maxPausesPerMember - ((auctionState as any)?.pausesUsed?.[dbUserId!] ?? 0)} left)`}
              </Text>
            </YStack>
          )}

          {/* Roster toggle */}
          <YStack
            onPress={() => setShowRoster(!showRoster)}
            cursor="pointer"
            pressStyle={{ opacity: 0.8 }}
            paddingHorizontal="$3"
            paddingVertical="$1"
            borderRadius={DesignSystem.radius.md}
            backgroundColor={showRoster ? "$accentBackground" : "$backgroundSurface"}
          >
            <Text fontFamily="$mono" fontSize={11} fontWeight="600" color={showRoster ? "$accentColor" : "$colorMuted"}>
              {formatUIText(`squads (${myTeamSize})`)}
            </Text>
          </YStack>
        </XStack>
      </YStack>

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
          ) : isMyNomination ? (
            <Text testID="auction-nominate-prompt" fontFamily="$mono" fontWeight="500" fontSize={14} color="$colorCricket">
              {formatUIText("your turn to nominate a player!")}
            </Text>
          ) : (
            <Text fontFamily="$mono" fontWeight="500" fontSize={13} color="$colorMuted">
              {formatUIText("waiting for nomination...")}
            </Text>
          )}
        </YStack>
      )}

      {/* Squad Panel — My Squad / All Squads tabs */}
      {showRoster && (
        <YStack backgroundColor="$backgroundSurface" padding="$3" borderBottomWidth={1} borderBottomColor="$borderColor" maxHeight={260}>
          {/* Tab switcher */}
          <XStack gap="$2" marginBottom="$2">
            {(["mine", "all"] as const).map((tab) => {
              const isActive = rosterTab === tab;
              const vis = (auctionState as any)?.squadVisibility ?? "after_sold";
              // "full" = always, "after_sold" = visible (sold data is public), "hidden" = only after auction ends
              const canShowAll = vis === "full" || vis === "after_sold" || auctionState?.status === "completed";
              if (tab === "all" && !canShowAll) return null;
              return (
                <YStack
                  key={tab}
                  onPress={() => setRosterTab(tab)}
                  cursor="pointer"
                  paddingHorizontal="$3"
                  paddingVertical={4}
                  borderRadius={DesignSystem.radius.md}
                  backgroundColor={isActive ? "$accentBackground" : "transparent"}
                >
                  <Text fontFamily="$mono" fontSize={11} fontWeight={isActive ? "700" : "500"} color={isActive ? "$accentColor" : "$colorMuted"}>
                    {tab === "mine" ? `my squad (${myTeamSize})` : "all squads"}
                  </Text>
                </YStack>
              );
            })}
          </XStack>

          {rosterTab === "mine" ? (
            <FlatList
              data={(auctionState?.soldPlayers ?? []).filter((p: any) => p.userId === dbUserId)}
              keyExtractor={(item: any) => item.playerId}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }: { item: any }) => {
                const player = (players ?? []).find((p: any) => p.id === item.playerId);
                return (
                  <Card padding="$2" marginRight="$2" minWidth={100}>
                    <Text {...textStyles.playerName} fontSize={11} numberOfLines={1}>
                      {(player as any)?.name ?? "Unknown"}
                    </Text>
                    <XStack alignItems="center" gap="$1" marginTop={2}>
                      <Badge variant="default" size="sm">{formatRoleShort((player as any)?.role ?? "")}</Badge>
                      <Text fontFamily="$mono" fontSize={9} color="$colorCricket">{item.amount} Cr</Text>
                    </XStack>
                  </Card>
                );
              }}
              ListEmptyComponent={
                <Text fontFamily="$body" fontSize={11} color="$colorMuted">{formatUIText("no players yet")}</Text>
              }
            />
          ) : (
            <FlatList
              data={auctionState?.pickOrder ?? []}
              keyExtractor={(uid: string) => uid}
              renderItem={({ item: uid }: { item: string }) => {
                const memberName = (auctionState as any)?.memberNames?.[uid] ?? "Player";
                const memberPlayers = (auctionState?.soldPlayers ?? []).filter((sp: any) => sp.userId === uid);
                const isMe = uid === dbUserId;
                return (
                  <YStack marginBottom="$2">
                    <XStack alignItems="center" gap="$2" marginBottom={4}>
                      <Text fontFamily="$mono" fontSize={11} fontWeight="700" color={isMe ? "$colorAccent" : "$color"}>
                        {isMe ? "you" : memberName}
                      </Text>
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                        {memberPlayers.length} players | {(auctionState?.budgets?.[uid] ?? 0).toFixed(1)} Cr left
                      </Text>
                    </XStack>
                    <FlatList
                      data={memberPlayers}
                      keyExtractor={(sp: any) => sp.playerId}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      renderItem={({ item: sp }: { item: any }) => {
                        const player = (players ?? []).find((p: any) => p.id === sp.playerId);
                        return (
                          <Card padding="$2" marginRight="$2" minWidth={90}>
                            <Text {...textStyles.playerName} fontSize={10} numberOfLines={1}>
                              {(player as any)?.name ?? "?"}
                            </Text>
                            <Text fontFamily="$mono" fontSize={8} color="$colorCricket" marginTop={1}>{sp.amount} Cr</Text>
                          </Card>
                        );
                      }}
                      ListEmptyComponent={
                        <Text fontFamily="$body" fontSize={10} color="$colorMuted">no players yet</Text>
                      }
                    />
                  </YStack>
                );
              }}
            />
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
        <YStack flex={1} borderRightWidth={1} borderRightColor="$borderColor">
          <Text {...textStyles.sectionHeader} padding="$3" paddingBottom="$2">
            {formatUIText("available")} ({filteredAvailable.length})
          </Text>
          <FlatList
            testID="auction-available-list"
            data={filteredAvailable}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item, index }: { item: any; index: number }) => (
              <Animated.View entering={FadeInDown.delay(30 + index * 20).springify()}>
                <Card
                  pressable
                  padding="$3"
                  marginHorizontal="$2"
                  marginBottom="$1"
                  opacity={isMyNomination && !currentPlayer && !mySquadFull ? 1 : 0.6}
                  onPress={() => isMyNomination && !currentPlayer && !mySquadFull ? handleNominate(item.id, item.name) : null}
                  disabled={!isMyNomination || !!currentPlayer || mySquadFull}
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
                      <Text {...textStyles.playerName} fontSize={13} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <XStack alignItems="center" gap="$1">
                        <Badge variant="default" size="sm">
                          {formatRoleShort(item.role ?? "")}
                        </Badge>
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                          {formatTeamName(item.team)}
                        </Text>
                      </XStack>
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
                </Card>
              </Animated.View>
            )}
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
        <YStack width="40%">
          <Text {...textStyles.sectionHeader} padding="$3" paddingBottom="$2">
            {formatUIText("sold")} ({filteredSold.length})
          </Text>
          <FlatList
            testID="auction-sold-list"
            data={[...filteredSold].reverse()}
            keyExtractor={(item: any, idx: number) => `${item.playerId}-${idx}`}
            renderItem={({ item }: { item: any }) => {
              const player = (players ?? []).find((p: any) => p.id === item.playerId);
              return (
                <Card
                  padding="$3"
                  marginHorizontal="$2"
                  marginBottom="$1"
                  borderColor={item.userId === dbUserId ? "$colorAccentLight" : "$borderColor"}
                >
                  <Text {...textStyles.playerName} fontSize={12} numberOfLines={1}>
                    {(player as any)?.name ?? formatUIText("unknown")}
                  </Text>
                  <XStack justifyContent="space-between" alignItems="center" marginTop={2}>
                    <Text fontFamily="$mono" fontSize={9} color="$colorCricket">{item.amount} Cr</Text>
                    <Text fontFamily="$mono" fontSize={8} color={item.userId === dbUserId ? "$colorAccent" : "$colorMuted"}>
                      {item.userId === dbUserId
                        ? "you"
                        : (auctionState as any)?.buyerVisibility === "during_auction" && (auctionState as any)?.memberNames?.[item.userId]
                          ? (auctionState as any).memberNames[item.userId]
                          : `#${item.pickNumber}`}
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
    </YStack>
  );
}
