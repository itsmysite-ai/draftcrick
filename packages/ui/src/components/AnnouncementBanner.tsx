import { XStack, YStack, Text, type GetProps } from "tamagui";

// ─────────────────────────────────────────────────────────────────────────────
// BANNER CONTENT — edit here to update across all screens
// ─────────────────────────────────────────────────────────────────────────────
const BANNER = {
  text: "ipl 2026 fantasy leagues are open — create or join a league now",
  accent: "$accentBackground" as const,
};
// ─────────────────────────────────────────────────────────────────────────────

interface AnnouncementBannerProps extends Omit<GetProps<typeof YStack>, "children"> {}

/**
 * AnnouncementBanner — persistent update / news / ad strip
 *
 * Content is defined in BANNER above. Changing it once updates every screen.
 * Renders a clean mono-font strip inside a card-like container.
 */
export function AnnouncementBanner(props: AnnouncementBannerProps) {
  return (
    <YStack
      marginHorizontal="$4"
      marginVertical="$3"
      backgroundColor="$backgroundSurface"
      borderRadius="$3"
      paddingVertical="$2"
      paddingHorizontal="$4"
      {...props}
    >
      <XStack alignItems="center" gap="$3">
        <YStack width={3} height={14} borderRadius={2} backgroundColor={BANNER.accent} />
        <Text
          fontFamily="$mono"
          fontSize={11}
          color="$colorSecondary"
          letterSpacing={-0.2}
          numberOfLines={1}
          flex={1}
        >
          {BANNER.text}
        </Text>
      </XStack>
    </YStack>
  );
}
