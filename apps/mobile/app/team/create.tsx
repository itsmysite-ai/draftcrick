import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

/**
 * Team Builder — salary cap mode.
 * Pick 11 players within budget, set captain/VC.
 */
export default function TeamBuilderScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [selectedTab, setSelectedTab] = useState<string>("WK");

  const tabs = ["WK", "BAT", "AR", "BOWL"];

  return (
    <View style={styles.container}>
      {/* Budget bar */}
      <View style={styles.budgetBar}>
        <View>
          <Text style={styles.budgetLabel}>Credits Remaining</Text>
          <Text style={styles.budgetValue}>100.0</Text>
        </View>
        <View>
          <Text style={styles.budgetLabel}>Players</Text>
          <Text style={styles.budgetValue}>0/11</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: "0%" }]} />
      </View>

      {/* Role tabs */}
      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, selectedTab === tab && styles.tabActive]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === tab && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Player list */}
      <ScrollView style={styles.playerList}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            Connect to API to load players
          </Text>
          <Text style={styles.emptySubtitle}>
            Players for this match will appear here with their credits, form,
            and AI projections
          </Text>
        </View>
      </ScrollView>

      {/* AI Auto-Pick FAB */}
      <TouchableOpacity style={styles.autoPickButton}>
        <Text style={styles.autoPickText}>Auto Pick</Text>
      </TouchableOpacity>

      {/* Submit button */}
      <TouchableOpacity style={styles.submitButton} disabled>
        <Text style={styles.submitText}>Select 11 Players</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1628",
  },
  budgetBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#1A2332",
    borderBottomWidth: 1,
    borderBottomColor: "#243044",
  },
  budgetLabel: {
    fontSize: 11,
    color: "#6C757D",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  budgetValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  progressBar: {
    height: 4,
    backgroundColor: "#243044",
  },
  progressFill: {
    height: 4,
    backgroundColor: "#00F5A0",
    borderRadius: 2,
  },
  tabs: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#1A2332",
  },
  tabActive: {
    backgroundColor: "#00F5A0",
  },
  tabText: {
    color: "#ADB5BD",
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#0A1628",
  },
  playerList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    backgroundColor: "#1A2332",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#243044",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#6C757D",
    textAlign: "center",
    lineHeight: 20,
  },
  autoPickButton: {
    position: "absolute",
    right: 16,
    bottom: 80,
    backgroundColor: "#FFB800",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  autoPickText: {
    color: "#0A1628",
    fontSize: 14,
    fontWeight: "700",
  },
  submitButton: {
    backgroundColor: "#00F5A0",
    margin: 16,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    opacity: 0.4,
  },
  submitText: {
    color: "#0A1628",
    fontSize: 16,
    fontWeight: "700",
  },
});
