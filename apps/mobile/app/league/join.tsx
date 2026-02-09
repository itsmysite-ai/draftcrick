import { TextInput } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Button,
  BackButton,
  ModeToggle,
  AnnouncementBanner,
  DesignSystem,
  textStyles,
  formatUIText,
} from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";

export default function JoinLeagueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const [inviteCode, setInviteCode] = useState("");

  const joinMutation = trpc.league.join.useMutation({
    onSuccess: (league) => {
      router.replace(`/league/${league!.id}` as any);
    },
  });

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* ── Inline Header ── */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={insets.top + 8}
        paddingBottom="$2"
      >
        <BackButton onPress={() => router.back()} />
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>

      <AnnouncementBanner />

      {/* ── Content ── */}
      <YStack flex={1} justifyContent="center" paddingHorizontal="$4">
        <Text fontSize={DesignSystem.emptyState.iconSize} textAlign="center" marginBottom="$4">
          {DesignSystem.emptyState.icon}
        </Text>
        <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" textAlign="center" letterSpacing={-0.5} marginBottom="$2">
          {formatUIText("join a league")}
        </Text>
        <Text fontFamily="$body" fontSize={15} color="$colorMuted" textAlign="center" marginBottom="$8">
          {formatUIText("enter the invite code shared by your league commissioner")}
        </Text>
        <TextInput
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder={formatUIText("enter invite code")}
          placeholderTextColor={theme.placeholderColor.val}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ backgroundColor: theme.backgroundSurface.val, color: theme.color.val, borderRadius: DesignSystem.radius["2xl"], padding: 18, fontSize: 20, textAlign: "center", letterSpacing: 3, fontWeight: "700", fontFamily: "DM Mono", borderWidth: 1, borderColor: theme.borderColor.val, marginBottom: 20 }}
        />
        <Button variant="primary" size="lg" onPress={() => joinMutation.mutate({ inviteCode: inviteCode.trim() })} disabled={joinMutation.isPending || !inviteCode.trim()} opacity={!inviteCode.trim() ? 0.4 : 1}>
          {joinMutation.isPending ? formatUIText("joining...") : formatUIText("join league")}
        </Button>
        {joinMutation.error && (
          <Text fontFamily="$body" color="$error" textAlign="center" marginTop="$4" fontSize={14}>{joinMutation.error.message}</Text>
        )}
      </YStack>
    </YStack>
  );
}
