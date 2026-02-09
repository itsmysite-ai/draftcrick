import { View, Text, TextInput, Pressable } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";
import { FontFamily } from "../../lib/design";

export default function JoinLeagueScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const [inviteCode, setInviteCode] = useState("");

  const joinMutation = trpc.league.join.useMutation({
    onSuccess: (league) => {
      router.replace(`/league/${league!.id}` as any);
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, padding: 16, justifyContent: "center" }}>
      <Text style={{ color: t.text, fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>
        Join a League
      </Text>
      <Text style={{ color: t.textTertiary, fontSize: 15, textAlign: "center", marginBottom: 32 }}>
        Enter the invite code shared by your league commissioner
      </Text>

      <TextInput
        value={inviteCode}
        onChangeText={setInviteCode}
        placeholder="Enter invite code"
        placeholderTextColor={t.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          backgroundColor: t.bgSurface, color: t.text, borderRadius: 14, padding: 18, fontSize: 20,
          textAlign: "center", letterSpacing: 3, fontWeight: "700",
          borderWidth: 1, borderColor: t.border, marginBottom: 20,
        }}
      />

      <Pressable
        onPress={() => joinMutation.mutate({ inviteCode: inviteCode.trim() })}
        disabled={joinMutation.isPending || !inviteCode.trim()}
        style={{
          backgroundColor: !inviteCode.trim() ? t.textTertiary : t.accent,
          borderRadius: 14, padding: 16, alignItems: "center",
        }}
      >
        <Text style={{ color: t.bg, fontSize: 18, fontWeight: "800" }}>
          {joinMutation.isPending ? "Joining..." : "Join League"}
        </Text>
      </Pressable>

      {joinMutation.error && (
        <Text style={{ color: t.red, textAlign: "center", marginTop: 16, fontSize: 14 }}>
          {joinMutation.error.message}
        </Text>
      )}
    </View>
  );
}
