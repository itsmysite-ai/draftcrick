import { XStack, Text, type GetProps } from "tamagui";

interface BackButtonProps extends Omit<GetProps<typeof XStack>, "children"> {
  onPress: () => void;
}

/**
 * BackButton — clean, minimal back navigation pill
 *
 * Matches the ModeToggle aesthetic: subtle surface background, rounded,
 * mono font arrow. Drop it into any screen header row alongside the title
 * and ModeToggle.
 */
export function BackButton({ onPress, ...props }: BackButtonProps) {
  return (
    <XStack
      width={34}
      height={34}
      borderRadius={17}
      backgroundColor="$backgroundSurface"
      alignItems="center"
      justifyContent="center"
      pressStyle={{ opacity: 0.7, scale: 0.95 }}
      onPress={onPress}
      cursor="pointer"
      {...props}
    >
      <Text fontFamily="$mono" fontSize={18} color="$colorSecondary" marginTop={-1}>
        {"‹"}
      </Text>
    </XStack>
  );
}
