import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { trpc } from "../../lib/trpc";

export default function ContestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const contest = trpc.contest.getById.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const standings = trpc.contest.getStandings.useQuery(
    { contestId: id! },
    { enabled: !!id }
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([contest.refetch(), standings.refetch()]);
    setRefreshing(false);
  }, [contest, standings]);

  if (contest.isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color="#5DB882" size="large" />
      </View>
    );
  }

  const c = contest.data;
  if (!c) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Contest not found</Text>
      </View>
    );
  }

  const match = c.match;
  const isOpen = c.status === "open";
  const isLive = c.status === "live";
  const statusColor =
    isLive ? "#E5484D" : c.status === "settled" ? "#5DB882" : "#D4A43D";

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#5DB882"
        />
      }
    >
      {/* Contest Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.contestName}>{c.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {c.status?.toUpperCase()}
            </Text>
          </View>
        </View>

        {match && (
          <View style={styles.matchRow}>
            <Text style={styles.matchTeams}>
              {match.teamHome} vs {match.teamAway}
            </Text>
            <Text style={styles.matchTournament}>
              {match.tournament ?? "Cricket"}
            </Text>
          </View>
        )}
      </View>

      {/* Contest Info */}
      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Prize Pool</Text>
          <Text style={styles.infoValue}>₹{c.prizePool}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Entry Fee</Text>
          <Text style={styles.infoValue}>
            {c.entryFee === 0 ? "FREE" : `₹${c.entryFee}`}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Spots</Text>
          <Text style={styles.infoValue}>
            {c.currentEntries}/{c.maxEntries}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Type</Text>
          <Text style={styles.infoValue}>
            {c.contestType?.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Spots Fill Bar */}
      <View style={styles.fillBarContainer}>
        <View style={styles.fillBar}>
          <View
            style={[
              styles.fillBarProgress,
              {
                width: `${Math.min(100, (c.currentEntries / c.maxEntries) * 100)}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.fillBarText}>
          {c.maxEntries - c.currentEntries} spots left
        </Text>
      </View>

      {/* Join Button */}
      {isOpen && (
        <View style={styles.joinSection}>
          <TouchableOpacity
            style={styles.joinButton}
            onPress={() => {
              if (match) {
                router.push(
                  `/team/create?matchId=${match.id}&contestId=${c.id}`
                );
              }
            }}
          >
            <Text style={styles.joinButtonText}>
              {c.entryFee === 0 ? "Join Free" : `Join ₹${c.entryFee}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Prize Distribution */}
      {c.prizeDistribution &&
        Array.isArray(c.prizeDistribution) &&
        (c.prizeDistribution as Array<{ rank: number; amount: number }>).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prize Distribution</Text>
          {(c.prizeDistribution as Array<{ rank: number; amount: number }>).map(
            (prize, i) => (
              <View key={i} style={styles.prizeRow}>
                <Text style={styles.prizeRank}>#{prize.rank}</Text>
                <Text style={styles.prizeAmount}>₹{prize.amount}</Text>
              </View>
            )
          )}
        </View>
      )}

      {/* Leaderboard */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Leaderboard</Text>
        {standings.isLoading ? (
          <ActivityIndicator color="#5DB882" style={{ padding: 20 }} />
        ) : standings.data && standings.data.length > 0 ? (
          standings.data.map((entry: { rank: number; userId: string; totalPoints: number }, i: number) => (
            <View
              key={entry.userId}
              style={[
                styles.leaderboardRow,
                i < 3 && styles.leaderboardRowTop,
              ]}
            >
              <View style={styles.rankBadge}>
                <Text
                  style={[
                    styles.rankText,
                    i === 0 && { color: "#D4A43D" },
                    i === 1 && { color: "#C0C0C0" },
                    i === 2 && { color: "#CD7F32" },
                  ]}
                >
                  #{entry.rank}
                </Text>
              </View>
              <View style={styles.leaderboardInfo}>
                <Text style={styles.leaderboardName}>
                  Player {entry.userId.slice(0, 8)}
                </Text>
              </View>
              <Text style={styles.leaderboardPoints}>
                {entry.totalPoints.toFixed(1)} pts
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyLeaderboard}>
            <Text style={styles.emptyText}>
              {isOpen
                ? "Leaderboard will appear once the match starts"
                : "No entries yet"}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111210",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#111210",
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#E5484D",
    fontSize: 16,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1C1D1B",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  contestName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#EDECEA",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  matchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matchTeams: {
    fontSize: 14,
    color: "#EDECEA",
    fontWeight: "600",
  },
  matchTournament: {
    fontSize: 12,
    color: "#5DB882",
    fontWeight: "600",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 12,
  },
  infoItem: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#1C1D1B",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#333432",
  },
  infoLabel: {
    fontSize: 11,
    color: "#5E5D5A",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#EDECEA",
    marginTop: 4,
  },
  fillBarContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  fillBar: {
    height: 6,
    backgroundColor: "#333432",
    borderRadius: 3,
  },
  fillBarProgress: {
    height: 6,
    backgroundColor: "#5DB882",
    borderRadius: 3,
  },
  fillBarText: {
    fontSize: 12,
    color: "#5E5D5A",
    marginTop: 6,
    textAlign: "center",
  },
  joinSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  joinButton: {
    backgroundColor: "#5DB882",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  joinButtonText: {
    color: "#111210",
    fontSize: 16,
    fontWeight: "700",
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#EDECEA",
    marginBottom: 12,
  },
  prizeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1C1D1B",
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#333432",
  },
  prizeRank: {
    fontSize: 14,
    fontWeight: "700",
    color: "#D4A43D",
  },
  prizeAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#EDECEA",
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1D1B",
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#333432",
  },
  leaderboardRowTop: {
    borderColor: "rgba(212, 164, 61, 0.25)",
  },
  rankBadge: {
    width: 36,
    alignItems: "center",
  },
  rankText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#EDECEA",
  },
  leaderboardInfo: {
    flex: 1,
    marginLeft: 8,
  },
  leaderboardName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EDECEA",
  },
  leaderboardPoints: {
    fontSize: 14,
    fontWeight: "700",
    color: "#D4A43D",
  },
  emptyLeaderboard: {
    backgroundColor: "#1C1D1B",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333432",
  },
  emptyText: {
    color: "#5E5D5A",
    fontSize: 14,
    textAlign: "center",
  },
});
