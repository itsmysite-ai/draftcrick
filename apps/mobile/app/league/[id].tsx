import { View, Text, FlatList, Pressable, Alert, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";

const BG = "#0A1628";
const CARD = "#1A2332";
const ACCENT = "#00F5A0";
const TEXT = "#FFFFFF";
const MUTED = "#6C757D";

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: league, isLoading, refetch } = trpc.league.getById.useQuery({ id: id! });
  const startDraftMutation = trpc.league.startDraft.useMutation({
    onSuccess: (room) => {
      const route = room!.type === "auction"
        ? `/auction/${room!.id}` as const
        : `/draft/${room!.id}` as const;
      router.push(route as any);
    },
  });
  const leaveMutation = trpc.league.leave.useMutation({ onSuccess: () => router.back() });
  const kickMutation = trpc.league.kickMember.useMutation({ onSuccess: () => refetch() });
  const promoteMutation = trpc.league.promoteMember.useMutation({ onSuccess: () => refetch() });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: MUTED, fontSize: 16 }}>Loading league...</Text>
      </View>
    );
  }

  if (!league) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: MUTED, fontSize: 16 }}>League not found</Text>
      </View>
    );
  }

  const myMembership = league.members?.find((m: any) => m.userId === user?.id);
  const isOwner = myMembership?.role === "owner";
  const isAdmin = myMembership?.role === "admin" || isOwner;

  const shareInvite = () => {
    Share.share({
      message: `Join my DraftCrick league "${league.name}"! Invite code: ${league.inviteCode}`,
    });
  };

  const handleStartDraft = (type: "snake_draft" | "auction") => {
    Alert.alert(
      `Start ${type === "auction" ? "Auction" : "Snake Draft"}?`,
      "All members will be notified. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start",
          onPress: () => startDraftMutation.mutate({ leagueId: id!, type }),
        },
      ]
    );
  };

  const handleKick = (userId: string, username: string) => {
    Alert.alert("Kick Member", `Remove ${username} from the league?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Kick",
        style: "destructive",
        onPress: () => kickMutation.mutate({ leagueId: id!, userId }),
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <FlatList
        data={league.members ?? []}
        keyExtractor={(item: any) => item.userId}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <>
            {/* League Header */}
            <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <Text style={{ color: TEXT, fontSize: 24, fontWeight: "800" }}>{league.name}</Text>
              <View style={{ flexDirection: "row", marginTop: 8, gap: 12 }}>
                <View style={{ backgroundColor: "#00F5A020", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ color: ACCENT, fontSize: 12, fontWeight: "600" }}>{league.format.toUpperCase()}</Text>
                </View>
                <View style={{ backgroundColor: "#FFD60020", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ color: "#FFD600", fontSize: 12, fontWeight: "600" }}>{league.template.toUpperCase()}</Text>
                </View>
                <Text style={{ color: MUTED, fontSize: 12, alignSelf: "center" }}>
                  {league.members?.length ?? 0}/{league.maxMembers} members
                </Text>
              </View>
              <Text style={{ color: MUTED, fontSize: 13, marginTop: 8 }}>
                {league.tournament} {league.season ? `- ${league.season}` : ""}
              </Text>
            </View>

            {/* Invite Code */}
            <Pressable
              onPress={shareInvite}
              style={{ backgroundColor: CARD, borderRadius: 12, padding: 16, marginBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
            >
              <View>
                <Text style={{ color: MUTED, fontSize: 12 }}>INVITE CODE</Text>
                <Text style={{ color: ACCENT, fontSize: 20, fontWeight: "700", letterSpacing: 2 }}>
                  {league.inviteCode}
                </Text>
              </View>
              <Text style={{ color: ACCENT, fontSize: 14 }}>Share</Text>
            </Pressable>

            {/* Actions */}
            {isAdmin && (
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                {(league.format === "draft") && (
                  <Pressable
                    onPress={() => handleStartDraft("snake_draft")}
                    style={{ flex: 1, backgroundColor: ACCENT, borderRadius: 12, padding: 14, alignItems: "center" }}
                  >
                    <Text style={{ color: BG, fontWeight: "700", fontSize: 15 }}>Start Draft</Text>
                  </Pressable>
                )}
                {(league.format === "auction") && (
                  <Pressable
                    onPress={() => handleStartDraft("auction")}
                    style={{ flex: 1, backgroundColor: "#FFD600", borderRadius: 12, padding: 14, alignItems: "center" }}
                  >
                    <Text style={{ color: BG, fontWeight: "700", fontSize: 15 }}>Start Auction</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => router.push(`/league/${id}/settings` as any)}
                  style={{ flex: 1, backgroundColor: CARD, borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#2A3442" }}
                >
                  <Text style={{ color: TEXT, fontWeight: "700", fontSize: 15 }}>Settings</Text>
                </Pressable>
              </View>
            )}

            {/* Trade button for leagues with trading enabled */}
            <Pressable
              onPress={() => router.push(`/league/${id}/trades` as any)}
              style={{ backgroundColor: CARD, borderRadius: 12, padding: 14, marginBottom: 16, alignItems: "center", borderWidth: 1, borderColor: "#2A3442" }}
            >
              <Text style={{ color: TEXT, fontWeight: "700", fontSize: 15 }}>View Trades</Text>
            </Pressable>

            <Text style={{ color: TEXT, fontSize: 18, fontWeight: "700", marginBottom: 12 }}>Members</Text>
          </>
        }
        renderItem={({ item }: { item: any }) => (
          <View style={{
            backgroundColor: CARD, borderRadius: 12, padding: 14, marginBottom: 8,
            flexDirection: "row", justifyContent: "space-between", alignItems: "center"
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: TEXT, fontSize: 15, fontWeight: "600" }}>
                {item.user?.displayName ?? item.user?.username ?? "Unknown"}
              </Text>
              <Text style={{ color: item.role === "owner" ? ACCENT : item.role === "admin" ? "#FFD600" : MUTED, fontSize: 12, fontWeight: "600", marginTop: 2 }}>
                {item.role.toUpperCase()}
              </Text>
            </View>
            {isOwner && item.userId !== user?.id && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() =>
                    promoteMutation.mutate({
                      leagueId: id!,
                      userId: item.userId,
                      role: item.role === "admin" ? "member" : "admin",
                    })
                  }
                  style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#2A3442", borderRadius: 8 }}
                >
                  <Text style={{ color: "#FFD600", fontSize: 12 }}>
                    {item.role === "admin" ? "Demote" : "Promote"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleKick(item.userId, item.user?.username ?? "member")}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#FF4C4C20", borderRadius: 8 }}
                >
                  <Text style={{ color: "#FF4C4C", fontSize: 12 }}>Kick</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
        ListFooterComponent={
          !isOwner && myMembership ? (
            <Pressable
              onPress={() =>
                Alert.alert("Leave League?", "You will lose your team and progress.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Leave", style: "destructive", onPress: () => leaveMutation.mutate({ leagueId: id! }) },
                ])
              }
              style={{ marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: "#FF4C4C20", alignItems: "center" }}
            >
              <Text style={{ color: "#FF4C4C", fontWeight: "700", fontSize: 15 }}>Leave League</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}
