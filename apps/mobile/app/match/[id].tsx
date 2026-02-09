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
import { useTheme } from "../../providers/ThemeProvider";

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTheme();
  const styles = createStyles(t);

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
        <ActivityIndicator color={t.accent} size="large" />
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
          <ActivityIndicator color={t.accent} />
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
          <ActivityIndicator color={t.accent} />
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

const createStyles = (t: ReturnType<typeof import("../../providers/ThemeProvider").useTheme>["t"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: t.bg,
      justifyContent: "center",
      alignItems: "center",
    },
    errorText: {
      color: t.red,
      fontSize: 16,
    },
    matchHeader: {
      padding: 20,
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: t.bgSurface,
    },
    headerBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    tournament: {
      fontSize: 12,
      color: t.accent,
      fontWeight: "600",
    },
    liveBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.redMuted,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      gap: 5,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: t.red,
    },
    liveText: {
      fontSize: 10,
      fontWeight: "800",
      color: t.red,
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
      color: t.text,
    },
    vs: {
      fontSize: 14,
      color: t.textTertiary,
      fontWeight: "600",
    },
    venue: {
      fontSize: 13,
      color: t.textTertiary,
      marginTop: 12,
    },
    time: {
      fontSize: 13,
      color: t.amber,
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
      backgroundColor: t.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    actionButtonText: {
      color: t.textInverse,
      fontSize: 15,
      fontWeight: "700",
    },
    section: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: t.text,
      marginBottom: 12,
    },
    contestCard: {
      backgroundColor: t.bgSurface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: t.border,
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
      color: t.text,
    },
    contestType: {
      fontSize: 10,
      color: t.amber,
      fontWeight: "700",
    },
    contestDetails: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    detailLabel: {
      fontSize: 11,
      color: t.textTertiary,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: "700",
      color: t.text,
      marginTop: 2,
    },
    fillBar: {
      height: 4,
      backgroundColor: t.border,
      borderRadius: 2,
    },
    fillBarProgress: {
      height: 4,
      backgroundColor: t.accent,
      borderRadius: 2,
    },
    placeholder: {
      backgroundColor: t.bgSurface,
      borderRadius: 12,
      padding: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: t.border,
    },
    placeholderText: {
      color: t.textTertiary,
      fontSize: 14,
      textAlign: "center",
    },
    playerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: t.bgSurface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: t.border,
    },
    playerInfo: {
      flex: 1,
    },
    playerName: {
      fontSize: 14,
      fontWeight: "600",
      color: t.text,
    },
    playerMeta: {
      fontSize: 12,
      color: t.textTertiary,
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
      color: t.amber,
    },
    pointsLabel: {
      fontSize: 10,
      color: t.textTertiary,
    },
  });
