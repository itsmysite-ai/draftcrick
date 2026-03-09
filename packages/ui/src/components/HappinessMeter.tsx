import { YStack, XStack, View, type GetProps } from "tamagui";
import { Text } from "../primitives/SportText";

interface HappinessMeterProps extends Omit<GetProps<typeof XStack>, "children"> {
  current: number;
  total: number;
  label?: string;
  unit?: string;
}

/**
 * HappinessMeter — Progress bar with emoji face
 * Shows team building progress with graduated color + emoji
 * Thresholds: 🥺 < 20%, 😐 20-50%, 🙂 50-80%, 😄 ≥ 80%
 * Colors: hatch < 30%, cricket 30-60%, accent ≥ 60%
 */
export function HappinessMeter({
  current,
  total,
  label = "team happiness",
  unit = "drafted",
  ...props
}: HappinessMeterProps) {
  const percentage = Math.min(100, Math.round((current / total) * 100));

  // Emoji thresholds
  const emoji =
    percentage >= 80 ? "😄" : percentage >= 50 ? "🙂" : percentage >= 20 ? "😐" : "🥺";

  // Color thresholds
  const barColor =
    percentage >= 60 ? "$colorAccent" : percentage >= 30 ? "$colorCricket" : "$colorHatch";

  return (
    <XStack alignItems="center" gap="$3" {...props}>
      <Text fontSize={20} lineHeight={24}>
        {emoji}
      </Text>
      <YStack flex={1}>
        <XStack justifyContent="space-between" marginBottom={5}>
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            {label}
          </Text>
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            {current}/{total} {unit}
          </Text>
        </XStack>
        <YStack
          width="100%"
          height={6}
          borderRadius="$round"
          backgroundColor="$backgroundSurfaceAlt"
          overflow="hidden"
        >
          <View
            height="100%"
            borderRadius="$round"
            backgroundColor={barColor as any}
            width={`${percentage}%` as any}
          />
        </YStack>
      </YStack>
    </XStack>
  );
}
