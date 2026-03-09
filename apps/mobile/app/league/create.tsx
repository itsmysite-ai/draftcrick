import { TextInput, ScrollView, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Button,
  BackButton,
  AnnouncementBanner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useSport } from "../../providers/ThemeProvider";
import { HeaderControls } from "../../components/HeaderControls";

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
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { sport } = useSport();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<LeagueFormat>("salary_cap");
  const [template, setTemplate] = useState<Template>("casual");
  const [tournament, setTournament] = useState("");
  const [maxMembers, setMaxMembers] = useState("10");
  const [isPrivate, setIsPrivate] = useState(true);

  const tournamentsQuery = trpc.sports.tournaments.useQuery({ sport });
  const availableTournaments = tournamentsQuery.data?.tournaments ?? [];

  // Auto-select first tournament when data loads
  useEffect(() => {
    if (availableTournaments.length > 0 && !tournament) {
      setTournament(availableTournaments[0].name);
    }
  }, [availableTournaments]);

  const createMutation = trpc.league.create.useMutation({
    onSuccess: (league) => { router.replace(`/league/${league!.id}` as any); },
  });

  const handleCreate = () => {
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), format, template, tournament, maxMembers: parseInt(maxMembers) || 10, isPrivate });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background.val }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} testID="create-league-screen">
      {/* ── Inline Header ── */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingTop={insets.top + 8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <BackButton onPress={() => router.back()} />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("create league")}
          </Text>
        </XStack>
        <HeaderControls />
      </XStack>

      <AnnouncementBanner marginHorizontal={0} />

      <Text {...textStyles.sectionHeader} marginBottom="$1">
        {formatUIText("league name")}
      </Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. the willow warriors" placeholderTextColor={theme.placeholderColor.val} testID="league-name-input"
        style={{ backgroundColor: theme.background.val, color: theme.color.val, borderRadius: DesignSystem.radius.lg, padding: 14, fontSize: 16, fontFamily: "DM Sans", borderWidth: 1, borderColor: theme.borderColor.val, marginBottom: 20 }} />

      <Text {...textStyles.sectionHeader} marginBottom="$2">
        {formatUIText("tournament")}
      </Text>
      {tournamentsQuery.isLoading ? (
        <YStack alignItems="center" paddingVertical="$4" marginBottom="$5">
          <ActivityIndicator size="small" color={theme.color.val} />
          <Text fontFamily="$mono" fontSize={12} color="$colorMuted" marginTop="$2">
            {formatUIText("loading tournaments...")}
          </Text>
        </YStack>
      ) : availableTournaments.length === 0 ? (
        <Card padding="$4" marginBottom="$5">
          <Text fontFamily="$body" fontSize={13} color="$colorMuted" textAlign="center">
            {formatUIText("no active tournaments available")}
          </Text>
        </Card>
      ) : (
        <YStack marginBottom="$5">
          {availableTournaments.map((t) => (
            <Card
              key={t.id}
              pressable
              marginBottom="$2"
              padding="$4"
              borderColor={tournament === t.name ? "$accentBackground" : "$borderColor"}
              onPress={() => setTournament(t.name)}
              testID={`tournament-${t.id}`}
            >
              <Text fontFamily="$body" fontWeight="700" fontSize={15} color={tournament === t.name ? "$accentBackground" : "$color"}>
                {t.name}
              </Text>
              {t.category && (
                <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop={2}>
                  {t.category}{t.startDate ? ` · ${t.startDate}` : ""}
                </Text>
              )}
            </Card>
          ))}
        </YStack>
      )}

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

      <Button variant="primary" size="lg" onPress={handleCreate} disabled={createMutation.isPending || !name.trim() || !tournament} opacity={!name.trim() || !tournament ? 0.4 : 1} marginTop="$2" testID="create-league-btn">
        {createMutation.isPending ? formatUIText("creating...") : formatUIText("create league")}
      </Button>

      {createMutation.error && (
        <Text fontFamily="$body" color="$error" textAlign="center" marginTop="$3">{createMutation.error.message}</Text>
      )}
    </ScrollView>
  );
}
