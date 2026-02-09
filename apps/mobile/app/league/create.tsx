import { TextInput, ScrollView } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Button } from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";

type LeagueFormat = "salary_cap" | "draft" | "auction" | "prediction";
type Template = "casual" | "competitive" | "pro" | "custom";

const FORMATS: { value: LeagueFormat; label: string; desc: string }[] = [
  { value: "salary_cap", label: "Salary Cap", desc: "Classic fantasy with budget constraints" },
  { value: "draft", label: "Snake Draft", desc: "Take turns picking players" },
  { value: "auction", label: "Auction", desc: "Bid on players with limited budget" },
  { value: "prediction", label: "Prediction", desc: "Predict match outcomes" },
];

const TEMPLATES: { value: Template; label: string; desc: string }[] = [
  { value: "casual", label: "Casual", desc: "Relaxed rules, generous transfers" },
  { value: "competitive", label: "Competitive", desc: "Trading, playoffs, waiver wire" },
  { value: "pro", label: "Pro", desc: "Strict rules, trade vetoes, advanced scoring" },
];

export default function CreateLeagueScreen() {
  const router = useRouter();
  const theme = useTamaguiTheme();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<LeagueFormat>("salary_cap");
  const [template, setTemplate] = useState<Template>("casual");
  const [tournament, setTournament] = useState("IPL 2026");
  const [maxMembers, setMaxMembers] = useState("10");
  const [isPrivate, setIsPrivate] = useState(true);

  const createMutation = trpc.league.create.useMutation({
    onSuccess: (league) => { router.replace(`/league/${league!.id}` as any); },
  });

  const handleCreate = () => {
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), format, template, tournament, maxMembers: parseInt(maxMembers) || 10, isPrivate });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background.val }} contentContainerStyle={{ padding: 16 }}>
      <Text fontFamily="$heading" fontWeight="800" fontSize={24} color="$color" marginBottom="$6">Create League</Text>

      <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginBottom="$1" fontWeight="600">LEAGUE NAME</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. The Willow Warriors" placeholderTextColor={theme.placeholderColor.val}
        style={{ backgroundColor: theme.background.val, color: theme.color.val, borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: theme.borderColor.val, marginBottom: 20 }} />

      <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginBottom="$1" fontWeight="600">TOURNAMENT</Text>
      <TextInput value={tournament} onChangeText={setTournament} placeholder="e.g. IPL 2026" placeholderTextColor={theme.placeholderColor.val}
        style={{ backgroundColor: theme.background.val, color: theme.color.val, borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: theme.borderColor.val, marginBottom: 20 }} />

      <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginBottom="$2" fontWeight="600">FORMAT</Text>
      <YStack marginBottom="$5">
        {FORMATS.map((f) => (
          <XStack key={f.value} backgroundColor={format === f.value ? "$colorAccentLight" : "$backgroundSurface"} borderColor={format === f.value ? "$accentBackground" : "$borderColor"}
            borderWidth={1} borderRadius="$3" padding="$4" marginBottom="$2" onPress={() => setFormat(f.value)} cursor="pointer" pressStyle={{ scale: 0.98, opacity: 0.9 }}>
            <YStack>
              <Text fontFamily="$body" fontWeight="700" fontSize={15} color={format === f.value ? "$accentBackground" : "$color"}>{f.label}</Text>
              <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop={2}>{f.desc}</Text>
            </YStack>
          </XStack>
        ))}
      </YStack>

      <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginBottom="$2" fontWeight="600">TEMPLATE</Text>
      <XStack gap="$3" marginBottom="$5">
        {TEMPLATES.map((tmpl) => (
          <YStack key={tmpl.value} flex={1} backgroundColor={template === tmpl.value ? "$colorAccentLight" : "$backgroundSurface"}
            borderColor={template === tmpl.value ? "$accentBackground" : "$borderColor"} borderWidth={1} borderRadius="$3" padding="$4" alignItems="center"
            onPress={() => setTemplate(tmpl.value)} cursor="pointer" pressStyle={{ scale: 0.97, opacity: 0.9 }}>
            <Text fontFamily="$body" fontWeight="700" fontSize={15} color={template === tmpl.value ? "$accentBackground" : "$color"}>{tmpl.label}</Text>
            <Text fontFamily="$body" fontSize={10} color="$colorMuted" marginTop="$1" textAlign="center">{tmpl.desc}</Text>
          </YStack>
        ))}
      </XStack>

      <XStack gap="$3" marginBottom="$5">
        <YStack flex={1}>
          <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginBottom="$1" fontWeight="600">MAX MEMBERS</Text>
          <TextInput value={maxMembers} onChangeText={setMaxMembers} keyboardType="numeric"
            style={{ backgroundColor: theme.background.val, color: theme.color.val, borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: theme.borderColor.val }} />
        </YStack>
        <YStack flex={1}>
          <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginBottom="$1" fontWeight="600">VISIBILITY</Text>
          <YStack backgroundColor="$background" borderRadius="$3" padding="$4" borderWidth={1} borderColor="$borderColor" alignItems="center"
            onPress={() => setIsPrivate(!isPrivate)} cursor="pointer" pressStyle={{ opacity: 0.8 }}>
            <Text fontFamily="$body" fontWeight="700" fontSize={16} color={isPrivate ? "$accentBackground" : "$colorCricket"}>{isPrivate ? "Private" : "Public"}</Text>
          </YStack>
        </YStack>
      </XStack>

      <Button variant="primary" size="lg" onPress={handleCreate} disabled={createMutation.isPending || !name.trim()} opacity={!name.trim() ? 0.4 : 1} marginTop="$2">
        {createMutation.isPending ? "Creating..." : "Create League"}
      </Button>

      {createMutation.error && (
        <Text fontFamily="$body" color="$error" textAlign="center" marginTop="$3">{createMutation.error.message}</Text>
      )}
      <YStack height={40} />
    </ScrollView>
  );
}
