import { YStack, View } from "tamagui";

interface RacingHelmetIconProps {
  size?: number;
  color?: string;
}

/**
 * Simple racing helmet icon built with Tamagui Views.
 * Represents F1/motorsport — used as the primary sport icon for F1.
 */
export function RacingHelmetIcon({ size = 16, color = "#E10600" }: RacingHelmetIconProps) {
  return (
    <YStack
      width={size}
      height={size}
      alignItems="center"
      justifyContent="center"
    >
      {/* Helmet dome */}
      <View
        width={size * 0.85}
        height={size * 0.6}
        backgroundColor={color as any}
        borderTopLeftRadius={size * 0.45}
        borderTopRightRadius={size * 0.45}
        borderBottomLeftRadius={size * 0.1}
        borderBottomRightRadius={size * 0.3}
        position="absolute"
        top={size * 0.1}
      />
      {/* Visor */}
      <View
        width={size * 0.55}
        height={size * 0.18}
        backgroundColor={"rgba(0,0,0,0.6)" as any}
        borderRadius={size * 0.08}
        position="absolute"
        top={size * 0.35}
        right={size * 0.08}
      />
      {/* Chin guard */}
      <View
        width={size * 0.5}
        height={size * 0.2}
        backgroundColor={color as any}
        borderBottomLeftRadius={size * 0.08}
        borderBottomRightRadius={size * 0.15}
        position="absolute"
        bottom={size * 0.15}
        right={size * 0.08}
        opacity={0.9}
      />
    </YStack>
  );
}
