import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";

const TEAMS = ["CSK", "MI", "RCB", "KKR", "DC", "SRH", "PBKS", "GT", "LSG", "RR"];
const FORMATS = ["Salary Cap", "Draft", "Prediction"];

/**
 * 3-step onboarding wizard:
 * 1. Pick favorite team
 * 2. Choose format preference
 * 3. Choose experience mode (Full / Comfort)
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [preferredFormat, setPreferredFormat] = useState<string | null>(null);

  const handleComplete = (mode: "full" | "comfort") => {
    // Save preferences and navigate
    router.replace(mode === "comfort" ? "/(comfort-tabs)" : "/(tabs)");
  };

  return (
    <View style={styles.container}>
      {/* Progress indicator */}
      <View style={styles.progress}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[styles.progressDot, step >= i && styles.progressDotActive]}
          />
        ))}
      </View>

      {step === 0 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Pick Your Team</Text>
          <Text style={styles.stepSubtitle}>Who do you support?</Text>
          <View style={styles.optionsGrid}>
            {TEAMS.map((team) => (
              <TouchableOpacity
                key={team}
                style={[
                  styles.optionChip,
                  favoriteTeam === team && styles.optionChipSelected,
                ]}
                onPress={() => setFavoriteTeam(team)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    favoriteTeam === team && styles.optionChipTextSelected,
                  ]}
                >
                  {team}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.nextButton, !favoriteTeam && styles.nextButtonDisabled]}
            disabled={!favoriteTeam}
            onPress={() => setStep(1)}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 1 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Choose Your Style</Text>
          <Text style={styles.stepSubtitle}>How do you want to play?</Text>
          <View style={styles.formatOptions}>
            {FORMATS.map((format) => (
              <TouchableOpacity
                key={format}
                style={[
                  styles.formatCard,
                  preferredFormat === format && styles.formatCardSelected,
                ]}
                onPress={() => setPreferredFormat(format)}
              >
                <Text style={styles.formatTitle}>{format}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.nextButton, !preferredFormat && styles.nextButtonDisabled]}
            disabled={!preferredFormat}
            onPress={() => setStep(2)}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>How do you want to play?</Text>
          <Text style={styles.stepSubtitle}>
            You can switch anytime in Settings
          </Text>

          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => handleComplete("full")}
          >
            <Text style={styles.modeTitle}>Full Experience</Text>
            <Text style={styles.modeDescription}>
              All features, detailed stats, advanced customization
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, styles.comfortModeCard]}
            onPress={() => handleComplete("comfort")}
          >
            <Text style={[styles.modeTitle, styles.comfortModeTitle]}>
              Comfort Mode
            </Text>
            <Text style={styles.modeDescription}>
              Simpler layout, larger text, voice guidance, plain language
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1628",
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  progress: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 40,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#243044",
  },
  progressDotActive: {
    backgroundColor: "#00F5A0",
    width: 24,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: "#6C757D",
    marginBottom: 32,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionChip: {
    backgroundColor: "#1A2332",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#243044",
  },
  optionChipSelected: {
    backgroundColor: "rgba(0, 245, 160, 0.15)",
    borderColor: "#00F5A0",
  },
  optionChipText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  optionChipTextSelected: {
    color: "#00F5A0",
  },
  formatOptions: {
    gap: 12,
  },
  formatCard: {
    backgroundColor: "#1A2332",
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "#243044",
  },
  formatCardSelected: {
    borderColor: "#00F5A0",
    backgroundColor: "rgba(0, 245, 160, 0.08)",
  },
  formatTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  nextButton: {
    backgroundColor: "#00F5A0",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: "auto",
    marginBottom: 32,
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    color: "#0A1628",
    fontSize: 16,
    fontWeight: "700",
  },
  modeCard: {
    backgroundColor: "#1A2332",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#243044",
  },
  comfortModeCard: {
    borderColor: "#00F5A0",
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  comfortModeTitle: {
    color: "#00F5A0",
  },
  modeDescription: {
    fontSize: 15,
    color: "#ADB5BD",
    lineHeight: 22,
  },
});
