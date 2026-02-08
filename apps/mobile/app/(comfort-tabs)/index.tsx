import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

/**
 * Comfort Mode Home — simplified with larger text and fewer options.
 * Shows: next match, your team status, and one clear action.
 */
export default function ComfortHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Welcome!</Text>
      <Text style={styles.subtitle}>Here's what's happening in cricket today</Text>

      {/* Next Match Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Next Match</Text>
        <Text style={styles.cardSubtitle}>
          No upcoming matches to show right now
        </Text>
      </View>

      {/* Your Team Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Team</Text>
        <Text style={styles.cardSubtitle}>
          You haven't created a team yet
        </Text>
      </View>

      {/* Main action */}
      <TouchableOpacity style={styles.actionButton}>
        <Text style={styles.actionButtonText}>Play Now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1628",
    padding: 24,
  },
  greeting: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: "#ADB5BD",
    marginBottom: 32,
    lineHeight: 26,
  },
  card: {
    backgroundColor: "#1A2332",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#243044",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 16,
    color: "#ADB5BD",
    lineHeight: 24,
  },
  actionButton: {
    backgroundColor: "#00F5A0",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 16,
    // 56px height - meets comfort mode 48px+ target
  },
  actionButtonText: {
    color: "#0A1628",
    fontSize: 20,
    fontWeight: "800",
  },
});
