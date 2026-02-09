import { View, Text, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { useTheme } from "../../providers/ThemeProvider";

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { t } = useTheme();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    // Firebase Auth createUserWithEmailAndPassword
    // Then call tRPC syncUser to create PostgreSQL record with username
    await signUp(email, password);
  };

  const styles = createStyles(t);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>
        Join thousands of fantasy cricket players
      </Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={t.textTertiary}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={t.textTertiary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password (8+ characters)"
          placeholderTextColor={t.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
          <Text style={styles.registerButtonText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/auth/login")}>
          <Text style={styles.loginLink}>
            Already have an account?{" "}
            <Text style={styles.loginLinkHighlight}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (t: ReturnType<typeof import("../../providers/ThemeProvider").useTheme>["t"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
      padding: 24,
      justifyContent: "center",
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: t.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: t.textTertiary,
      marginBottom: 32,
    },
    form: {
      gap: 16,
    },
    input: {
      backgroundColor: t.bgSurface,
      borderRadius: 12,
      padding: 16,
      color: t.text,
      fontSize: 16,
      borderWidth: 1,
      borderColor: t.border,
    },
    registerButton: {
      backgroundColor: t.accent,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
    },
    registerButtonText: {
      color: t.bg,
      fontSize: 16,
      fontWeight: "700",
    },
    loginLink: {
      color: t.textTertiary,
      fontSize: 14,
      textAlign: "center",
      marginTop: 8,
    },
    loginLinkHighlight: {
      color: t.accent,
      fontWeight: "600",
    },
  });
