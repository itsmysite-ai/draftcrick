import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing, Font, FontFamily } from "../../lib/design";

const TEAMS = ["CSK", "MI", "RCB", "KKR", "DC", "SRH", "PBKS", "GT", "LSG", "RR"];
const FORMATS = [
  { key: "salary_cap", label: "Salary Cap", icon: "cash-outline" as const, desc: "Build teams within a budget" },
  { key: "draft", label: "Draft", icon: "swap-horizontal-outline" as const, desc: "Take turns picking players" },
  { key: "prediction", label: "Prediction", icon: "analytics-outline" as const, desc: "Predict match outcomes" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [preferredFormat, setPreferredFormat] = useState<string | null>(null);

  const handleComplete = () => {
    router.replace("/(tabs)");
  };

  return (
    <View style={s.container}>
      <View style={s.progress}>
        {[0, 1].map((i) => (
          <View key={i} style={[s.dot, step >= i && s.dotActive]} />
        ))}
      </View>

      {step === 0 && (
        <View style={s.step}>
          <Text style={s.title}>Pick Your Team</Text>
          <Text style={s.subtitle}>Who do you support?</Text>
          <View style={s.grid}>
            {TEAMS.map((team) => (
              <Pressable
                key={team}
                onPress={() => setFavoriteTeam(team)}
                style={({ hovered }) => [
                  s.chip,
                  favoriteTeam === team && s.chipSelected,
                  hovered && { backgroundColor: Colors.bgSurfaceHover },
                ]}
              >
                <Text style={[s.chipText, favoriteTeam === team && s.chipTextSelected]}>{team}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            disabled={!favoriteTeam}
            onPress={() => setStep(1)}
            style={({ hovered }) => [s.nextBtn, !favoriteTeam && s.nextBtnDisabled, hovered && { opacity: 0.9 }]}
          >
            <Text style={s.nextBtnText}>Next</Text>
          </Pressable>
        </View>
      )}

      {step === 1 && (
        <View style={s.step}>
          <Text style={s.title}>Choose Your Style</Text>
          <Text style={s.subtitle}>How do you want to play?</Text>
          <View style={{ gap: 12 }}>
            {FORMATS.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => setPreferredFormat(f.key)}
                style={({ hovered }) => [
                  s.formatCard,
                  preferredFormat === f.key && s.formatSelected,
                  hovered && { backgroundColor: Colors.bgSurfaceHover },
                ]}
              >
                <View style={s.formatRow}>
                  <Ionicons name={f.icon} size={20} color={preferredFormat === f.key ? Colors.accent : Colors.textTertiary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.formatTitle, preferredFormat === f.key && { color: Colors.accent }]}>{f.label}</Text>
                    <Text style={s.formatDesc}>{f.desc}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
          <Pressable
            disabled={!preferredFormat}
            onPress={handleComplete}
            style={({ hovered }) => [s.nextBtn, !preferredFormat && s.nextBtnDisabled, hovered && { opacity: 0.9 }]}
          >
            <Text style={s.nextBtnText}>Let's Go</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing["2xl"], paddingTop: 60 },
  progress: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 40 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.accent, width: 24 },
  step: { flex: 1 },
  title: { fontFamily: FontFamily.headingBold, fontSize: Font["3xl"], color: Colors.text, marginBottom: 8 },
  subtitle: { fontFamily: FontFamily.body, fontSize: Font.lg, color: Colors.textTertiary, marginBottom: 32 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    backgroundColor: Colors.bgSurface, borderRadius: Radius.xl,
    paddingHorizontal: 20, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipSelected: { backgroundColor: Colors.accentMuted, borderColor: Colors.accent },
  chipText: { fontFamily: FontFamily.bodySemiBold, fontSize: Font.md, color: Colors.text },
  chipTextSelected: { color: Colors.accent },
  formatCard: {
    backgroundColor: Colors.bgSurface, borderRadius: Radius.md,
    padding: Spacing.xl, borderWidth: 2, borderColor: Colors.border,
  },
  formatSelected: { borderColor: Colors.accent, backgroundColor: Colors.accentMuted },
  formatRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  formatTitle: { fontFamily: FontFamily.headingBold, fontSize: Font.xl, color: Colors.text },
  formatDesc: { fontFamily: FontFamily.body, fontSize: Font.sm, color: Colors.textSecondary, marginTop: 2 },
  nextBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingVertical: Spacing.lg, alignItems: "center",
    marginTop: "auto", marginBottom: 32,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontFamily: FontFamily.headingBold, fontSize: Font.lg, color: Colors.textInverse },
});
