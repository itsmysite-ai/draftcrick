import { FlatList, Alert, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  BackButton,
  Button,
  InitialsAvatar,
  SegmentTab,
  ModeToggle,
  AnnouncementBanner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";
import { useTheme } from "../../providers/ThemeProvider";

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const [tab, setTab] = useState<"members" | "standings">("members");
  const { data: league, isLoading, refetch } = trpc.league.getById.useQuery({ id: id! });
  const standings = trpc.league.memberStandings.useQuery({ leagueId: id! }, { enabled: !!id });
  const startDraftMutation = trpc.league.startDraft.useMutation({ onSuccess: (room) => { const route = room!.type === "auction" ? `/auction/${room!.id}` as const : `/draft/${room!.id}` as const; router.push(route as any); } });
  const leaveMutation = trpc.league.leave.useMutation({ onSuccess: () => router.back() });
  const kickMutation = trpc.league.kickMember.useMutation({ onSuccess: () => refetch() });
  const promoteMutation = trpc.league.promoteMember.useMutation({ onSuccess: () => refetch() });

  if (isLoading) return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
      <Text fontFamily="$body" color="$colorMuted" fontSize={16}>{formatUIText("loading league...")}</Text>
    </YStack>
  );
  if (!league) return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
      <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
      <Text {...textStyles.hint}>{formatUIText("league not found")}</Text>
    </YStack>
  );

  const myMembership = league.members?.find((m: any) => m.userId === user?.id);
  const isOwner = myMembership?.role === "owner";
  const isAdmin = myMembership?.role === "admin" || isOwner;
  const shareInvite = () => { Share.share({ message: `${formatUIText("join my draftplay league")} "${league.name}"! ${formatUIText("invite code")}: ${league.inviteCode}` }); };
  const handleStartDraft = (type: "snake_draft" | "auction") => {
    Alert.alert(
      formatUIText(`start ${type === "auction" ? "auction" : "snake draft"}?`),
      formatUIText("all members will be notified. this cannot be undone."),
      [{ text: formatUIText("cancel"), style: "cancel" }, { text: formatUIText("start"), onPress: () => startDraftMutation.mutate({ leagueId: id!, type }) }],
    );
  };
  const handleKick = (userId: string, username: string) => {
    Alert.alert(
      formatUIText("kick member"),
      `${formatUIText("remove")} ${username} ${formatUIText("from the league?")}`,
      [{ text: formatUIText("cancel"), style: "cancel" }, { text: formatUIText("kick"), style: "destructive", onPress: () => kickMutation.mutate({ leagueId: id!, userId }) }],
    );
  };

  return (
    <YStack flex={1} backgroundColor="$background" testID="league-detail-screen">
      <FlatList data={tab === "standings" ? (standings.data ?? []) : (league.members ?? [])} keyExtractor={(item: any) => item.userId} contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={<>
          <XStack
            justifyContent="space-between"
            alignItems="center"
            paddingTop={insets.top + 8}
            paddingBottom="$3"
            marginBottom="$3"
          >
            <XStack alignItems="center" gap="$3">
              <BackButton onPress={() => router.back()} />
            </XStack>
            <ModeToggle mode={mode} onToggle={toggleMode} />
          </XStack>
          <AnnouncementBanner marginHorizontal={0} />
          <Card padding="$5" marginBottom="$4">
            <Text testID="league-name" fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
              {league.name}
            </Text>
            <XStack marginTop="$2" gap="$3" flexWrap="wrap">
              <Badge variant="role" size="sm">
                {formatBadgeText(league.format)}
              </Badge>
              <Badge variant="role" size="sm">
                {formatBadgeText(league.template)}
              </Badge>
              <Text fontFamily="$mono" fontSize={12} color="$colorMuted" alignSelf="center">
                {league.members?.length ?? 0}/{league.maxMembers} {formatUIText("members")}
              </Text>
            </XStack>
            <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginTop="$2">
              {league.tournament} {league.season ? `- ${league.season}` : ""}
            </Text>
          </Card>

          <Card testID="league-invite-code" pressable onPress={shareInvite} marginBottom="$4" padding="$4">
            <XStack justifyContent="space-between" alignItems="center">
              <YStack>
                <Text {...textStyles.hint}>{formatBadgeText("invite code")}</Text>
                <Text fontFamily="$mono" fontSize={20} fontWeight="700" color="$accentBackground" letterSpacing={2}>
                  {league.inviteCode}
                </Text>
              </YStack>
              <Text fontFamily="$mono" fontSize={14} color="$accentBackground">
                {formatUIText("share")}
              </Text>
            </XStack>
          </Card>

          {isAdmin && (
            <XStack gap="$3" marginBottom="$4">
              {league.format === "draft" && (
                <Button testID="league-start-draft-btn" variant="primary" size="md" flex={1} onPress={() => handleStartDraft("snake_draft")}>
                  {formatUIText("start draft")}
                </Button>
              )}
              {league.format === "auction" && (
                <Button testID="league-start-auction-btn" variant="primary" size="md" flex={1} onPress={() => handleStartDraft("auction")}>
                  {formatUIText("start auction")}
                </Button>
              )}
              <Button variant="secondary" size="md" flex={1} onPress={() => router.push(`/league/${id}/settings` as any)}>
                {formatUIText("settings")}
              </Button>
            </XStack>
          )}

          <Button testID="league-view-trades-btn" variant="secondary" size="md" marginBottom="$4" onPress={() => router.push(`/league/${id}/trades` as any)}>
            {formatUIText("view trades")}
          </Button>

          {/* Tab switcher: Members / Standings (#8) */}
          <XStack
            marginBottom="$3"
            borderRadius="$3"
            backgroundColor="$backgroundSurfaceAlt"
            padding="$1"
            gap="$1"
          >
            {([
              { key: "members" as const, label: "Members" },
              { key: "standings" as const, label: "Standings" },
            ]).map((tb) => (
              <SegmentTab key={tb.key} active={tab === tb.key} onPress={() => setTab(tb.key)}>
                <Text fontFamily="$body" fontWeight="600" fontSize={13} color={tab === tb.key ? "$color" : "$colorMuted"}>
                  {formatUIText(tb.label)}
                </Text>
              </SegmentTab>
            ))}
          </XStack>
        </>}
        renderItem={({ item, index }: { item: any; index: number }) => {
          // Standings tab (#8)
          if (tab === "standings") {
            const standingsData = standings.data ?? [];
            if (index >= standingsData.length) return null;
            const s = standingsData[index];
            if (!s) return null;
            const isMe = s.userId === user?.id;
            return (
              <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
                <Card marginBottom="$2" padding="$4" borderColor={isMe ? "$accentBackground" : "$borderColor"} borderWidth={isMe ? 2 : 1}>
                  <XStack alignItems="center">
                    <YStack width={32} alignItems="center">
                      <Text fontFamily="$mono" fontWeight="800" fontSize={14} color={index === 0 ? "$colorCricket" : index === 1 ? "$colorSecondary" : "$color"}>
                        #{s.rank}
                      </Text>
                    </YStack>
                    <XStack alignItems="center" gap="$2" flex={1} marginLeft="$2">
                      <InitialsAvatar name={s.displayName} playerRole="BAT" ovr={`#${s.rank}`} size={32} />
                      <YStack flex={1}>
                        <Text {...textStyles.playerName}>{s.displayName}</Text>
                        {isMe && <Badge variant="live" size="sm" alignSelf="flex-start">{formatBadgeText("you")}</Badge>}
                      </YStack>
                    </XStack>
                    <YStack alignItems="flex-end">
                      <Text fontFamily="$mono" fontWeight="700" fontSize={15} color="$accentBackground">
                        {s.totalPoints.toFixed(1)}
                      </Text>
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                        {s.contestsPlayed} contest{s.contestsPlayed !== 1 ? "s" : ""}
                      </Text>
                    </YStack>
                  </XStack>
                </Card>
              </Animated.View>
            );
          }
          // Members tab (original)
          return (
          <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
            <Card testID={`league-member-${item.userId}`} marginBottom="$2" padding="$4">
              <XStack justifyContent="space-between" alignItems="center">
                <XStack alignItems="center" gap="$3" flex={1}>
                  <InitialsAvatar
                    name={item.user?.displayName ?? item.user?.username ?? "?"}
                    playerRole="BAT"
                    ovr={0}
                    size={36}
                    hideBadge
                  />
                  <YStack flex={1}>
                    <Text {...textStyles.playerName}>
                      {item.user?.displayName ?? item.user?.username ?? formatUIText("unknown")}
                    </Text>
                    <Badge variant="role" size="sm" alignSelf="flex-start" marginTop={2}>
                      {formatBadgeText(item.role)}
                    </Badge>
                  </YStack>
                </XStack>
                {isOwner && item.userId !== user?.id && (
                  <XStack gap="$2">
                    <Button variant="secondary" size="sm" onPress={() => promoteMutation.mutate({ leagueId: id!, userId: item.userId, role: item.role === "admin" ? "member" : "admin" })}>
                      {formatUIText(item.role === "admin" ? "demote" : "promote")}
                    </Button>
                    <Button variant="danger" size="sm" onPress={() => handleKick(item.userId, item.user?.username ?? "member")}>
                      {formatUIText("kick")}
                    </Button>
                  </XStack>
                )}
              </XStack>
            </Card>
          </Animated.View>
          );
        }}
        ListFooterComponent={!isOwner && myMembership ? (
          <Button variant="danger" size="md" marginTop="$4" onPress={() => Alert.alert(
            formatUIText("leave league?"),
            formatUIText("you will lose your team and progress."),
            [{ text: formatUIText("cancel"), style: "cancel" }, { text: formatUIText("leave"), style: "destructive", onPress: () => leaveMutation.mutate({ leagueId: id! }) }],
          )}>
            {formatUIText("leave league")}
          </Button>
        ) : null}
      />
    </YStack>
  );
}
