import { TextInput } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { YStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Button } from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";

export default function JoinLeagueScreen() {
  const router = useRouter();
  const theme = useTamaguiTheme();
  const [inviteCode, setInviteCode] = useState("");

  const joinMutation = trpc.league.join.useMutation({
    onSuccess: (league) => {
      router.replace(`/league/${league!.id}` as any);
    },
  });

  return (
    <YStack flex={1} backgroundColor="$background" padding="$4" justifyContent="center">
      <Text fontFamily="$heading" fontWeight="800" fontSize={28} color="$color" textAlign="center" marginBottom="$2">Join a League</Text>
      <Text fontFamily="$body" fontSize={15} color="$colorMuted" textAlign="center" marginBottom="$8">Enter the invite code shared by your league commissioner</Text>
      <TextInput
        value={inviteCode}
        onChangeText={setInviteCode}
        placeholder="Enter invite code"
        placeholderTextColor={theme.placeholderColor.val}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ backgroundColor: theme.backgroundSurface.val, color: theme.color.val, borderRadius: 14, padding: 18, fontSize: 20, textAlign: "center", letterSpacing: 3, fontWeight: "700", borderWidth: 1, borderColor: theme.borderColor.val, marginBottom: 20 }}
      />
      <Button variant="primary" size="lg" onPress={() => joinMutation.mutate({ inviteCode: inviteCode.trim() })} disabled={joinMutation.isPending || !inviteCode.trim()} opacity={!inviteCode.trim() ? 0.4 : 1}>
        {joinMutation.isPending ? "Joining..." : "Join League"}
      </Button>
      {joinMutation.error && (
        <Text fontFamily="$body" color="$error" textAlign="center" marginTop="$4" fontSize={14}>{joinMutation.error.message}</Text>
      )}
    </YStack>
  );
}
