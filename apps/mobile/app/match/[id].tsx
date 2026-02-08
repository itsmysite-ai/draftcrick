import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

/**
 * Match Center — shows match details, scorecard, and contest options.
 */
export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      {/* Match Header */}
      <View style={styles.matchHeader}>
        <Text style={styles.tournament}>IPL 2026</Text>
        <View style={styles.teamsRow}>
          <View style={styles.teamCol}>
            <Text style={styles.teamName}>TBD</Text>
          </View>
          <Text style={styles.vs}>VS</Text>
          <View style={styles.teamCol}>
            <Text style={styles.teamName}>TBD</Text>
          </View>
        </View>
        <Text style={styles.venue}>Venue loading...</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/team/create?matchId=${id}`)}
        >
          <Text style={styles.actionButtonText}>Build Team</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButtonSecondary}>
          <Text style={styles.actionButtonSecondaryText}>View Contests</Text>
        </TouchableOpacity>
      </View>

      {/* Placeholder sections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scorecard</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Live scorecard will appear here during the match
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Playing XI</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Playing XI announced ~30 min before toss
          </Text>
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
  matchHeader: {
    padding: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1A2332",
  },
  tournament: {
    fontSize: 12,
    color: "#00F5A0",
    fontWeight: "600",
    marginBottom: 12,
  },
  teamsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  teamCol: {
    alignItems: "center",
    flex: 1,
  },
  teamName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  vs: {
    fontSize: 14,
    color: "#6C757D",
    fontWeight: "600",
  },
  venue: {
    fontSize: 13,
    color: "#6C757D",
    marginTop: 12,
  },
  actions: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#00F5A0",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#0A1628",
    fontSize: 15,
    fontWeight: "700",
  },
  actionButtonSecondary: {
    flex: 1,
    backgroundColor: "#1A2332",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#243044",
  },
  actionButtonSecondaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  placeholder: {
    backgroundColor: "#1A2332",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#243044",
  },
  placeholderText: {
    color: "#6C757D",
    fontSize: 14,
    textAlign: "center",
  },
});
