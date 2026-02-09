import { TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Button,
  BackButton,
  ModeToggle,
  AnnouncementBanner,
  DesignSystem,
  formatUIText,
} from "@draftcrick/ui";
import { useAuth } from "../../providers/AuthProvider";
import { useTheme } from "../../providers/ThemeProvider";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    await signIn(email, password);
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
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>

      <AnnouncementBanner />

      {/* ── Form ── */}
      <YStack flex={1} justifyContent="center" paddingHorizontal="$6">
        <Text fontSize={48} textAlign="center" marginBottom="$4">
          {DesignSystem.emptyState.icon}
        </Text>
        <Text fontFamily="$mono" fontWeight="500" fontSize={24} color="$color" letterSpacing={-0.5} marginBottom="$2">
          {formatUIText("welcome back")}
        </Text>
        <Text fontFamily="$body" fontSize={15} color="$colorMuted" marginBottom="$8">
          {formatUIText("sign in to your draftcrick account")}
        </Text>

        <YStack gap="$4">
          <TextInput
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

          <TextInput
            placeholder={formatUIText("password")}
            placeholderTextColor={theme.placeholderColor.val}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
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

          <Button variant="primary" size="lg" onPress={handleLogin}>
            {formatUIText("sign in")}
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
