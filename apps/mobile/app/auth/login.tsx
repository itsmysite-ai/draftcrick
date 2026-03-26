import { TextInput, Pressable, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Button,
  BackButton,
  AnnouncementBanner,
  DraftPlayLogo,
  DesignSystem,
  formatUIText,
} from "@draftplay/ui";
import { useAuth } from "../../providers/AuthProvider";
import { HeaderControls } from "../../components/HeaderControls";

/** Particle constellation background — web only */
function ParticleBackground() {
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const canvas = canvasRef.current as any;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as any;
    if (!ctx) return;

    let animationId: any;
    const particles: Array<{ x: number; y: number; vx: number; vy: number; r: number; o: number }> = [];
    const COUNT = 100;
    const DIST = 160;
    const win = globalThis as any;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth ?? win.innerWidth ?? 800;
      canvas.height = canvas.parentElement?.clientHeight ?? win.innerHeight ?? 600;
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
          o: Math.random() * 0.4 + 0.2,
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
            ctx.strokeStyle = `rgba(${c}, ${(1 - d / DIST) * 0.15})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animationId = requestAnimationFrame(draw);
    }

    resize();
    init();
    animationId = requestAnimationFrame(draw);
    win.addEventListener?.("resize", resize);
    return () => {
      cancelAnimationFrame(animationId);
      win.removeEventListener?.("resize", resize);
    };
  }, []);

  if (Platform.OS !== "web") return null;

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

/** Convert raw Firebase error messages into user-friendly text */
function friendlyAuthError(msg: string): string {
  if (msg.includes("auth/wrong-password") || msg.includes("auth/invalid-credential"))
    return "Incorrect email or password. Please try again.";
  if (msg.includes("auth/user-not-found"))
    return "No account found with this email.";
  if (msg.includes("auth/too-many-requests"))
    return "Too many attempts. Please wait and try again.";
  if (msg.includes("auth/invalid-email"))
    return "Please enter a valid email address.";
  if (msg.includes("auth/network-request-failed"))
    return "Network error. Check your connection.";
  if (msg.includes("auth/email-already-in-use"))
    return "This email is already registered. Try signing in instead.";
  if (msg.includes("auth/weak-password"))
    return "Password must be at least 6 characters.";
  // Strip "Firebase: " prefix for any unknown errors
  return msg.replace(/^Firebase:\s*/i, "").replace(/\s*\(auth\/[^)]+\)\.?$/i, "").trim() || "Sign in failed. Please try again.";
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, signInWithGoogle, error } = useAuth();
  const theme = useTamaguiTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rawError = localError ?? error;
  const displayError = rawError ? friendlyAuthError(rawError) : null;

  const handleLogin = async () => {
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      // Check if there's a redirect URL (e.g. from Day Pass link)
      const redirect = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_redirect") : null;
      if (redirect) {
        sessionStorage.removeItem("auth_redirect");
      }
      // Use window.location on web for a clean navigation (avoids SPA routing issues)
      if (typeof window !== "undefined") {
        window.location.href = redirect || "/";
      } else {
        router.replace(redirect ? (redirect as any) : "/(tabs)");
      }
    } catch (e: any) {
      setLocalError(e.message ?? "Sign in failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
    <YStack flex={1} backgroundColor="$background">
      {/* ── Inline Header ── */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={insets.top + 8}
        paddingBottom="$2"
      >
        <BackButton onPress={() => router.back()} />
        <HeaderControls />
      </XStack>

      <AnnouncementBanner />

      {/* ── Form ── */}
      <YStack flex={1} justifyContent="center" paddingHorizontal="$6" paddingBottom="$10">
        {/* Logo */}
        <YStack alignItems="center" marginBottom="$5">
          <DraftPlayLogo size={48} animate />
        </YStack>

        {/* Brand + tagline — consistent sizing */}
        <YStack alignItems="center" gap="$1" marginBottom="$5">
          <Text fontFamily="$mono" fontWeight="800" fontSize={26} color="$color" letterSpacing={-0.3} textAlign="center">
            DraftPlay<Text color="$accent">.ai</Text>
          </Text>
          <Text fontFamily="$mono" fontSize={11} color="$colorMuted" letterSpacing={2} textAlign="center">
            ALL THRILL. PURE SKILL.
          </Text>
        </YStack>

        {/* Hero text — symmetrical two-liner */}
        <YStack alignItems="center" gap={2} marginBottom="$4">
          <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$color" letterSpacing={-0.5} textAlign="center">
            fantasy gaming.
          </Text>
          <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$error" letterSpacing={-0.5} textAlign="center">
            not betting.
          </Text>
        </YStack>

        {/* Subtitle */}
        <Text fontFamily="$body" fontSize={14} color="$colorMuted" textAlign="center" marginBottom="$4">
          sign in or create your account
        </Text>

        {/* Badges — compact, same line */}
        <XStack gap="$2" justifyContent="center" marginBottom="$5">
          <XStack
            backgroundColor="$accentBackground"
            paddingHorizontal="$3"
            paddingVertical="$1.5"
            borderRadius={20}
            alignItems="center"
            gap="$1"
          >
            <Text fontFamily="$mono" fontWeight="700" fontSize={10} color="white">
              {formatUIText("7-day free trial")}
            </Text>
          </XStack>
          <XStack
            backgroundColor="rgba(212, 164, 61, 0.15)"
            borderWidth={1}
            borderColor="rgba(212, 164, 61, 0.3)"
            paddingHorizontal="$3"
            paddingVertical="$1.5"
            borderRadius={20}
            alignItems="center"
            gap="$1"
          >
            <Text fontFamily="$mono" fontWeight="700" fontSize={10} color="#D4A43D">
              {formatUIText("day pass ₹69/24hr")}
            </Text>
          </XStack>
        </XStack>

        {displayError && (
          <Text
            testID="auth-error"
            fontFamily="$body"
            fontSize={14}
            color="$error"
            marginBottom="$4"
            textAlign="center"
          >
            {displayError}
          </Text>
        )}

        <YStack gap="$4">
          {/* Google Sign-In — primary */}
          <Button variant="primary" size="lg" maxWidth={320} alignSelf="center" onPress={async () => {
            setLocalError(null);
            setIsSubmitting(true);
            try {
              await signInWithGoogle();
              const redirect = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_redirect") : null;
              if (redirect) sessionStorage.removeItem("auth_redirect");
              if (typeof window !== "undefined") {
                (window as any).location.href = redirect || "/";
              } else {
                router.replace(redirect ? (redirect as any) : "/(tabs)");
              }
            } catch (e: any) {
              setLocalError(e.message ?? "Google sign in failed");
            } finally {
              setIsSubmitting(false);
            }
          }} disabled={isSubmitting} testID="google-signin-btn">
            {isSubmitting ? formatUIText("signing in...") : formatUIText("sign in with google")}
          </Button>

          {/* Email/password sign-in — commented out for now, Google-only for beta
          <XStack alignItems="center" marginVertical="$2">
            <YStack flex={1} height={1} backgroundColor="$borderColor" />
            <Text fontFamily="$body" fontSize={13} color="$colorMuted" paddingHorizontal="$3">
              {formatUIText("or sign in with email")}
            </Text>
            <YStack flex={1} height={1} backgroundColor="$borderColor" />
          </XStack>

          <TextInput
            testID="email-input"
            placeholder={formatUIText("email")}
            placeholderTextColor={theme.placeholderColor?.val}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={{
              backgroundColor: theme.backgroundSurface?.val,
              borderRadius: DesignSystem.radius.lg,
              padding: 16,
              color: theme.color?.val,
              fontSize: 16,
              borderWidth: 1,
              borderColor: theme.borderColor?.val,
              outlineColor: "#3D9968",
            }}
          />

          <YStack>
            <TextInput
              testID="password-input"
              placeholder={formatUIText("password")}
              placeholderTextColor={theme.placeholderColor?.val}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={{
                backgroundColor: theme.backgroundSurface?.val,
                borderRadius: DesignSystem.radius.lg,
                padding: 16,
                paddingRight: 48,
                color: theme.color?.val,
                fontSize: 16,
                borderWidth: 1,
                borderColor: theme.borderColor?.val,
                outlineColor: "#3D9968",
              }}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={{ position: "absolute", right: 14, top: 16 }}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={theme.colorMuted?.val}
              />
            </Pressable>
          </YStack>

          <Button testID="submit-button" variant="primary" size="lg" onPress={handleLogin} disabled={isSubmitting} opacity={isSubmitting ? 0.6 : 1}>
            {isSubmitting ? formatUIText("signing in...") : formatUIText("sign in")}
          </Button>
          */}

          <Text fontFamily="$body" fontSize={11} color="$colorMuted" textAlign="center" marginTop="$2" lineHeight={16}>
            {formatUIText("by continuing, you agree to our ")}{" "}
            <Text fontSize={11} color="$accentBackground" onPress={() => router.push("/legal/terms" as any)}>
              {formatUIText("terms")}
            </Text>
            {" & "}
            <Text fontSize={11} color="$accentBackground" onPress={() => router.push("/legal/privacy" as any)}>
              {formatUIText("privacy policy")}
            </Text>
          </Text>
        </YStack>
      </YStack>
    </YStack>
    </ScrollView>
  );
}
