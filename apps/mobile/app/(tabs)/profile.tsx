import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { useComfortMode } from "../../providers/ComfortModeProvider";
import { Colors, Gradients, Radius, Shadow, Spacing, Font } from "../../lib/design";

function SettingRow({
  icon,
  label,
  value,
  accent,
  onPress,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  accent?: boolean;
  onPress?: () => void;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.settingRow, !isLast && styles.settingBorder]}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIconWrap, accent && { backgroundColor: Colors.accentMuted }]}>
          <Ionicons name={icon} size={16} color={accent ? Colors.accent : Colors.textSecondary} />
        </View>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <View style={styles.settingRight}>
        {value && (
          <Text style={[styles.settingValue, accent && { color: Colors.accent }]}>{value}</Text>
        )}
        {onPress && (
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { enabled: comfortMode, enable: enableComfort } = useComfortMode();

  const wallet = trpc.wallet.getBalance.useQuery(undefined, { retry: false });
  const isLoggedIn = !wallet.error;

  const handleComfortToggle = () => {
    enableComfort();
    router.replace("/(comfort-tabs)" as any);
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header */}
      <Animated.View entering={FadeIn.delay(50)} style={styles.profileHeader}>
        <LinearGradient
          colors={Gradients.hero as any}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.avatarContainer}>
          <LinearGradient
            colors={isLoggedIn ? (Gradients.primary as any) : (["rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"] as any)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarGradient}
          >
            <View style={styles.avatarInner}>
              <Ionicons
                name={isLoggedIn ? "person" : "person-outline"}
                size={28}
                color={isLoggedIn ? Colors.accent : Colors.textTertiary}
              />
            </View>
          </LinearGradient>
        </View>

        <Text style={styles.profileName}>{isLoggedIn ? "Player" : "Guest User"}</Text>
        <Text style={styles.profileSub}>
          {isLoggedIn ? "Fantasy cricket champion in the making" : "Sign in to track your journey"}
        </Text>

        {!isLoggedIn && (
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => router.push("/auth/login")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signInGrad}
            >
              <Text style={styles.signInText}>Sign In</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.textInverse} />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Wallet Card */}
      {isLoggedIn && wallet.data && (
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <TouchableOpacity
            onPress={() => router.push("/wallet" as never)}
            activeOpacity={0.85}
            style={styles.walletCard}
          >
            <View style={styles.walletHeader}>
              <View>
                <Text style={styles.walletLabel}>Total Balance</Text>
                <Text style={styles.walletBalance}>
                  ₹{wallet.data.totalBalance.toFixed(2)}
                </Text>
              </View>
              <View style={styles.walletIconWrap}>
                <Ionicons name="wallet-outline" size={20} color={Colors.accent} />
              </View>
            </View>
            <View style={styles.walletBreakdown}>
              {[
                { label: "Cash", value: wallet.data.cashBalance, icon: "cash-outline" as const },
                { label: "Bonus", value: wallet.data.bonusBalance, icon: "gift-outline" as const },
                { label: "Winnings", value: wallet.data.totalWinnings, icon: "trending-up" as const },
              ].map((item, i) => (
                <View key={i} style={styles.walletItem}>
                  <Ionicons name={item.icon} size={14} color={Colors.textTertiary} />
                  <Text style={styles.walletItemLabel}>{item.label}</Text>
                  <Text style={styles.walletItemValue}>₹{item.value.toFixed(0)}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Settings */}
      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Settings</Text>
        <SettingRow
          icon="accessibility-outline"
          label="Comfort Mode"
          value="Switch"
          accent
          onPress={handleComfortToggle}
        />
        <SettingRow
          icon="language-outline"
          label="Language"
          value="English"
        />
        <SettingRow
          icon="wallet-outline"
          label="Wallet"
          onPress={() => router.push("/wallet" as never)}
        />
        <SettingRow
          icon="notifications-outline"
          label="Notifications"
          value="On"
          onPress={() => {}}
        />
        <SettingRow
          icon="moon-outline"
          label="Theme"
          value="Dark"
        />
        <SettingRow
          icon="information-circle-outline"
          label="App Version"
          value="0.0.1"
          isLast
        />
      </Animated.View>

      {/* Quick Links */}
      <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.quickLinks}>
        {[
          { icon: "help-circle-outline" as const, label: "Help & FAQ", gradient: Gradients.blue },
          { icon: "document-text-outline" as const, label: "Terms", gradient: Gradients.purple },
          { icon: "shield-checkmark-outline" as const, label: "Privacy", gradient: Gradients.primary },
        ].map((link, i) => (
          <TouchableOpacity key={i} style={styles.quickLink} activeOpacity={0.8}>
            <LinearGradient
              colors={link.gradient as any}
              style={styles.quickLinkIcon}
            >
              <Ionicons name={link.icon} size={16} color="#fff" />
            </LinearGradient>
            <Text style={styles.quickLinkText}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    paddingHorizontal: Spacing.xl,
  },

  // Profile Header
  profileHeader: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    borderRadius: Radius.xl,
    marginBottom: Spacing.xl,
    overflow: "hidden",
  },
  avatarContainer: {
    marginBottom: Spacing.lg,
  },
  avatarGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 3,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 37,
    backgroundColor: Colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    fontSize: Font["2xl"],
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 4,
  },
  profileSub: {
    fontSize: Font.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  signInBtn: {
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  signInGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
  },
  signInText: {
    fontSize: Font.md,
    fontWeight: "700",
    color: Colors.textInverse,
  },

  // Wallet
  walletCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadow.md,
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  walletLabel: {
    fontSize: Font.xs,
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  walletBalance: {
    fontSize: Font["3xl"],
    fontWeight: "900",
    color: Colors.accent,
  },
  walletIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  walletBreakdown: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  walletItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  walletItemLabel: {
    fontSize: Font.xs,
    color: Colors.textTertiary,
  },
  walletItemValue: {
    fontSize: Font.md,
    fontWeight: "700",
    color: Colors.text,
  },

  // Settings
  settingsCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
    overflow: "hidden",
  },
  settingsTitle: {
    fontSize: Font.sm,
    fontWeight: "700",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  settingBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  settingIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: {
    fontSize: Font.md,
    color: Colors.text,
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  settingValue: {
    fontSize: Font.sm,
    color: Colors.textSecondary,
  },

  // Quick Links
  quickLinks: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  quickLink: {
    flex: 1,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
  },
  quickLinkIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLinkText: {
    fontSize: Font.sm,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
});
