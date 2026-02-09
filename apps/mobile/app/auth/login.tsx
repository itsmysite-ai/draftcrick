import { View, Text, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useAuth } from "../../providers/AuthProvider";
import { useTheme } from "../../providers/ThemeProvider";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { t } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    // Firebase Auth signInWithEmailAndPassword
    await signIn(email, password);
  };

  const styles = createStyles(t);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Sign in to your DraftCrick account</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={t.textTertiary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={t.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Sign In</Text>
        </TouchableOpacity>

        {/* Social login buttons — Firebase Auth providers */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtons}>
          <TouchableOpacity style={styles.socialButton}>
            <Text style={styles.socialButtonText}>Google</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton}>
            <Text style={styles.socialButtonText}>Apple</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push("/auth/register")}>
          <Text style={styles.registerLink}>
            Don't have an account?{" "}
            <Text style={styles.registerLinkHighlight}>Sign up</Text>
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
    loginButton: {
      backgroundColor: t.accent,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
    },
    loginButtonText: {
      color: t.bg,
      fontSize: 16,
      fontWeight: "700",
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 8,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: t.border,
    },
    dividerText: {
      color: t.textTertiary,
      fontSize: 13,
      paddingHorizontal: 12,
    },
    socialButtons: {
      flexDirection: "row",
      gap: 12,
    },
    socialButton: {
      flex: 1,
      backgroundColor: t.bgSurface,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: t.border,
    },
    socialButtonText: {
      color: t.text,
      fontSize: 15,
      fontWeight: "600",
    },
    registerLink: {
      color: t.textTertiary,
      fontSize: 14,
      textAlign: "center",
      marginTop: 8,
    },
    registerLinkHighlight: {
      color: t.accent,
      fontWeight: "600",
    },
  });
