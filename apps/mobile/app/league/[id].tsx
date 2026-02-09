import { FlatList, Alert, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Card, Badge, Button } from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTamaguiTheme();
  const { data: league, isLoading, refetch } = trpc.league.getById.useQuery({ id: id! });
  const startDraftMutation = trpc.league.startDraft.useMutation({ onSuccess: (room) => { const route = room!.type === "auction" ? `/auction/${room!.id}` as const : `/draft/${room!.id}` as const; router.push(route as any); } });
  const leaveMutation = trpc.league.leave.useMutation({ onSuccess: () => router.back() });
  const kickMutation = trpc.league.kickMember.useMutation({ onSuccess: () => refetch() });
  const promoteMutation = trpc.league.promoteMember.useMutation({ onSuccess: () => refetch() });

  if (isLoading) return (<YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center"><Text fontFamily="$body" color="$colorMuted" fontSize={16}>Loading league...</Text></YStack>);
  if (!league) return (<YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center"><Text fontFamily="$body" color="$colorMuted" fontSize={16}>League not found</Text></YStack>);

  const myMembership = league.members?.find((m: any) => m.userId === user?.id);
  const isOwner = myMembership?.role === "owner";
  const isAdmin = myMembership?.role === "admin" || isOwner;
  const shareInvite = () => { Share.share({ message: `Join my DraftCrick league "${league.name}"! Invite code: ${league.inviteCode}` }); };
  const handleStartDraft = (type: "snake_draft" | "auction") => { Alert.alert(`Start ${type === "auction" ? "Auction" : "Snake Draft"}?`, "All members will be notified. This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Start", onPress: () => startDraftMutation.mutate({ leagueId: id!, type }) }]); };
  const handleKick = (userId: string, username: string) => { Alert.alert("Kick Member", `Remove ${username} from the league?`, [{ text: "Cancel", style: "cancel" }, { text: "Kick", style: "destructive", onPress: () => kickMutation.mutate({ leagueId: id!, userId }) }]); };

  return (
    <YStack flex={1} backgroundColor="$background">
      <FlatList data={league.members ?? []} keyExtractor={(item: any) => item.userId} contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={<>
          <Card padding="$5" marginBottom="$4">
            <Text fontFamily="$heading" fontWeight="800" fontSize={24} color="$color">{league.name}</Text>
            <XStack marginTop="$2" gap="$3">
              <Badge backgroundColor="$colorAccentLight" color="$colorAccent" size="sm" fontWeight="600">{league.format.toUpperCase()}</Badge>
              <Badge backgroundColor="$colorCricketLight" color="$colorCricket" size="sm" fontWeight="600">{league.template.toUpperCase()}</Badge>
              <Text fontFamily="$body" fontSize={12} color="$colorMuted" alignSelf="center">{league.members?.length ?? 0}/{league.maxMembers} members</Text>
            </XStack>
            <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginTop="$2">{league.tournament} {league.season ? `- ${league.season}` : ""}</Text>
          </Card>
          <Card pressable onPress={shareInvite} marginBottom="$4" padding="$4">
            <XStack justifyContent="space-between" alignItems="center">
              <YStack>
                <Text fontFamily="$mono" fontSize={12} color="$colorMuted">INVITE CODE</Text>
                <Text fontFamily="$mono" fontSize={20} fontWeight="700" color="$accentBackground" letterSpacing={2}>{league.inviteCode}</Text>
              </YStack>
              <Text fontFamily="$body" fontSize={14} color="$accentBackground">Share</Text>
            </XStack>
          </Card>
          {isAdmin && (
            <XStack gap="$3" marginBottom="$4">
              {league.format === "draft" && <Button variant="primary" size="md" flex={1} onPress={() => handleStartDraft("snake_draft")}>Start Draft</Button>}
              {league.format === "auction" && <Button variant="primary" size="md" flex={1} onPress={() => handleStartDraft("auction")}>Start Auction</Button>}
              <Button variant="secondary" size="md" flex={1} onPress={() => router.push(`/league/${id}/settings` as any)}>Settings</Button>
            </XStack>
          )}
          <Button variant="secondary" size="md" marginBottom="$4" onPress={() => router.push(`/league/${id}/trades` as any)}>View Trades</Button>
          <Text fontFamily="$heading" fontWeight="700" fontSize={18} color="$color" marginBottom="$3">Members</Text>
        </>}
        renderItem={({ item }: { item: any }) => (
          <Card marginBottom="$2" padding="$4">
            <XStack justifyContent="space-between" alignItems="center">
              <YStack flex={1}>
                <Text fontFamily="$body" fontWeight="600" fontSize={15} color="$color">{item.user?.displayName ?? item.user?.username ?? "Unknown"}</Text>
                <Text fontFamily="$mono" fontSize={12} fontWeight="600" marginTop={2} color={item.role === "owner" ? "$accentBackground" : item.role === "admin" ? "$colorCricket" : "$colorMuted"}>{item.role.toUpperCase()}</Text>
              </YStack>
              {isOwner && item.userId !== user?.id && (
                <XStack gap="$2">
                  <Button variant="secondary" size="sm" onPress={() => promoteMutation.mutate({ leagueId: id!, userId: item.userId, role: item.role === "admin" ? "member" : "admin" })}>{item.role === "admin" ? "Demote" : "Promote"}</Button>
                  <Button variant="danger" size="sm" onPress={() => handleKick(item.userId, item.user?.username ?? "member")}>Kick</Button>
                </XStack>
              )}
            </XStack>
          </Card>
        )}
        ListFooterComponent={!isOwner && myMembership ? (
          <Button variant="danger" size="md" marginTop="$4" onPress={() => Alert.alert("Leave League?", "You will lose your team and progress.", [{ text: "Cancel", style: "cancel" }, { text: "Leave", style: "destructive", onPress: () => leaveMutation.mutate({ leagueId: id! }) }])}>Leave League</Button>
        ) : null}
      />
    </YStack>
  );
}
