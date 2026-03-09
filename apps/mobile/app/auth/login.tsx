import { TextInput, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
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
  const { signIn, error } = useAuth();
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
      router.replace("/(tabs)");
    } catch (e: any) {
      setLocalError(e.message ?? "Sign in failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
      <YStack flex={1} justifyContent="center" paddingHorizontal="$6">
        <YStack alignItems="center" marginBottom="$4">
          <DraftPlayLogo size={56} animate />
        </YStack>
        <Text fontFamily="$mono" fontWeight="500" fontSize={24} color="$color" letterSpacing={-0.5} marginBottom="$2">
          {formatUIText("welcome back")}
        </Text>
        <Text fontFamily="$body" fontSize={15} color="$colorMuted" marginBottom="$8">
          {formatUIText("sign in to your draftplay account")}
        </Text>

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
          <TextInput
            testID="email-input"
            placeholder={formatUIText("email")}
            placeholderTextColor={theme.placeholderColor.val}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={{
              backgroundColor: theme.backgroundSurface.val,
              borderRadius: DesignSystem.radius.lg,
              padding: 16,
              color: theme.color.val,
              fontSize: 16,
              borderWidth: 1,
              borderColor: theme.borderColor.val,
            }}
          />

          <YStack>
            <TextInput
              testID="password-input"
              placeholder={formatUIText("password")}
              placeholderTextColor={theme.placeholderColor.val}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={{
                backgroundColor: theme.backgroundSurface.val,
                borderRadius: DesignSystem.radius.lg,
                padding: 16,
                paddingRight: 48,
                color: theme.color.val,
                fontSize: 16,
                borderWidth: 1,
                borderColor: theme.borderColor.val,
              }}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={{ position: "absolute", right: 14, top: 16 }}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={theme.colorMuted.val}
              />
            </Pressable>
          </YStack>

          <Button testID="submit-button" variant="primary" size="lg" onPress={handleLogin} disabled={isSubmitting} opacity={isSubmitting ? 0.6 : 1}>
            {isSubmitting ? formatUIText("signing in...") : formatUIText("sign in")}
          </Button>

          <XStack alignItems="center" marginVertical="$2">
            <YStack flex={1} height={1} backgroundColor="$borderColor" />
            <Text fontFamily="$body" fontSize={13} color="$colorMuted" paddingHorizontal="$3">
              {formatUIText("or continue with")}
            </Text>
            <YStack flex={1} height={1} backgroundColor="$borderColor" />
          </XStack>

          <XStack gap="$3">
            <Button variant="secondary" size="md" flex={1}>
              {formatUIText("google")}
            </Button>
            <Button variant="secondary" size="md" flex={1}>
              {formatUIText("apple")}
            </Button>
          </XStack>

          <XStack justifyContent="center" marginTop="$2" onPress={() => router.push("/auth/register")} cursor="pointer">
            <Text fontFamily="$body" fontSize={14} color="$colorMuted">
              {formatUIText("don't have an account?")}{" "}
            </Text>
            <Text fontFamily="$body" fontSize={14} color="$accentBackground" fontWeight="600">
              {formatUIText("sign up")}
            </Text>
          </XStack>
        </YStack>
      </YStack>
    </YStack>
  );
}
