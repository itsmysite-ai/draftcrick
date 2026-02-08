import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function ComfortHelpScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Help</Text>
      <Text style={styles.subtitle}>
        Need help? Ask our Cricket Guru or browse common questions
      </Text>

      {/* Ask Guru button */}
      <TouchableOpacity
        style={styles.guruButton}
        onPress={() => router.push("/guru" as never)}
      >
        <Text style={styles.guruButtonText}>Ask Cricket Guru</Text>
        <Text style={styles.guruButtonSubtext}>
          Get instant answers about cricket and fantasy
        </Text>
      </TouchableOpacity>

      {/* FAQ */}
      <View style={styles.faqSection}>
        <Text style={styles.faqTitle}>Common Questions</Text>

        {[
          { q: "What is fantasy cricket?", a: "Pick real cricket players to form your team. Score points based on how they play in real matches." },
          { q: "What is a captain?", a: "Your captain earns double points. Choose your best player!" },
          { q: "How do I join a contest?", a: "Go to Home, pick a match, and tap 'Play Now' to join." },
        ].map((faq) => (
          <View key={faq.q} style={styles.faqItem}>
            <Text style={styles.faqQuestion}>{faq.q}</Text>
            <Text style={styles.faqAnswer}>{faq.a}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1628",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#ADB5BD",
    lineHeight: 26,
    marginBottom: 24,
  },
  guruButton: {
    backgroundColor: "#00F5A0",
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
  },
  guruButtonText: {
    color: "#0A1628",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  guruButtonSubtext: {
    color: "#0A1628",
    fontSize: 16,
    opacity: 0.7,
  },
  faqSection: {
    gap: 12,
  },
  faqTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  faqItem: {
    backgroundColor: "#1A2332",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#243044",
  },
  faqQuestion: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 16,
    color: "#ADB5BD",
    lineHeight: 24,
  },
});
