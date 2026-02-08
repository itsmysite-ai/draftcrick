import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { trpc } from "../../lib/trpc";

export default function ContestsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const myContests = trpc.contest.myContests.useQuery(undefined, {
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await myContests.refetch();
    setRefreshing(false);
  }, [myContests]);

  // Not authenticated — show sign-in prompt
  if (myContests.error?.data?.code === "UNAUTHORIZED") {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>My Contests</Text>
          <Text style={styles.emptySubtitle}>
            Sign in to view your contests
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push("/auth/login")}
          >
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (myContests.isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#00F5A0" size="large" />
      </View>
    );
  }

  const data = myContests.data ?? [];

  if (data.length === 0) {
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

  return (
    <View style={[styles.container, { justifyContent: "flex-start" }]}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00F5A0"
          />
        }
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const contest = item.contest;
          const match = contest?.match;
          const statusColor =
            contest?.status === "live"
              ? "#FF4D4F"
              : contest?.status === "settled"
                ? "#00F5A0"
                : "#FFB800";

          return (
            <TouchableOpacity
              style={styles.contestCard}
              onPress={() =>
                contest ? router.push(`/contest/${contest.id}`) : undefined
              }
            >
              <View style={styles.contestHeader}>
                <Text style={styles.contestName}>
                  {contest?.name ?? "Contest"}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: `${statusColor}20` },
                  ]}
                >
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {contest?.status?.toUpperCase() ?? "OPEN"}
                  </Text>
                </View>
              </View>

              {match && (
                <Text style={styles.matchInfo}>
                  {match.teamHome} vs {match.teamAway}
                </Text>
              )}

              <View style={styles.contestFooter}>
                <View>
                  <Text style={styles.footerLabel}>Your Points</Text>
                  <Text style={styles.footerValue}>
                    {item.totalPoints.toFixed(1)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.footerLabel}>Prize Pool</Text>
                  <Text style={styles.footerValue}>
                    {contest ? `₹${contest.prizePool}` : "-"}
                  </Text>
                </View>
                <View>
                  <Text style={styles.footerLabel}>Entry</Text>
                  <Text style={styles.footerValue}>
                    {contest
                      ? contest.entryFee === 0
                        ? "FREE"
                        : `₹${contest.entryFee}`
                      : "-"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A1628",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    padding: 20,
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
  signInButton: {
    backgroundColor: "#00F5A0",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  signInText: {
    color: "#0A1628",
    fontSize: 15,
    fontWeight: "700",
  },
  contestCard: {
    backgroundColor: "#1A2332",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#243044",
  },
  contestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  contestName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  matchInfo: {
    fontSize: 13,
    color: "#6C757D",
    marginBottom: 12,
  },
  contestFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#243044",
    paddingTop: 12,
  },
  footerLabel: {
    fontSize: 11,
    color: "#6C757D",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  footerValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 2,
  },
});
