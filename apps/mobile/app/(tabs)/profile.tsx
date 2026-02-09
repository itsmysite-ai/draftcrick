import {
  View, Text, StyleSheet, Pressable, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { trpc } from "../../lib/trpc";
import { Radius, Spacing, Font, FontFamily } from "../../lib/design";
import { useTheme } from "../../providers/ThemeProvider";

function SettingRow({ icon, label, value, accent, onPress, last }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value?: string;
  accent?: boolean; onPress?: () => void; last?: boolean;
}) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }) => [
        s.settingRow,
        !last && { borderBottomWidth: 1, borderBottomColor: t.border },
        hovered && onPress && { backgroundColor: t.bgSurfaceHover },
      ]}
    >
      <View style={s.settingLeft}>
        <View style={[s.settingIcon, { backgroundColor: t.bgLight }, accent && { backgroundColor: t.accentMuted }]}>
          <Ionicons name={icon} size={15} color={accent ? t.accent : t.textTertiary} />
        </View>
        <Text style={[s.settingLabel, { color: t.text }]}>{label}</Text>
      </View>
      <View style={s.settingRight}>
        {value && <Text style={[s.settingVal, { color: t.textTertiary }, accent && { color: t.accent }]}>{value}</Text>}
        {onPress && <Ionicons name="chevron-forward" size={14} color={t.textTertiary} />}
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, mode, toggleMode } = useTheme();
  const wallet = trpc.wallet.getBalance.useQuery(undefined, { retry: false });
  const isLoggedIn = !wallet.error;

  return (
    <ScrollView
      style={[s.container, { backgroundColor: t.bg, paddingTop: insets.top }]}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn.delay(30)} style={[s.profileHeader, { borderBottomColor: t.borderSubtle }]}>
        <View style={[s.avatar, { backgroundColor: t.bgSurface, borderColor: t.border }]}>
          <Ionicons name={isLoggedIn ? "person" : "person-outline"} size={24} color={isLoggedIn ? t.accent : t.textTertiary} />
        </View>
        <Text style={[s.name, { color: t.text }]}>{isLoggedIn ? "Player" : "Guest User"}</Text>
        <Text style={[s.sub, { color: t.textSecondary }]}>{isLoggedIn ? "Fantasy cricket champion in the making" : "Sign in to track your journey"}</Text>
        {!isLoggedIn && (
          <Pressable
            onPress={() => router.push("/auth/login")}
            style={({ hovered }) => [s.signInBtn, { backgroundColor: t.accent }, hovered && { backgroundColor: t.accentDark }]}
          >
            <Text style={[s.signInText, { color: t.textInverse }]}>Sign In</Text>
            <Ionicons name="arrow-forward" size={14} color={t.textInverse} />
          </Pressable>
        )}
      </Animated.View>

      {isLoggedIn && wallet.data && (
        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <Pressable
            onPress={() => router.push("/wallet" as never)}
            style={({ pressed, hovered }) => [
              s.walletCard,
              { backgroundColor: t.bgSurface, borderRadius: Radius.md, borderWidth: 1, borderColor: t.border },
              hovered && { backgroundColor: t.bgSurfaceHover },
              pressed && { backgroundColor: t.bgSurfacePress, transform: [{ scale: 0.98 }] },
            ]}
          >
            <View style={s.walletTop}>
              <View>
                <Text style={[s.walletLabel, { color: t.textTertiary }]}>Total Balance</Text>
                <Text style={[s.walletBal, { color: t.accent }]}>₹{wallet.data.totalBalance.toFixed(2)}</Text>
              </View>
              <View style={[s.walletIcon, { backgroundColor: t.accentMuted }]}>
                <Ionicons name="wallet-outline" size={18} color={t.accent} />
              </View>
            </View>
            <View style={[s.walletBreakdown, { borderTopColor: t.border }]}>
              {[
                { l: "Cash", v: wallet.data.cashBalance, i: "cash-outline" as const },
                { l: "Bonus", v: wallet.data.bonusBalance, i: "gift-outline" as const },
                { l: "Winnings", v: wallet.data.totalWinnings, i: "trending-up" as const },
              ].map((x, i) => (
                <View key={i} style={s.walletItem}>
                  <Ionicons name={x.i} size={13} color={t.textTertiary} />
                  <Text style={[s.walletItemLabel, { color: t.textTertiary }]}>{x.l}</Text>
                  <Text style={[s.walletItemVal, { color: t.text }]}>₹{x.v.toFixed(0)}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        </Animated.View>
      )}

      <Animated.View
        entering={FadeInDown.delay(160).springify()}
        style={[s.settingsCard, { backgroundColor: t.bgSurface, borderRadius: Radius.md, borderWidth: 1, borderColor: t.border }]}
      >
        <Text style={[s.settingsHeader, { color: t.textTertiary }]}>Settings</Text>
        <SettingRow icon="language-outline" label="Language" value="English" />
        <SettingRow icon="wallet-outline" label="Wallet" onPress={() => router.push("/wallet" as never)} />
        <SettingRow icon="notifications-outline" label="Notifications" value="On" onPress={() => {}} />
        <SettingRow icon="moon-outline" label="Theme" value={mode === "dark" ? "Dark" : "Light"} onPress={toggleMode} />
        <SettingRow icon="information-circle-outline" label="App Version" value="0.0.1" last />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240).springify()} style={s.linksRow}>
        {([
          { i: "help-circle-outline" as const, l: "Help & FAQ" },
          { i: "document-text-outline" as const, l: "Terms" },
          { i: "shield-checkmark-outline" as const, l: "Privacy" },
        ]).map((link, idx) => (
          <Pressable
            key={idx}
            style={({ hovered }) => [
              s.linkCard,
              { backgroundColor: t.bgSurface, borderRadius: Radius.md, borderWidth: 1, borderColor: t.border },
              hovered && { backgroundColor: t.bgSurfaceHover },
            ]}
          >
            <Ionicons name={link.i} size={18} color={t.textTertiary} />
            <Text style={[s.linkText, { color: t.textTertiary }]}>{link.l}</Text>
          </Pressable>
        ))}
      </Animated.View>

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.xl },

  profileHeader: { alignItems: "center", paddingVertical: Spacing["3xl"], marginBottom: Spacing.xl, borderBottomWidth: 1 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2,
    alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg,
  },
  name: { fontFamily: FontFamily.headingBold, fontSize: Font["2xl"], marginBottom: 4 },
  sub: { fontFamily: FontFamily.body, fontSize: Font.md, marginBottom: Spacing.xl },
  signInBtn: {
    flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    paddingHorizontal: Spacing["2xl"], paddingVertical: Spacing.md, borderRadius: Radius.sm,
  },
  signInText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md },

  walletCard: { padding: Spacing.lg, marginBottom: Spacing.xl },
  walletTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: Spacing.lg },
  walletLabel: { fontFamily: FontFamily.body, fontSize: Font.xs, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  walletBal: { fontFamily: FontFamily.headingBold, fontSize: Font["3xl"] },
  walletIcon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: "center", justifyContent: "center" },
  walletBreakdown: { flexDirection: "row", borderTopWidth: 1, paddingTop: Spacing.md, gap: Spacing.md },
  walletItem: { flex: 1, alignItems: "center", gap: 3 },
  walletItemLabel: { fontFamily: FontFamily.body, fontSize: Font.xs },
  walletItemVal: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md },

  settingsCard: { marginBottom: Spacing.xl, overflow: "hidden" },
  settingsHeader: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.xs, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  settingIcon: { width: 30, height: 30, borderRadius: Radius.xs, alignItems: "center", justifyContent: "center" },
  settingLabel: { fontFamily: FontFamily.body, fontSize: Font.md },
  settingRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  settingVal: { fontFamily: FontFamily.body, fontSize: Font.sm },

  linksRow: { flexDirection: "row", gap: Spacing.md },
  linkCard: { flex: 1, padding: Spacing.lg, alignItems: "center", gap: Spacing.sm },
  linkText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.sm },
});
