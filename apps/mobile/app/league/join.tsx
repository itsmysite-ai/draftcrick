import { View, Text, TextInput, Pressable } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "../../lib/trpc";

const BG = "#111210";
const CARD = "#1C1D1B";
const ACCENT = "#5DB882";
const TEXT = "#EDECEA";
const MUTED = "#5E5D5A";

export default function JoinLeagueScreen() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");

  const joinMutation = trpc.league.join.useMutation({
    onSuccess: (league) => {
      router.replace(`/league/${league!.id}` as any);
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: BG, padding: 16, justifyContent: "center" }}>
      <Text style={{ color: TEXT, fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>
        Join a League
      </Text>
      <Text style={{ color: MUTED, fontSize: 15, textAlign: "center", marginBottom: 32 }}>
        Enter the invite code shared by your league commissioner
      </Text>

      <TextInput
        value={inviteCode}
        onChangeText={setInviteCode}
        placeholder="Enter invite code"
        placeholderTextColor={MUTED}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          backgroundColor: CARD, color: TEXT, borderRadius: 14, padding: 18, fontSize: 20,
          textAlign: "center", letterSpacing: 3, fontWeight: "700",
          borderWidth: 1, borderColor: "#333432", marginBottom: 20,
        }}
      />

      <Pressable
        onPress={() => joinMutation.mutate({ inviteCode: inviteCode.trim() })}
        disabled={joinMutation.isPending || !inviteCode.trim()}
        style={{
          backgroundColor: !inviteCode.trim() ? MUTED : ACCENT,
          borderRadius: 14, padding: 16, alignItems: "center",
        }}
      >
        <Text style={{ color: BG, fontSize: 18, fontWeight: "800" }}>
          {joinMutation.isPending ? "Joining..." : "Join League"}
        </Text>
      </Pressable>

      {joinMutation.error && (
        <Text style={{ color: "#E5484D", textAlign: "center", marginTop: 16, fontSize: 14 }}>
          {joinMutation.error.message}
        </Text>
      )}
    </View>
  );
}
