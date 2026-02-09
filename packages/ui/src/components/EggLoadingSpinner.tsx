import { useEffect } from "react";
import { YStack, Text, type GetProps } from "tamagui";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

interface EggLoadingSpinnerProps extends Omit<GetProps<typeof YStack>, "children"> {
  size?: number;
  message?: string;
}

/**
 * EggLoadingSpinner — Wobbling egg animation
 * The tami·draft loading indicator
 */
export function EggLoadingSpinner({
  size = 48,
  message = "loading",
  ...props
}: EggLoadingSpinnerProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 300, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }),
        withTiming(12, { duration: 300, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }),
        withTiming(-8, { duration: 250, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }),
        withTiming(8, { duration: 250, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }),
        withTiming(0, { duration: 200, easing: Easing.bezier(0.34, 1.56, 0.64, 1) })
      ),
      -1,
      false
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <YStack alignItems="center" justifyContent="center" gap="$3" {...props}>
      <Animated.View style={animatedStyle}>
        <Text fontSize={size} lineHeight={size}>
          🥚
        </Text>
      </Animated.View>
      {message && (
        <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
          {message}
          <Text animation="quick" opacity={0.5}>
            ...
          </Text>
        </Text>
      )}
    </YStack>
  );
}
