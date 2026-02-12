import React from "react";
import { XStack, YStack, Text } from "tamagui";
import { Card } from "../primitives/Card";
import { Badge } from "../primitives/Badge";
import { textStyles, formatUIText, formatBadgeText } from "../constants/designSystem";

interface TournamentCardProps {
  tournament: {
    id: string;
    name: string;
    category: string;
    startDate: string | null;
    endDate: string | null;
  };
  matchCount: number;
  isSelected?: boolean;
  onPress: () => void;
}

/** Format a date range like "feb 10 – mar 2" */
function formatDateRange(start: string | null, end: string | null): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  if (!start && !end) return "dates tba";
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `from ${fmt(start)}`;
  return `until ${fmt(end!)}`;
}

export function TournamentCard({
  tournament,
  matchCount,
  isSelected,
  onPress,
}: TournamentCardProps) {
  return (
    <Card
      pressable
      onPress={onPress}
      padding="$5"
      marginBottom="$3"
      borderWidth={isSelected ? 2 : 1}
      borderColor={isSelected ? "$accentBackground" : "$borderColor"}
      backgroundColor={isSelected ? "$backgroundSurfaceHover" : "$backgroundSurface"}
      pressStyle={{ opacity: 0.85, scale: 0.98 }}
    >
      {/* Header: category badge + match count */}
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
        <Badge variant="role" size="sm">
          {formatBadgeText(tournament.category)}
        </Badge>
        <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
          {matchCount} {formatUIText(matchCount === 1 ? "match" : "matches")}
        </Text>
      </XStack>

      {/* Tournament name */}
      <Text
        {...textStyles.playerName}
        fontSize={15}
        numberOfLines={2}
        marginBottom="$2"
      >
        {tournament.name}
      </Text>

      {/* Date range */}
      <Text {...textStyles.hint}>
        {formatUIText(formatDateRange(tournament.startDate, tournament.endDate))}
      </Text>
    </Card>
  );
}
