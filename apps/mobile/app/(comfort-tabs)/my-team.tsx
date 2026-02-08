import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "../../lib/trpc";

const BG = "#0A1628";
const CARD = "#1A2332";
const ACCENT = "#00F5A0";
const TEXT_COLOR = "#FFFFFF";
const MUTED = "#ADB5BD";
const BORDER = "#243044";

export default function ComfortMyTeamScreen() {
  const router = useRouter();
  const { data: contests, isLoading } = trpc.contest.myContests.useQuery(undefined, {
    retry: false,
  });

  const hasTeams = contests && contests.length > 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 24 }}>
      <Text style={{ fontSize: 28, fontWeight: "800", color: TEXT_COLOR, marginBottom: 8 }}>
        My Team
      </Text>

      {isLoading ? (
        <ActivityIndicator color={ACCENT} style={{ padding: 32 }} />
      ) : hasTeams ? (
        <>
          <Text style={{ fontSize: 18, color: MUTED, lineHeight: 26, marginBottom: 20 }}>
            You have joined {contests.length} contest{contests.length > 1 ? "s" : ""}
          </Text>
          {contests.slice(0, 5).map((contest: any) => (
            <Pressable
              key={contest.id}
              onPress={() => router.push(`/contest/${contest.id}` as any)}
              style={{
                backgroundColor: CARD, borderRadius: 16, padding: 20, marginBottom: 12,
                borderWidth: 2, borderColor: BORDER,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: TEXT_COLOR }}>
                {contest.name}
              </Text>
              <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
                <View>
                  <Text style={{ fontSize: 14, color: MUTED }}>Your Points</Text>
                  <Text style={{ fontSize: 22, fontWeight: "800", color: ACCENT }}>
                    {contest.totalPoints ?? 0}
                  </Text>
                </View>
                {contest.rank && (
                  <View>
                    <Text style={{ fontSize: 14, color: MUTED }}>Your Rank</Text>
                    <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFD600" }}>
                      #{contest.rank}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ color: ACCENT, fontSize: 16, fontWeight: "600", marginTop: 12 }}>
                Tap to view details
              </Text>
            </Pressable>
          ))}
        </>
      ) : (
        <>
          <Text style={{ fontSize: 18, color: MUTED, lineHeight: 26, marginBottom: 32 }}>
            Your team will appear here once you create one
          </Text>

          <View style={{
            backgroundColor: CARD, borderRadius: 16, padding: 24, marginBottom: 24,
            borderWidth: 2, borderColor: BORDER,
          }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: ACCENT, marginBottom: 12 }}>
              How it works
            </Text>
            <Text style={{ fontSize: 18, color: TEXT_COLOR, lineHeight: 30 }}>
              1. Pick 11 players from two teams{"\n"}
              2. Choose a captain for double points{"\n"}
              3. Watch them score as the match plays
            </Text>
          </View>

          <Pressable
            onPress={() => router.push("/(comfort-tabs)" as any)}
            style={{
              backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 20, alignItems: "center",
            }}
          >
            <Text style={{ color: BG, fontSize: 20, fontWeight: "800" }}>
              Find a Match to Play
            </Text>
          </Pressable>
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}
