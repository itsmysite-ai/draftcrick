import { XStack, Text } from "tamagui";

interface EarlyAccessBadgeProps {
  size?: "sm" | "md";
}

/**
 * "EARLY ACCESS" badge shown on Elite-only features.
 * Uses a purple/gold style to indicate exclusive availability.
 */
export function EarlyAccessBadge({ size = "sm" }: EarlyAccessBadgeProps) {
  const fontSize = size === "sm" ? 9 : 11;
  const px = size === "sm" ? "$2" : "$3";
  const py = size === "sm" ? 2 : 4;

  return (
    <XStack
      backgroundColor="#7B5EA7"
      borderRadius={4}
      paddingHorizontal={px}
      paddingVertical={py}
      alignItems="center"
    >
      <Text
        fontFamily="$mono"
        fontWeight="700"
        fontSize={fontSize}
        color="white"
        letterSpacing={0.5}
      >
        EARLY ACCESS
      </Text>
    </XStack>
  );
}
