import { SafeBackButton } from "../../components/SafeBackButton";
import { FlatList, Alert, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  BackButton,
  Button,
  InitialsAvatar,
  SegmentTab,
  AnnouncementBanner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  DraftPlayLogo,
} from "@draftplay/ui";
import QRCode from "react-native-qrcode-svg";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";
import { HeaderControls } from "../../components/HeaderControls";

const STATUS_ORDER: Record<string, number> = { live: 0, open: 1, upcoming: 2, locked: 3, settling: 4, settled: 5, cancelled: 6 };
const STATUS_VARIANT: Record<string, string> = { live: "live", open: "default", upcoming: "role", locked: "role", settling: "role", settled: "default", cancelled: "danger" };

function formatMatchTime(dateStr: string | Date): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  if (diff < 86400000) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const theme = useTamaguiTheme();
  const [tab, setTab] = useState<"members" | "standings" | "contests">("contests");
  const [showQR, setShowQR] = useState(false);
  const { data: league, isLoading, refetch } = trpc.league.getById.useQuery({ id: id! });
  const standings = trpc.league.memberStandings.useQuery({ leagueId: id! }, { enabled: !!id });
  const leagueContests = trpc.league.leagueContests.useQuery({ leagueId: id! }, { enabled: !!id });
  const startDraftMutation = trpc.league.startDraft.useMutation({ onSuccess: (room) => { const route = room!.type === "auction" ? `/auction/${room!.id}` as const : `/draft/${room!.id}` as const; router.push(route as any); } });
  const leaveMutation = trpc.league.leave.useMutation({ onSuccess: () => router.back() });
  const kickMutation = trpc.league.kickMember.useMutation({ onSuccess: () => refetch() });
  const promoteMutation = trpc.league.promoteMember.useMutation({ onSuccess: () => refetch() });

  const sortedContests = useMemo(() => {
    const data = leagueContests.data ?? [];
    return [...data].sort((a, b) => {
      const statusDiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      // Within same status, sort by match start time ascending
      const timeA = a.match?.startTime ? new Date(a.match.startTime).getTime() : 0;
      const timeB = b.match?.startTime ? new Date(b.match.startTime).getTime() : 0;
      return timeA - timeB;
    });
  }, [leagueContests.data]);

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
  const shareLink = `https://app.draftplay.ai/league/join?code=${league.inviteCode}`;
  const shareInvite = () => { Share.share({ message: `${formatUIText("join my draftplay league")} "${league.name}"!\n${shareLink}` }); };
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
      <FlatList data={tab === "contests" ? sortedContests : tab === "standings" ? (standings.data ?? []) : (league.members ?? [])} keyExtractor={(item: any) => item.id ?? item.userId} contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={<>
          <XStack
            justifyContent="space-between"
            alignItems="center"
            paddingTop={insets.top + 8}
            paddingBottom="$3"
            marginBottom="$3"
          >
            <XStack alignItems="center" gap="$3">
              <SafeBackButton />
            </XStack>
            <HeaderControls />
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

          <Card testID="league-invite-code" marginBottom="$4" padding="$4">
            <XStack justifyContent="space-between" alignItems="center" marginBottom={showQR ? 16 : 0}>
              <YStack>
                <Text {...textStyles.hint}>{formatBadgeText("invite friends")}</Text>
                <Text fontFamily="$mono" fontSize={16} fontWeight="700" color="$accentBackground" letterSpacing={2}>
                  {league.inviteCode}
                </Text>
              </YStack>
              <XStack gap="$2">
                <Button variant="secondary" size="sm" onPress={() => setShowQR(!showQR)}>
                  {showQR ? formatUIText("hide qr") : formatUIText("qr code")}
                </Button>
                <Button variant="primary" size="sm" onPress={shareInvite}>
                  {formatUIText("share link")}
                </Button>
              </XStack>
            </XStack>
            {showQR && (
              <YStack alignItems="center" paddingVertical="$3" gap="$2">
                <QRCode value={shareLink} size={180} backgroundColor="transparent" color="#5DB882" />
                <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center">
                  {formatUIText("scan to join this league")}
                </Text>
              </YStack>
            )}
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

          <Button testID="league-view-trades-btn" variant="secondary" size="md" marginBottom="$4" disabled opacity={0.5}>
            <XStack alignItems="center" gap="$2">
              <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$colorMuted">
                {formatUIText("view trades")}
              </Text>
              <Badge variant="default" size="sm">
                {formatBadgeText("coming soon")}
              </Badge>
            </XStack>
          </Button>

          {/* Tab switcher: Contests / Members / Standings */}
          <XStack
            marginBottom="$3"
            borderRadius="$3"
            backgroundColor="$backgroundSurfaceAlt"
            padding="$1"
            gap="$1"
          >
            {([
              { key: "contests" as const, label: "Contests" },
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

          {/* Progressive tip for contests tab */}
          {tab === "contests" && sortedContests.length > 0 && (() => {
            const openContest = sortedContests.find((c: any) => c.status === "open");
            const upcomingCount = sortedContests.filter((c: any) => c.status === "upcoming").length;
            if (openContest) {
              return (
                <Card padding="$3" marginBottom="$3" testID="league-contest-tip">
                  <XStack alignItems="center" gap="$2" marginBottom="$1">
                    <YStack width={20} height={20} borderRadius={10} backgroundColor="$accentBackground" alignItems="center" justifyContent="center">
                      <Text fontFamily="$mono" fontWeight="700" fontSize={10} color="white">!</Text>
                    </YStack>
                    <Text fontFamily="$mono" fontWeight="600" fontSize={12} color="$accentBackground">
                      {formatUIText("ready to play")}
                    </Text>
                  </XStack>
                  <Text fontFamily="$mono" fontSize={11} color="$colorMuted" lineHeight={16}>
                    {formatUIText("tap an open contest to pick 11 players and build your team. ")}
                    {upcomingCount > 0 && formatUIText(`${upcomingCount} more contest${upcomingCount > 1 ? "s" : ""} will open closer to match time.`)}
                  </Text>
                </Card>
              );
            }
            if (upcomingCount > 0) {
              return (
                <Card padding="$3" marginBottom="$3" testID="league-contest-tip">
                  <Text fontFamily="$mono" fontWeight="600" fontSize={12} color="$accentBackground" marginBottom="$1">
                    {formatUIText("contests scheduled")}
                  </Text>
                  <Text fontFamily="$mono" fontSize={11} color="$colorMuted" lineHeight={16}>
                    {formatUIText(`${upcomingCount} contest${upcomingCount > 1 ? "s" : ""} will open when drafts are enabled closer to match time.`)}
                  </Text>
                </Card>
              );
            }
            return null;
          })()}
        </>}
        renderItem={({ item, index }: { item: any; index: number }) => {
          // Contests tab
          if (tab === "contests") {
            const contest = item;
            const match = contest.match;
            const statusVariant = STATUS_VARIANT[contest.status] ?? "default";
            return (
              <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
                <Card
                  pressable
                  marginBottom="$2"
                  padding="$4"
                  onPress={() => {
                    if (match && (contest.status === "open" || contest.status === "upcoming")) {
                      router.push(`/match/${match.id}` as any);
                    } else {
                      router.push(`/contest/${contest.id}` as any);
                    }
                  }}
                  borderColor={contest.status === "live" ? "$colorCricket" : "$borderColor"}
                  borderWidth={contest.status === "live" ? 2 : 1}
                  testID={`league-contest-${contest.id}`}
                >
                  <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
                    <Text fontFamily="$body" fontWeight="700" fontSize={14} color="$color" flex={1} numberOfLines={1}>
                      {contest.name}
                    </Text>
                    <Badge variant={statusVariant as any} size="sm">
                      {formatBadgeText(contest.status)}
                    </Badge>
                  </XStack>
                  {match && (
                    <YStack>
                      <Text fontFamily="$mono" fontWeight="600" fontSize={13} color="$accentBackground">
                        {match.teamHome} vs {match.teamAway}
                      </Text>
                      <XStack justifyContent="space-between" marginTop="$1">
                        <Text fontFamily="$body" fontSize={11} color="$colorMuted">
                          {match.format?.toUpperCase()} · {formatMatchTime(match.startTime)}
                        </Text>
                        {match.venue && (
                          <Text fontFamily="$body" fontSize={11} color="$colorMuted" numberOfLines={1} flex={1} textAlign="right" marginLeft="$2">
                            {match.venue}
                          </Text>
                        )}
                      </XStack>
                      {match.scoreSummary && (
                        <Text fontFamily="$mono" fontSize={11} color="$colorCricket" marginTop="$1">
                          {match.scoreSummary}
                        </Text>
                      )}
                      {match.result && (
                        <Text fontFamily="$body" fontSize={11} color="$colorSecondary" marginTop="$1">
                          {match.result}
                        </Text>
                      )}
                    </YStack>
                  )}
                  <XStack marginTop="$2" gap="$3">
                    <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                      {contest.currentEntries}/{contest.maxEntries} entries
                    </Text>
                    {contest.prizePool > 0 && (
                      <Text fontFamily="$mono" fontSize={10} color="$colorCricket">
                        prize: {contest.prizePool}
                      </Text>
                    )}
                    {contest.entryFee > 0 && (
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                        fee: {contest.entryFee}
                      </Text>
                    )}
                  </XStack>
                </Card>
              </Animated.View>
            );
          }
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
        ListEmptyComponent={
          tab === "contests" ? (
            <Card padding="$5" alignItems="center">
              <Text fontFamily="$body" fontSize={13} color="$colorMuted" textAlign="center">
                {formatUIText("no contests yet — contests will appear here as matches are scheduled")}
              </Text>
            </Card>
          ) : tab === "standings" ? (
            <Card padding="$5" alignItems="center">
              <Text fontFamily="$body" fontSize={13} color="$colorMuted" textAlign="center">
                {formatUIText("no standings yet — play contests to climb the leaderboard")}
              </Text>
            </Card>
          ) : null
        }
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
