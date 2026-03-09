import { YStack, View } from "tamagui";

interface CricketBatIconProps {
  size?: number;
}

/**
 * CricketBatIcon — Elegant cricket bat silhouette (no ball)
 * Handle at top, flat wide blade at bottom — like the real thing
 */
export function CricketBatIcon({ size = 16 }: CricketBatIconProps) {
  return (
    <YStack
      width={size}
      height={size}
      alignItems="center"
      justifyContent="center"
      style={{ transform: [{ rotate: "-35deg" }] }}
    >
      {/* Grip */}
      <View
        width={size * 0.14}
        height={size * 0.1}
        backgroundColor="#3D2B1F"
        borderTopLeftRadius={size * 0.07}
        borderTopRightRadius={size * 0.07}
      />
      {/* Handle */}
      <View
        width={size * 0.1}
        height={size * 0.25}
        backgroundColor="#A0782C"
      />
      {/* Shoulder — tapers from handle to blade */}
      <View
        width={size * 0.28}
        height={size * 0.08}
        backgroundColor="#C4993D"
        borderTopLeftRadius={size * 0.02}
        borderTopRightRadius={size * 0.02}
      />
      {/* Blade — wide, flat, elegant */}
      <View
        width={size * 0.32}
        height={size * 0.45}
        backgroundColor="#D9B565"
        borderBottomLeftRadius={size * 0.06}
        borderBottomRightRadius={size * 0.06}
      />
    </YStack>
  );
}
