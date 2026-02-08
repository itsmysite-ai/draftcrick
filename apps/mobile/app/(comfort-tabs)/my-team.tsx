import { View, Text, StyleSheet } from "react-native";

export default function ComfortMyTeamScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Team</Text>
      <Text style={styles.subtitle}>
        Your team will appear here once you create one
      </Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>
          1. Pick 11 players from two teams{"\n"}
          2. Choose a captain for double points{"\n"}
          3. Watch them score as the match plays
        </Text>
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
    marginBottom: 32,
  },
  infoCard: {
    backgroundColor: "#1A2332",
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: "#243044",
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#00F5A0",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 18,
    color: "#FFFFFF",
    lineHeight: 30,
  },
});
