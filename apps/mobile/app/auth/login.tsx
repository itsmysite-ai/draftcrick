import { TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Button } from "@draftcrick/ui";
import { useAuth } from "../../providers/AuthProvider";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const theme = useTamaguiTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    await signIn(email, password);
  };

  return (
    <YStack flex={1} backgroundColor="$background" padding="$6" justifyContent="center">
      <Text fontFamily="$heading" fontWeight="800" fontSize={28} color="$color" marginBottom="$2">
        Welcome Back
      </Text>
      <Text fontFamily="$body" fontSize={15} color="$colorMuted" marginBottom="$8">
        Sign in to your DraftCrick account
      </Text>

      <YStack gap="$4">
        <TextInput
          placeholder="Email"
          placeholderTextColor={theme.placeholderColor.val}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={{
            backgroundColor: theme.backgroundSurface.val,
            borderRadius: 12,
            padding: 16,
            color: theme.color.val,
            fontSize: 16,
            borderWidth: 1,
            borderColor: theme.borderColor.val,
          }}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor={theme.placeholderColor.val}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={{
            backgroundColor: theme.backgroundSurface.val,
            borderRadius: 12,
            padding: 16,
            color: theme.color.val,
            fontSize: 16,
            borderWidth: 1,
            borderColor: theme.borderColor.val,
          }}
        />

        <Button variant="primary" size="lg" onPress={handleLogin}>
          Sign In
        </Button>

        <XStack alignItems="center" marginVertical="$2">
          <YStack flex={1} height={1} backgroundColor="$borderColor" />
          <Text fontFamily="$body" fontSize={13} color="$colorMuted" paddingHorizontal="$3">
            or continue with
          </Text>
          <YStack flex={1} height={1} backgroundColor="$borderColor" />
        </XStack>

        <XStack gap="$3">
          <Button variant="secondary" size="md" flex={1}>
            Google
          </Button>
          <Button variant="secondary" size="md" flex={1}>
            Apple
          </Button>
        </XStack>

        <XStack justifyContent="center" marginTop="$2" onPress={() => router.push("/auth/register")} cursor="pointer">
          <Text fontFamily="$body" fontSize={14} color="$colorMuted">
            Don't have an account?{" "}
          </Text>
          <Text fontFamily="$body" fontSize={14} color="$accentBackground" fontWeight="600">
            Sign up
          </Text>
        </XStack>
      </YStack>
    </YStack>
  );
}
