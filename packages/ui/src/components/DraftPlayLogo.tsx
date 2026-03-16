import { useEffect, useRef } from "react";
import { Platform } from "react-native";
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
 * Subtle 3D depth with shadow/highlight layers.
 * Optional play-bounce animation — shadow tri + main tri + highlight
 * all animate together so the click feels natural.
 *
 * On web: renders an inline SVG for pixel-perfect rendering.
 * On native: renders using Views + border tricks.
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

  // Shadow offset for 3D depth — subtle
  const sh = Math.max(0.6, size * 0.02);
  const shadowColor = "#2D7A4E";
  const highlightColor = "#5BBF8A";

  // Play click animation — subtle press-in then snap-out
  const triScale = useSharedValue(1);
  const triTranslateX = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    triScale.value = withRepeat(
      withSequence(
        withDelay(2200,
          withTiming(0.93, { duration: 120, easing: Easing.in(Easing.ease) })
        ),
        withTiming(1, { duration: 180, easing: Easing.out(Easing.ease) }),
      ),
      -1,
      false
    );
    triTranslateX.value = withRepeat(
      withSequence(
        withDelay(2200,
          withTiming(-size * 0.008, { duration: 120, easing: Easing.in(Easing.ease) })
        ),
        withTiming(0, { duration: 180, easing: Easing.out(Easing.ease) }),
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

  // ── Web: inject CSS animation for play-bounce (once) ──
  const injectedRef = useRef(false);
  useEffect(() => {
    if (Platform.OS !== "web" || injectedRef.current) return;
    injectedRef.current = true;
    if (typeof document !== "undefined" && !document.getElementById("dp-logo-anim")) {
      const style = document.createElement("style");
      style.id = "dp-logo-anim";
      style.textContent = `
        @keyframes dpPlayBounce {
          0%, 85% { transform: scale(1) translateX(0); }
          90% { transform: scale(0.93) translateX(-0.5px); }
          95% { transform: scale(1) translateX(0); }
          100% { transform: scale(1) translateX(0); }
        }
        .dp-logo-click-group {
          animation: dpPlayBounce 3s ease-in-out infinite;
          transform-origin: left center;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // ── Web: SVG rendering for pixel-perfect logo ──
  if (Platform.OS === "web") {
    return (
      <YStack width={size} height={size} alignItems="center" justifyContent="center" testID="draftplay-logo">
        {/* @ts-ignore — inline SVG works on web but RN types don't know about it */}
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="dp-shadow" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0.8" dy="1.1" stdDeviation="0.7" floodColor="#1a4a30" floodOpacity="0.45" />
            </filter>
          </defs>

          <g filter="url(#dp-shadow)">
            {/* Bowl arc */}
            <path d="M18.1 17.7 A8.35 8.35 0 0 0 18.1 34.4" stroke={color} strokeWidth="2.8" fill="none" strokeLinecap="round"/>
            {/* Vertical bar — extends past arc endpoints to cover round caps */}
            <rect x="18.1" y="5.6" width="2.8" height="30.2" fill={color}/>
          </g>

          {/* Play triangle — animated */}
          <g className={animate ? "dp-logo-click-group" : undefined} filter="url(#dp-shadow)">
            <polygon points="20.9,5.6 30.26,12.8 20.9,20.0" fill={color}/>
          </g>

          {/* Highlight: top half of bowl arc */}
          <path d="M17.8 17.4 A8.35 8.35 0 0 0 9.5 25.4" stroke={highlightColor} strokeWidth="0.8" fill="none" opacity="0.3" strokeLinecap="round"/>
        </svg>
      </YStack>
    );
  }

  // ── Native: View-based rendering ──
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
      opacity={0.15}
    />
  );

  return (
    <YStack width={size} height={size} alignItems="center" justifyContent="center" overflow="visible" testID="draftplay-logo">

      {/* ── SHADOW LAYER — subtle depth ── */}

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
        opacity={0.15}
      />

      <View
        position="absolute"
        left={barX + sh}
        top={markT + sh}
        width={sw}
        height={stemH}
        backgroundColor={shadowColor}
        opacity={0.15}
      />

      {/* Shadow + Main play triangle — animate together */}
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
          {/* Shadow triangle offset behind */}
          <View position="absolute" left={sh} top={sh}>
            {playTriangleShadow}
          </View>
          {/* Main triangle */}
          {playTriangle}
        </Animated.View>
      ) : (
        <>
          <View position="absolute" left={barX + sw * 1.0 + sh} top={markT + sh}>
            {playTriangleShadow}
          </View>
          <View position="absolute" left={barX + sw * 1.0} top={markT}>
            {playTriangle}
          </View>
        </>
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

      {/* ── HIGHLIGHT LAYER — subtle shine ── */}

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
        borderWidth={Math.max(1, sw * 0.4)}
        borderColor={highlightColor}
        borderRightWidth={0}
        borderBottomColor="transparent"
        opacity={0.2}
      />

    </YStack>
  );
}
