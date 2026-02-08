import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useComfortMode } from "../../providers/ComfortModeProvider";

const BG = "#0A1628";
const CARD = "#1A2332";
const ACCENT = "#00F5A0";
const TEXT_COLOR = "#FFFFFF";
const MUTED = "#ADB5BD";
const BORDER = "#243044";

const FAQ = [
  {
    q: "What is fantasy cricket?",
    a: "Pick real cricket players to form your team. Score points based on how they play in real matches.",
  },
  {
    q: "What is a captain?",
    a: "Your captain earns double points. Choose your best player as captain!",
  },
  {
    q: "How do I join a contest?",
    a: "Go to Home, pick a match, and tap 'Play Now' to join a contest.",
  },
  {
    q: "What is a league?",
    a: "A league is a private group where you play with friends over multiple matches. You can create one or join with an invite code.",
  },
  {
    q: "How do I switch to the full app?",
    a: "Tap the 'Switch to Full Experience' button below. You can always come back to Comfort Mode from the Profile tab.",
  },
];

export default function ComfortHelpScreen() {
  const router = useRouter();
  const { disable } = useComfortMode();

  const handleSwitchToStandard = () => {
    disable();
    router.replace("/(tabs)" as any);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 24 }}>
      <Text style={{ fontSize: 28, fontWeight: "800", color: TEXT_COLOR, marginBottom: 8 }}>
        Help
      </Text>
      <Text style={{ fontSize: 18, color: MUTED, lineHeight: 26, marginBottom: 24 }}>
        Need help? Ask our Cricket Guru or browse common questions below.
      </Text>

      {/* Ask Guru button */}
      <Pressable
        onPress={() => router.push("/guru" as any)}
        style={{
          backgroundColor: ACCENT, borderRadius: 16, padding: 24, marginBottom: 32,
        }}
      >
        <Text style={{ color: BG, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>
          Ask Cricket Guru
        </Text>
        <Text style={{ color: BG, fontSize: 16, opacity: 0.7 }}>
          Get instant answers about cricket and fantasy
        </Text>
      </Pressable>

      {/* FAQ */}
      <Text style={{ fontSize: 20, fontWeight: "700", color: TEXT_COLOR, marginBottom: 12 }}>
        Common Questions
      </Text>
      {FAQ.map((faq) => (
        <View key={faq.q} style={{
          backgroundColor: CARD, borderRadius: 14, padding: 20, marginBottom: 12,
          borderWidth: 1, borderColor: BORDER,
        }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: TEXT_COLOR, marginBottom: 8 }}>
            {faq.q}
          </Text>
          <Text style={{ fontSize: 16, color: MUTED, lineHeight: 24 }}>
            {faq.a}
          </Text>
        </View>
      ))}

      {/* Switch to standard mode */}
      <View style={{ marginTop: 24, marginBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: TEXT_COLOR, marginBottom: 8 }}>
          Want more features?
        </Text>
        <Pressable
          onPress={handleSwitchToStandard}
          style={{
            backgroundColor: CARD, borderRadius: 16, padding: 20, alignItems: "center",
            borderWidth: 2, borderColor: ACCENT,
          }}
        >
          <Text style={{ color: ACCENT, fontSize: 18, fontWeight: "800" }}>
            Switch to Full Experience
          </Text>
          <Text style={{ color: MUTED, fontSize: 14, marginTop: 4 }}>
            Access all 5 tabs, leagues, drafts, and more
          </Text>
        </Pressable>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}
