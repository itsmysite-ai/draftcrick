import { View, Text, StyleSheet } from "react-native";

export default function ContestsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>My Contests</Text>
        <Text style={styles.emptySubtitle}>
          You haven't joined any contests yet
        </Text>
        <Text style={styles.emptyAction}>
          Browse upcoming matches to find contests to join
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
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#6C757D",
    marginBottom: 4,
  },
  emptyAction: {
    fontSize: 13,
    color: "#00F5A0",
  },
});
