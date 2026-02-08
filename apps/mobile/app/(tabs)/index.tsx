import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

/**
 * Home screen — shows live matches, upcoming matches, and quick actions.
 */
export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      {/* Welcome header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi there!</Text>
        <Text style={styles.subtitle}>Ready for some cricket?</Text>
      </View>

      {/* Live Now section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Live Now</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No live matches right now</Text>
          <Text style={styles.emptySubtext}>
            Check back during match time for live scoring
          </Text>
        </View>
      </View>

      {/* Upcoming Matches */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Matches</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Matches loading...</Text>
          <Text style={styles.emptySubtext}>
            Connect to the API to see upcoming matches
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/contest/create" as never)}
          >
            <Text style={styles.actionEmoji}>🎯</Text>
            <Text style={styles.actionText}>Join Contest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/predict" as never)}
          >
            <Text style={styles.actionEmoji}>🔮</Text>
            <Text style={styles.actionText}>Predict</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/draft" as never)}
          >
            <Text style={styles.actionEmoji}>🎙️</Text>
            <Text style={styles.actionText}>Draft Room</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/guru" as never)}
          >
            <Text style={styles.actionEmoji}>🏏</Text>
            <Text style={styles.actionText}>Cricket Guru</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1628",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 15,
    color: "#6C757D",
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: "#1A2332",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#243044",
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  emptySubtext: {
    color: "#6C757D",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    backgroundColor: "#1A2332",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    width: "47%",
    borderWidth: 1,
    borderColor: "#243044",
  },
  actionEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
