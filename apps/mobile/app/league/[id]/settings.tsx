import { TextInput, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../../components/SportText";
import { BackButton, Badge, Button, Card, formatUIText } from "@draftplay/ui";
import { trpc } from "../../../lib/trpc";
import { HeaderControls } from "../../../components/HeaderControls";

export default function LeagueSettingsScreen() {
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { data: league, refetch } = trpc.league.getById.useQuery({ id: leagueId! });
  const updateMutation = trpc.league.updateSettings.useMutation({
    onSuccess: () => {
      Alert.alert("Settings updated!");
      setHasChanges(false);
      refetch();
    },
  });
  const regenCodeMutation = trpc.league.regenerateInviteCode.useMutation({ onSuccess: () => refetch() });
  const [name, setName] = useState("");
  const [maxMembers, setMaxMembers] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (league) {
      setName(league.name);
      setMaxMembers(String(league.maxMembers));
    }
  }, [league]);

  const handleSave = () => {
    updateMutation.mutate({
      leagueId: leagueId!,
      name: name.trim() || undefined,
      maxMembers: parseInt(maxMembers) || undefined,
    });
  };

  const handleBack = () => {
    if (hasChanges) {
      Alert.alert("Unsaved Changes", "You have unsaved changes. Discard them?", [
        { text: "Cancel", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  const handleRegenCode = () => {
    Alert.alert("Regenerate Code?", "The current invite code will stop working.", [
      { text: "Cancel", style: "cancel" },
      { text: "Regenerate", onPress: () => regenCodeMutation.mutate({ leagueId: leagueId! }) },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background.val }} contentContainerStyle={{ padding: 16 }}>
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingTop={insets.top + 8}
        paddingBottom="$3"
        marginBottom="$5"
      >
        <XStack alignItems="center" gap="$3">
          <BackButton onPress={handleBack} />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("league settings")}
          </Text>
        </XStack>
        <HeaderControls />
      </XStack>
      <Card padding="$4" marginBottom="$4">
        <Text fontFamily="$mono" fontSize={12} color="$colorMuted" fontWeight="600" marginBottom="$2">BASIC SETTINGS</Text>
        <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginBottom="$1">League Name</Text>
        <TextInput value={name} onChangeText={(v) => { setName(v); setHasChanges(true); }} style={{ backgroundColor: theme.background.val, color: theme.color.val, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.borderColor.val, marginBottom: 12 }} />
        <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginBottom="$1">Max Members</Text>
        <TextInput value={maxMembers} onChangeText={(v) => { setMaxMembers(v); setHasChanges(true); }} keyboardType="numeric" style={{ backgroundColor: theme.background.val, color: theme.color.val, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.borderColor.val, marginBottom: 12 }} />
        <Button variant="primary" size="md" onPress={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Saving..." : hasChanges ? "Save All Changes" : "Save Changes"}
        </Button>
      </Card>
      <Card padding="$4" marginBottom="$4">
        <Text fontFamily="$mono" fontSize={12} color="$colorMuted" fontWeight="600" marginBottom="$2">INVITE CODE</Text>
        <Text fontFamily="$mono" fontSize={20} fontWeight="700" color="$accentBackground" letterSpacing={2} marginBottom="$3">{league?.inviteCode ?? "---"}</Text>
        <Button variant="danger" size="sm" onPress={handleRegenCode}>Regenerate Code</Button>
      </Card>
      {/* League Rules — Coming Soon */}
      <Card padding="$4" marginBottom="$4" opacity={0.7}>
        <XStack justifyContent="space-between" alignItems="center">
          <YStack flex={1}>
            <XStack alignItems="center" gap="$2">
              <Text fontFamily="$heading" fontWeight="700" fontSize={18} color="$colorMuted">League Rules</Text>
              <Badge variant="default" size="sm" backgroundColor="$colorAccentLight" color="$colorAccent" fontWeight="700">
                COMING SOON
              </Badge>
            </XStack>
            <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop="$2">
              {formatUIText("customize scoring, transfers, boosters & more — launching soon")}
            </Text>
          </YStack>
        </XStack>
      </Card>
      <YStack height={40} />
    </ScrollView>
  );
}
