import { SafeBackButton } from "../../components/SafeBackButton";
import { FlatList, Alert, Share, Image, Modal, View } from "react-native";
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
  AlertModal,
  DesignSystem,
  EggLoadingSpinner,
  textStyles,
  formatUIText,
  formatBadgeText,
  DraftPlayLogo,
} from "@draftplay/ui";
import QRCode from "react-native-qrcode-svg";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";
import { HeaderControls } from "../../components/HeaderControls";
import { MemberBreakdownSheet } from "../../components/MemberBreakdownSheet";
import { FullStandingsSheet } from "../../components/FullStandingsSheet";
import { useTheme } from "../../providers/ThemeProvider";
import { ScrollView } from "react-native";

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
  // Standings has been promoted to its own podium card + bottom sheet —
  // the tab switcher only needs contests / members now.
  const [tab, setTab] = useState<"members" | "contests">("contests");
  const [showQR, setShowQR] = useState(false);
  const [showFullStandings, setShowFullStandings] = useState(false);
  const [confirmAlert, setConfirmAlert] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
    confirmVariant?: "primary" | "danger";
  } | null>(null);
  // Drill-down state for the standings rows — tapping any opens a bottom
  // sheet with the per-contest breakdown for that member.
  const [selectedMember, setSelectedMember] = useState<{
    userId: string;
    displayName: string;
    rank: number;
    totalPoints: number;
    contestsPlayed: number;
  } | null>(null);
  const { data: league, isLoading, refetch } = trpc.league.getById.useQuery({ id: id! }, { refetchInterval: 10000 });
  const standings = trpc.league.memberStandings.useQuery({ leagueId: id! }, { enabled: !!id, refetchInterval: 10000 });
  const leagueContests = trpc.league.leagueContests.useQuery({ leagueId: id! }, { enabled: !!id, refetchInterval: 10000 });
  // Check for active auction/draft room
  const { data: draftRooms } = trpc.draft.getRoomsByLeague.useQuery({ leagueId: id! }, { enabled: !!id, refetchInterval: 10000 });
  const activeDraftRoom = (draftRooms ?? []).find((r: any) => r.status === "waiting" || r.status === "in_progress");
  const completedDraftRoom = (draftRooms ?? []).find((r: any) => r.status === "completed");
  const startDraftMutation = trpc.league.startDraft.useMutation({
    onSuccess: (room) => {
      const route = room!.type === "auction" ? `/auction/${room!.id}` as const : `/draft/${room!.id}` as const;
      router.push(route as any);
    },
    onError: (err) => {
      Alert.alert("Error", err.message ?? "Failed to start auction");
    },
  });
  const leaveMutation = trpc.league.leave.useMutation({ onSuccess: () => router.back() });
  const kickMutation = trpc.league.kickMember.useMutation({ onSuccess: () => refetch() });
  const promoteMutation = trpc.league.promoteMember.useMutation({ onSuccess: () => refetch() });

  // Sorted contest list. Items are tagged with `joined` from the
  // server. We materialize a flat list here that interleaves section
  // headers ("your contests" / "available to join") between the two
  // groups, so the FlatList can render one continuous stream while the
  // user reads it as two distinct sections.
  const sortedContests = useMemo(() => {
    const data = (leagueContests.data ?? []) as any[];
    const sortFn = (a: any, b: any) => {
      const statusDiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      const timeA = a.match?.startTime ? new Date(a.match.startTime).getTime() : 0;
      const timeB = b.match?.startTime ? new Date(b.match.startTime).getTime() : 0;
      return timeA - timeB;
    };
    const joined = data.filter((c) => c.joined).sort(sortFn);
    const available = data.filter((c) => !c.joined).sort(sortFn);
    const items: any[] = [];
    if (joined.length > 0) {
      items.push({ __section: true, id: "header-joined", label: "your contests" });
      items.push(...joined);
    }
    if (available.length > 0) {
      items.push({ __section: true, id: "header-available", label: "available to join" });
      items.push(...available);
    }
    return items;
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

  // Cricket Manager format has its own layout — rounds + season standings
  if (league.format === "cricket_manager") {
    return <CricketManagerLeagueView league={league} leagueId={id!} />;
  }

  // Match by DB UUID or by email (user.id is Firebase UID, members use DB UUID)
  const myMembership = league.members?.find((m: any) =>
    m.userId === user?.id || m.user?.email === user?.email
  );
  const isOwner = myMembership?.role === "owner" || league.ownerId === user?.id;
  const isAdmin = myMembership?.role === "admin" || isOwner;
  const shareLink = `https://app.draftplay.ai/league/join?code=${league.inviteCode}`;
  const shareInvite = () => { Share.share({ message: `${formatUIText("join my draftplay league")} "${league.name}"!\n${shareLink}` }); };
  // Public leagues don't need an invite code — a direct link to the
  // league page is enough since anyone can join from there. Sharing
  // that link is how public leagues grow.
  const publicShareLink = `https://app.draftplay.ai/league/${id}`;
  const sharePublicLeague = () => {
    Share.share({
      message: `${formatUIText("check out this public draftplay league")} "${league.name}" — ${league.tournament}\n${publicShareLink}`,
    });
  };
  const handleStartDraft = (type: "snake_draft" | "auction") => {
    const label = type === "auction" ? "auction" : "snake draft";
    setConfirmAlert({
      title: `start ${label}?`,
      message: "all members will be notified. this cannot be undone.",
      onConfirm: () => {
        setConfirmAlert(null);
        startDraftMutation.mutate({ leagueId: id!, type });
      },
    });
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
      <FlatList data={tab === "contests" ? sortedContests : (league.members ?? [])} keyExtractor={(item: any) => item.id ?? item.userId} contentContainerStyle={{ padding: 16 }}
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
            <XStack justifyContent="space-between" alignItems="flex-start">
              <Text testID="league-name" flex={1} fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
                {league.name}
              </Text>
              {isAdmin && (
                <Pressable
                  onPress={() => router.push(`/league/${id}/settings` as any)}
                  hitSlop={10}
                  testID="league-settings-icon"
                >
                  <Ionicons name="settings-outline" size={20} color={theme.colorMuted?.val ?? "#888"} />
                </Pressable>
              )}
            </XStack>
            <XStack marginTop="$2" gap="$3" flexWrap="wrap">
              <Badge variant="role" size="sm">
                {formatBadgeText(league.format)}
              </Badge>
              {/* Public leagues get a clear "OPEN" trust signal in place of
                  the casual/competitive template badge — that template
                  taxonomy is private-friend-group language. */}
              {league.isPrivate ? (
                <Badge variant="role" size="sm">
                  {formatBadgeText(league.template)}
                </Badge>
              ) : (
                <Badge variant="success" size="sm">
                  {formatBadgeText("public")}
                </Badge>
              )}
              <Text fontFamily="$mono" fontSize={12} color="$colorMuted" alignSelf="center">
                {/* For unlimited / very-large leagues the cap is noise —
                    just show the live count. Private + small public still
                    show "X/Y" because the cap is meaningful there. */}
                {league.maxMembers >= 10000
                  ? `${league.members?.length ?? 0} ${formatUIText("members")}`
                  : `${league.members?.length ?? 0}/${league.maxMembers} ${formatUIText("members")}`}
              </Text>
            </XStack>
            <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginTop="$2">
              {league.tournament} {league.season ? `- ${league.season}` : ""}
            </Text>
          </Card>

          {/* Public leagues don't need an invite code — a direct share
              link to the league page is enough. Anyone who taps it lands
              on this same page and can join from here. Different shape
              from the private invite card (no code, no QR), just a
              single share button. Hidden when the league is full. */}
          {!league.isPrivate && (league.members?.length ?? 0) < league.maxMembers && (
            <Card marginBottom="$4" padding="$4">
              <XStack justifyContent="space-between" alignItems="center" gap="$3">
                <YStack flex={1}>
                  <Text {...textStyles.hint}>{formatBadgeText("share this league")}</Text>
                  <Text
                    fontFamily="$body"
                    fontSize={12}
                    color="$colorMuted"
                    marginTop={2}
                    lineHeight={16}
                  >
                    {formatUIText(
                      "public — anyone can join from a share link, no code needed"
                    )}
                  </Text>
                </YStack>
                <Button variant="primary" size="sm" onPress={sharePublicLeague} testID="league-public-share-btn">
                  {formatUIText("share link")}
                </Button>
              </XStack>
            </Card>
          )}

          {/* Invite friends is private-league only — public leagues use
              the share card above instead. Hidden when the league is full. */}
          {league.isPrivate && (league.members?.length ?? 0) < league.maxMembers && (
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
          )}

          <LeagueRulesCard league={league} />

          <LeaguePrizesCard leagueId={id!} />

          {/* Active auction/draft — join banner for ALL members */}
          {activeDraftRoom && (
            <Card
              testID="league-active-auction-banner"
              marginBottom="$4"
              padding="$4"
              borderWidth={2}
              borderColor="$accentBackground"
              pressable
              onPress={() => {
                const route = activeDraftRoom.type === "auction"
                  ? `/auction/${activeDraftRoom.id}`
                  : `/draft/${activeDraftRoom.id}`;
                router.push(route as any);
              }}
            >
              <XStack alignItems="center" justifyContent="space-between">
                <YStack flex={1}>
                  <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$accentBackground">
                    {formatUIText(activeDraftRoom.type === "auction" ? "auction is live!" : "draft is live!")}
                  </Text>
                  <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop={2}>
                    {formatUIText("tap to join and pick your squad")}
                  </Text>
                </YStack>
                <Badge variant="live" size="sm">LIVE</Badge>
              </XStack>
            </Card>
          )}

          {/* Completed auction — report card button for ALL members */}
          {completedDraftRoom && (
            <Card
              testID="league-report-card-banner"
              marginBottom="$4"
              padding="$4"
              borderWidth={1}
              borderColor="$accentBackground"
              pressable
              onPress={() => router.push(`/auction/report?roomId=${completedDraftRoom.id}` as any)}
            >
              <XStack alignItems="center" justifyContent="space-between">
                <YStack flex={1}>
                  <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$accentBackground">
                    {formatUIText("auction complete")}
                  </Text>
                  <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop={2}>
                    {formatUIText("view your report card and squad")}
                  </Text>
                </YStack>
                <Badge variant="default" size="sm">REPORT</Badge>
              </XStack>
            </Card>
          )}

          {/* Admin controls — only show start button if no active or completed auction.
              Settings has been moved to the gear icon in the league header card. */}
          {isAdmin && !activeDraftRoom && !completedDraftRoom && (league.format === "draft" || league.format === "auction") && (
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
            </XStack>
          )}

          {/* Podium preview — winner + runner-up at a glance, replacing the
              old standalone settings button. Only shows when at least one
              member has scored points (no point teasing an empty board).
              Trophy is reserved for actually-won leagues; while in progress
              we use silver/bronze to mark the leader and chaser. */}
          {(standings.data?.length ?? 0) > 0 && (() => {
            const isLeagueSettled = league.status === "completed" || league.status === "archived";
            return (
            <Card marginBottom="$4" padding="$4">
              <Text {...textStyles.hint} marginBottom="$3">{formatBadgeText("standings")}</Text>
              <XStack gap="$3">
                {standings.data!.slice(0, 2).map((s: any, i: number) => {
                  const isFirst = i === 0;
                  // Settled: 🏆 / 🥈 with WINNER / RUNNER labels.
                  // In progress: 🥇 / 🥈 with LEADING / CHASING labels —
                  // medal family marks placement, trophy is reserved for the
                  // actual championship outcome.
                  const emoji = isLeagueSettled
                    ? (isFirst ? "🏆" : "🥈")
                    : (isFirst ? "🥇" : "🥈");
                  const label = isLeagueSettled
                    ? (isFirst ? "winner" : "runner")
                    : (isFirst ? "leading" : "chasing");
                  const color = isFirst ? "$colorCricket" : "$colorSecondary";
                  return (
                    <Pressable
                      key={s.userId}
                      style={{ flex: 1 }}
                      onPress={() =>
                        setSelectedMember({
                          userId: s.userId,
                          displayName: s.displayName,
                          rank: s.rank,
                          totalPoints: s.totalPoints,
                          contestsPlayed: s.contestsPlayed,
                        })
                      }
                    >
                      <Card
                        padding="$3"
                        borderWidth={1}
                        borderColor={color}
                      >
                        <XStack alignItems="center" gap="$2" marginBottom="$2">
                          <Text fontFamily="$mono" fontSize={16}>
                            {emoji}
                          </Text>
                          <Text fontFamily="$mono" fontSize={10} fontWeight="700" color={color} letterSpacing={0.5}>
                            {formatBadgeText(label)}
                          </Text>
                        </XStack>
                        <Text {...textStyles.playerName} numberOfLines={1}>
                          {s.displayName}
                        </Text>
                        <Text fontFamily="$mono" fontWeight="700" fontSize={15} color="$accentBackground" marginTop={2}>
                          {s.totalPoints.toFixed(1)}
                        </Text>
                      </Card>
                    </Pressable>
                  );
                })}
              </XStack>

              {/* My-rank tile — when the current user isn't in the top 2,
                  surface their rank inline so they can immediately answer
                  "where do I stand?" without opening the full standings.
                  Especially important in large public leagues. */}
              {(() => {
                const me = standings.data?.find((s: any) => s.userId === user?.id);
                if (!me || me.rank <= 2) return null;
                return (
                  <Pressable
                    onPress={() =>
                      setSelectedMember({
                        userId: me.userId,
                        displayName: me.displayName,
                        rank: me.rank,
                        totalPoints: me.totalPoints,
                        contestsPlayed: me.contestsPlayed,
                      })
                    }
                  >
                    <XStack
                      marginTop="$3"
                      paddingHorizontal="$3"
                      paddingVertical="$3"
                      borderRadius="$3"
                      backgroundColor="$backgroundSurfaceAlt"
                      borderWidth={1}
                      borderColor="$accentBackground"
                      alignItems="center"
                      gap="$2"
                    >
                      <YStack flex={1}>
                        <Text fontFamily="$mono" fontSize={10} fontWeight="700" color="$accentBackground" letterSpacing={0.5}>
                          {formatBadgeText("you")}
                        </Text>
                        <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color" marginTop={2}>
                          #{me.rank} · {me.totalPoints.toFixed(1)} pts
                        </Text>
                      </YStack>
                      <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                        {(standings.data?.length ?? 0) - me.rank > 0
                          ? `${(standings.data?.length ?? 0) - me.rank} ${formatUIText("behind you")}`
                          : ""}
                      </Text>
                    </XStack>
                  </Pressable>
                );
              })()}

              {/* "See all standings" — only show if there are members beyond
                  the top 2 already displayed in the podium. */}
              {(standings.data?.length ?? 0) > 2 && (
                <Pressable onPress={() => setShowFullStandings(true)} style={{ marginTop: 12 }}>
                  <XStack
                    alignItems="center"
                    justifyContent="center"
                    paddingVertical="$2"
                    borderRadius="$3"
                    backgroundColor="$backgroundSurfaceAlt"
                  >
                    <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$accentBackground">
                      {formatUIText("see all standings")} →
                    </Text>
                  </XStack>
                </Pressable>
              )}
            </Card>
            );
          })()}

          {/* Trades only apply to draft/auction formats — those have a
              persistent player roster that members can trade. Salary cap
              builds a fresh team per contest, so there's nothing to trade.
              CM uses a separate render path entirely (renderCricketManagerView). */}
          {(league.format === "draft" || league.format === "auction") && (
            <Button testID="league-view-trades-btn" variant="secondary" size="md" marginBottom="$4" onPress={() => router.push(`/league/${id}/trades` as any)}>
              <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                {formatUIText("view trades")}
              </Text>
            </Button>
          )}

          {/* Tab switcher: Contests / Members. Standings has its own podium
              card above + "see all" sheet, so it doesn't need a tab here. */}
          {/* Members tab is private-league only — for public leagues with
              hundreds of strangers, browsing the full member list is
              meaningless and the kick/promote actions are admin-only
              anyway. Public leagues just see Contests. */}
          {league.isPrivate ? (
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
              ]).map((tb) => (
                <SegmentTab key={tb.key} active={tab === tb.key} onPress={() => setTab(tb.key)}>
                  <Text fontFamily="$body" fontWeight="600" fontSize={13} color={tab === tb.key ? "$color" : "$colorMuted"}>
                    {formatUIText(tb.label)}
                  </Text>
                </SegmentTab>
              ))}
            </XStack>
          ) : null}

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
            // Section header rendered as a row inside the contest stream
            if (item.__section) {
              return (
                <Text
                  {...textStyles.sectionHeader}
                  marginTop={index === 0 ? "$0" : "$3"}
                  marginBottom="$2"
                  testID={`section-${item.id}`}
                >
                  {formatUIText(item.label)}
                </Text>
              );
            }
            const contest = item;
            const match = contest.match;
            const statusVariant = STATUS_VARIANT[contest.status] ?? "default";
            // Drop the league-name prefix from the contest title — the
            // user is already on the league page, so the league name is
            // redundant. Server-generated names look like
            // "<League Name>" by default; if the contest name is exactly
            // the league name, fall back to the match label.
            const matchLabel = match ? `${match.teamHome} vs ${match.teamAway}` : "";
            const cleanedName =
              contest.name && contest.name !== league.name
                ? contest.name.replace(new RegExp(`^${league.name}\\s*[·-]\\s*`), "")
                : matchLabel || contest.name;
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
                      {cleanedName}
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
          // Members tab (original) — standings has its own podium card +
          // FullStandingsSheet, so we don't render it inside this list.
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
          ) : null
        }
        ListFooterComponent={!isOwner && myMembership ? (
          <Button
            variant="danger"
            size="md"
            marginTop="$4"
            onPress={() => {
              // Salary cap + CM build per-contest/round teams; nothing to
              // "lose" beyond future participation. Draft + auction have a
              // persistent roster you forfeit. Either way, any PC entry
              // fees already spent on joined contests are non-refundable.
              const base =
                league.format === "draft" || league.format === "auction"
                  ? "your roster will be released and you'll forfeit your standing."
                  : "you'll stop appearing in this league's standings going forward — your past contest history is preserved.";
              setConfirmAlert({
                title: "leave league?",
                message:
                  base +
                  " any pop coins you've already spent on entry fees in this league will NOT be refunded.",
                confirmLabel: "leave league",
                confirmVariant: "danger",
                onConfirm: () => {
                  setConfirmAlert(null);
                  leaveMutation.mutate({ leagueId: id! });
                },
              });
            }}
          >
            {formatUIText("leave league")}
          </Button>
        ) : null}
      />
      {confirmAlert && (
        <AlertModal
          visible={!!confirmAlert}
          title={confirmAlert.title}
          message={confirmAlert.message}
          onDismiss={() => setConfirmAlert(null)}
          actions={[
            { label: "cancel", variant: "ghost", onPress: () => setConfirmAlert(null) },
            {
              label: confirmAlert.confirmLabel ?? "start",
              variant: confirmAlert.confirmVariant ?? "primary",
              onPress: confirmAlert.onConfirm,
            },
          ]}
        />
      )}
      {selectedMember && id && (
        <MemberBreakdownSheet
          visible={!!selectedMember}
          onClose={() => setSelectedMember(null)}
          leagueId={id}
          userId={selectedMember.userId}
          displayName={selectedMember.displayName}
          rank={selectedMember.rank}
          totalPoints={selectedMember.totalPoints}
          contestsPlayed={selectedMember.contestsPlayed}
          isMe={selectedMember.userId === user?.id}
        />
      )}
      <FullStandingsSheet
        visible={showFullStandings}
        onClose={() => setShowFullStandings(false)}
        rows={(standings.data ?? []) as any}
        isLeagueSettled={league.status === "completed" || league.status === "archived"}
        currentUserId={user?.id}
        onSelectMember={(entry) => setSelectedMember(entry)}
      />
    </YStack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cricket Manager league view — rounds list + season standings
// ─────────────────────────────────────────────────────────────────────────────

const CM_STATUS_VARIANT: Record<
  string,
  "default" | "live" | "role" | "warning" | "danger" | "success"
> = {
  upcoming: "role",
  open: "success",
  locked: "role",
  live: "live",
  settled: "default",
  void: "danger",
};

function CricketManagerLeagueView({
  league,
  leagueId,
}: {
  league: any;
  leagueId: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [cmTab, setCmTab] = useState<"rounds" | "standings" | "members">("rounds");
  const [confirmLeave, setConfirmLeave] = useState(false);

  const roundsQuery = trpc.cricketManager.getLeagueRounds.useQuery(
    { leagueId },
    { refetchInterval: 15000 }
  );
  const standingsQuery = trpc.cricketManager.getLeagueStandings.useQuery(
    { leagueId, limit: 200, offset: 0 },
    { enabled: cmTab === "standings", refetchInterval: 15000 }
  );
  const leaveMutation = trpc.league.leave.useMutation({
    onSuccess: () => router.back(),
  });

  const cmMembership = (league.members ?? []).find(
    (m: any) => m.userId === user?.id || m.user?.email === user?.email
  );
  const cmIsOwner =
    cmMembership?.role === "owner" || league.ownerId === user?.id;

  const roundsData = roundsQuery.data ?? [];
  const standingsData = standingsQuery.data ?? [];
  const data =
    cmTab === "rounds"
      ? roundsData
      : cmTab === "standings"
      ? standingsData
      : league.members ?? [];

  return (
    <YStack flex={1} backgroundColor="$background" testID="cm-league-detail">
      <FlatList
        data={data as any[]}
        keyExtractor={(item: any) =>
          item.id ?? item.userId ?? `${Math.random()}`
        }
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <>
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

            {/* League header */}
            <Card padding="$5" marginBottom="$4">
              <Text
                fontFamily="$mono"
                fontWeight="500"
                fontSize={17}
                color="$color"
                letterSpacing={-0.5}
              >
                {league.name}
              </Text>
              <XStack marginTop="$2" gap="$3" flexWrap="wrap">
                <Badge variant="role" size="sm">
                  cricket manager
                </Badge>
                <Text
                  fontFamily="$mono"
                  fontSize={12}
                  color="$colorMuted"
                  alignSelf="center"
                >
                  {league.members?.length ?? 0}/{league.maxMembers}{" "}
                  {formatUIText("members")}
                </Text>
              </XStack>
              <Text
                fontFamily="$body"
                fontSize={13}
                color="$colorMuted"
                marginTop="$2"
              >
                {league.tournament}
              </Text>
              {league.rules?.cricketManager?.prizePool > 0 && (
                <Text
                  fontFamily="$mono"
                  fontSize={12}
                  color="$colorCricket"
                  marginTop="$1"
                >
                  prize pool: {league.rules.cricketManager.prizePool} PC
                </Text>
              )}
            </Card>

            <LeaguePrizesCard leagueId={leagueId} />

            {/* Tab switcher */}
            <XStack
              marginBottom="$3"
              borderRadius="$3"
              backgroundColor="$backgroundSurfaceAlt"
              padding="$1"
              gap="$1"
            >
              {([
                { key: "rounds" as const, label: "rounds" },
                { key: "standings" as const, label: "standings" },
                { key: "members" as const, label: "members" },
              ]).map((t) => (
                <SegmentTab
                  key={t.key}
                  active={cmTab === t.key}
                  onPress={() => setCmTab(t.key)}
                >
                  <Text
                    fontFamily="$body"
                    fontWeight="600"
                    fontSize={13}
                    color={cmTab === t.key ? "$color" : "$colorMuted"}
                  >
                    {formatUIText(t.label)}
                  </Text>
                </SegmentTab>
              ))}
            </XStack>
          </>
        }
        renderItem={({ item, index }: { item: any; index: number }) => {
          if (cmTab === "rounds") {
            const round = item;
            return (
              <Animated.View
                entering={FadeInDown.delay(index * 40).springify()}
              >
                <Card
                  pressable
                  marginBottom="$2"
                  padding="$4"
                  onPress={() =>
                    router.push(
                      `/league/${leagueId}/round/${round.id}` as never
                    )
                  }
                  borderColor={
                    round.status === "live" ? "$colorCricket" : "$borderColor"
                  }
                  borderWidth={round.status === "live" ? 2 : 1}
                  testID={`cm-round-${round.id}`}
                >
                  <XStack justifyContent="space-between" alignItems="flex-start">
                    <XStack alignItems="center" gap="$2" flex={1}>
                      <Text
                        fontFamily="$mono"
                        fontWeight="700"
                        fontSize={12}
                        color="$accentBackground"
                        backgroundColor="rgba(61,153,104,0.1)"
                        paddingHorizontal="$2"
                        paddingVertical={2}
                        borderRadius="$2"
                      >
                        R{round.roundNumber}
                      </Text>
                      <Text
                        fontFamily="$body"
                        fontWeight="700"
                        fontSize={14}
                        color="$color"
                        flex={1}
                        numberOfLines={1}
                      >
                        {round.name}
                      </Text>
                    </XStack>
                    <Badge
                      variant={CM_STATUS_VARIANT[round.status] ?? "default"}
                      size="sm"
                    >
                      {formatBadgeText(round.status)}
                    </Badge>
                  </XStack>
                  <Text
                    fontFamily="$body"
                    fontSize={11}
                    color="$colorMuted"
                    marginTop="$2"
                  >
                    {round.matchesTotal} {formatUIText("matches")} ·{" "}
                    {new Date(round.windowStart).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                    {" → "}
                    {new Date(round.windowEnd).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </Text>
                  {round.totalEntries > 0 && (
                    <Text
                      fontFamily="$mono"
                      fontSize={11}
                      color="$colorCricket"
                      marginTop="$1"
                    >
                      {round.totalEntries} {formatUIText("entries")}
                      {round.bestNrr != null &&
                        ` · best NRR ${Number(round.bestNrr).toFixed(2)}`}
                    </Text>
                  )}
                </Card>
              </Animated.View>
            );
          }

          if (cmTab === "standings") {
            const s = item;
            const isMe = s.userId === user?.id;
            // Use the anonymous username — email can leak the user's
            // real identity, username never does.
            const label = s.username ?? "player";
            return (
              <Animated.View
                entering={FadeInDown.delay(index * 30).springify()}
              >
                <Card
                  marginBottom="$2"
                  padding="$3"
                  borderColor={isMe ? "$accentBackground" : "$borderColor"}
                  borderWidth={isMe ? 2 : 1}
                >
                  <XStack alignItems="center">
                    <YStack width={32} alignItems="center">
                      <Text
                        fontFamily="$mono"
                        fontWeight="800"
                        fontSize={14}
                        color={
                          index === 0
                            ? "$colorCricket"
                            : index === 1
                            ? "$colorSecondary"
                            : "$color"
                        }
                      >
                        #{s.rank ?? index + 1}
                      </Text>
                    </YStack>
                    <XStack alignItems="center" gap="$2" flex={1} marginLeft="$2">
                      <InitialsAvatar
                        name={label}
                        playerRole="BAT"
                        ovr={0}
                        size={32}
                        hideBadge
                      />
                      <YStack flex={1}>
                        <Text {...textStyles.playerName}>{label}</Text>
                        {isMe && (
                          <Badge
                            variant="live"
                            size="sm"
                            alignSelf="flex-start"
                          >
                            {formatUIText("you")}
                          </Badge>
                        )}
                      </YStack>
                    </XStack>
                    <YStack alignItems="flex-end">
                      <Text
                        fontFamily="$mono"
                        fontWeight="700"
                        fontSize={15}
                        color="$accentBackground"
                      >
                        {Number(s.totalNrr).toFixed(2)}
                      </Text>
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                        {s.roundsPlayed}{" "}
                        {formatUIText(
                          s.roundsPlayed === 1 ? "round" : "rounds"
                        )}
                      </Text>
                    </YStack>
                  </XStack>
                </Card>
              </Animated.View>
            );
          }

          // Members tab
          const m = item;
          return (
            <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
              <Card marginBottom="$2" padding="$4">
                <XStack alignItems="center" gap="$3">
                  <InitialsAvatar
                    name={m.user?.displayName ?? m.user?.username ?? "?"}
                    playerRole="BAT"
                    ovr={0}
                    size={36}
                    hideBadge
                  />
                  <YStack flex={1}>
                    <Text {...textStyles.playerName}>
                      {m.user?.displayName ??
                        m.user?.username ??
                        formatUIText("unknown")}
                    </Text>
                    <Badge
                      variant="role"
                      size="sm"
                      alignSelf="flex-start"
                      marginTop={2}
                    >
                      {formatBadgeText(m.role)}
                    </Badge>
                  </YStack>
                </XStack>
              </Card>
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          // Show a loading spinner while the relevant query is in
          // flight — without this the empty state flashes for a beat
          // before the rounds load, which made users think their league
          // had no rounds when it actually had several.
          cmTab === "rounds" && roundsQuery.isLoading ? (
            <YStack alignItems="center" paddingVertical="$8">
              <EggLoadingSpinner size={40} message={formatUIText("loading rounds")} />
            </YStack>
          ) : cmTab === "standings" && standingsQuery.isLoading ? (
            <YStack alignItems="center" paddingVertical="$8">
              <EggLoadingSpinner size={40} message={formatUIText("loading standings")} />
            </YStack>
          ) : cmTab === "rounds" ? (
            <Card padding="$5" alignItems="center">
              <Text {...textStyles.hint}>
                {formatUIText(
                  "no rounds yet — check back when the admin composes the first round"
                )}
              </Text>
            </Card>
          ) : cmTab === "standings" ? (
            <Card padding="$5" alignItems="center">
              <Text {...textStyles.hint}>
                {formatUIText("no standings yet — submit a round entry to appear")}
              </Text>
            </Card>
          ) : null
        }
        ListFooterComponent={
          !cmIsOwner && cmMembership ? (
            <Button
              variant="danger"
              size="md"
              marginTop="$4"
              onPress={() => setConfirmLeave(true)}
            >
              {formatUIText("leave league")}
            </Button>
          ) : null
        }
      />
      {confirmLeave && (
        <AlertModal
          visible={confirmLeave}
          title={formatUIText("leave league?")}
          message={formatUIText(
            "you'll stop appearing in future rounds and standings. your past entries stay on record. any pop coins you've already spent on round entry fees will NOT be refunded."
          )}
          onDismiss={() => setConfirmLeave(false)}
          actions={[
            {
              label: "cancel",
              variant: "ghost",
              onPress: () => setConfirmLeave(false),
            },
            {
              label: "leave league",
              variant: "danger",
              onPress: () => {
                setConfirmLeave(false);
                leaveMutation.mutate({ leagueId });
              },
            },
          ]}
        />
      )}
    </YStack>
  );
}

// ─── Prizes card — shown on league page for any format ─────────────────────
// Rendered when an admin has announced one or more prizes on the league.
// Purely read-only on mobile; editing happens in the admin portal.

function LeaguePrizesCard({ leagueId }: { leagueId: string }) {
  const prizesQuery = trpc.league.getPrizes.useQuery(
    { leagueId },
    { enabled: !!leagueId }
  );
  const prizes = prizesQuery.data ?? [];
  if (prizes.length === 0) return null;

  return (
    <Card padding="$4" marginBottom="$4">
      <XStack alignItems="center" gap="$2" marginBottom="$3">
        <Text fontSize={18}>🎁</Text>
        <Text
          fontFamily="$mono"
          fontWeight="700"
          fontSize={14}
          color="$color"
          letterSpacing={-0.3}
        >
          {formatUIText("prizes")}
        </Text>
        <Badge variant="role" size="sm">
          {formatBadgeText(`${prizes.length}`)}
        </Badge>
      </XStack>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingRight: 4 }}
      >
        {prizes.map((p: any) => {
          const rankLabel =
            p.rankFrom === p.rankTo
              ? `#${p.rankFrom}`
              : `#${p.rankFrom}–${p.rankTo}`;
          return (
            <YStack key={p.id} width={140} gap="$2">
              {p.imageUrl ? (
                <Image
                  source={{ uri: p.imageUrl }}
                  style={{ width: 140, height: 140, borderRadius: 8 }}
                  resizeMode="cover"
                />
              ) : (
                <YStack
                  width={140}
                  height={140}
                  borderRadius={8}
                  backgroundColor="$backgroundSurfaceAlt"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text fontSize={36}>🏆</Text>
                </YStack>
              )}
              <Text
                fontFamily="$mono"
                fontWeight="700"
                fontSize={10}
                color="$accentBackground"
              >
                {rankLabel}
              </Text>
              <Text
                fontFamily="$body"
                fontWeight="600"
                fontSize={13}
                color="$color"
                numberOfLines={2}
              >
                {p.title}
              </Text>
            </YStack>
          );
        })}
      </ScrollView>
    </Card>
  );
}

// ─── How you win — dynamic rules modal ─────────────────────────────────────
// Reads league.rules and renders a human-readable summary. Mirrors the CM
// NrrExplainerModal pattern (plain View + RN Modal to avoid iOS Chrome NaN
// crashes from Tamagui-shorthand insets). Any format with meaningful rules
// gets a card — formats without configured rules just hide the card.

export function LeagueRulesCard({ league }: { league: any }) {
  const [open, setOpen] = useState(false);

  const sections = useMemo(
    () => buildRuleSections(league),
    [league]
  );

  // Don't show the card if there's nothing to explain.
  if (sections.length === 0) return null;

  const intro = introForFormat(league.format);

  return (
    <>
      <Card
        padding="$4"
        marginBottom="$4"
        pressable
        onPress={() => setOpen(true)}
      >
        <XStack alignItems="center" justifyContent="space-between">
          <XStack alignItems="center" gap="$2" flex={1}>
            <Text fontSize={18}>🏆</Text>
            <YStack flex={1}>
              <Text
                fontFamily="$mono"
                fontWeight="700"
                fontSize={14}
                color="$color"
                letterSpacing={-0.3}
              >
                {formatUIText("how you win")}
              </Text>
              <Text
                fontFamily="$body"
                fontSize={11}
                color="$colorMuted"
                marginTop={2}
              >
                {formatUIText("tap to see this league's rules")}
              </Text>
            </YStack>
          </XStack>
          <Ionicons name="chevron-forward" size={16} color="#888" />
        </XStack>
      </Card>
      <LeagueRulesModal
        visible={open}
        onClose={() => setOpen(false)}
        intro={intro}
        sections={sections}
        title={formatBadgeText(league.format ?? "league")}
      />
    </>
  );
}

function introForFormat(fmt: string): string {
  switch (fmt) {
    case "salary_cap":
      return "pick 11 players within the credit budget. captain doubles their points. highest total wins the contest.";
    case "draft":
      return "take turns picking unique players. the pool empties as you go — a player you miss is gone. highest-scoring squad across the season wins.";
    case "auction":
      return "bid credits for each player. once you own them, they score for you all season. spend wisely — your budget is all you get.";
    case "prediction":
      return "answer questions about matches. correct predictions earn points. top of the leaderboard wins.";
    default:
      return "compete against your league members — highest points wins.";
  }
}

function buildRuleSections(league: any): Array<{ title: string; rows: Array<{ label: string; value: string }> }> {
  const rules = league?.rules ?? {};
  const sections: Array<{ title: string; rows: Array<{ label: string; value: string }> }> = [];
  const fmt = league?.format;

  const tc = rules.teamComposition;
  if (tc) {
    const rows: Array<{ label: string; value: string }> = [
      { label: "squad size", value: `${tc.teamSize} players` },
    ];
    if (typeof tc.minBatsmen === "number" || typeof tc.maxBatsmen === "number") {
      rows.push({
        label: "role limits",
        value: `BAT ${tc.minBatsmen}-${tc.maxBatsmen} · BOWL ${tc.minBowlers}-${tc.maxBowlers} · AR ${tc.minAllRounders}-${tc.maxAllRounders} · WK ${tc.minWicketKeepers}-${tc.maxWicketKeepers}`,
      });
    }
    if (typeof tc.maxFromOneTeam === "number") {
      rows.push({ label: "max from one team", value: `${tc.maxFromOneTeam}` });
    }
    if (typeof tc.maxOverseasPlayers === "number") {
      rows.push({ label: "max overseas", value: `${tc.maxOverseasPlayers}` });
    }
    sections.push({ title: "squad", rows });
  }

  if (fmt === "salary_cap" && rules.salary) {
    const rows: Array<{ label: string; value: string }> = [
      { label: "budget", value: `${rules.salary.totalBudget} credits` },
    ];
    if (rules.salary.playerPriceMin != null && rules.salary.playerPriceMax != null) {
      rows.push({
        label: "player prices",
        value: `${rules.salary.playerPriceMin} – ${rules.salary.playerPriceMax} credits`,
      });
    }
    sections.push({ title: "budget", rows });
  }

  if (rules.boosters) {
    const b = rules.boosters;
    const rows: Array<{ label: string; value: string }> = [
      { label: "captain", value: `${b.captainMultiplier}× points` },
      { label: "vice-captain", value: `${b.viceCaptainMultiplier}× points` },
    ];
    if (b.tripleCaptainEnabled) {
      rows.push({ label: "triple captain chip", value: `${b.tripleCaptainUsesPerSeason ?? 1}× per season` });
    }
    if (b.benchBoostEnabled) {
      rows.push({ label: "bench boost chip", value: `${b.benchBoostUsesPerSeason ?? 1}× per season` });
    }
    sections.push({ title: "boosters", rows });
  }

  if (fmt === "draft" && rules.draft) {
    const d = rules.draft;
    sections.push({
      title: "draft",
      rows: [
        { label: "rounds", value: `${d.maxRounds}` },
        { label: "time per pick", value: `${d.timePerPick}s` },
        { label: "order", value: d.snakeDraftEnabled ? "snake (reverses each round)" : "fixed" },
        ...(d.keeperPlayersEnabled
          ? [{ label: "keeper slots", value: `${d.keeperPlayerSlots}` }]
          : []),
      ],
    });
  }

  if (fmt === "auction" && rules.auction) {
    const a = rules.auction;
    sections.push({
      title: "auction",
      rows: [
        { label: "budget", value: `${a.auctionBudget}` },
        { label: "min bid", value: `${a.minBid}` },
        { label: "bid increment", value: `${a.bidIncrement}` },
        { label: "max bid time", value: `${a.maxBidTime}s` },
        { label: "players per team", value: `${a.maxPlayersPerTeam}` },
      ],
    });
  }

  if (rules.scoring) {
    const s = rules.scoring;
    const battingRows: Array<{ label: string; value: string }> = [];
    if (s.runPoints != null) battingRows.push({ label: "run", value: `${s.runPoints} pt${s.runPoints === 1 ? "" : "s"}` });
    if (s.boundaryBonus != null) battingRows.push({ label: "four bonus", value: `+${s.boundaryBonus}` });
    if (s.sixBonus != null) battingRows.push({ label: "six bonus", value: `+${s.sixBonus}` });
    if (s.halfCenturyBonus != null) battingRows.push({ label: "50 bonus", value: `+${s.halfCenturyBonus}` });
    if (s.centuryBonus != null) battingRows.push({ label: "100 bonus", value: `+${s.centuryBonus}` });
    if (s.duckPenalty != null && s.duckPenalty !== 0) battingRows.push({ label: "duck", value: `${s.duckPenalty}` });
    if (battingRows.length) sections.push({ title: "scoring — batting", rows: battingRows });

    const bowlingRows: Array<{ label: string; value: string }> = [];
    if (s.wicketPoints != null) bowlingRows.push({ label: "wicket", value: `${s.wicketPoints}` });
    if (s.maidenOverPoints != null) bowlingRows.push({ label: "maiden over", value: `+${s.maidenOverPoints}` });
    if (s.threeWicketBonus != null) bowlingRows.push({ label: "3 wickets", value: `+${s.threeWicketBonus}` });
    if (s.fiveWicketBonus != null) bowlingRows.push({ label: "5 wickets", value: `+${s.fiveWicketBonus}` });
    if (bowlingRows.length) sections.push({ title: "scoring — bowling", rows: bowlingRows });

    const fieldingRows: Array<{ label: string; value: string }> = [];
    if (s.catchPoints != null) fieldingRows.push({ label: "catch", value: `${s.catchPoints}` });
    if (s.stumpingPoints != null) fieldingRows.push({ label: "stumping", value: `${s.stumpingPoints}` });
    if (s.runOutDirectPoints != null) fieldingRows.push({ label: "run-out (direct)", value: `${s.runOutDirectPoints}` });
    if (s.runOutIndirectPoints != null) fieldingRows.push({ label: "run-out (assist)", value: `${s.runOutIndirectPoints}` });
    if (s.playerOfMatchBonus != null) fieldingRows.push({ label: "player of match", value: `+${s.playerOfMatchBonus}` });
    if (fieldingRows.length) sections.push({ title: "scoring — fielding + match", rows: fieldingRows });
  }

  if (rules.transfers && (rules.transfers.maxTransfersPerWeek ?? 0) > 0) {
    const t = rules.transfers;
    const rows: Array<{ label: string; value: string }> = [
      {
        label: "transfers / week",
        value: `${t.maxTransfersPerWeek} (${t.freeTransfersPerWeek} free${t.transferPenaltyPoints > 0 ? `, −${t.transferPenaltyPoints} pts after` : ""})`,
      },
    ];
    if (t.tradeWindowOpen) {
      rows.push({
        label: "trade window",
        value: `day ${t.tradeWindowStartDay}–${t.tradeWindowEndDay} of the week`,
      });
    }
    if (t.waiverWireEnabled) {
      rows.push({ label: "waiver wire", value: t.waiverWirePriority?.replace(/_/g, " ") ?? "on" });
    }
    sections.push({ title: "transfers", rows });
  }

  if (rules.playoffs?.playoffsEnabled) {
    const p = rules.playoffs;
    sections.push({
      title: "playoffs",
      rows: [
        { label: "format", value: `${p.playoffFormat?.replace(/_/g, " ") ?? "knockout"}` },
        { label: "size", value: `${p.playoffSize} teams` },
        { label: "rounds", value: `${p.playoffRounds}` },
        ...(p.homeAdvantageEnabled
          ? [{ label: "home advantage", value: `+${p.homeAdvantageBonus} pts` }]
          : []),
      ],
    });
  }

  return sections;
}

function LeagueRulesModal({
  visible,
  onClose,
  intro,
  sections,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  intro: string;
  sections: Array<{ title: string; rows: Array<{ label: string; value: string }> }>;
  title: string;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const safeTop = typeof insets?.top === "number" ? insets.top : 0;
  const safeBottom = typeof insets?.bottom === "number" ? insets.bottom : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: t.overlay,
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          paddingTop: safeTop + 24,
          paddingBottom: safeBottom + 24,
        }}
      >
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onClose}
        />
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            flexShrink: 1,
            backgroundColor: t.bgSurface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: t.border,
            overflow: "hidden",
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text
              fontFamily="$mono"
              fontWeight="700"
              fontSize={20}
              color="$color"
              letterSpacing={-0.5}
              marginBottom="$2"
            >
              {formatUIText("how you win")}
            </Text>
            <Badge variant="role" size="sm" alignSelf="flex-start" marginBottom="$3">
              {title}
            </Badge>
            <Text
              fontFamily="$body"
              fontSize={13}
              color="$colorMuted"
              marginBottom="$4"
              lineHeight={19}
            >
              {formatUIText(intro)}
            </Text>

            {sections.map((s) => (
              <YStack
                key={s.title}
                padding="$3"
                backgroundColor="$backgroundSurfaceAlt"
                borderRadius={10}
                marginBottom="$3"
              >
                <Text
                  fontFamily="$mono"
                  fontWeight="700"
                  fontSize={12}
                  color="$accentBackground"
                  textTransform="uppercase"
                  letterSpacing={1}
                  marginBottom="$2"
                >
                  {s.title}
                </Text>
                <YStack gap="$2">
                  {s.rows.map((r) => (
                    <XStack key={r.label} justifyContent="space-between" gap="$3">
                      <Text
                        fontFamily="$body"
                        fontSize={12}
                        color="$colorMuted"
                        flex={1}
                      >
                        {r.label}
                      </Text>
                      <Text
                        fontFamily="$mono"
                        fontWeight="600"
                        fontSize={12}
                        color="$color"
                        flex={1}
                        textAlign="right"
                      >
                        {r.value}
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              </YStack>
            ))}

            <Button variant="primary" size="lg" onPress={onClose}>
              {formatUIText("got it")}
            </Button>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
