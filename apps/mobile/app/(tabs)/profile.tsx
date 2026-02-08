import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "../../lib/trpc";
import { useComfortMode } from "../../providers/ComfortModeProvider";

export default function ProfileScreen() {
  const router = useRouter();
  const { enabled: comfortMode, enable: enableComfort } = useComfortMode();

  const wallet = trpc.wallet.getBalance.useQuery(undefined, {
    retry: false,
  });

  const isLoggedIn = !wallet.error;

  const handleComfortToggle = () => {
    enableComfort();
    router.replace("/(comfort-tabs)" as any);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{isLoggedIn ? "U" : "?"}</Text>
      </View>

      <Text style={styles.name}>{isLoggedIn ? "Player" : "Guest User"}</Text>
      <Text style={styles.subtitle}>
        {isLoggedIn
          ? "Your fantasy cricket journey"
          : "Sign in to track your fantasy journey"}
      </Text>

      {!isLoggedIn && (
        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => router.push("/auth/login")}
        >
          <Text style={styles.signInText}>Sign In</Text>
        </TouchableOpacity>
      )}

      {/* Wallet Balance */}
      {isLoggedIn && wallet.data && (
        <TouchableOpacity
          style={styles.walletCard}
          onPress={() => router.push("/wallet" as never)}
        >
          <Text style={styles.walletLabel}>Wallet Balance</Text>
          <Text style={styles.walletBalance}>
            ₹{wallet.data.totalBalance.toFixed(2)}
          </Text>
          <View style={styles.walletBreakdown}>
            <View>
              <Text style={styles.breakdownLabel}>Cash</Text>
              <Text style={styles.breakdownValue}>
                ₹{wallet.data.cashBalance.toFixed(2)}
              </Text>
            </View>
            <View>
              <Text style={styles.breakdownLabel}>Bonus</Text>
              <Text style={styles.breakdownValue}>
                ₹{wallet.data.bonusBalance.toFixed(2)}
              </Text>
            </View>
            <View>
              <Text style={styles.breakdownLabel}>Winnings</Text>
              <Text style={styles.breakdownValue}>
                ₹{wallet.data.totalWinnings.toFixed(2)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Settings */}
      <View style={styles.settingsSection}>
        <TouchableOpacity style={styles.settingRow} onPress={handleComfortToggle}>
          <Text style={styles.settingLabel}>Comfort Mode</Text>
          <Text style={[styles.settingValue, { color: "#00F5A0" }]}>
            Switch →
          </Text>
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
        <TouchableOpacity style={styles.settingRow}>
          <Text style={styles.settingLabel}>Notifications</Text>
          <Text style={styles.settingValue}>On</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.settingRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.settingLabel}>App Version</Text>
          <Text style={styles.settingValue}>0.0.1</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1628",
  },
  content: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1A2332",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#00F5A0",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    color: "#00F5A0",
    fontWeight: "700",
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
  walletCard: {
    width: "100%",
    backgroundColor: "#1A2332",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#00F5A030",
  },
  walletLabel: {
    fontSize: 12,
    color: "#6C757D",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  walletBalance: {
    fontSize: 28,
    fontWeight: "800",
    color: "#00F5A0",
    marginTop: 4,
    marginBottom: 12,
  },
  walletBreakdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#243044",
    paddingTop: 12,
  },
  breakdownLabel: {
    fontSize: 11,
    color: "#6C757D",
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 2,
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
