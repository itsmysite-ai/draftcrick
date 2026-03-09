import { useEffect } from "react";
import { YStack, type GetProps } from "tamagui";
import { Text } from "../primitives/SportText";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { DraftPlayLogo } from "./DraftPlayLogo";

interface EggLoadingSpinnerProps extends Omit<GetProps<typeof YStack>, "children"> {
  size?: number;
  message?: string;
}

/**
 * LoadingSpinner — Pulsing DraftPlay logo animation
 * The draftplay.ai loading indicator
 */
export function EggLoadingSpinner({
  size = 48,
  message = "loading",
  ...props
}: EggLoadingSpinnerProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 600, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
        withTiming(0.95, { duration: 600, easing: Easing.bezier(0.4, 0, 0.2, 1) })
      ),
      -1,
      true
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 600, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
        withTiming(1, { duration: 600, easing: Easing.bezier(0.4, 0, 0.2, 1) })
      ),
      -1,
      true
    );
  }, [scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <YStack alignItems="center" justifyContent="center" gap="$3" {...props}>
      <Animated.View style={animatedStyle}>
        <DraftPlayLogo size={size} />
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
