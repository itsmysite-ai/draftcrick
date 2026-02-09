import { TextInput, ScrollView } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Button,
  ModeToggle,
  HappinessMeter,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";

type LeagueFormat = "salary_cap" | "draft" | "auction" | "prediction";
type Template = "casual" | "competitive" | "pro" | "custom";

const FORMATS: { value: LeagueFormat; label: string; desc: string }[] = [
  { value: "salary_cap", label: "salary cap", desc: "classic fantasy with budget constraints" },
  { value: "draft", label: "snake draft", desc: "take turns picking players" },
  { value: "auction", label: "auction", desc: "bid on players with limited budget" },
  { value: "prediction", label: "prediction", desc: "predict match outcomes" },
];

const TEMPLATES: { value: Template; label: string; desc: string }[] = [
  { value: "casual", label: "casual", desc: "relaxed rules, generous transfers" },
  { value: "competitive", label: "competitive", desc: "trading, playoffs, waiver wire" },
  { value: "pro", label: "pro", desc: "strict rules, trade vetoes, advanced scoring" },
];

export default function CreateLeagueScreen() {
  const router = useRouter();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
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
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$6">
        <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
          {formatUIText("create league")}
        </Text>
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>

      <Card marginBottom="$4" padding="$3" paddingHorizontal="$4">
        <HappinessMeter current={3} total={10} label="season progress" unit="xp earned" />
      </Card>

      <Text {...textStyles.sectionHeader} marginBottom="$1">
        {formatUIText("league name")}
      </Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. the willow warriors" placeholderTextColor={theme.placeholderColor.val}
        style={{ backgroundColor: theme.background.val, color: theme.color.val, borderRadius: DesignSystem.radius.lg, padding: 14, fontSize: 16, fontFamily: "DM Sans", borderWidth: 1, borderColor: theme.borderColor.val, marginBottom: 20 }} />

      <Text {...textStyles.sectionHeader} marginBottom="$1">
        {formatUIText("tournament")}
      </Text>
      <TextInput value={tournament} onChangeText={setTournament} placeholder="e.g. IPL 2026" placeholderTextColor={theme.placeholderColor.val}
        style={{ backgroundColor: theme.background.val, color: theme.color.val, borderRadius: DesignSystem.radius.lg, padding: 14, fontSize: 16, fontFamily: "DM Sans", borderWidth: 1, borderColor: theme.borderColor.val, marginBottom: 20 }} />

      <Text {...textStyles.sectionHeader} marginBottom="$2">
        {formatUIText("format")}
      </Text>
      <YStack marginBottom="$5">
        {FORMATS.map((f) => (
          <Card
            key={f.value}
            pressable
            marginBottom="$2"
            padding="$4"
            borderColor={format === f.value ? "$accentBackground" : "$borderColor"}
            onPress={() => setFormat(f.value)}
          >
            <Text fontFamily="$body" fontWeight="700" fontSize={15} color={format === f.value ? "$accentBackground" : "$color"}>
              {f.label}
            </Text>
            <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop={2}>
              {f.desc}
            </Text>
          </Card>
        ))}
      </YStack>

      <Text {...textStyles.sectionHeader} marginBottom="$2">
        {formatUIText("template")}
      </Text>
      <XStack gap="$3" marginBottom="$5">
        {TEMPLATES.map((tmpl) => (
          <Card
            key={tmpl.value}
            pressable
            flex={1}
            padding="$4"
            alignItems="center"
            borderColor={template === tmpl.value ? "$accentBackground" : "$borderColor"}
            onPress={() => setTemplate(tmpl.value)}
          >
            <Text fontFamily="$body" fontWeight="700" fontSize={15} color={template === tmpl.value ? "$accentBackground" : "$color"}>
              {tmpl.label}
            </Text>
            <Text fontFamily="$body" fontSize={10} color="$colorMuted" marginTop="$1" textAlign="center">
              {tmpl.desc}
            </Text>
          </Card>
        ))}
      </XStack>

      <XStack gap="$3" marginBottom="$5">
        <YStack flex={1}>
          <Text {...textStyles.sectionHeader} marginBottom="$1">
            {formatUIText("max members")}
          </Text>
          <TextInput value={maxMembers} onChangeText={setMaxMembers} keyboardType="numeric"
            style={{ backgroundColor: theme.background.val, color: theme.color.val, borderRadius: DesignSystem.radius.lg, padding: 14, fontSize: 16, fontFamily: "DM Mono", borderWidth: 1, borderColor: theme.borderColor.val }} />
        </YStack>
        <YStack flex={1}>
          <Text {...textStyles.sectionHeader} marginBottom="$1">
            {formatUIText("visibility")}
          </Text>
          <Card
            pressable
            padding="$4"
            alignItems="center"
            onPress={() => setIsPrivate(!isPrivate)}
          >
            <Text fontFamily="$mono" fontWeight="700" fontSize={16} color={isPrivate ? "$accentBackground" : "$colorCricket"}>
              {formatUIText(isPrivate ? "private" : "public")}
            </Text>
          </Card>
        </YStack>
      </XStack>

      <Button variant="primary" size="lg" onPress={handleCreate} disabled={createMutation.isPending || !name.trim()} opacity={!name.trim() ? 0.4 : 1} marginTop="$2">
        {createMutation.isPending ? formatUIText("creating...") : formatUIText("create league")}
      </Button>

      {createMutation.error && (
        <Text fontFamily="$body" color="$error" textAlign="center" marginTop="$3">{createMutation.error.message}</Text>
      )}
      <YStack height={40} />
    </ScrollView>
  );
}
