import {
  View, Text, StyleSheet, Pressable, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { useComfortMode } from "../../providers/ComfortModeProvider";
import { Colors, Radius, Spacing, Font, FontFamily, card } from "../../lib/design";

function SettingRow({ icon, label, value, accent, onPress, last }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value?: string;
  accent?: boolean; onPress?: () => void; last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ hovered }) => [s.settingRow, !last && s.settingBorder, hovered && onPress && { backgroundColor: Colors.bgSurfaceHover }]}>
      <View style={s.settingLeft}>
        <View style={[s.settingIcon, accent && { backgroundColor: Colors.accentMuted }]}>
          <Ionicons name={icon} size={15} color={accent ? Colors.accent : Colors.textTertiary} />
        </View>
        <Text style={s.settingLabel}>{label}</Text>
      </View>
      <View style={s.settingRight}>
        {value && <Text style={[s.settingVal, accent && { color: Colors.accent }]}>{value}</Text>}
        {onPress && <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />}
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { enable: enableComfort } = useComfortMode();
  const wallet = trpc.wallet.getBalance.useQuery(undefined, { retry: false });
  const isLoggedIn = !wallet.error;

  return (
    <ScrollView style={[s.container, { paddingTop: insets.top }]} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Animated.View entering={FadeIn.delay(30)} style={s.profileHeader}>
        <View style={s.avatar}>
          <Ionicons name={isLoggedIn ? "person" : "person-outline"} size={24} color={isLoggedIn ? Colors.accent : Colors.textTertiary} />
        </View>
        <Text style={s.name}>{isLoggedIn ? "Player" : "Guest User"}</Text>
        <Text style={s.sub}>{isLoggedIn ? "Fantasy cricket champion in the making" : "Sign in to track your journey"}</Text>
        {!isLoggedIn && (
          <Pressable onPress={() => router.push("/auth/login")} style={({ hovered }) => [s.signInBtn, hovered && { backgroundColor: Colors.accentDark }]}>
            <Text style={s.signInText}>Sign In</Text>
            <Ionicons name="arrow-forward" size={14} color={Colors.textInverse} />
          </Pressable>
        )}
      </Animated.View>

      {/* Wallet */}
      {isLoggedIn && wallet.data && (
        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <Pressable onPress={() => router.push("/wallet" as never)} style={({ pressed, hovered }) => [s.walletCard, hovered && s.hover, pressed && s.press]}>
            <View style={s.walletTop}>
              <View>
                <Text style={s.walletLabel}>Total Balance</Text>
                <Text style={s.walletBal}>₹{wallet.data.totalBalance.toFixed(2)}</Text>
              </View>
              <View style={s.walletIcon}><Ionicons name="wallet-outline" size={18} color={Colors.accent} /></View>
            </View>
            <View style={s.walletBreakdown}>
              {[
                { l: "Cash", v: wallet.data.cashBalance, i: "cash-outline" as const },
                { l: "Bonus", v: wallet.data.bonusBalance, i: "gift-outline" as const },
                { l: "Winnings", v: wallet.data.totalWinnings, i: "trending-up" as const },
              ].map((x, i) => (
                <View key={i} style={s.walletItem}>
                  <Ionicons name={x.i} size={13} color={Colors.textTertiary} />
                  <Text style={s.walletItemLabel}>{x.l}</Text>
                  <Text style={s.walletItemVal}>₹{x.v.toFixed(0)}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        </Animated.View>
      )}

      {/* Settings */}
      <Animated.View entering={FadeInDown.delay(160).springify()} style={s.settingsCard}>
        <Text style={s.settingsHeader}>Settings</Text>
        <SettingRow icon="accessibility-outline" label="Comfort Mode" value="Switch" accent onPress={() => { enableComfort(); router.replace("/(comfort-tabs)" as any); }} />
        <SettingRow icon="language-outline" label="Language" value="English" />
        <SettingRow icon="wallet-outline" label="Wallet" onPress={() => router.push("/wallet" as never)} />
        <SettingRow icon="notifications-outline" label="Notifications" value="On" onPress={() => {}} />
        <SettingRow icon="moon-outline" label="Theme" value="Dark" />
        <SettingRow icon="information-circle-outline" label="App Version" value="0.0.1" last />
      </Animated.View>

      {/* Quick links */}
      <Animated.View entering={FadeInDown.delay(240).springify()} style={s.linksRow}>
        {([
          { i: "help-circle-outline" as const, l: "Help & FAQ" },
          { i: "document-text-outline" as const, l: "Terms" },
          { i: "shield-checkmark-outline" as const, l: "Privacy" },
        ]).map((link, idx) => (
          <Pressable key={idx} style={({ hovered }) => [s.linkCard, hovered && s.hover]}>
            <Ionicons name={link.i} size={18} color={Colors.textTertiary} />
            <Text style={s.linkText}>{link.l}</Text>
          </Pressable>
        ))}
      </Animated.View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.xl },
  hover: { backgroundColor: Colors.bgSurfaceHover },
  press: { backgroundColor: Colors.bgSurfacePress, transform: [{ scale: 0.98 }] },

  profileHeader: { alignItems: "center", paddingVertical: Spacing["3xl"], marginBottom: Spacing.xl },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.bgSurface, borderWidth: 2, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg,
  },
  name: { fontFamily: FontFamily.headingBold, fontSize: Font["2xl"], color: Colors.text, marginBottom: 4 },
  sub: { fontFamily: FontFamily.body, fontSize: Font.md, color: Colors.textSecondary, marginBottom: Spacing.xl },
  signInBtn: {
    flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    backgroundColor: Colors.accent, paddingHorizontal: Spacing["2xl"], paddingVertical: Spacing.md, borderRadius: Radius.sm,
  },
  signInText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md, color: Colors.textInverse },

  walletCard: { ...card, padding: Spacing.lg, marginBottom: Spacing.xl },
  walletTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: Spacing.lg },
  walletLabel: { fontFamily: FontFamily.body, fontSize: Font.xs, color: Colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  walletBal: { fontFamily: FontFamily.headingBold, fontSize: Font["3xl"], color: Colors.accent },
  walletIcon: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.accentMuted, alignItems: "center", justifyContent: "center" },
  walletBreakdown: { flexDirection: "row", borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md, gap: Spacing.md },
  walletItem: { flex: 1, alignItems: "center", gap: 3 },
  walletItemLabel: { fontFamily: FontFamily.body, fontSize: Font.xs, color: Colors.textTertiary },
  walletItemVal: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md, color: Colors.text },

  settingsCard: { ...card, marginBottom: Spacing.xl, overflow: "hidden" },
  settingsHeader: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, color: Colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  settingBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  settingIcon: { width: 30, height: 30, borderRadius: Radius.xs, backgroundColor: Colors.bgLight, alignItems: "center", justifyContent: "center" },
  settingLabel: { fontFamily: FontFamily.body, fontSize: Font.md, color: Colors.text },
  settingRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  settingVal: { fontFamily: FontFamily.body, fontSize: Font.sm, color: Colors.textTertiary },

  linksRow: { flexDirection: "row", gap: Spacing.md },
  linkCard: { flex: 1, ...card, padding: Spacing.lg, alignItems: "center", gap: Spacing.sm },
  linkText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm, color: Colors.textTertiary },
});
