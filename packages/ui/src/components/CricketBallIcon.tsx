import { YStack, View } from "tamagui";

interface CricketBallIconProps {
  size?: number;
}

export function CricketBallIcon({ size = 16 }: CricketBallIconProps) {
  const seamWidth = Math.max(1, size * 0.06);

  return (
    <YStack
      width={size}
      height={size}
      borderRadius={size / 2}
      backgroundColor="#C1272D"
      overflow="hidden"
      alignItems="center"
      justifyContent="center"
      style={{ transform: [{ rotate: "30deg" }] }}
    >
      {/* Center seam — vertical line down the middle */}
      <View
        position="absolute"
        width={seamWidth}
        height={size}
        backgroundColor="#FFFFFFCC"
      />
      {/* Side stitching — curved arcs flanking the vertical seam */}
      <View
        position="absolute"
        width={size * 0.5}
        height={size * 0.7}
        borderRadius={size * 0.35}
        borderWidth={seamWidth}
        borderColor="transparent"
        borderLeftColor="#FFFFFFAA"
        left={size * 0.02}
      />
      <View
        position="absolute"
        width={size * 0.5}
        height={size * 0.7}
        borderRadius={size * 0.35}
        borderWidth={seamWidth}
        borderColor="transparent"
        borderRightColor="#FFFFFFAA"
        right={size * 0.02}
      />
    </YStack>
  );
}
