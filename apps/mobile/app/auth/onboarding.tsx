import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Radius, Spacing, Font, FontFamily } from "../../lib/design";
import { useTheme } from "../../providers/ThemeProvider";

const TEAMS = ["CSK", "MI", "RCB", "KKR", "DC", "SRH", "PBKS", "GT", "LSG", "RR"];
const FORMATS = [
  { key: "salary_cap", label: "Salary Cap", icon: "cash-outline" as const, desc: "Build teams within a budget" },
  { key: "draft", label: "Draft", icon: "swap-horizontal-outline" as const, desc: "Take turns picking players" },
  { key: "prediction", label: "Prediction", icon: "analytics-outline" as const, desc: "Predict match outcomes" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const [step, setStep] = useState(0);
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [preferredFormat, setPreferredFormat] = useState<string | null>(null);

  const handleComplete = () => {
    router.replace("/(tabs)");
  };

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <View style={s.progress}>
        {[0, 1].map((i) => (
          <View key={i} style={[s.dot, { backgroundColor: t.border }, step >= i && { backgroundColor: t.accent, width: 24 }]} />
        ))}
      </View>

      {step === 0 && (
        <View style={s.step}>
          <Text style={[s.title, { color: t.text }]}>Pick Your Team</Text>
          <Text style={[s.subtitle, { color: t.textTertiary }]}>Who do you support?</Text>
          <View style={s.grid}>
            {TEAMS.map((team) => (
              <Pressable
                key={team}
                onPress={() => setFavoriteTeam(team)}
                style={({ hovered }) => [
                  s.chip,
                  { backgroundColor: t.bgSurface, borderColor: t.border },
                  favoriteTeam === team && { backgroundColor: t.accentMuted, borderColor: t.accent },
                  hovered && { backgroundColor: t.bgSurfaceHover },
                ]}
              >
                <Text style={[s.chipText, { color: t.text }, favoriteTeam === team && { color: t.accent }]}>{team}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            disabled={!favoriteTeam}
            onPress={() => setStep(1)}
            style={({ hovered }) => [s.nextBtn, { backgroundColor: t.accent }, !favoriteTeam && s.nextBtnDisabled, hovered && { opacity: 0.9 }]}
          >
            <Text style={[s.nextBtnText, { color: t.textInverse }]}>Next</Text>
          </Pressable>
        </View>
      )}

      {step === 1 && (
        <View style={s.step}>
          <Text style={[s.title, { color: t.text }]}>Choose Your Style</Text>
          <Text style={[s.subtitle, { color: t.textTertiary }]}>How do you want to play?</Text>
          <View style={{ gap: 12 }}>
            {FORMATS.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => setPreferredFormat(f.key)}
                style={({ hovered }) => [
                  s.formatCard,
                  { backgroundColor: t.bgSurface, borderColor: t.border },
                  preferredFormat === f.key && { borderColor: t.accent, backgroundColor: t.accentMuted },
                  hovered && { backgroundColor: t.bgSurfaceHover },
                ]}
              >
                <View style={s.formatRow}>
                  <Ionicons name={f.icon} size={20} color={preferredFormat === f.key ? t.accent : t.textTertiary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.formatTitle, { color: t.text }, preferredFormat === f.key && { color: t.accent }]}>{f.label}</Text>
                    <Text style={[s.formatDesc, { color: t.textSecondary }]}>{f.desc}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
          <Pressable
            disabled={!preferredFormat}
            onPress={handleComplete}
            style={({ hovered }) => [s.nextBtn, { backgroundColor: t.accent }, !preferredFormat && s.nextBtnDisabled, hovered && { opacity: 0.9 }]}
          >
            <Text style={[s.nextBtnText, { color: t.textInverse }]}>Let's Go</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing["2xl"], paddingTop: 60 },
  progress: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 40 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  step: { flex: 1 },
  title: { fontFamily: FontFamily.headingBold, fontSize: Font["3xl"], marginBottom: 8 },
  subtitle: { fontFamily: FontFamily.body, fontSize: Font.lg, marginBottom: 32 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    borderRadius: Radius.xl,
    paddingHorizontal: 20, paddingVertical: 12,
    borderWidth: 1,
  },
  chipText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md },
  formatCard: {
    borderRadius: Radius.md,
    padding: Spacing.xl, borderWidth: 2,
  },
  formatRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  formatTitle: { fontFamily: FontFamily.headingBold, fontSize: Font.xl },
  formatDesc: { fontFamily: FontFamily.body, fontSize: Font.sm, marginTop: 2 },
  nextBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg, alignItems: "center",
    marginTop: "auto", marginBottom: 32,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontFamily: FontFamily.headingBold, fontSize: Font.lg },
});
