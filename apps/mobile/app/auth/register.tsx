import { TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Button } from "@draftcrick/ui";
import { useAuth } from "../../providers/AuthProvider";

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const theme = useTamaguiTheme();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    await signUp(email, password);
  };

  return (
    <YStack flex={1} backgroundColor="$background" padding="$6" justifyContent="center">
      <Text fontFamily="$heading" fontWeight="800" fontSize={28} color="$color" marginBottom="$2">
        Create Account
      </Text>
      <Text fontFamily="$body" fontSize={15} color="$colorMuted" marginBottom="$8">
        Join thousands of fantasy cricket players
      </Text>

      <YStack gap="$4">
        <TextInput
          placeholder="Username"
          placeholderTextColor={theme.placeholderColor.val}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
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
          placeholder="Email"
          placeholderTextColor={theme.placeholderColor.val}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
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
          placeholder="Password (8+ characters)"
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
        <Button variant="primary" size="lg" onPress={handleRegister}>
          Create Account
        </Button>
        <XStack justifyContent="center" marginTop="$2" onPress={() => router.push("/auth/login")} cursor="pointer">
          <Text fontFamily="$body" fontSize={14} color="$colorMuted">
            Already have an account?{" "}
          </Text>
          <Text fontFamily="$body" fontSize={14} color="$accentBackground" fontWeight="600">
            Sign in
          </Text>
        </XStack>
      </YStack>
    </YStack>
  );
}
