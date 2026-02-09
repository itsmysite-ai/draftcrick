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
import { useTheme } from "../../providers/ThemeProvider";

export default function ContestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const styles = createStyles(t);

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
        <ActivityIndicator color={t.accent} size="large" />
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
    isLive ? t.red : c.status === "settled" ? t.accent : t.amber;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={t.accent}
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
          <ActivityIndicator color={t.accent} style={{ padding: 20 }} />
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
                    i === 0 && { color: t.amber },
                    i === 1 && { color: t.textSecondary },
                    i === 2 && { color: t.hatch },
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

const createStyles = (t: ReturnType<typeof import("../../providers/ThemeProvider").useTheme>["t"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    centerContainer: {
      flex: 1,
      backgroundColor: t.bg,
      justifyContent: "center",
      alignItems: "center",
    },
    errorText: {
      color: t.red,
      fontSize: 16,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: t.bgSurface,
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
      color: t.text,
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
      color: t.text,
      fontWeight: "600",
    },
    matchTournament: {
      fontSize: 12,
      color: t.accent,
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
      backgroundColor: t.bgSurface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    infoLabel: {
      fontSize: 11,
      color: t.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    infoValue: {
      fontSize: 18,
      fontWeight: "700",
      color: t.text,
      marginTop: 4,
    },
    fillBarContainer: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    fillBar: {
      height: 6,
      backgroundColor: t.border,
      borderRadius: 3,
    },
    fillBarProgress: {
      height: 6,
      backgroundColor: t.accent,
      borderRadius: 3,
    },
    fillBarText: {
      fontSize: 12,
      color: t.textTertiary,
      marginTop: 6,
      textAlign: "center",
    },
    joinSection: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    joinButton: {
      backgroundColor: t.accent,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
    },
    joinButtonText: {
      color: t.textInverse,
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
      color: t.text,
      marginBottom: 12,
    },
    prizeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: t.bgSurface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: t.border,
    },
    prizeRank: {
      fontSize: 14,
      fontWeight: "700",
      color: t.amber,
    },
    prizeAmount: {
      fontSize: 14,
      fontWeight: "700",
      color: t.text,
    },
    leaderboardRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.bgSurface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: t.border,
    },
    leaderboardRowTop: {
      borderColor: t.amberMuted,
    },
    rankBadge: {
      width: 36,
      alignItems: "center",
    },
    rankText: {
      fontSize: 14,
      fontWeight: "800",
      color: t.text,
    },
    leaderboardInfo: {
      flex: 1,
      marginLeft: 8,
    },
    leaderboardName: {
      fontSize: 14,
      fontWeight: "600",
      color: t.text,
    },
    leaderboardPoints: {
      fontSize: 14,
      fontWeight: "700",
      color: t.amber,
    },
    emptyLeaderboard: {
      backgroundColor: t.bgSurface,
      borderRadius: 12,
      padding: 24,
      alignItems: "center",
      borderWidth: 1,
      borderColor: t.border,
    },
    emptyText: {
      color: t.textTertiary,
      fontSize: 14,
      textAlign: "center",
    },
  });
