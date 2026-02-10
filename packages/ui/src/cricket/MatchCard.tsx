import React from "react";
import { XStack, YStack, Text, H4 } from "tamagui";
import { Card } from "../primitives/Card";
import { Badge } from "../primitives/Badge";

interface MatchCardProps {
  teamHome: string;
  teamAway: string;
  venue: string;
  startTime: Date;
  status: "upcoming" | "live" | "completed" | "abandoned";
  result?: string | null;
  scoreHome?: string;
  scoreAway?: string;
  onPress?: () => void;
}

export function MatchCard({
  teamHome,
  teamAway,
  venue,
  startTime,
  status,
  result,
  scoreHome,
  scoreAway,
  onPress,
}: MatchCardProps) {
  const isLive = status === "live";

  return (
    <Card pressable elevated live={isLive} onPress={onPress}>
      {/* Status badge */}
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
        <Text fontSize={12} color="$placeholderColor">
          {venue}
        </Text>
        <Badge variant={isLive ? "live" : status === "upcoming" ? "default" : "success"}>
          {isLive ? "LIVE" : status === "upcoming" ? formatCountdown(startTime) : "Completed"}
        </Badge>
      </XStack>

      {/* Teams */}
      <XStack justifyContent="space-between" alignItems="center">
        <YStack flex={1} alignItems="center">
          <H4 fontWeight="700">{teamHome}</H4>
          {scoreHome && (
            <Text fontSize={16} fontWeight="600" color="$accentBackground">
              {scoreHome}
            </Text>
          )}
        </YStack>

        <Text
          fontSize={14}
          color="$placeholderColor"
          paddingHorizontal="$3"
          fontWeight="600"
        >
          VS
        </Text>

        <YStack flex={1} alignItems="center">
          <H4 fontWeight="700">{teamAway}</H4>
          {scoreAway && (
            <Text fontSize={16} fontWeight="600" color="$accentBackground">
              {scoreAway}
            </Text>
          )}
        </YStack>
      </XStack>

      {/* Result */}
      {result && (
        <Text
          fontSize={12}
          color="$placeholderColor"
          textAlign="center"
          marginTop="$2"
        >
          {result}
        </Text>
      )}
    </Card>
  );
}

function formatCountdown(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "Started";

  const hours = Math.floor(diffMs / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);

  if (hours > 24) return `${Math.floor(hours / 24)}d`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
