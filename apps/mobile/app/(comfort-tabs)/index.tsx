import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "../../lib/trpc";

const BG = "#0A1628";
const CARD = "#1A2332";
const ACCENT = "#00F5A0";
const TEXT_COLOR = "#FFFFFF";
const MUTED = "#ADB5BD";
const BORDER = "#243044";

/**
 * Comfort Mode Home — simplified with larger text, fewer options, AAA contrast.
 * Shows: next match, your rank, one clear action.
 */
export default function ComfortHomeScreen() {
  const router = useRouter();
  const liveMatches = trpc.match.live.useQuery(undefined, { retry: false });
  const upcomingMatches = trpc.match.list.useQuery(
    { status: "upcoming", limit: 3 },
    { retry: false }
  );

  const nextMatch =
    (liveMatches.data && liveMatches.data.length > 0
      ? liveMatches.data[0]
      : upcomingMatches.data?.matches?.[0]) ?? null;

  const isLive = nextMatch?.status === "live";
  const isLoading = liveMatches.isLoading || upcomingMatches.isLoading;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 24 }}>
      <Text style={{ fontSize: 32, fontWeight: "800", color: TEXT_COLOR, marginBottom: 4 }}>
        Welcome!
      </Text>
      <Text style={{ fontSize: 18, color: MUTED, marginBottom: 32, lineHeight: 26 }}>
        Here's what's happening in cricket today
      </Text>

      {/* Next Match Card */}
      <View style={{
        backgroundColor: CARD, borderRadius: 16, padding: 24, marginBottom: 16,
        borderWidth: 2, borderColor: BORDER,
      }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: TEXT_COLOR, marginBottom: 8 }}>
          Next Match
        </Text>
        {isLoading ? (
          <ActivityIndicator color={ACCENT} style={{ padding: 12 }} />
        ) : nextMatch ? (
          <Pressable onPress={() => router.push(`/match/${nextMatch.id}` as any)}>
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16, marginVertical: 8 }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: TEXT_COLOR, flex: 1, textAlign: "center" }}>
                {nextMatch.teamHome}
              </Text>
              <Text style={{ fontSize: 16, color: MUTED, fontWeight: "600" }}>VS</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: TEXT_COLOR, flex: 1, textAlign: "center" }}>
                {nextMatch.teamAway}
              </Text>
            </View>
            {isLive && (
              <View style={{ backgroundColor: "#FF4D4F20", borderRadius: 10, padding: 8, alignItems: "center", marginTop: 4 }}>
                <Text style={{ color: "#FF4D4F", fontWeight: "800", fontSize: 16 }}>Playing Now!</Text>
              </View>
            )}
            {!isLive && nextMatch.startTime && (
              <Text style={{ color: MUTED, fontSize: 16, textAlign: "center", marginTop: 4 }}>
                {new Date(nextMatch.startTime).toLocaleDateString("en-US", {
                  weekday: "long", month: "short", day: "numeric",
                })}{" "}
                at{" "}
                {new Date(nextMatch.startTime).toLocaleTimeString("en-US", {
                  hour: "numeric", minute: "2-digit", hour12: true,
                })}
              </Text>
            )}
            <Text style={{ color: ACCENT, fontSize: 16, fontWeight: "700", textAlign: "center", marginTop: 12 }}>
              Tap to see details
            </Text>
          </Pressable>
        ) : (
          <Text style={{ fontSize: 16, color: MUTED, lineHeight: 24 }}>
            No upcoming matches to show right now. Check back soon!
          </Text>
        )}
      </View>

      {/* Your Team Card */}
      <View style={{
        backgroundColor: CARD, borderRadius: 16, padding: 24, marginBottom: 16,
        borderWidth: 2, borderColor: BORDER,
      }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: TEXT_COLOR, marginBottom: 8 }}>
          Your Team
        </Text>
        <Text style={{ fontSize: 16, color: MUTED, lineHeight: 24 }}>
          You haven't created a team yet. Tap "Play Now" below to get started!
        </Text>
      </View>

      {/* Play Now */}
      {nextMatch ? (
        <Pressable
          onPress={() => router.push(`/match/${nextMatch.id}` as any)}
          style={{
            backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 20, alignItems: "center",
            marginTop: 8,
          }}
        >
          <Text style={{ color: BG, fontSize: 22, fontWeight: "800" }}>Play Now</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push("/(tabs)" as any)}
          style={{
            backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 20, alignItems: "center",
            marginTop: 8,
          }}
        >
          <Text style={{ color: BG, fontSize: 22, fontWeight: "800" }}>Explore Matches</Text>
        </Pressable>
      )}

      {/* Upcoming list */}
      {upcomingMatches.data?.matches && upcomingMatches.data.matches.length > 1 && (
        <View style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: TEXT_COLOR, marginBottom: 12 }}>
            Coming Up
          </Text>
          {upcomingMatches.data.matches.slice(0, 3).map((m: any) => (
            <Pressable
              key={m.id}
              onPress={() => router.push(`/match/${m.id}` as any)}
              style={{
                backgroundColor: CARD, borderRadius: 14, padding: 18, marginBottom: 10,
                borderWidth: 1, borderColor: BORDER,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: TEXT_COLOR }}>
                {m.teamHome} vs {m.teamAway}
              </Text>
              <Text style={{ fontSize: 15, color: MUTED, marginTop: 4 }}>
                {new Date(m.startTime).toLocaleDateString("en-US", {
                  weekday: "short", month: "short", day: "numeric",
                })}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}
