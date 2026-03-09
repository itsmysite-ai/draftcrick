import { XStack } from "tamagui";
import { Text } from "../primitives/SportText";

const TIER_STYLES = {
  free: { bg: "$colorMuted", text: "$background", label: "FREE" },
  pro: { bg: "$accentBackground", text: "#ffffff", label: "PRO" },
  elite: { bg: "#D4A017", text: "#1a1a1a", label: "ELITE" },
} as const;

interface TierBadgeProps {
  tier: "free" | "pro" | "elite";
  size?: "sm" | "md";
  testID?: string;
}

export function TierBadge({ tier, size = "md", testID }: TierBadgeProps) {
  const config = TIER_STYLES[tier] ?? TIER_STYLES.free;
  const fontSize = size === "sm" ? 8 : 10;
  const px = size === "sm" ? "$1" : "$2";
  const py = size === "sm" ? 1 : 3;

  return (
    <XStack
      backgroundColor={config.bg}
      borderRadius={size === "sm" ? 4 : 6}
      paddingHorizontal={px}
      paddingVertical={py}
      alignItems="center"
      testID={testID}
    >
      <Text
        fontFamily="$mono"
        fontWeight="700"
        fontSize={fontSize}
        color={config.text}
        letterSpacing={0.5}
      >
        {config.label}
      </Text>
    </XStack>
  );
}
