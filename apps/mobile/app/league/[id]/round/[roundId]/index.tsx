import { SafeBackButton } from "../../../../../components/SafeBackButton";
import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack } from "tamagui";
import { Text } from "../../../../../components/SportText";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  EggLoadingSpinner,
  textStyles,
  formatUIText,
  formatBadgeText,
  formatTeamName,
} from "@draftplay/ui";
import { trpc } from "../../../../../lib/trpc";
import { HeaderControls } from "../../../../../components/HeaderControls";

const STATUS_VARIANT: Record<
  string,
  "default" | "live" | "role" | "warning" | "danger" | "success"
> = {
  upcoming: "role",
  open: "success",
  locked: "role",
  live: "live",
  settled: "default",
  void: "danger",
};

type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

function roleToBadge(role: string): RoleKey {
  if (role === "bowler") return "BOWL";
  if (role === "all_rounder") return "AR";
  if (role === "wicket_keeper") return "WK";
  return "BAT";
}

function formatDateTime(dt: string | Date) {
  const d = new Date(dt);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeOnly(dt: string | Date) {
  return new Date(dt).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(dt: string | Date) {
  const ms = new Date(dt).getTime() - Date.now();
  if (ms < 0) return "started";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function RoundHubScreen() {
  const { id: leagueId, roundId } = useLocalSearchParams<{
    id: string;
    roundId: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const roundQuery = trpc.cricketManager.getRound.useQuery(
    { roundId: roundId! },
    { enabled: !!roundId, refetchInterval: 15000 }
  );

  // Normalize for per-player scorecard lookup
  const eligibleById = useMemo(() => {
    const pool = (roundQuery.data?.eligiblePlayers ?? []) as Array<{
      playerId: string;
      name: string;
      team: string;
      role: string;
      photoUrl?: string | null;
    }>;
    return new Map(pool.map((p) => [p.playerId, p]));
  }, [roundQuery.data?.eligiblePlayers]);

  // Aggregate match state per team across ALL matches in the round — a
  // single team can play multiple matches in one round (e.g. SRH vs PBKS +
  // SRH vs RR), so we need a combined view rather than last-write-wins.
  const teamMatchState = useMemo(() => {
    const map = new Map<
      string,
      {
        done: number;
        live: number;
        upcoming: number;
        /** overall state label */
        state: "done" | "live" | "partial" | "upcoming";
      }
    >();

    const rows = (roundQuery.data?.matches ?? []) as Array<{
      id: string;
      status: string;
      teamHome: string;
      teamAway: string;
    }>;

    const bump = (team: string, status: string) => {
      const cur = map.get(team) ?? {
        done: 0,
        live: 0,
        upcoming: 0,
        state: "upcoming" as const,
      };
      if (status === "completed" || status === "abandoned") cur.done += 1;
      else if (status === "live") cur.live += 1;
      else cur.upcoming += 1;
      map.set(team, cur);
    };

    for (const m of rows) {
      bump(m.teamHome, m.status);
      bump(m.teamAway, m.status);
    }

    // Compute combined state per team
    for (const [team, counts] of map.entries()) {
      let state: "done" | "live" | "partial" | "upcoming";
      if (counts.live > 0) state = "live";
      else if (counts.done > 0 && counts.upcoming > 0) state = "partial";
      else if (counts.done > 0 && counts.upcoming === 0) state = "done";
      else state = "upcoming";
      map.set(team, { ...counts, state });
    }

    return map;
  }, [roundQuery.data?.matches]);

  if (roundQuery.isLoading) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
      >
        <EggLoadingSpinner size={48} message="loading round" />
      </YStack>
    );
  }

  if (!roundQuery.data) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
      >
        <Text {...textStyles.hint}>{formatUIText("round not found")}</Text>
      </YStack>
    );
  }

  const round = roundQuery.data;
  const hasEntry = !!round.myEntry;
  // Round status is the single source of truth for whether entries are
  // accepted. Backend transitions `open → live` the moment the first match
  // in the round goes live.
  const isOpen = round.status === "open" || round.status === "upcoming";

  const cta = (() => {
    if (isOpen) {
      return {
        label: hasEntry ? "edit entry" : "build entry",
        disabled: false,
        variant: "primary" as const,
      };
    }
    if (round.status === "locked" || round.status === "live") {
      return {
        label: hasEntry ? "view live scorecard" : "view leaderboard",
        disabled: false,
        variant: "primary" as const,
      };
    }
    if (round.status === "settled") {
      return {
        label: hasEntry ? "view final scorecard" : "view results",
        disabled: false,
        variant: "primary" as const,
      };
    }
    return { label: "view", disabled: true, variant: "secondary" as const };
  })();

  function onCtaPress() {
    if (!roundId || !leagueId) return;
    if (isOpen) {
      router.push(`/league/${leagueId}/round/${roundId}/build` as never);
    } else {
      router.push(`/league/${leagueId}/round/${roundId}/leaderboard` as never);
    }
  }

  // Next upcoming match for header countdown. Only count matches whose
  // start time is actually in the future — a match that was reset back
  // to "upcoming" after its start time passed isn't "next".
  const nowMs = Date.now();
  const sortedMatches = [...((round.matches ?? []) as any[])].sort(
    (a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  const nextMatch = sortedMatches.find(
    (m) =>
      m.status === "upcoming" && new Date(m.startTime).getTime() > nowMs
  );
  const liveMatch = sortedMatches.find((m) => m.status === "live");
  const firstMatch = sortedMatches[0];
  const completedCount = round.matchesCompleted ?? 0;
  const totalMatches = round.matchesTotal ?? (round.matches?.length ?? 0);

  return (
    <YStack flex={1} backgroundColor="$background">
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <XStack
          justifyContent="space-between"
          alignItems="center"
          marginBottom="$4"
        >
          <XStack alignItems="center" gap="$3">
            <SafeBackButton />
            <Text
              fontFamily="$mono"
              fontWeight="500"
              fontSize={17}
              color="$color"
              letterSpacing={-0.5}
            >
              {formatUIText("round")} {round.roundNumber}
            </Text>
          </XStack>
          <HeaderControls />
        </XStack>

        {/* Round header */}
        <Animated.View entering={FadeInDown.delay(40).springify()}>
          <Card padding="$5" marginBottom="$4">
            <XStack justifyContent="space-between" alignItems="flex-start">
              <YStack flex={1}>
                <Text
                  fontFamily="$mono"
                  fontWeight="500"
                  fontSize={18}
                  color="$color"
                  letterSpacing={-0.5}
                >
                  {round.name}
                </Text>
                <Text
                  fontFamily="$body"
                  fontSize={12}
                  color="$colorMuted"
                  marginTop="$1"
                >
                  {totalMatches} {formatUIText("matches")} ·{" "}
                  {formatDateTime(round.windowStart)}
                </Text>
              </YStack>
              <Badge
                variant={STATUS_VARIANT[round.status] ?? "default"}
                size="sm"
              >
                {formatBadgeText(round.status)}
              </Badge>
            </XStack>

            {/* Progress bar — only once some match action has happened */}
            {totalMatches > 0 &&
              (completedCount > 0 || liveMatch || round.status !== "open") && (
                <YStack marginTop="$3" gap={4}>
                  <XStack alignItems="center" justifyContent="space-between">
                    <Text
                      fontFamily="$mono"
                      fontSize={11}
                      color="$colorMuted"
                    >
                      {completedCount}/{totalMatches}{" "}
                      {formatUIText("matches done")}
                    </Text>
                    {liveMatch ? (
                      <Text
                        fontFamily="$mono"
                        fontSize={11}
                        color="$colorCricket"
                        fontWeight="700"
                      >
                        ● {formatUIText("live")}:{" "}
                        {formatTeamName(liveMatch.teamHome)} {formatUIText("vs")}{" "}
                        {formatTeamName(liveMatch.teamAway)}
                      </Text>
                    ) : nextMatch ? (
                      <Text
                        fontFamily="$mono"
                        fontSize={11}
                        color="$accentBackground"
                        fontWeight="700"
                      >
                        {formatUIText("next in")}{" "}
                        {formatCountdown(nextMatch.startTime)}
                      </Text>
                    ) : null}
                  </XStack>
                  <YStack
                    height={6}
                    borderRadius={3}
                    backgroundColor="$backgroundSurfaceAlt"
                    overflow="hidden"
                  >
                    <YStack
                      width={
                        (`${Math.round((completedCount / Math.max(1, totalMatches)) * 100)}%` as unknown) as number
                      }
                      height={6}
                      backgroundColor="$accentBackground"
                    />
                  </YStack>
                </YStack>
              )}

            <XStack gap="$2" marginTop="$3" flexWrap="wrap">
              <Badge variant="role" size="sm">
                {round.ballLimit} balls
              </Badge>
              <Badge variant="role" size="sm">
                min {round.minBowlers} bowlers
              </Badge>
              <Badge variant="role" size="sm">
                max {round.maxOversPerBowler} overs/bowler
              </Badge>
              {isOpen &&
                (() => {
                  // Show "entries close when X vs Y starts" or the time if soon
                  if (!firstMatch) return null;
                  const startMs = new Date(firstMatch.startTime).getTime();
                  if (startMs > nowMs) {
                    return (
                      <Badge variant="warning" size="sm">
                        closes {formatCountdown(firstMatch.startTime)}
                      </Badge>
                    );
                  }
                  // Start time already passed but match not yet live — just
                  // say "closes at first match" without a clock.
                  return (
                    <Badge variant="warning" size="sm">
                      closes at first match
                    </Badge>
                  );
                })()}
              {round.status === "live" && (
                <Badge variant="live" size="sm">
                  entries locked
                </Badge>
              )}
            </XStack>
          </Card>
        </Animated.View>

        {/* ── Live dual-bar race (if user has entry and round is live/settled) ── */}
        {round.myEntry &&
          (round.status === "live" ||
            round.status === "locked" ||
            round.status === "settled") && (
            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <DualBarRace
                batting={round.myEntry.battingTotal ?? 0}
                bowling={round.myEntry.bowlingTotal ?? 0}
                nrr={Number(round.myEntry.nrr ?? 0)}
                isLive={round.status === "live"}
              />
            </Animated.View>
          )}

        {/* ── Per-player live scorecard ── */}
        {round.myEntry &&
          (round.status === "live" ||
            round.status === "locked" ||
            round.status === "settled") && (
            <Animated.View entering={FadeInDown.delay(140).springify()}>
              <PerPlayerScorecard
                entry={round.myEntry}
                eligibleById={eligibleById}
                teamMatchState={teamMatchState}
                roundSettled={round.status === "settled"}
              />
            </Animated.View>
          )}

        {/* Primary actions — elevated above the match list so users don't
            have to scroll to start the core flow. Secondary "leaderboard"
            link stays a quiet text link, not a full-width button, so it
            doesn't dilute the CTA hierarchy. */}
        <YStack marginTop="$4" gap="$2">
          <Button
            variant={cta.variant}
            size="lg"
            disabled={cta.disabled}
            onPress={onCtaPress}
            testID="round-cta"
          >
            {formatUIText(cta.label)}
          </Button>
          {round.status !== "upcoming" && (
            <Button
              variant="secondary"
              size="md"
              onPress={() =>
                router.push(
                  `/league/${leagueId}/round/${roundId}/leaderboard` as never
                )
              }
            >
              {formatUIText("leaderboard")}
            </Button>
          )}
        </YStack>

        {/* Your squad — render the user's picks in a horizontally-scrollable
            strip once they've built an entry, so they can see who's playing
            for them from the round page without going back to the build
            flow. Hidden until an entry exists. */}
        {round.myEntry && (
          <YStack marginTop="$4">
            <Text
              fontFamily="$mono"
              fontSize={12}
              color="$colorMuted"
              textTransform="uppercase"
              letterSpacing={1}
              marginBottom="$2"
            >
              {formatUIText("your squad")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
            >
              {(
                (round.myEntry.players ?? []) as Array<{ playerId: string }>
              ).map((pick) => {
                const p = eligibleById.get(pick.playerId);
                if (!p) return null;
                return (
                  <YStack
                    key={pick.playerId}
                    alignItems="center"
                    width={52}
                  >
                    <InitialsAvatar
                      name={p.name}
                      playerRole={
                        p.role === "bowler"
                          ? "BOWL"
                          : p.role === "all_rounder"
                            ? "AR"
                            : p.role === "wicket_keeper"
                              ? "WK"
                              : "BAT"
                      }
                      ovr={0}
                      size={40}
                      hideBadge
                      imageUrl={p.photoUrl ?? undefined}
                    />
                    <Text
                      fontFamily="$body"
                      fontSize={9}
                      color="$color"
                      numberOfLines={1}
                      marginTop={4}
                      textAlign="center"
                    >
                      {p.name.split(" ").pop() ?? p.name}
                    </Text>
                  </YStack>
                );
              })}
            </ScrollView>
          </YStack>
        )}

        {/* Matches in this round */}
        <Text
          fontFamily="$mono"
          fontSize={12}
          color="$colorMuted"
          textTransform="uppercase"
          letterSpacing={1}
          marginBottom="$2"
          marginTop="$4"
        >
          {formatUIText("matches in round")}
        </Text>
        {sortedMatches.length === 0 ? (
          <Card padding="$5" alignItems="center" marginBottom="$4">
            <Text {...textStyles.hint}>{formatUIText("no matches")}</Text>
          </Card>
        ) : (
          sortedMatches.map((m: any, i: number) => {
            const isDone =
              m.status === "completed" || m.status === "abandoned";
            const isLive = m.status === "live";
            return (
              <Animated.View
                key={m.id}
                entering={FadeInDown.delay(180 + i * 30).springify()}
              >
                <Card
                  marginBottom="$2"
                  padding="$4"
                  borderWidth={isLive ? 2 : 1}
                  borderColor={isLive ? "$colorCricket" : "$borderColor"}
                >
                  <XStack
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <YStack flex={1}>
                      <Text
                        fontFamily="$mono"
                        fontWeight="600"
                        fontSize={14}
                        color="$accentBackground"
                      >
                        {formatTeamName(m.teamHome)} {formatUIText("vs")}{" "}
                        {formatTeamName(m.teamAway)}
                      </Text>
                      <Text
                        fontFamily="$body"
                        fontSize={11}
                        color="$colorMuted"
                        marginTop="$1"
                      >
                        {m.format?.toUpperCase?.() ?? ""} ·{" "}
                        {formatDateTime(m.startTime)}
                      </Text>
                      {m.venue && (
                        <Text
                          fontFamily="$body"
                          fontSize={11}
                          color="$colorMuted"
                          numberOfLines={1}
                        >
                          {m.venue}
                        </Text>
                      )}
                      {m.scoreSummary && (
                        <Text
                          fontFamily="$mono"
                          fontSize={11}
                          color="$colorCricket"
                          marginTop="$1"
                        >
                          {m.scoreSummary}
                        </Text>
                      )}
                    </YStack>
                    <Badge
                      variant={
                        isLive
                          ? "live"
                          : isDone
                            ? "default"
                            : "role"
                      }
                      size="sm"
                    >
                      {isLive ? "LIVE" : formatBadgeText(m.status)}
                    </Badge>
                  </XStack>
                </Card>
              </Animated.View>
            );
          })
        )}

      </ScrollView>
    </YStack>
  );
}

// ─── Dual bar race ─────────────────────────────────────────────────────

function DualBarRace({
  batting,
  bowling,
  nrr,
  isLive,
}: {
  batting: number;
  bowling: number;
  nrr: number;
  isLive: boolean;
}) {
  const max = Math.max(batting, bowling, 1);
  const batPct = Math.round((batting / max) * 100);
  const bowlPct = Math.round((bowling / max) * 100);
  const leadsBy = batting - bowling;
  const leader =
    leadsBy > 0 ? "batting leads" : leadsBy < 0 ? "bowling leads" : "tied";

  return (
    <Card
      padding="$4"
      marginBottom="$4"
      borderWidth={isLive ? 2 : 1}
      borderColor={isLive ? "$colorCricket" : "$borderColor"}
    >
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
        <Text
          fontFamily="$mono"
          fontSize={10}
          color="$colorMuted"
          textTransform="uppercase"
          letterSpacing={1}
        >
          {formatUIText("your internal match")}
        </Text>
        {isLive && (
          <XStack alignItems="center" gap="$1">
            <YStack
              width={6}
              height={6}
              borderRadius={3}
              backgroundColor="$colorCricket"
            />
            <Text
              fontFamily="$mono"
              fontSize={10}
              color="$colorCricket"
              fontWeight="700"
            >
              {formatUIText("live")}
            </Text>
          </XStack>
        )}
      </XStack>

      {/* Batting bar */}
      <YStack marginBottom="$2">
        <XStack justifyContent="space-between" alignItems="baseline">
          <Text fontFamily="$body" fontSize={10} color="$colorMuted">
            BAT
          </Text>
          <Text
            fontFamily="$mono"
            fontWeight="800"
            fontSize={16}
            color="$accentBackground"
          >
            {batting}
          </Text>
        </XStack>
        <YStack
          marginTop={2}
          height={10}
          borderRadius={5}
          backgroundColor="$backgroundSurfaceAlt"
          overflow="hidden"
        >
          <YStack
            width={(`${batPct}%` as unknown) as number}
            height={10}
            backgroundColor="$accentBackground"
          />
        </YStack>
      </YStack>

      {/* Bowling bar */}
      <YStack>
        <XStack justifyContent="space-between" alignItems="baseline">
          <Text fontFamily="$body" fontSize={10} color="$colorMuted">
            BOWL
          </Text>
          <Text
            fontFamily="$mono"
            fontWeight="800"
            fontSize={16}
            color="$colorCricket"
          >
            {bowling}
          </Text>
        </XStack>
        <YStack
          marginTop={2}
          height={10}
          borderRadius={5}
          backgroundColor="$backgroundSurfaceAlt"
          overflow="hidden"
        >
          <YStack
            width={(`${bowlPct}%` as unknown) as number}
            height={10}
            backgroundColor="$colorCricket"
          />
        </YStack>
      </YStack>

      {/* NRR + leader */}
      <XStack
        marginTop="$3"
        padding="$2"
        backgroundColor="$backgroundSurfaceAlt"
        borderRadius={8}
        justifyContent="space-between"
        alignItems="center"
      >
        <Text fontFamily="$body" fontSize={11} color="$colorMuted">
          {formatUIText(leader)}
        </Text>
        <Text
          fontFamily="$mono"
          fontWeight="800"
          fontSize={18}
          color={nrr >= 0 ? "$accentBackground" : "$colorHatch"}
        >
          NRR {nrr >= 0 ? "+" : ""}
          {nrr.toFixed(2)}
        </Text>
      </XStack>
    </Card>
  );
}

// ─── Per-player scorecard ──────────────────────────────────────────────

function PerPlayerScorecard({
  entry,
  eligibleById,
  teamMatchState,
  roundSettled,
}: {
  entry: any;
  eligibleById: Map<
    string,
    {
      playerId: string;
      name: string;
      team: string;
      role: string;
      photoUrl?: string | null;
    }
  >;
  teamMatchState: Map<
    string,
    {
      done: number;
      live: number;
      upcoming: number;
      state: "done" | "live" | "partial" | "upcoming";
    }
  >;
  roundSettled: boolean;
}) {
  const battingOrder = (
    (entry.battingOrder ?? []) as Array<{ position: number; playerId: string }>
  )
    .slice()
    .sort((a, b) => a.position - b.position);
  const bowlingPriority = (
    (entry.bowlingPriority ?? []) as Array<{
      priority: number;
      playerId: string;
    }>
  )
    .slice()
    .sort((a, b) => a.priority - b.priority);

  // Batting details — per-batter breakdown produced by the engine
  const battingDetails = new Map<
    string,
    {
      runs: number;
      ballsFaced: number;
      dismissed: boolean;
      status: "full" | "partial" | "didnt_bat";
    }
  >();
  for (const d of (entry.battingDetails ?? []) as Array<{
    playerId: string;
    runs: number;
    ballsFaced: number;
    dismissed: boolean;
    status: "full" | "partial" | "didnt_bat";
  }>) {
    battingDetails.set(d.playerId, d);
  }

  const bowlingDetails = new Map<
    string,
    {
      cappedOvers: number;
      runsConceded: number;
      wickets: number;
    }
  >();
  for (const d of (entry.bowlingDetails ?? []) as Array<{
    playerId: string;
    cappedOvers: number;
    runsConceded: number;
    wickets: number;
  }>) {
    bowlingDetails.set(d.playerId, d);
  }

  // Icon reflects the AGGREGATED state across all of a team's matches
  // in the round. A team with 1 done + 1 upcoming is "partial" (⏱), not
  // just the state of whichever match happened to be listed last.
  function matchIcon(playerTeam: string): string {
    const s = teamMatchState.get(playerTeam);
    if (!s) return "⏳";
    if (s.state === "live") return "🔴";
    if (s.state === "done") return "✅";
    if (s.state === "partial") return "⏱";
    return "⏳";
  }

  // When a player's team still has matches to come, their stats are a
  // running snapshot — label as "so far" instead of "out" to avoid
  // implying finality.
  function hasMoreToCome(playerTeam: string): boolean {
    const s = teamMatchState.get(playerTeam);
    return !!s && (s.live > 0 || s.upcoming > 0);
  }

  // Convert raw balls bowled to cricket notation overs (e.g. 41 balls → 6.5
  // not 6.8). The engine writes cappedOvers per-bowler in cricket notation
  // already, but the aggregate footer was using decimal math — this fixes it.
  function ballsToCricketOvers(balls: number): number {
    const full = Math.floor(balls / 6);
    const partial = balls % 6;
    return full + partial / 10;
  }

  return (
    <Card padding="$4" marginBottom="$4">
      <Text
        fontFamily="$mono"
        fontSize={10}
        color="$colorMuted"
        textTransform="uppercase"
        letterSpacing={1}
        marginBottom="$2"
      >
        {formatUIText("your batting scorecard")}
      </Text>

      {battingOrder.map((slot, i) => {
        const p = eligibleById.get(slot.playerId);
        if (!p) return null;
        const d = battingDetails.get(slot.playerId);
        const mi = matchIcon(p.team);

        return (
          <XStack
            key={`bat-${slot.playerId}`}
            paddingVertical={6}
            alignItems="center"
            gap="$2"
            borderBottomWidth={i < battingOrder.length - 1 ? 1 : 0}
            borderBottomColor="$borderColor"
          >
            <Text
              fontFamily="$mono"
              fontSize={11}
              color="$colorMuted"
              width={20}
            >
              {slot.position}
            </Text>
            <InitialsAvatar
              name={p.name}
              playerRole={roleToBadge(p.role)}
              ovr={0}
              size={28}
              hideBadge
              imageUrl={p.photoUrl ?? undefined}
            />
            <YStack flex={1} marginLeft="$1">
              <Text fontFamily="$body" fontWeight="700" fontSize={12} color="$color" numberOfLines={1}>
                {p.name}
              </Text>
              <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                {p.team.split(" ").map((w) => w[0]).join("")}
              </Text>
            </YStack>
            <YStack alignItems="flex-end" minWidth={90}>
              {d && d.status !== "didnt_bat" ? (
                <>
                  <Text
                    fontFamily="$mono"
                    fontWeight="700"
                    fontSize={13}
                    color={d.dismissed ? "$color" : "$accentBackground"}
                  >
                    {d.runs}
                    {!d.dismissed ? "*" : ""} ({d.ballsFaced})
                  </Text>
                  <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                    {mi}{" "}
                    {d.status === "partial"
                      ? "partial"
                      : hasMoreToCome(p.team)
                        ? "so far"
                        : d.dismissed
                          ? "out"
                          : "not out"}
                  </Text>
                </>
              ) : hasMoreToCome(p.team) ? (
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  {mi} {formatUIText("yet to bat")}
                </Text>
              ) : (
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  {mi} {formatUIText("did not bat")}
                </Text>
              )}
            </YStack>
          </XStack>
        );
      })}

      {/* Balls used total */}
      <XStack
        marginTop="$2"
        paddingTop="$2"
        borderTopWidth={1}
        borderTopColor="$borderColor"
        justifyContent="space-between"
      >
        <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
          {roundSettled ? "balls used" : "balls used so far"}
        </Text>
        <Text fontFamily="$mono" fontSize={10} color="$color" fontWeight="700">
          {entry.battingBallsUsed ?? 0}/120
          {!roundSettled && (entry.battingBallsUsed ?? 0) < 120
            ? " · more to come"
            : ""}
        </Text>
      </XStack>

      {/* Bowling scorecard */}
      <Text
        fontFamily="$mono"
        fontSize={10}
        color="$colorMuted"
        textTransform="uppercase"
        letterSpacing={1}
        marginTop="$4"
        marginBottom="$2"
      >
        {formatUIText("your bowling figures")}
      </Text>

      {bowlingPriority.map((slot, i) => {
        const p = eligibleById.get(slot.playerId);
        if (!p) return null;
        const d = bowlingDetails.get(slot.playerId);
        const mi = matchIcon(p.team);

        return (
          <XStack
            key={`bowl-${slot.playerId}`}
            paddingVertical={6}
            alignItems="center"
            gap="$2"
            borderBottomWidth={i < bowlingPriority.length - 1 ? 1 : 0}
            borderBottomColor="$borderColor"
          >
            <Text
              fontFamily="$mono"
              fontSize={11}
              color="$colorCricket"
              width={20}
            >
              {slot.priority}
            </Text>
            <InitialsAvatar
              name={p.name}
              playerRole={roleToBadge(p.role)}
              ovr={0}
              size={28}
              hideBadge
              imageUrl={p.photoUrl ?? undefined}
            />
            <YStack flex={1} marginLeft="$1">
              <Text fontFamily="$body" fontWeight="700" fontSize={12} color="$color" numberOfLines={1}>
                {p.name}
              </Text>
              <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                {p.team.split(" ").map((w) => w[0]).join("")}
              </Text>
            </YStack>
            <YStack alignItems="flex-end" minWidth={90}>
              {d && d.runsConceded > 0 ? (
                <>
                  <Text
                    fontFamily="$mono"
                    fontWeight="700"
                    fontSize={13}
                    color="$colorCricket"
                  >
                    {d.cappedOvers.toFixed(1)}-{d.runsConceded}-{d.wickets}
                  </Text>
                  <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                    {mi} {hasMoreToCome(p.team) ? "so far" : "done"}
                  </Text>
                </>
              ) : hasMoreToCome(p.team) ? (
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  {mi} {formatUIText("yet to bowl")}
                </Text>
              ) : (
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  {mi} {formatUIText("did not bowl")}
                </Text>
              )}
            </YStack>
          </XStack>
        );
      })}

      <XStack
        marginTop="$2"
        paddingTop="$2"
        borderTopWidth={1}
        borderTopColor="$borderColor"
        justifyContent="space-between"
      >
        <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
          {roundSettled ? "overs bowled" : "overs bowled so far"}
        </Text>
        <Text fontFamily="$mono" fontSize={10} color="$color" fontWeight="700">
          {ballsToCricketOvers(entry.bowlingBallsBowled ?? 0).toFixed(1)}/20.0
          {!roundSettled && (entry.bowlingBallsBowled ?? 0) < 120
            ? " · more to come"
            : ""}
        </Text>
      </XStack>
    </Card>
  );
}
