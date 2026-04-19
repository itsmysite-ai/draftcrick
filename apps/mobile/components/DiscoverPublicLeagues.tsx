/**
 * DiscoverPublicLeagues — home dashboard card that surfaces public
 * leagues the user hasn't joined yet, with inline one-tap Join.
 *
 * Shows top 3 by newest (configurable via prop). For more, the user taps
 * "browse all →" which routes to /leagues/browse.
 *
 * CM vs salary_cap/draft/auction leagues use different join endpoints;
 * that branching is handled here so the caller doesn't need to know.
 */

import { useState } from "react";
import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { YStack, XStack } from "tamagui";
import { Text } from "./SportText";
import {
  Card,
  Badge,
  Button,
  formatUIText,
  formatBadgeText,
  textStyles,
} from "@draftplay/ui";
import { trpc } from "../lib/trpc";

const FORMAT_META: Record<string, { emoji: string; label: string }> = {
  cricket_manager: { emoji: "🏆", label: "cricket manager" },
  salary_cap: { emoji: "💰", label: "salary cap" },
  draft: { emoji: "🐍", label: "snake draft" },
  auction: { emoji: "🔨", label: "auction" },
  prediction: { emoji: "🔮", label: "prediction" },
};

interface DiscoverPublicLeaguesProps {
  /** How many leagues to surface inline on the home card. Defaults to 3. */
  limit?: number;
}

export function DiscoverPublicLeagues({ limit = 3 }: DiscoverPublicLeaguesProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Over-fetch slightly so if the user joins a card, the list auto-fills
  // from the buffer on next render. Keeps the card from collapsing to
  // empty after a single join.
  const query = trpc.league.browsePublic.useQuery(
    { limit: Math.max(limit + 2, 5), sort: "largest" },
    { staleTime: 60 * 1000 }
  );

  // On successful join we invalidate everything the home dashboard
  // reads so the feed pivots from "discover" → "your contests / rounds"
  // without a manual refresh. Previously only browsePublic refetched,
  // so the user had to hard-reload to see their new league's contests.
  const invalidateDashboard = () => {
    utils.league.myLeagues.invalidate();
    utils.team.myTeams.invalidate();
    utils.contest.myContests.invalidate();
    utils.cricketManager.pendingRoundsForMe.invalidate();
    utils.cricketManager.myActiveEntries.invalidate();
    query.refetch();
  };

  const joinPublic = trpc.league.joinPublic.useMutation({
    onSuccess: () => {
      setJoiningId(null);
      invalidateDashboard();
    },
    onError: () => setJoiningId(null),
  });
  const joinCmLeague = trpc.cricketManager.joinLeague.useMutation({
    onSuccess: () => {
      setJoiningId(null);
      invalidateDashboard();
    },
    onError: () => setJoiningId(null),
  });

  function handleJoin(leagueId: string, format: string) {
    setJoiningId(leagueId);
    if (format === "cricket_manager") {
      joinCmLeague.mutate({ leagueId });
    } else {
      joinPublic.mutate({ leagueId });
    }
  }

  const rows = (query.data ?? []).slice(0, limit);

  // Hide the whole section when there's nothing to discover. No point
  // teasing an empty state.
  if (query.isLoading) return null;
  if (rows.length === 0) return null;

  return (
    <YStack marginBottom="$4" paddingHorizontal="$4">
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
        <Text {...textStyles.sectionHeader}>
          {formatUIText("discover public leagues")}
        </Text>
        <Pressable
          onPress={() => router.push("/leagues/browse" as any)}
          hitSlop={8}
        >
          <Text
            fontFamily="$body"
            fontSize={12}
            fontWeight="600"
            color="$accentBackground"
          >
            {formatUIText("browse all")} →
          </Text>
        </Pressable>
      </XStack>

      <YStack gap="$2">
        {rows.map((league: any, index: number) => {
          const meta = FORMAT_META[league.format] ?? {
            emoji: "🏟",
            label: league.format,
          };
          const isJoining = joiningId === league.id;
          return (
            <Animated.View
              key={league.id}
              entering={FadeInDown.delay(index * 30).springify()}
            >
              <Card padding="$3">
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={24}>{meta.emoji}</Text>
                  <YStack flex={1}>
                    <Pressable
                      onPress={() => router.push(`/league/${league.id}` as any)}
                    >
                      <Text
                        {...textStyles.playerName}
                        fontSize={14}
                        numberOfLines={1}
                      >
                        {league.name}
                      </Text>
                    </Pressable>
                    <XStack gap="$2" alignItems="center" marginTop={2}>
                      <Badge variant="role" size="sm">
                        {formatBadgeText(meta.label)}
                      </Badge>
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                        {league.memberCount ?? 0}{" "}
                        {formatUIText("members")} ·{" "}
                        {league.tournament}
                      </Text>
                    </XStack>
                  </YStack>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isJoining}
                    onPress={() => handleJoin(league.id, league.format)}
                    testID={`discover-join-${league.id}`}
                  >
                    {isJoining ? formatUIText("joining…") : formatUIText("join")}
                  </Button>
                </XStack>
              </Card>
            </Animated.View>
          );
        })}
      </YStack>
    </YStack>
  );
}
