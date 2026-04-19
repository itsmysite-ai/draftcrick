import { SafeBackButton } from "../../components/SafeBackButton";
import { TextInput, ScrollView } from "react-native";
import { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Button,
  Card,
  Badge,
  AnnouncementBanner,
  DesignSystem,
  EggLoadingSpinner,
  formatUIText,
  formatBadgeText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { HeaderControls } from "../../components/HeaderControls";
import { useRequireAuth } from "../../hooks/useRequireAuth";

export default function JoinLeagueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [inviteCode, setInviteCode] = useState(code?.trim() ?? "");
  const [joined, setJoined] = useState(false);
  const [joinedLeagueId, setJoinedLeagueId] = useState<string | null>(null);

  // Redirect to login if not authenticated, preserving the invite code
  const isAuthed = useRequireAuth();
  if (!isAuthed) return <Redirect href="/auth/login" />;

  // Preview the league when we have a code
  const previewQuery = trpc.league.previewInvite.useQuery(
    { inviteCode: inviteCode.trim() },
    { enabled: inviteCode.trim().length > 0, retry: false },
  );
  const preview = previewQuery.data;

  const joinMutation = trpc.league.join.useMutation({
    onSuccess: (league) => {
      setJoined(true);
      setJoinedLeagueId(league!.id);
    },
  });

  // Sync URL code param into state
  useEffect(() => {
    if (code?.trim()) setInviteCode(code.trim());
  }, [code]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
    <YStack flex={1} backgroundColor="$background" testID="join-league-screen">
      {/* ── Inline Header ── */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={insets.top + 8}
        paddingBottom="$2"
      >
        <SafeBackButton />
        <HeaderControls />
      </XStack>

      <AnnouncementBanner />

      {/* ── Content ── */}
      <YStack flex={1} justifyContent="center" paddingHorizontal="$4">
        <YStack alignItems="center" marginBottom="$4">
          <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
        </YStack>

        {/* ── Success State ── */}
        {joined && joinedLeagueId ? (
          <YStack alignItems="center" gap="$3">
            <Text fontFamily="$mono" fontWeight="700" fontSize={20} color="$accentBackground" textAlign="center">
              {formatUIText("you're in!")}
            </Text>
            <Text fontFamily="$body" fontSize={14} color="$color" textAlign="center">
              {formatUIText(`you've joined "${preview?.name ?? "the league"}"`)}
            </Text>
            <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center" marginBottom="$2">
              {formatUIText("create your team for upcoming matches to start competing")}
            </Text>
            <Button variant="primary" size="lg" onPress={() => router.replace(`/league/${joinedLeagueId}` as any)} testID="go-to-league-btn">
              {formatUIText("go to league")}
            </Button>
            <Button variant="secondary" size="md" onPress={() => router.replace("/(tabs)")} testID="go-home-btn">
              {formatUIText("go home")}
            </Button>
          </YStack>
        ) : preview?.alreadyMember ? (
          /* ── Already a Member ── */
          <YStack alignItems="center" gap="$3">
            <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color" textAlign="center">
              {formatUIText("you're already in this league")}
            </Text>
            <Text fontFamily="$body" fontSize={13} color="$colorMuted" textAlign="center">
              {preview.name}
            </Text>
            <Button variant="primary" size="lg" onPress={() => router.replace(`/league/${preview.id}` as any)} testID="view-league-btn">
              {formatUIText("go to league")}
            </Button>
          </YStack>
        ) : (
          /* ── Join Flow ── */
          <>
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" textAlign="center" letterSpacing={-0.5} marginBottom="$2">
              {formatUIText("join a league")}
            </Text>

            {!code && (
              <Text fontFamily="$body" fontSize={14} color="$colorMuted" textAlign="center" marginBottom="$6">
                {formatUIText("enter the invite code or use a shared link")}
              </Text>
            )}

            {/* Invite code input */}
            <TextInput
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder={formatUIText("enter invite code")}
              testID="invite-code-input"
              placeholderTextColor={theme.placeholderColor?.val}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ backgroundColor: theme.backgroundSurface?.val, color: theme.color?.val, borderRadius: DesignSystem.radius["2xl"], padding: 18, fontSize: 20, textAlign: "center", letterSpacing: 3, fontWeight: "700", fontFamily: "DM Mono", borderWidth: 1, borderColor: theme.borderColor?.val, marginBottom: 20 }}
            />

            {/* League Preview Card */}
            {previewQuery.isLoading && inviteCode.trim() && (
              <YStack alignItems="center" paddingVertical="$4">
                <EggLoadingSpinner size={28} message={formatUIText("looking up league")} />
              </YStack>
            )}

            {preview && !preview.alreadyMember && (
              <Card padding="$4" marginBottom="$4" borderColor="$accentBackground" borderWidth={1}>
                <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
                  <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$color" flex={1} numberOfLines={2}>
                    {preview.name}
                  </Text>
                  <Badge variant="role" size="sm">{formatBadgeText(preview.format)}</Badge>
                </XStack>
                {preview.tournament && (
                  <Text fontFamily="$mono" fontSize={11} color="$colorMuted" marginBottom="$1">
                    {preview.tournament}
                  </Text>
                )}
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                  {preview.memberCount}
                  {preview.maxMembers < 10000 ? `/${preview.maxMembers}` : ""}
                  {" "}{formatUIText("members")}
                  {preview.isFull && ` · ${formatUIText("full")}`}
                </Text>
              </Card>
            )}

            {previewQuery.isSuccess && !preview && inviteCode.trim() && (
              <Text fontFamily="$body" color="$error" textAlign="center" marginBottom="$4" fontSize={13}>
                {formatUIText("no league found with this code")}
              </Text>
            )}

            {/* Join Button */}
            <Button
              variant="primary"
              size="lg"
              onPress={() => joinMutation.mutate({ inviteCode: inviteCode.trim() })}
              disabled={joinMutation.isPending || !inviteCode.trim() || preview?.isFull || !preview}
              opacity={!inviteCode.trim() || !preview ? 0.4 : 1}
              testID="join-league-btn"
            >
              {joinMutation.isPending
                ? formatUIText("joining...")
                : preview?.isFull
                  ? formatUIText("league is full")
                  : formatUIText("join league")}
            </Button>

            {joinMutation.error && (
              <Text fontFamily="$body" color="$error" textAlign="center" marginTop="$4" fontSize={14} testID="join-league-error">
                {joinMutation.error.message}
              </Text>
            )}
          </>
        )}
      </YStack>
    </YStack>
    </ScrollView>
  );
}
