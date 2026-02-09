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

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    await signUp(email, password);
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
          {formatUIText("create account")}
        </Text>
        <Text fontFamily="$body" fontSize={15} color="$colorMuted" marginBottom="$8">
          {formatUIText("join thousands of fantasy cricket players")}
        </Text>

        <YStack gap="$4">
          <TextInput
            placeholder={formatUIText("username")}
            placeholderTextColor={theme.placeholderColor.val}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
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
            placeholder={formatUIText("email")}
            placeholderTextColor={theme.placeholderColor.val}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
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
            placeholder={formatUIText("password (8+ characters)")}
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
          <Button variant="primary" size="lg" onPress={handleRegister}>
            {formatUIText("create account")}
          </Button>
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
  );
}
