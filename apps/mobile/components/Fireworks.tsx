/**
 * Fireworks celebration — rockets shoot up from bottom, explode into
 * circular bursts of sparks with gravity.
 */
import { useEffect, useRef, useMemo, useState } from "react";
import { Animated, StyleSheet, Easing, View } from "react-native";

const BURST_COLORS = ["#D4A43D", "#5DB882", "#E5484D", "#5DA8B8", "#A088CC", "#E08060", "#FFD700", "#FF69B4"];

// ── Spark: one dot in an explosion burst ──
function Spark({ color, angle, distance, delay, size }: {
  color: string; angle: number; distance: number; delay: number; size: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(progress, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: false }),
        ]),
      ]),
    ]).start();
  }, []);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * distance] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * distance + distance * 0.3] });
  const scale = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1, 0.3] });

  return (
    <Animated.View style={{
      position: "absolute",
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color,
      opacity: fade,
      transform: [{ translateX }, { translateY }, { scale }],
    }} />
  );
}

// ── Burst: a circle of sparks at a point ──
function Burst({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) {
  const sparkCount = 12 + Math.floor(Math.random() * 8);
  const sparks = useMemo(() =>
    Array.from({ length: sparkCount }).map((_, i) => ({
      angle: (i / sparkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
      distance: 40 + Math.random() * 60,
      size: 4 + Math.random() * 4,
    })),
  [sparkCount]);

  return (
    <View style={{ position: "absolute", left: x, top: y }}>
      {sparks.map((s, i) => (
        <Spark key={i} color={color} angle={s.angle} distance={s.distance} delay={delay} size={s.size} />
      ))}
    </View>
  );
}

// ── Rocket trail: shoots up from bottom to burst point ──
function Rocket({ startX, endX, endY, delay, onBurst }: {
  startX: number; endX: number; endY: number; delay: number; onBurst: () => void;
}) {
  const rise = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(fade, { toValue: 1, duration: 100, useNativeDriver: false }),
      Animated.timing(rise, { toValue: 1, duration: 1200, easing: Easing.in(Easing.quad), useNativeDriver: false }),
    ]).start(() => {
      onBurst();
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    });
  }, []);

  const bottom = rise.interpolate({ inputRange: [0, 1], outputRange: [0, endY] });
  const left = rise.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });
  const trailHeight = rise.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [4, 16, 12, 6] });

  return (
    <Animated.View style={{
      position: "absolute",
      bottom,
      left,
      width: 3,
      height: trailHeight,
      borderRadius: 2,
      backgroundColor: "#FFD700",
      opacity: fade,
      shadowColor: "#FFD700",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 6,
    }} />
  );
}

// ── Main Fireworks component ──
export function Fireworks({ duration = 8000 }: { duration?: number }) {
  const [visible, setVisible] = useState(true);
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number; delay: number; color: string }>>([]);
  const screenH = typeof window !== "undefined" ? window.innerHeight : 700;
  const screenW = typeof window !== "undefined" ? Math.min(window.innerWidth, 500) : 350;

  const rockets = useMemo(() => {
    const items: Array<{
      id: number; startX: number; endX: number; endY: number; delay: number; color: string;
    }> = [];
    // 5 waves, 3-4 rockets each
    for (let wave = 0; wave < 5; wave++) {
      const count = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const isLeft = i % 2 === 0;
        items.push({
          id: wave * 4 + i,
          startX: isLeft ? 10 + Math.random() * (screenW * 0.2) : screenW * 0.7 + Math.random() * (screenW * 0.2),
          endX: screenW * 0.1 + Math.random() * (screenW * 0.8),
          endY: screenH * 0.4 + Math.random() * (screenH * 0.3),
          delay: wave * 1200 + Math.random() * 600,
          color: BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)]!,
        });
      }
    }
    return items;
  }, [screenW, screenH]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(t);
  }, [duration]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {rockets.map((r) => (
        <Rocket
          key={r.id}
          startX={r.startX}
          endX={r.endX}
          endY={r.endY}
          delay={r.delay}
          onBurst={() => {
            setBursts((prev) => [...prev, {
              id: r.id,
              x: r.endX,
              y: screenH - r.endY,
              delay: 0,
              color: r.color,
            }]);
          }}
        />
      ))}
      {bursts.map((b) => (
        <Burst key={`burst-${b.id}`} x={b.x} y={b.y} delay={b.delay} color={b.color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    overflow: "hidden",
  },
});
