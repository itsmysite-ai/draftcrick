import { View, Text, StyleSheet } from "react-native";

export default function LiveScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.emptyState}>
        <View style={styles.liveDot} />
        <Text style={styles.title}>Live Matches</Text>
        <Text style={styles.subtitle}>No matches are live right now</Text>
        <Text style={styles.subtext}>
          Live scoring updates every 5-10 seconds during matches
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1628",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyState: {
    alignItems: "center",
  },
  liveDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF4D4F",
    marginBottom: 16,
    opacity: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6C757D",
    marginBottom: 4,
  },
  subtext: {
    fontSize: 13,
    color: "#6C757D",
    textAlign: "center",
  },
});
