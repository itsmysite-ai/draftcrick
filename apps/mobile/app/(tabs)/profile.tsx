import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Avatar placeholder */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>?</Text>
      </View>

      <Text style={styles.name}>Guest User</Text>
      <Text style={styles.subtitle}>Sign in to track your fantasy journey</Text>

      <TouchableOpacity
        style={styles.signInButton}
        onPress={() => router.push("/auth/login")}
      >
        <Text style={styles.signInText}>Sign In</Text>
      </TouchableOpacity>

      {/* Settings */}
      <View style={styles.settingsSection}>
        <TouchableOpacity style={styles.settingRow}>
          <Text style={styles.settingLabel}>Comfort Mode</Text>
          <Text style={styles.settingValue}>Off</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingRow}>
          <Text style={styles.settingLabel}>Language</Text>
          <Text style={styles.settingValue}>English</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => router.push("/wallet" as never)}
        >
          <Text style={styles.settingLabel}>Wallet</Text>
          <Text style={styles.settingValue}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1628",
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1A2332",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#243044",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    color: "#6C757D",
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6C757D",
    marginBottom: 24,
  },
  signInButton: {
    backgroundColor: "#00F5A0",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 32,
  },
  signInText: {
    color: "#0A1628",
    fontSize: 16,
    fontWeight: "700",
  },
  settingsSection: {
    width: "100%",
    backgroundColor: "#1A2332",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#243044",
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#243044",
  },
  settingLabel: {
    fontSize: 15,
    color: "#FFFFFF",
  },
  settingValue: {
    fontSize: 15,
    color: "#6C757D",
  },
});
