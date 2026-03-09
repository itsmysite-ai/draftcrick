import { YStack, View } from "tamagui";

interface CheckeredFlagIconProps {
  size?: number;
}

/**
 * Checkered flag icon built with Tamagui Views.
 * Secondary sport icon for F1.
 */
export function CheckeredFlagIcon({ size = 16 }: CheckeredFlagIconProps) {
  const cellSize = size * 0.18;

  return (
    <YStack
      width={size}
      height={size}
      alignItems="center"
      justifyContent="center"
    >
      {/* Flag pole */}
      <View
        width={size * 0.06}
        height={size * 0.9}
        backgroundColor="#888888"
        position="absolute"
        left={size * 0.12}
        borderRadius={size * 0.03}
      />
      {/* Flag body with checkerboard */}
      <YStack
        width={size * 0.65}
        height={size * 0.55}
        position="absolute"
        left={size * 0.18}
        top={size * 0.05}
        borderRadius={size * 0.04}
        overflow="hidden"
        flexDirection="row"
        flexWrap="wrap"
      >
        {/* 3x3 checkerboard pattern */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <View
            key={i}
            width={cellSize}
            height={cellSize}
            backgroundColor={(Math.floor(i / 3) + (i % 3)) % 2 === 0 ? "#1A1A1A" : "#FFFFFF"}
          />
        ))}
      </YStack>
    </YStack>
  );
}
