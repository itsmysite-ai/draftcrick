import { Platform } from "react-native";
import { View } from "react-native";
import { ChatRoom } from "./ChatRoom";
import { Text } from "../SportText";
import { formatUIText } from "@draftplay/ui";
import { YStack, XStack } from "tamagui";
import { useTheme } from "../../providers/ThemeProvider";
import { useEffect, useState, useRef } from "react";

/** Particle constellation — renders behind everything on wide web screens */
function ParticleCanvas() {
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    const canvas = canvasRef.current as any;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as any;
    if (!ctx) return;

    let animationId: any;
    const particles: Array<{ x: number; y: number; vx: number; vy: number; r: number; o: number }> = [];
    const COUNT = 120;
    const DIST = 160;
    const MOUSE_R = 220;
    const win = globalThis as any;
    const mouse = { x: -1000, y: -1000 };

    function resize() {
      if (!canvas) return;
      canvas.width = win.innerWidth ?? 1200;
      canvas.height = win.innerHeight ?? 800;
    }

    function init() {
      if (!canvas) return;
      for (let i = 0; i < COUNT; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.8 + 0.5,
          o: Math.random() * 0.4 + 0.15,
        });
      }
    }

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const c = "93, 184, 130";

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Mouse repulsion
        const mdx = p.x - mouse.x;
        const mdy = p.y - mouse.y;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < MOUSE_R && md > 0) {
          const force = (MOUSE_R - md) / MOUSE_R * 0.02;
          p.vx += (mdx / md) * force;
          p.vy += (mdy / md) * force;
        }
        p.vx *= 0.999;
        p.vy *= 0.999;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c}, ${p.o})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]!;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < DIST) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${c}, ${(1 - d / DIST) * 0.12})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }

        // Mouse connection lines
        const dx = a.x - mouse.x;
        const dy = a.y - mouse.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < MOUSE_R) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(${c}, ${(1 - d / MOUSE_R) * 0.25})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
      animationId = requestAnimationFrame(draw);
    }

    function onMouseMove(e: any) { mouse.x = e.clientX; mouse.y = e.clientY; }
    function onMouseLeave() { mouse.x = -1000; mouse.y = -1000; }

    resize();
    init();
    animationId = requestAnimationFrame(draw);
    win.addEventListener?.("resize", resize);
    win.addEventListener?.("mousemove", onMouseMove);
    win.addEventListener?.("mouseleave", onMouseLeave);
    return () => {
      cancelAnimationFrame(animationId);
      win.removeEventListener?.("resize", resize);
      win.removeEventListener?.("mousemove", onMouseMove);
      win.removeEventListener?.("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute" as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none" as any,
        zIndex: 0,
      }}
    />
  );
}

/**
 * Web-only layout wrapper.
 * - On mobile/native: passthrough.
 * - On web (wide screens): constrains app to phone-width + chat sidebar.
 * - Uses CSS media queries for responsiveness + theme-aware borders.
 */
export function WebLayoutWrapper({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return <WebLayout>{children}</WebLayout>;
}

function WebLayout({ children }: { children: React.ReactNode }) {
  const { t, mode } = useTheme();
  const [isWide, setIsWide] = useState(false);

  // Listen for resize
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1024px = iPad landscape / desktop. Avoids triggering on rotated phones.
    const check = () => setIsWide(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const borderColor = mode === "light" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";

  // Mobile / narrow: no sidebar, no constraint
  if (!isWide) {
    return <>{children}</>;
  }

  // Wide: phone-frame + sidebar
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        justifyContent: "center",
        backgroundColor: t.bg,
        minHeight: "100vh" as any,
        position: "relative" as any,
      }}
    >
      <ParticleCanvas />
      {/* App frame — fixed phone width */}
      <View
        style={{
          width: 550,
          minWidth: 500,
          minHeight: "100vh" as any,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor,
        }}
      >
        {children}
      </View>

      {/* Chat sidebar — fills remaining space */}
      <View
        style={{
          flex: 1,
          minWidth: 340,
          maxWidth: 380,
          minHeight: "100vh" as any,
          borderRightWidth: 1,
          borderColor,
          backgroundColor: t.bg,
        }}
      >
        {/* Header */}
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$3"
          borderBottomWidth={1}
          borderColor="$borderColor"
          alignItems="center"
          gap="$2"
        >
          <Text fontSize={20}>💬</Text>
          <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color">
            {formatUIText("buzz")}
          </Text>
          <YStack
            backgroundColor="$accentBackground"
            paddingHorizontal="$2"
            paddingVertical={2}
            borderRadius="$round"
            marginLeft="$2"
          >
            <Text fontFamily="$mono" fontWeight="600" fontSize={10} color="white">
              LIVE
            </Text>
          </YStack>
        </XStack>

        {/* Chat */}
        <View style={{ flex: 1 }}>
          <ChatRoom compact />
        </View>
      </View>
    </View>
  );
}
