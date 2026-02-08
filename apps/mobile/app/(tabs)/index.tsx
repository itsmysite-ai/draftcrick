import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { trpc } from "../../lib/trpc";

function MatchCard({
  match,
  onPress,
}: {
  match: {
    id: string;
    teamHome: string;
    teamAway: string;
    venue: string | null;
    startTime: Date | string;
    status: string;
    tournament: string | null;
  };
  onPress: () => void;
}) {
  const startTime = new Date(match.startTime);
  const isLive = match.status === "live";
  const timeStr = startTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const dateStr = startTime.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <TouchableOpacity style={styles.matchCard} onPress={onPress}>
      <View style={styles.matchCardHeader}>
        <Text style={styles.matchTournament}>
          {match.tournament ?? "Cricket"}
        </Text>
        {isLive && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDotSmall} />
            <Text style={styles.liveTextSmall}>LIVE</Text>
          </View>
        )}
      </View>
      <View style={styles.matchTeams}>
        <View style={styles.matchTeamCol}>
          <Text style={styles.matchTeamName}>{match.teamHome}</Text>
        </View>
        <Text style={styles.matchVs}>VS</Text>
        <View style={styles.matchTeamCol}>
          <Text style={styles.matchTeamName}>{match.teamAway}</Text>
        </View>
      </View>
      <View style={styles.matchFooter}>
        <Text style={styles.matchVenue} numberOfLines={1}>
          {match.venue ?? ""}
        </Text>
        <Text style={styles.matchTime}>
          {isLive ? "In Progress" : `${dateStr} ${timeStr}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const liveMatches = trpc.match.live.useQuery();
  const upcomingMatches = trpc.match.list.useQuery({
    status: "upcoming",
    limit: 10,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([liveMatches.refetch(), upcomingMatches.refetch()]);
    setRefreshing(false);
  }, [liveMatches, upcomingMatches]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#00F5A0"
        />
      }
    >
      {/* Welcome header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi there!</Text>
        <Text style={styles.subtitle}>Ready for some cricket?</Text>
      </View>

      {/* Live Now section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Live Now</Text>
        {liveMatches.isLoading ? (
          <ActivityIndicator color="#00F5A0" style={{ padding: 20 }} />
        ) : liveMatches.data && liveMatches.data.length > 0 ? (
          liveMatches.data.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onPress={() => router.push(`/match/${match.id}`)}
            />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No live matches right now</Text>
            <Text style={styles.emptySubtext}>
              Check back during match time for live scoring
            </Text>
          </View>
        )}
      </View>

      {/* Upcoming Matches */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Matches</Text>
        {upcomingMatches.isLoading ? (
          <ActivityIndicator color="#00F5A0" style={{ padding: 20 }} />
        ) : upcomingMatches.data?.matches &&
          upcomingMatches.data.matches.length > 0 ? (
          upcomingMatches.data.matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onPress={() => router.push(`/match/${match.id}`)}
            />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No upcoming matches</Text>
            <Text style={styles.emptySubtext}>
              New matches will appear here when scheduled
            </Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(tabs)/contests")}
          >
            <Text style={styles.actionEmoji}>🎯</Text>
            <Text style={styles.actionText}>My Contests</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/wallet" as never)}
          >
            <Text style={styles.actionEmoji}>💰</Text>
            <Text style={styles.actionText}>Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(tabs)/live")}
          >
            <Text style={styles.actionEmoji}>📡</Text>
            <Text style={styles.actionText}>Live Scores</Text>
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
  matchCard: {
    backgroundColor: "#1A2332",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#243044",
  },
  matchCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  matchTournament: {
    fontSize: 11,
    color: "#00F5A0",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 77, 79, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 5,
  },
  liveDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF4D4F",
  },
  liveTextSmall: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FF4D4F",
  },
  matchTeams: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 12,
  },
  matchTeamCol: {
    flex: 1,
    alignItems: "center",
  },
  matchTeamName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  matchVs: {
    fontSize: 12,
    color: "#6C757D",
    fontWeight: "600",
  },
  matchFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matchVenue: {
    fontSize: 12,
    color: "#6C757D",
    flex: 1,
  },
  matchTime: {
    fontSize: 12,
    color: "#FFB800",
    fontWeight: "600",
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
