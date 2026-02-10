import { Text, XStack, type GetProps } from "tamagui";

interface StatLabelProps extends Omit<GetProps<typeof XStack>, "children"> {
  label: string;
  value: string | number;
}

/**
 * StatLabel — Cricket stat display with DM Mono font
 * Format: [value] [label] e.g. "53.4 avg"
 * Used for batting avg, strike rate, wickets, economy, etc.
 */
export function StatLabel({ label, value, ...props }: StatLabelProps) {
  return (
    <XStack alignItems="center" {...props}>
      <Text fontFamily="$mono" fontSize={11} color="$color" fontWeight="500">
        {value}
      </Text>
      <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
        {" "}
        {label}
      </Text>
    </XStack>
  );
}
