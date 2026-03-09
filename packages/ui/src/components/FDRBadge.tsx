import { XStack, Text } from "tamagui";

const FDR_COLORS = {
  1: { bg: "#1a7a3a", text: "#ffffff", label: "very easy" },
  2: { bg: "#30a46c", text: "#ffffff", label: "easy" },
  3: { bg: "#f5a623", text: "#1a1a1a", label: "medium" },
  4: { bg: "#e5484d", text: "#ffffff", label: "hard" },
  5: { bg: "#8b0000", text: "#ffffff", label: "very hard" },
} as const;

interface FDRBadgeProps {
  fdr: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  testID?: string;
}

export function FDRBadge({ fdr, size = "md", showLabel = false, testID }: FDRBadgeProps) {
  const clamped = Math.max(1, Math.min(5, Math.round(fdr))) as 1 | 2 | 3 | 4 | 5;
  const config = FDR_COLORS[clamped];
  const fontSize = size === "sm" ? 10 : size === "md" ? 12 : 14;
  const padding = size === "sm" ? "$1" : size === "md" ? "$2" : "$3";

  return (
    <XStack
      alignItems="center"
      gap="$1"
      backgroundColor={config.bg}
      borderRadius={size === "sm" ? 6 : 8}
      paddingHorizontal={padding}
      paddingVertical={size === "sm" ? 2 : 4}
      testID={testID}
    >
      <Text fontFamily="$mono" fontWeight="700" fontSize={fontSize} color={config.text}>
        {clamped}
      </Text>
      {showLabel && (
        <Text fontFamily="$mono" fontSize={fontSize - 2} color={config.text} opacity={0.9}>
          {config.label}
        </Text>
      )}
    </XStack>
  );
}

interface FDRTickerProps {
  fixtures: Array<{ matchId: string; teamA: { teamId: string; overallFdr: number }; teamB: { teamId: string; overallFdr: number } }>;
  testID?: string;
}

export function FDRTicker({ fixtures, testID }: FDRTickerProps) {
  return (
    <XStack gap="$2" flexWrap="wrap" testID={testID}>
      {fixtures.map((f) => (
        <XStack key={f.matchId} alignItems="center" gap="$1" paddingVertical="$1">
          <FDRBadge fdr={f.teamA.overallFdr} size="sm" />
          <Text fontFamily="$mono" fontSize={9} color="$colorMuted">vs</Text>
          <FDRBadge fdr={f.teamB.overallFdr} size="sm" />
        </XStack>
      ))}
    </XStack>
  );
}
