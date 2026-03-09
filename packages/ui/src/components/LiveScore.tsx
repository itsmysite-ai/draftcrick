import { useEffect, useRef } from "react";
import { YStack, Text } from "tamagui";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

const FLIP_DURATION = 220;

interface LiveScoreProps {
  /** The score text, e.g. "India 30/1 (4.2 ov)" */
  score: string;
  /** Whether the match is currently live — affects size & color */
  isLive?: boolean;
  /** Font size override (default: 16 for live, 14 otherwise) */
  fontSize?: number;
}

/**
 * LiveScore — animated score display with split-flap transition
 *
 * When the score text changes, the old value flips up and fades out,
 * then the new value flips in from below — like a stadium scoreboard.
 * Also does a brief scale pulse to draw attention.
 */
export function LiveScore({ score, isLive = false, fontSize }: LiveScoreProps) {
  const prevScore = useRef(score);

  const flipY = useSharedValue(0);
  const flipOpacity = useSharedValue(1);
  const scaleVal = useSharedValue(1);

  useEffect(() => {
    if (prevScore.current !== score && score) {
      // Railway flip: old text slides up + fades, new text slides up into place
      flipY.value = withSequence(
        withTiming(-14, { duration: FLIP_DURATION, easing: Easing.in(Easing.cubic) }),
        withTiming(14, { duration: 0 }),
        withTiming(0, { duration: FLIP_DURATION, easing: Easing.out(Easing.cubic) }),
      );
      flipOpacity.value = withSequence(
        withTiming(0, { duration: FLIP_DURATION, easing: Easing.in(Easing.quad) }),
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: FLIP_DURATION, easing: Easing.out(Easing.quad) }),
      );
      // Subtle scale pulse
      scaleVal.value = withSequence(
        withTiming(1, { duration: FLIP_DURATION }),
        withTiming(1.06, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 200, easing: Easing.inOut(Easing.quad) }),
      );
      prevScore.current = score;
    }
  }, [score, flipY, flipOpacity, scaleVal]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: flipY.value }, { scale: scaleVal.value }],
    opacity: flipOpacity.value,
  }));

  const size = fontSize ?? (isLive ? 16 : 14);

  return (
    <YStack alignItems="center" overflow="hidden" paddingVertical="$1">
      <Animated.View style={animatedStyle}>
        <Text
          fontFamily="$mono"
          fontWeight="800"
          fontSize={size}
          color={isLive ? "$color" : "$colorCricket"}
          letterSpacing={-0.3}
          textAlign="center"
        >
          {score}
        </Text>
      </Animated.View>
    </YStack>
  );
}
