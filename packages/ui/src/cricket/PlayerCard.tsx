import React from "react";
import { XStack, YStack, Text, Image } from "tamagui";
import { Card } from "../primitives/Card";
import { Badge } from "../primitives/Badge";

interface PlayerCardProps {
  name: string;
  team: string;
  role: string;
  photoUrl?: string | null;
  credits?: number;
  fantasyPoints?: number;
  ownershipPercent?: number;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isSelected?: boolean;
  onPress?: () => void;
}

const ROLE_SHORT: Record<string, string> = {
  batsman: "BAT",
  bowler: "BOWL",
  all_rounder: "AR",
  wicket_keeper: "WK",
};

export function PlayerCard({
  name,
  team,
  role,
  photoUrl,
  credits,
  fantasyPoints,
  ownershipPercent,
  isCaptain,
  isViceCaptain,
  isSelected,
  onPress,
}: PlayerCardProps) {
  return (
    <Card
      pressable
      onPress={onPress}
      borderColor={isSelected ? "$accentBackground" : "$borderColor"}
      borderWidth={isSelected ? 2 : 1}
    >
      <XStack alignItems="center" gap="$3">
        {/* Player photo placeholder */}
        <YStack
          width={48}
          height={48}
          borderRadius="$round"
          backgroundColor="$backgroundHover"
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
        >
          {photoUrl ? (
            <Image src={photoUrl} width={48} height={48} />
          ) : (
            <Text fontSize={18}>{name.charAt(0)}</Text>
          )}
        </YStack>

        {/* Player info */}
        <YStack flex={1}>
          <XStack alignItems="center" gap="$2">
            <Text fontWeight="700" fontSize={15}>
              {name}
            </Text>
            {isCaptain && <Badge variant="captain" size="sm">C</Badge>}
            {isViceCaptain && <Badge variant="captain" size="sm">VC</Badge>}
          </XStack>
          <XStack gap="$2" alignItems="center">
            <Badge variant="role" size="sm">
              {ROLE_SHORT[role] ?? role}
            </Badge>
            <Text fontSize={12} color="$placeholderColor">
              {team}
            </Text>
          </XStack>
        </YStack>

        {/* Stats column */}
        <YStack alignItems="flex-end">
          {credits !== undefined && (
            <Text fontWeight="700" fontSize={15}>
              {credits.toFixed(1)}
            </Text>
          )}
          {fantasyPoints !== undefined && (
            <Text fontSize={13} color="$accentBackground" fontWeight="600">
              {fantasyPoints} pts
            </Text>
          )}
          {ownershipPercent !== undefined && (
            <Text fontSize={11} color="$placeholderColor">
              {ownershipPercent}% owned
            </Text>
          )}
        </YStack>
      </XStack>
    </Card>
  );
}
