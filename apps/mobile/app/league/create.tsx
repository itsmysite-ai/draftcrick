import { TextInput, ScrollView, ActivityIndicator } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  Button,
  BackButton,
  AnnouncementBanner,
  DesignSystem,
  Paywall,
  textStyles,
  formatUIText,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useSport } from "../../providers/ThemeProvider";
import { HeaderControls } from "../../components/HeaderControls";
import { usePaywall } from "../../hooks/usePaywall";
import { useSubscription } from "../../hooks/useSubscription";

type LeagueFormat = "salary_cap" | "draft" | "auction" | "prediction";
type Template = "casual" | "competitive" | "pro";

const FORMATS: { value: LeagueFormat; label: string; desc: string; comingSoon?: boolean }[] = [
  { value: "salary_cap", label: "salary cap", desc: "pick players within budget each match" },
  { value: "draft", label: "snake draft", desc: "take turns picking players for the season", comingSoon: true },
  { value: "auction", label: "auction", desc: "bid on players — squad carries forward", comingSoon: true },
  { value: "prediction", label: "prediction", desc: "predict match outcomes", comingSoon: true },
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
  const { gate, paywallProps } = usePaywall();
  const { features } = useSubscription();
  const myLeagues = trpc.league.myLeagues.useQuery();
  const ownedLeagueCount = (myLeagues.data ?? []).filter((m: any) => m.role === "owner").length;
  const atLeagueLimit = ownedLeagueCount >= features.maxLeagues;
  const [name, setName] = useState("");
  const [format, setFormat] = useState<LeagueFormat>("salary_cap");
  const [template, setTemplate] = useState<Template>("casual");
  const [tournament, setTournament] = useState("");
  const [maxMembers, setMaxMembers] = useState("10");
  const [isPrivate, setIsPrivate] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const tournamentsQuery = trpc.sports.tournaments.useQuery({ sport });
  const availableTournaments = tournamentsQuery.data?.tournaments ?? [];

  // Auto-select first tournament when data loads
  useEffect(() => {
    if (availableTournaments.length > 0 && !tournament) {
      setTournament(availableTournaments[0].name);
    }
  }, [availableTournaments]);

  const generateNameMutation = trpc.league.generateName.useMutation();

  const handleSuggest = useCallback(async () => {
    if (!tournament || suggesting) return;
    setSuggesting(true);
    try {
      const result = await generateNameMutation.mutateAsync({ format, template, tournament });
      if (result.names.length > 0) {
        // Pick a random one from the suggestions
        const picked = result.names[Math.floor(Math.random() * result.names.length)]!;
        setName(picked);
      }
    } catch {
      // Silently fail — user can just type their own name
    } finally {
      setSuggesting(false);
    }
  }, [format, template, tournament, suggesting]);

  const createMutation = trpc.league.create.useMutation({
    onSuccess: (league) => { router.replace(`/league/${league!.id}` as any); },
  });

  const handleCreate = () => {
    if (!name.trim()) return;
    if (atLeagueLimit) {
      gate("pro", "More Leagues", `You've reached the ${features.maxLeagues} league limit for your current tier. Upgrade to create more.`);
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      format,
      template,
      tournament,
      maxMembers: parseInt(maxMembers) || 10,
      isPrivate,
    });
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
      <XStack gap="$2" marginBottom={20} alignItems="center">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. office boys ipl, college gang..."
          placeholderTextColor={theme.placeholderColor?.val}
          testID="league-name-input"
          style={{
            flex: 1,
            backgroundColor: theme.background.val,
            color: theme.color.val,
            borderRadius: DesignSystem.radius.lg,
            padding: 14,
            fontSize: 16,
            fontFamily: "DM Sans",
            borderWidth: 1,
            borderColor: theme.borderColor.val,
          }}
        />
        <Card
          pressable={!suggesting}
          padding="$3"
          onPress={handleSuggest}
          opacity={suggesting ? 0.5 : 1}
          testID="suggest-name-btn"
        >
          {suggesting ? (
            <ActivityIndicator size="small" color={theme.accentBackground?.val} />
          ) : (
            <Text fontFamily="$mono" fontSize={11} color="$accentBackground" fontWeight="600">
              {formatUIText("AI")}
            </Text>
          )}
        </Card>
      </XStack>

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
            pressable={!f.comingSoon}
            marginBottom="$2"
            padding="$4"
            borderColor={format === f.value ? "$accentBackground" : "$borderColor"}
            opacity={f.comingSoon ? 0.5 : 1}
            onPress={() => !f.comingSoon && setFormat(f.value)}
          >
            <XStack alignItems="center" gap="$2">
              <Text fontFamily="$body" fontWeight="700" fontSize={15} color={format === f.value ? "$accentBackground" : "$color"}>
                {f.label}
              </Text>
              {f.comingSoon && (
                <Badge variant="default" size="sm" backgroundColor="$colorAccentLight" color="$colorAccent" fontWeight="700">
                  COMING SOON
                </Badge>
              )}
            </XStack>
            <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop={2}>
              {f.desc}
            </Text>
          </Card>
        ))}
      </YStack>

      <Text {...textStyles.sectionHeader} marginBottom="$2">
        {formatUIText("template")}
      </Text>
      <XStack gap="$3" marginBottom="$3">
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

      {/* Customize Rules — Coming Soon */}
      <Card padding="$3" marginBottom="$5" borderColor="$borderColor" opacity={0.7}>
        <XStack justifyContent="space-between" alignItems="center">
          <YStack flex={1}>
            <XStack alignItems="center" gap="$2">
              <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$colorMuted">
                {formatUIText("customize rules")}
              </Text>
              <Badge variant="default" size="sm" backgroundColor="$colorAccentLight" color="$colorAccent" fontWeight="700">
                COMING SOON
              </Badge>
            </XStack>
            <Text fontFamily="$body" fontSize={11} color="$colorMuted" marginTop={2}>
              {formatUIText("fine-tune scoring, transfers, boosters & more")}
            </Text>
          </YStack>
        </XStack>
      </Card>

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

      <Button
        variant="primary"
        size="lg"
        onPress={handleCreate}
        disabled={createMutation.isPending || !name.trim() || !tournament}
        opacity={!name.trim() || !tournament ? 0.4 : 1}
        marginTop="$2"
        testID="create-league-btn"
      >
        {createMutation.isPending ? formatUIText("creating...") : formatUIText("create league")}
      </Button>

      {atLeagueLimit && (
        <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center" marginTop="$2">
          {formatUIText(`${ownedLeagueCount}/${features.maxLeagues} leagues used`)}
        </Text>
      )}

      {createMutation.error && (
        <Text fontFamily="$body" color="$error" textAlign="center" marginTop="$3">{createMutation.error.message}</Text>
      )}

      <Paywall {...paywallProps} />
    </ScrollView>
  );
}
