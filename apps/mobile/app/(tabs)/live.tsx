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

export default function LiveScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const liveMatches = trpc.match.live.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await liveMatches.refetch();
    setRefreshing(false);
  }, [liveMatches]);

  if (liveMatches.isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#00F5A0" size="large" />
      </View>
    );
  }

  const data = liveMatches.data ?? [];

  if (data.length === 0) {
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
        ListHeaderComponent={
          <View style={styles.liveHeader}>
            <View style={styles.liveDotAnimated} />
            <Text style={styles.liveHeaderText}>
              {data.length} Live Match{data.length !== 1 ? "es" : ""}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.matchCard}
            onPress={() => router.push(`/match/${item.id}`)}
          >
            <View style={styles.matchCardHeader}>
              <Text style={styles.tournament}>
                {item.tournament ?? "Cricket"}
              </Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDotSmall} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <View style={styles.matchTeams}>
              <View style={styles.teamCol}>
                <Text style={styles.teamName}>{item.teamHome}</Text>
                {item.result && (
                  <Text style={styles.score}>
                    {item.result}
                  </Text>
                )}
              </View>
              <Text style={styles.vs}>VS</Text>
              <View style={styles.teamCol}>
                <Text style={styles.teamName}>{item.teamAway}</Text>
              </View>
            </View>
            <Text style={styles.venue}>{item.venue ?? ""}</Text>
          </TouchableOpacity>
        )}
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
    paddingHorizontal: 20,
  },
  liveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  liveDotAnimated: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF4D4F",
  },
  liveHeaderText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  matchCard: {
    backgroundColor: "#1A2332",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FF4D4F30",
  },
  matchCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tournament: {
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
  liveText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FF4D4F",
  },
  matchTeams: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 8,
  },
  teamCol: {
    flex: 1,
    alignItems: "center",
  },
  teamName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  score: {
    fontSize: 14,
    color: "#FFB800",
    fontWeight: "600",
    marginTop: 4,
  },
  vs: {
    fontSize: 12,
    color: "#6C757D",
    fontWeight: "600",
  },
  venue: {
    fontSize: 12,
    color: "#6C757D",
    textAlign: "center",
  },
});
