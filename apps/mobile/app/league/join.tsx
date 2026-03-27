import { SafeBackButton } from "../../components/SafeBackButton";
import { TextInput, ScrollView } from "react-native";
import { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Button,
  BackButton,
  AnnouncementBanner,
  DesignSystem,
  textStyles,
  formatUIText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { Redirect } from "expo-router";
import { trpc } from "../../lib/trpc";
import { HeaderControls } from "../../components/HeaderControls";
import { useRequireAuth } from "../../hooks/useRequireAuth";

export default function JoinLeagueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [inviteCode, setInviteCode] = useState("");
  const [autoJoining, setAutoJoining] = useState(false);

  // Redirect to login if not authenticated, preserving the invite code
  const isAuthed = useRequireAuth();
  if (!isAuthed) return <Redirect href="/auth/login" />;

  const joinMutation = trpc.league.join.useMutation({
    onSuccess: (league) => {
      router.replace(`/league/${league!.id}` as any);
    },
  });

  // Auto-fill and auto-join if code is in URL params
  useEffect(() => {
    if (code && code.trim()) {
      setInviteCode(code.trim());
      setAutoJoining(true);
    }
  }, [code]);

  // Auto-join after code is set from URL
  useEffect(() => {
    if (autoJoining && inviteCode && !joinMutation.isPending && !joinMutation.error) {
      joinMutation.mutate({ inviteCode: inviteCode.trim() });
      setAutoJoining(false);
    }
  }, [autoJoining, inviteCode]);

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
        <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" textAlign="center" letterSpacing={-0.5} marginBottom="$2">
          {formatUIText("join a league")}
        </Text>
        <Text fontFamily="$body" fontSize={15} color="$colorMuted" textAlign="center" marginBottom="$8">
          {code
            ? formatUIText("joining league...")
            : formatUIText("enter the invite code or use a shared link")}
        </Text>
        <TextInput
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder={formatUIText("enter invite code")}
          testID="invite-code-input"
          placeholderTextColor={theme.placeholderColor.val}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ backgroundColor: theme.backgroundSurface.val, color: theme.color.val, borderRadius: DesignSystem.radius["2xl"], padding: 18, fontSize: 20, textAlign: "center", letterSpacing: 3, fontWeight: "700", fontFamily: "DM Mono", borderWidth: 1, borderColor: theme.borderColor.val, marginBottom: 20 }}
        />
        <Button variant="primary" size="lg" onPress={() => joinMutation.mutate({ inviteCode: inviteCode.trim() })} disabled={joinMutation.isPending || !inviteCode.trim()} opacity={!inviteCode.trim() ? 0.4 : 1} testID="join-league-btn">
          {joinMutation.isPending ? formatUIText("joining...") : formatUIText("join league")}
        </Button>
        {joinMutation.error && (
          <Text fontFamily="$body" color="$error" textAlign="center" marginTop="$4" fontSize={14} testID="join-league-error">{joinMutation.error.message}</Text>
        )}
      </YStack>
    </YStack>
    </ScrollView>
  );
}
