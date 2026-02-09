import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { trpc } from "../../lib/trpc";

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const match = trpc.match.getById.useQuery({ id: id! }, { enabled: !!id });
  const contests = trpc.contest.listByMatch.useQuery(
    { matchId: id! },
    { enabled: !!id }
  );
  const matchPlayers = trpc.player.getByMatch.useQuery(
    { matchId: id! },
    { enabled: !!id }
  );

  if (match.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#00F5A0" size="large" />
      </View>
    );
  }

  const m = match.data;
  if (!m) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Match not found</Text>
      </View>
    );
  }

  const isLive = m.status === "live";
  const isUpcoming = m.status === "upcoming";
  const startTime = new Date(m.startTime);
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
    <ScrollView style={styles.container}>
      {/* Match Header */}
      <View style={styles.matchHeader}>
        <View style={styles.headerBadgeRow}>
          <Text style={styles.tournament}>{m.tournament ?? "Cricket"}</Text>
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
        <View style={styles.teamsRow}>
          <View style={styles.teamCol}>
            <Text style={styles.teamName}>{m.teamHome}</Text>
          </View>
          <Text style={styles.vs}>VS</Text>
          <View style={styles.teamCol}>
            <Text style={styles.teamName}>{m.teamAway}</Text>
          </View>
        </View>
        <Text style={styles.venue}>{m.venue ?? ""}</Text>
        <Text style={styles.time}>
          {isLive ? "In Progress" : `${dateStr} at ${timeStr}`}
        </Text>
      </View>

      {/* Actions */}
      {isUpcoming && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              router.push(`/team/create?matchId=${id}&contestId=`)
            }
          >
            <Text style={styles.actionButtonText}>Build Team</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Contests for this match */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Contests ({contests.data?.length ?? 0})
        </Text>
        {contests.isLoading ? (
          <ActivityIndicator color="#00F5A0" />
        ) : contests.data && contests.data.length > 0 ? (
          contests.data.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.contestCard}
              onPress={() => router.push(`/contest/${c.id}`)}
            >
              <View style={styles.contestHeader}>
                <Text style={styles.contestName}>{c.name}</Text>
                <Text style={styles.contestType}>
                  {c.contestType?.toUpperCase()}
                </Text>
              </View>
              <View style={styles.contestDetails}>
                <View>
                  <Text style={styles.detailLabel}>Prize Pool</Text>
                  <Text style={styles.detailValue}>₹{c.prizePool}</Text>
                </View>
                <View>
                  <Text style={styles.detailLabel}>Entry</Text>
                  <Text style={styles.detailValue}>
                    {c.entryFee === 0 ? "FREE" : `₹${c.entryFee}`}
                  </Text>
                </View>
                <View>
                  <Text style={styles.detailLabel}>Spots</Text>
                  <Text style={styles.detailValue}>
                    {c.currentEntries}/{c.maxEntries}
                  </Text>
                </View>
              </View>
              {/* Fill bar */}
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
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              No contests available for this match yet
            </Text>
          </View>
        )}
      </View>

      {/* Players */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Players ({matchPlayers.data?.length ?? 0})
        </Text>
        {matchPlayers.isLoading ? (
          <ActivityIndicator color="#00F5A0" />
        ) : matchPlayers.data && matchPlayers.data.length > 0 ? (
          matchPlayers.data.map((ps) => (
            <TouchableOpacity
              key={ps.id}
              style={styles.playerRow}
              onPress={() =>
                router.push(`/player/${ps.player?.id ?? ps.playerId}`)
              }
            >
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>
                  {ps.player?.name ?? "Unknown"}
                </Text>
                <Text style={styles.playerMeta}>
                  {ps.player?.team} ·{" "}
                  {ps.player?.role?.replace("_", " ") ?? ""}
                </Text>
              </View>
              <View style={styles.playerPoints}>
                <Text style={styles.pointsValue}>
                  {Number(ps.fantasyPoints ?? 0).toFixed(1)}
                </Text>
                <Text style={styles.pointsLabel}>pts</Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              {isUpcoming
                ? "Playing XI announced ~30 min before toss"
                : "No player data available"}
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
    backgroundColor: "#0A1628",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0A1628",
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#FF4D4F",
    fontSize: 16,
  },
  matchHeader: {
    padding: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1A2332",
  },
  headerBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  tournament: {
    fontSize: 12,
    color: "#00F5A0",
    fontWeight: "600",
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
  liveDot: {
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
  time: {
    fontSize: 13,
    color: "#FFB800",
    marginTop: 4,
    fontWeight: "600",
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
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  contestCard: {
    backgroundColor: "#1A2332",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#243044",
  },
  contestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  contestName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  contestType: {
    fontSize: 10,
    color: "#FFB800",
    fontWeight: "700",
  },
  contestDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 11,
    color: "#6C757D",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 2,
  },
  fillBar: {
    height: 4,
    backgroundColor: "#243044",
    borderRadius: 2,
  },
  fillBarProgress: {
    height: 4,
    backgroundColor: "#00F5A0",
    borderRadius: 2,
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
  playerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1A2332",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#243044",
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  playerMeta: {
    fontSize: 12,
    color: "#6C757D",
    marginTop: 2,
    textTransform: "capitalize",
  },
  playerPoints: {
    alignItems: "center",
    marginLeft: 12,
  },
  pointsValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFB800",
  },
  pointsLabel: {
    fontSize: 10,
    color: "#6C757D",
  },
});
