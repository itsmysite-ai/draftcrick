import { useEffect } from "react";
import { YStack, View } from "tamagui";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

interface DraftPlayLogoProps {
  size?: number;
  color?: string;
  animate?: boolean;
}

/**
 * DraftPlayLogo — Lowercase mirrored d + P sharing one vertical bar.
 * 3D effect with shadow layers and highlight overlays.
 * Optional play-bounce animation on the triangle.
 */
export function DraftPlayLogo({ size = 40, color = "#3D9968", animate = false }: DraftPlayLogoProps) {
  const sw = Math.max(2, size * 0.07);
  const stemH = size * 0.72;
  const bowlH = stemH * 0.58;
  const bowlW = bowlH * 0.5;
  const triH = stemH * 0.5;
  const triW = triH * 0.65;
  const totalW = bowlW + sw + triW;
  const markL = (size - totalW) / 2;
  const markT = (size - stemH) / 2;
  const barX = markL + bowlW;
  const bowlT = markT + stemH - bowlH;

  // Shadow offset for 3D depth
  const sh = Math.max(1, size * 0.03);
  const shadowColor = "#2D7A4E";
  const highlightColor = "#5BBF8A";

  // Play click animation — press-in then snap-out, like tapping a play button
  const triScale = useSharedValue(1);
  const triTranslateX = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    triScale.value = withRepeat(
      withSequence(
        withDelay(1800,
          withTiming(0.82, { duration: 100, easing: Easing.in(Easing.ease) })  // press in
        ),
        withTiming(1, { duration: 150, easing: Easing.out(Easing.ease) }),     // release back
      ),
      -1,
      false
    );
    triTranslateX.value = withRepeat(
      withSequence(
        withDelay(1800,
          withTiming(-size * 0.015, { duration: 100, easing: Easing.in(Easing.ease) })  // nudge left
        ),
        withTiming(0, { duration: 150, easing: Easing.out(Easing.ease) }),               // release back
      ),
      -1,
      false
    );
  }, [animate]);

  const playAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: triScale.value },
      { translateX: triTranslateX.value },
    ],
  }));

  const playTriangle = (
    <View
      width={0}
      height={0}
      borderLeftWidth={triW}
      borderTopWidth={triH / 2}
      borderBottomWidth={triH / 2}
      borderLeftColor={color}
      borderTopColor="transparent"
      borderBottomColor="transparent"
      borderRightColor="transparent"
    />
  );

  const playTriangleShadow = (
    <View
      width={0}
      height={0}
      borderLeftWidth={triW}
      borderTopWidth={triH / 2}
      borderBottomWidth={triH / 2}
      borderLeftColor={shadowColor}
      borderTopColor="transparent"
      borderBottomColor="transparent"
      borderRightColor="transparent"
      opacity={0.5}
    />
  );

  return (
    <YStack width={size} height={size} alignItems="center" justifyContent="center" overflow="visible" testID="draftplay-logo">

      {/* ── SHADOW LAYER ── */}

      <View
        position="absolute"
        left={markL + sh}
        top={bowlT + sh}
        width={bowlW}
        height={bowlH}
        borderTopLeftRadius={bowlH / 2}
        borderBottomLeftRadius={bowlH / 2}
        borderTopRightRadius={0}
        borderBottomRightRadius={0}
        borderWidth={sw}
        borderColor={shadowColor}
        borderRightWidth={0}
        opacity={0.5}
      />

      <View
        position="absolute"
        left={barX + sh}
        top={markT + sh}
        width={sw}
        height={stemH}
        backgroundColor={shadowColor}
        opacity={0.5}
      />

      {/* Shadow: play triangle (animated if animate=true) */}
      {animate ? (
        <Animated.View
          style={[
            {
              position: "absolute",
              left: barX + sw * 1.0 + sh,
              top: markT + sh,
            },
            playAnimStyle,
          ]}
        >
          {playTriangleShadow}
        </Animated.View>
      ) : (
        <View position="absolute" left={barX + sw * 1.0 + sh} top={markT + sh}>
          {playTriangleShadow}
        </View>
      )}

      {/* ── MAIN LAYER ── */}

      <View
        position="absolute"
        left={markL}
        top={bowlT}
        width={bowlW}
        height={bowlH}
        borderTopLeftRadius={bowlH / 2}
        borderBottomLeftRadius={bowlH / 2}
        borderTopRightRadius={0}
        borderBottomRightRadius={0}
        borderWidth={sw}
        borderColor={color}
        borderRightWidth={0}
      />

      <View
        position="absolute"
        left={barX}
        top={markT}
        width={sw}
        height={stemH}
        backgroundColor={color}
      />

      {/* Play triangle (animated if animate=true) */}
      {animate ? (
        <Animated.View
          style={[
            {
              position: "absolute",
              left: barX + sw * 1.0,
              top: markT,
            },
            playAnimStyle,
          ]}
        >
          {playTriangle}
        </Animated.View>
      ) : (
        <View position="absolute" left={barX + sw * 1.0} top={markT}>
          {playTriangle}
        </View>
      )}

      {/* ── HIGHLIGHT LAYER ── */}

      <View
        position="absolute"
        left={markL - sh * 0.3}
        top={bowlT - sh * 0.3}
        width={bowlW}
        height={bowlH}
        borderTopLeftRadius={bowlH / 2}
        borderBottomLeftRadius={bowlH / 2}
        borderTopRightRadius={0}
        borderBottomRightRadius={0}
        borderWidth={Math.max(1, sw * 0.5)}
        borderColor={highlightColor}
        borderRightWidth={0}
        borderBottomColor="transparent"
        opacity={0.4}
      />

    </YStack>
  );
}
