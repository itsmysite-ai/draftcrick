import { TextInput, Pressable, Alert, ScrollView } from "react-native";
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
  DesignSystem,
  formatUIText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { useAuth } from "../../providers/AuthProvider";
import { HeaderControls } from "../../components/HeaderControls";


/** Convert raw Firebase error messages into user-friendly text */
function friendlyAuthError(msg: string): string {
  if (msg.includes("auth/email-already-in-use"))
    return "This email is already registered. Try signing in instead.";
  if (msg.includes("auth/weak-password"))
    return "Password must be at least 6 characters.";
  if (msg.includes("auth/invalid-email"))
    return "Please enter a valid email address.";
  if (msg.includes("auth/network-request-failed"))
    return "Network error. Check your connection.";
  return msg.replace(/^Firebase:\s*/i, "").replace(/\s*\(auth\/[^)]+\)\.?$/i, "").trim() || "Sign up failed. Please try again.";
}

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp, signInWithGoogle, error } = useAuth();
  const theme = useTamaguiTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);


  const rawError = localError ?? error;
  const displayError = rawError ? friendlyAuthError(rawError) : null;

  const handleRegister = async () => {
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await signUp(email, password);
      router.replace("/auth/onboarding");
    } catch (e: any) {
      setLocalError(e.message ?? "Sign up failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!termsAccepted) {
      Alert.alert(
        "one more step",
        "please accept the terms of service to continue.",
        [{ text: "ok" }]
      );
      return;
    }
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      if (typeof (globalThis as any).window !== "undefined") {
        (globalThis as any).window.location.href = "/";
      } else {
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      setLocalError(e.message ?? "Google sign up failed");
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
        <SafeBackButton />
        <HeaderControls />
      </XStack>

      <AnnouncementBanner />

      {/* ── Form ── */}
      <YStack flex={1} justifyContent="center" paddingHorizontal="$6">
        <YStack alignItems="center" marginBottom="$4">
          <DraftPlayLogo size={48} animate />
        </YStack>
        <Text fontFamily="$mono" fontWeight="500" fontSize={24} color="$color" letterSpacing={-0.5} marginBottom="$2">
          {formatUIText("create account")}
        </Text>
        <Text fontFamily="$body" fontSize={15} color="$colorMuted" marginBottom="$4">
          {formatUIText("join thousands of fantasy cricket players")}
        </Text>

        {/* Free trial banner */}
        <XStack
          backgroundColor="$accentBackground"
          paddingHorizontal="$3"
          paddingVertical="$2"
          borderRadius="$3"
          alignItems="center"
          justifyContent="center"
          marginBottom="$6"
          gap="$2"
        >
          <Text fontFamily="$mono" fontWeight="700" fontSize={11} color="white">
            {formatUIText("start with a 7-day free trial — no credit card needed")}
          </Text>
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
          {/* Terms checkbox — required before Google sign-up */}
          <Pressable
            onPress={() => setTermsAccepted(!termsAccepted)}
            testID="terms-accept-checkbox"
          >
            <XStack gap="$3" alignItems="flex-start">
              <YStack
                width={22}
                height={22}
                borderRadius={4}
                borderWidth={2}
                borderColor={termsAccepted ? "$accentBackground" : "$borderColor"}
                backgroundColor={termsAccepted ? "$accentBackground" : "transparent"}
                alignItems="center"
                justifyContent="center"
                marginTop={2}
              >
                {termsAccepted && (
                  <Ionicons name="checkmark" size={14} color="white" />
                )}
              </YStack>
              <Text fontFamily="$body" fontSize={13} color="$colorSecondary" flex={1} lineHeight={20}>
                {formatUIText("i agree to the ")}{" "}
                <Text
                  fontFamily="$body"
                  fontSize={13}
                  color="$accentBackground"
                  fontWeight="600"
                  onPress={() => router.push("/legal/terms" as any)}
                >
                  {formatUIText("terms of service")}
                </Text>
                {formatUIText(" and ")}{" "}
                <Text
                  fontFamily="$body"
                  fontSize={13}
                  color="$accentBackground"
                  fontWeight="600"
                  onPress={() => router.push("/legal/privacy" as any)}
                >
                  {formatUIText("privacy policy")}
                </Text>
              </Text>
            </XStack>
          </Pressable>

          {/* Google Sign-Up — primary */}
          <Button variant="primary" size="lg" maxWidth={320} alignSelf="center" onPress={handleGoogleSignUp} disabled={isSubmitting || !termsAccepted} opacity={!termsAccepted ? 0.4 : 1} testID="google-signup-btn">
            {isSubmitting ? formatUIText("creating account...") : formatUIText("sign up with google")}
          </Button>

          {/* Email/password sign-up — commented out for beta, Google-only
          <XStack alignItems="center" marginVertical="$2">
            <YStack flex={1} height={1} backgroundColor="$borderColor" />
            <Text fontFamily="$body" fontSize={13} color="$colorMuted" paddingHorizontal="$3">
              {formatUIText("or sign up with email")}
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
              placeholder={formatUIText("password (8+ characters)")}
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

          <Pressable
            onPress={() => setAgeConfirmed(!ageConfirmed)}
            testID="age-confirm-checkbox"
          >
            <XStack gap="$3" alignItems="flex-start">
              <YStack
                width={22} height={22} borderRadius={4} borderWidth={2}
                borderColor={ageConfirmed ? "$accentBackground" : "$borderColor"}
                backgroundColor={ageConfirmed ? "$accentBackground" : "transparent"}
                alignItems="center" justifyContent="center" marginTop={2}
              >
                {ageConfirmed && <Ionicons name="checkmark" size={14} color="white" />}
              </YStack>
              <Text fontFamily="$body" fontSize={13} color="$colorSecondary" flex={1}>
                {formatUIText("i confirm i am 13 years or older")}
              </Text>
            </XStack>
          </Pressable>

          <Button testID="submit-button" variant="primary" size="lg" onPress={handleRegister}
            disabled={isSubmitting || !ageConfirmed || !termsAccepted}
            opacity={isSubmitting || !ageConfirmed || !termsAccepted ? 0.4 : 1}
          >
            {isSubmitting ? formatUIText("creating account...") : formatUIText("create account")}
          </Button>
          */}

          <XStack justifyContent="center" marginTop="$2" onPress={() => router.push("/auth/login")} cursor="pointer">
            <Text fontFamily="$body" fontSize={14} color="$colorMuted">
              {formatUIText("already have an account?")}{" "}
            </Text>
            <Text fontFamily="$body" fontSize={14} color="$accentBackground" fontWeight="600">
              {formatUIText("sign in")}
            </Text>
          </XStack>
        </YStack>
      </YStack>
    </YStack>
    </ScrollView>
  );
}
