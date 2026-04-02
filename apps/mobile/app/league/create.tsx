import { SafeBackButton } from "../../components/SafeBackButton";
import { TextInput, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, View, useTheme as useTamaguiTheme } from "tamagui";
import Animated, { FadeInDown } from "react-native-reanimated";
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
  formatBadgeText,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useSport } from "../../providers/ThemeProvider";
import { HeaderControls } from "../../components/HeaderControls";
import { usePaywall } from "../../hooks/usePaywall";
import { useSubscription } from "../../hooks/useSubscription";

type LeagueFormat = "salary_cap" | "draft" | "auction" | "prediction";

const FORMATS: { value: LeagueFormat; label: string; desc: string; comingSoon?: boolean }[] = [
  { value: "salary_cap", label: "salary cap", desc: "pick players within budget each match" },
  { value: "draft", label: "snake draft", desc: "take turns picking players for the season" },
  { value: "auction", label: "auction", desc: "bid on players — squad carries forward" },
  { value: "prediction", label: "prediction", desc: "predict match outcomes", comingSoon: true },
];

const LEAGUE_TYPES = [
  { label: "Duel", min: 2, max: 2, default: 2, desc: "1v1 head-to-head" },
  { label: "Huddle", min: 3, max: 4, default: 4, desc: "small group" },
  { label: "Club", min: 5, max: 10, default: 10, desc: "classic league" },
  { label: "Arena", min: 11, max: 20, default: 20, desc: "big league" },
] as const;

function getLeagueTypeSuffix(members: number): string {
  const type = LEAGUE_TYPES.find((t) => members >= t.min && members <= t.max);
  return type?.label ?? "League";
}

const MIN_MEMBERS = 2;
const MAX_MEMBERS = 20;
const MAX_ENTRY_FEE = 50;
const MIN_ENTRY_FEE = 0;
const ENTRY_FEE_STEP = 10;

function getPrizePreview(entryFee: number, members: number): { rank: number; pct: number }[] {
  if (entryFee === 0 || members < 2) return [];
  if (members <= 2) return [{ rank: 1, pct: 100 }];
  if (members <= 10) return [{ rank: 1, pct: 60 }, { rank: 2, pct: 25 }, { rank: 3, pct: 15 }];
  return [
    { rank: 1, pct: 40 }, { rank: 2, pct: 20 }, { rank: 3, pct: 12 },
    { rank: 4, pct: 8 }, { rank: 5, pct: 6 },
  ];
}

function Stepper({ value, onValue, min, max, step = 1, suffix }: {
  value: number; onValue: (v: number) => void; min: number; max: number; step?: number; suffix?: string;
}) {
  const theme = useTamaguiTheme();
  const canDec = value - step >= min;
  const canInc = value + step <= max;
  return (
    <XStack alignItems="center" gap="$2">
      <Card
        pressable={canDec}
        padding="$2"
        paddingHorizontal="$3"
        opacity={canDec ? 1 : 0.3}
        onPress={() => canDec && onValue(value - step)}
        borderColor="$borderColor"
      >
        <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color">-</Text>
      </Card>
      <Text fontFamily="$mono" fontWeight="700" fontSize={20} color="$color" minWidth={50} textAlign="center">
        {value}{suffix || ""}
      </Text>
      <Card
        pressable={canInc}
        padding="$2"
        paddingHorizontal="$3"
        opacity={canInc ? 1 : 0.3}
        onPress={() => canInc && onValue(value + step)}
        borderColor="$borderColor"
      >
        <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color">+</Text>
      </Card>
    </XStack>
  );
}

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

  // ── League config state ──
  const [name, setName] = useState("");
  const [format, setFormat] = useState<LeagueFormat>("salary_cap");
  const [tournament, setTournament] = useState("");
  const [maxMembers, setMaxMembers] = useState(10);
  const [entryFee, setEntryFee] = useState(0);
  const [isPrivate, setIsPrivate] = useState(true);

  // ── Auction-specific settings ──
  const [auctionBidIncrement, setAuctionBidIncrement] = useState(0.1);
  const [auctionSquadRule, setAuctionSquadRule] = useState("none");
  const [auctionSquadVisibility, setAuctionSquadVisibility] = useState("after_sold");
  const [auctionBuyerVisibility, setAuctionBuyerVisibility] = useState("during_auction");
  const [auctionMaxPauses, setAuctionMaxPauses] = useState(3);

  const auctionConfigQuery = trpc.draft.getAuctionConfigOptions.useQuery(undefined, {
    enabled: format === "auction",
  });
  const auctionConfig = auctionConfigQuery.data;

  // ── AI naming flow state ──
  const [nameGenStep, setNameGenStep] = useState<"config" | "q1" | "q2" | "picking" | "done">("config");
  const [groupName, setGroupName] = useState("");
  const [dynamicQ, setDynamicQ] = useState<{ question: string; options: string[] } | null>(null);
  const [selectedVibe, setSelectedVibe] = useState("");
  const [aiNameOptions, setAiNameOptions] = useState<string[]>([]);

  const tournamentsQuery = trpc.sports.tournaments.useQuery({ sport });
  const availableTournaments = tournamentsQuery.data?.tournaments ?? [];

  // Auto-select first tournament when data loads
  useEffect(() => {
    if (availableTournaments.length > 0 && !tournament) {
      setTournament(availableTournaments[0].name);
    }
  }, [availableTournaments]);

  const generateNameMutation = trpc.league.generateName.useMutation();
  const generateQuestionMutation = trpc.league.generateQuestion.useMutation();

  const createMutation = trpc.league.create.useMutation({
    onSuccess: (league) => { router.replace(`/league/${league!.id}` as any); },
  });

  // Step 1: User clicks "name my league" → show Q1
  const handleStartNaming = () => {
    if (!tournament) return;
    setNameGenStep("q1");
  };

  // Step 2: User submits Q1 (group name) → AI generates dynamic Q2
  const handleQ1Submit = () => {
    if (!groupName.trim() || !tournament) return;
    generateQuestionMutation.mutate(
      { groupName: groupName.trim(), tournament, leagueSize: maxMembers },
      {
        onSuccess: (data) => {
          setDynamicQ(data);
          setNameGenStep("q2");
        },
      },
    );
  };

  // Step 3: User picks a Q2 option → AI generates league names
  const handleQ2Pick = (option: string) => {
    setSelectedVibe(option);
    if (!tournament) return;
    generateNameMutation.mutate(
      {
        format,
        template: "casual",
        tournament,
        crewVibe: option,
        groupName: groupName.trim() || undefined,
        leagueSize: maxMembers,
      },
      {
        onSuccess: (data: { names: string[] }) => {
          if (data.names?.length) {
            setAiNameOptions(data.names);
            setName(data.names[0]);
            setNameGenStep("picking");
          }
        },
      },
    );
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    if (atLeagueLimit) {
      gate("pro", "More Leagues", `You've reached the ${features.maxLeagues} league limit for your current tier. Upgrade to create more.`);
      return;
    }
    const suffix = getLeagueTypeSuffix(maxMembers);
    const trimmedName = name.trim();
    // Append suffix if not already present
    const finalName = trimmedName.toLowerCase().endsWith(suffix.toLowerCase())
      ? trimmedName
      : `${trimmedName} ${suffix}`;
    const rules: Record<string, unknown> = { entryFee };
    if (format === "auction") {
      rules.auction = {
        bidIncrement: auctionBidIncrement,
        squadRule: auctionSquadRule,
        squadVisibility: auctionSquadVisibility,
        buyerVisibility: auctionBuyerVisibility,
        maxPausesPerMember: auctionMaxPauses,
      };
    }
    createMutation.mutate({
      name: finalName,
      format,
      template: "casual",
      tournament,
      maxMembers,
      isPrivate,
      rules,
    });
  };

  const activePreset = LEAGUE_TYPES.find((t) => maxMembers >= t.min && maxMembers <= t.max);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background.val }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} testID="create-league-screen">
      {/* ── Header ── */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingTop={insets.top + 8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <SafeBackButton />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("create league")}
          </Text>
        </XStack>
        <HeaderControls />
      </XStack>

      <AnnouncementBanner marginHorizontal={0} />

      {/* ── League Name (shown once AI flow is done) ── */}
      {nameGenStep === "done" && (
        <Animated.View entering={FadeInDown.duration(200)}>
          <YStack marginBottom="$5" gap="$1">
            <Text {...textStyles.sectionHeader}>{formatUIText("league name")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={60}
              testID="league-name-input"
              style={{
                fontFamily: "DM Sans",
                fontSize: 16,
                fontWeight: "700",
                color: theme.accentBackground?.val,
                backgroundColor: theme.background.val,
                borderWidth: 1,
                borderColor: theme.accentBackground?.val,
                borderRadius: DesignSystem.radius.lg,
                padding: 14,
              }}
            />
            <Text fontFamily="$mono" fontSize={9} color="$colorMuted" marginTop="$1">
              {formatUIText("tap to edit the name")}
            </Text>
          </YStack>
        </Animated.View>
      )}

      {/* ── Tournament Selection ── */}
      {(nameGenStep === "config" || nameGenStep === "done") && (
        <>
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

          {/* ── Format ── */}
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

          {/* ── League Type ── */}
          <Text {...textStyles.sectionHeader} marginBottom="$2">
            {formatUIText("league type")}
          </Text>
          <XStack gap="$2" marginBottom="$3" flexWrap="wrap">
            {LEAGUE_TYPES.map((t) => (
              <Card
                key={t.label}
                pressable
                flex={1}
                minWidth={70}
                padding="$3"
                alignItems="center"
                borderColor={activePreset?.label === t.label ? "$accentBackground" : "$borderColor"}
                onPress={() => setMaxMembers(t.default)}
              >
                <Text fontFamily="$mono" fontWeight="700" fontSize={14} color={activePreset?.label === t.label ? "$accentBackground" : "$color"}>
                  {t.label}
                </Text>
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted" marginTop={2}>
                  {t.min === t.max ? `${t.min} player` : `${t.min}-${t.max} players`}
                </Text>
              </Card>
            ))}
          </XStack>

          {/* Fine-tune with stepper */}
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$5">
            <YStack>
              <Text fontFamily="$body" fontSize={13} color="$color" fontWeight="600">
                {formatUIText("max members")}
              </Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                {activePreset ? activePreset.desc : `custom (${maxMembers})`}
              </Text>
            </YStack>
            <Stepper value={maxMembers} onValue={setMaxMembers} min={MIN_MEMBERS} max={MAX_MEMBERS} />
          </XStack>

          {/* ── Entry Fee ── */}
          <Text {...textStyles.sectionHeader} marginBottom="$2">
            {formatUIText("entry fee")}
          </Text>
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$5">
            <YStack>
              <Text fontFamily="$body" fontSize={13} color="$color" fontWeight="600">
                {entryFee === 0 ? formatUIText("free to join") : formatUIText(`${entryFee} coins per match`)}
              </Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                {formatUIText("lower fee = more accessible")}
              </Text>
            </YStack>
            <Stepper value={entryFee} onValue={setEntryFee} min={MIN_ENTRY_FEE} max={MAX_ENTRY_FEE} step={ENTRY_FEE_STEP} />
          </XStack>

          {/* ── Prize Breakdown ── */}
          {entryFee > 0 && (
            <Card padding="$3" marginBottom="$5" borderColor="$borderColor">
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
                <Text fontFamily="$mono" fontWeight="600" fontSize={12} color="$color">
                  {formatUIText("prize breakdown")}
                </Text>
                <Text fontFamily="$mono" fontSize={11} color="$accentBackground" fontWeight="700">
                  {formatUIText(`pool: ${entryFee * maxMembers} coins`)}
                </Text>
              </XStack>
              {getPrizePreview(entryFee, maxMembers).map((p) => (
                <XStack key={p.rank} justifyContent="space-between" paddingVertical={3}>
                  <Text fontFamily="$mono" fontSize={12} color="$colorMuted">
                    {p.rank === 1 ? "1st" : p.rank === 2 ? "2nd" : p.rank === 3 ? "3rd" : `${p.rank}th`}
                  </Text>
                  <Text fontFamily="$mono" fontSize={12} color="$color" fontWeight="600">
                    {Math.floor(entryFee * maxMembers * p.pct / 100)} coins ({p.pct}%)
                  </Text>
                </XStack>
              ))}
            </Card>
          )}

          {/* ── Auction Settings (only when format = auction) ── */}
          {format === "auction" && (
            <YStack marginBottom="$5">
              <Text {...textStyles.sectionHeader} marginBottom="$3">
                {formatUIText("auction settings")}
              </Text>

              {/* Bid Increment */}
              <Text fontFamily="$body" fontSize={13} color="$color" fontWeight="600" marginBottom="$1">
                {formatUIText("bid increment")}
              </Text>
              <XStack gap="$2" marginBottom="$4" flexWrap="wrap">
                {(auctionConfig?.bidIncrementOptions ?? [0.1, 0.2, 0.5, 1.0]).map((inc: number) => (
                  <Card
                    key={inc}
                    pressable
                    paddingHorizontal="$4"
                    paddingVertical="$2"
                    borderColor={auctionBidIncrement === inc ? "$accentBackground" : "$borderColor"}
                    onPress={() => setAuctionBidIncrement(inc)}
                  >
                    <Text fontFamily="$mono" fontWeight="700" fontSize={14} color={auctionBidIncrement === inc ? "$accentBackground" : "$color"}>
                      {inc}
                    </Text>
                  </Card>
                ))}
              </XStack>

              {/* Squad Rule */}
              <Text fontFamily="$body" fontSize={13} color="$color" fontWeight="600" marginBottom="$1">
                {formatUIText("squad rule")}
              </Text>
              <XStack gap="$2" marginBottom="$4" flexWrap="wrap">
                <Card
                  pressable
                  paddingHorizontal="$4"
                  paddingVertical="$2"
                  borderColor={auctionSquadRule === "none" ? "$accentBackground" : "$borderColor"}
                  onPress={() => setAuctionSquadRule("none")}
                >
                  <Text fontFamily="$mono" fontWeight="700" fontSize={13} color={auctionSquadRule === "none" ? "$accentBackground" : "$color"}>
                    {formatUIText("no rules")}
                  </Text>
                </Card>
                {(auctionConfig?.squadRules ?? []).map((rule: any) => (
                  <Card
                    key={rule.id}
                    pressable
                    paddingHorizontal="$4"
                    paddingVertical="$2"
                    borderColor={auctionSquadRule === rule.id ? "$accentBackground" : "$borderColor"}
                    onPress={() => setAuctionSquadRule(rule.id)}
                  >
                    <Text fontFamily="$mono" fontWeight="700" fontSize={13} color={auctionSquadRule === rule.id ? "$accentBackground" : "$color"}>
                      {rule.name}
                    </Text>
                    <Text fontFamily="$mono" fontSize={9} color="$colorMuted" marginTop={2}>
                      WK:{rule.minWK}-{rule.maxWK} BAT:{rule.minBAT}-{rule.maxBAT} BOWL:{rule.minBOWL}-{rule.maxBOWL} AR:{rule.minAR}-{rule.maxAR}
                    </Text>
                  </Card>
                ))}
              </XStack>

              {/* Squad Visibility */}
              <Text fontFamily="$body" fontSize={13} color="$color" fontWeight="600" marginBottom="$1">
                {formatUIText("squad visibility")}
              </Text>
              <XStack gap="$2" marginBottom="$4" flexWrap="wrap">
                {([
                  { value: "hidden", label: "hidden" },
                  { value: "after_sold", label: "after each sale" },
                  { value: "full", label: "always visible" },
                ] as const).map((opt) => (
                  <Card
                    key={opt.value}
                    pressable
                    paddingHorizontal="$3"
                    paddingVertical="$2"
                    borderColor={auctionSquadVisibility === opt.value ? "$accentBackground" : "$borderColor"}
                    onPress={() => setAuctionSquadVisibility(opt.value)}
                  >
                    <Text fontFamily="$mono" fontWeight="600" fontSize={12} color={auctionSquadVisibility === opt.value ? "$accentBackground" : "$color"}>
                      {formatUIText(opt.label)}
                    </Text>
                  </Card>
                ))}
              </XStack>

              {/* Buyer Visibility */}
              <Text fontFamily="$body" fontSize={13} color="$color" fontWeight="600" marginBottom="$1">
                {formatUIText("show buyer name")}
              </Text>
              <XStack gap="$2" marginBottom="$4" flexWrap="wrap">
                {([
                  { value: "during_auction", label: "during auction" },
                  { value: "after_auction", label: "after auction" },
                ] as const).map((opt) => (
                  <Card
                    key={opt.value}
                    pressable
                    paddingHorizontal="$3"
                    paddingVertical="$2"
                    borderColor={auctionBuyerVisibility === opt.value ? "$accentBackground" : "$borderColor"}
                    onPress={() => setAuctionBuyerVisibility(opt.value)}
                  >
                    <Text fontFamily="$mono" fontWeight="600" fontSize={12} color={auctionBuyerVisibility === opt.value ? "$accentBackground" : "$color"}>
                      {formatUIText(opt.label)}
                    </Text>
                  </Card>
                ))}
              </XStack>

              {/* Pauses Per Member */}
              <XStack justifyContent="space-between" alignItems="center">
                <YStack>
                  <Text fontFamily="$body" fontSize={13} color="$color" fontWeight="600">
                    {formatUIText("pauses per member")}
                  </Text>
                  <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                    {formatUIText("tactical timeouts during auction")}
                  </Text>
                </YStack>
                <Stepper
                  value={auctionMaxPauses}
                  onValue={setAuctionMaxPauses}
                  min={0}
                  max={auctionConfig?.maxPausesCap ?? 5}
                />
              </XStack>
            </YStack>
          )}

          {/* ── Visibility ── */}
          <Text {...textStyles.sectionHeader} marginBottom="$2">
            {formatUIText("visibility")}
          </Text>
          <XStack gap="$3" marginBottom="$5">
            <Card
              pressable
              flex={1}
              padding="$4"
              alignItems="center"
              borderColor={isPrivate ? "$accentBackground" : "$borderColor"}
              onPress={() => setIsPrivate(true)}
            >
              <Text fontFamily="$mono" fontWeight="700" fontSize={14} color={isPrivate ? "$accentBackground" : "$color"}>
                {formatUIText("private")}
              </Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted" marginTop={2}>
                {formatUIText("invite only")}
              </Text>
            </Card>
            <Card
              pressable
              flex={1}
              padding="$4"
              alignItems="center"
              borderColor={!isPrivate ? "$accentBackground" : "$borderColor"}
              onPress={() => setIsPrivate(false)}
            >
              <Text fontFamily="$mono" fontWeight="700" fontSize={14} color={!isPrivate ? "$accentBackground" : "$color"}>
                {formatUIText("public")}
              </Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted" marginTop={2}>
                {formatUIText("anyone can join")}
              </Text>
            </Card>
          </XStack>
        </>
      )}

      {/* ── Q1: Who's this league for? ── */}
      {nameGenStep === "q1" && (
        <Animated.View entering={FadeInDown.duration(200)}>
          <Card padding="$4" marginBottom="$4" borderColor="$accentBackground">
            <YStack gap="$3">
              <YStack gap="$1">
                <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                  {formatBadgeText("quick q — who's this league for?")}
                </Text>
                <TextInput
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder="e.g. office gang, hostel 4, family whatsapp..."
                  placeholderTextColor={theme.placeholderColor?.val || theme.colorMuted?.val}
                  maxLength={60}
                  autoFocus
                  style={{
                    fontFamily: "DM Sans",
                    fontSize: 14,
                    color: theme.color?.val,
                    backgroundColor: theme.backgroundSurface?.val || theme.background?.val,
                    borderWidth: 1,
                    borderColor: theme.borderColor?.val,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                />
              </YStack>
              <XStack gap="$2">
                <Pressable onPress={() => setNameGenStep("config")} style={{ flex: 1 }}>
                  <XStack paddingVertical="$2" justifyContent="center">
                    <Text fontFamily="$mono" fontSize={12} color="$colorMuted">{formatUIText("← back")}</Text>
                  </XStack>
                </Pressable>
                <View flex={2}>
                  <Button
                    variant="primary"
                    size="md"
                    onPress={handleQ1Submit}
                    disabled={!groupName.trim() || generateQuestionMutation.isPending}
                  >
                    {generateQuestionMutation.isPending ? formatUIText("thinking...") : formatUIText("next →")}
                  </Button>
                </View>
              </XStack>
            </YStack>
          </Card>
        </Animated.View>
      )}

      {/* ── Q2: Dynamic AI-generated question with selectable options ── */}
      {nameGenStep === "q2" && dynamicQ && (
        <Animated.View entering={FadeInDown.duration(200)}>
          <Card padding="$4" marginBottom="$4" borderColor="$accentBackground">
            <YStack gap="$3">
              <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                {formatBadgeText(dynamicQ.question)}
              </Text>
              <YStack gap="$2">
                {dynamicQ.options.map((option, i) => (
                  <Pressable key={i} onPress={() => handleQ2Pick(option)}>
                    <XStack
                      paddingHorizontal="$3"
                      paddingVertical="$2.5"
                      borderRadius={8}
                      borderWidth={1}
                      borderColor={selectedVibe === option ? "$accentBackground" : "$borderColor"}
                      backgroundColor={selectedVibe === option ? "$accentBackground" : "$backgroundSurface"}
                      alignItems="center"
                      gap="$2"
                      opacity={generateNameMutation.isPending && selectedVibe === option ? 0.7 : 1}
                    >
                      <Text fontFamily="$body" fontWeight="600" fontSize={14} color={selectedVibe === option ? "$background" : "$color"} flex={1}>
                        {option}
                      </Text>
                      {generateNameMutation.isPending && selectedVibe === option && (
                        <ActivityIndicator size="small" color={theme.background?.val} />
                      )}
                    </XStack>
                  </Pressable>
                ))}
              </YStack>
            </YStack>
          </Card>
        </Animated.View>
      )}

      {/* ── Picking: AI-generated name options ── */}
      {nameGenStep === "picking" && (
        <Animated.View entering={FadeInDown.duration(200)}>
          <Card padding="$4" marginBottom="$4" borderColor="$accentBackground">
            <YStack gap="$2">
              <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                {formatBadgeText("pick your league name")}
              </Text>
              <YStack gap="$2">
                {aiNameOptions.map((n, i) => (
                  <Pressable key={i} onPress={() => { setName(n); setNameGenStep("done"); }}>
                    <XStack
                      paddingHorizontal="$3"
                      paddingVertical="$2.5"
                      borderRadius={8}
                      borderWidth={1}
                      borderColor={name === n ? "$accentBackground" : "$borderColor"}
                      backgroundColor={name === n ? "$accentBackground" : "$backgroundSurface"}
                      alignItems="center"
                      gap="$2"
                    >
                      <Text fontFamily="$body" fontWeight="600" fontSize={14} color={name === n ? "$background" : "$color"} flex={1}>
                        {n}
                      </Text>
                    </XStack>
                  </Pressable>
                ))}
              </YStack>
            </YStack>
          </Card>
        </Animated.View>
      )}

      {/* ── Bottom Buttons ── */}
      {nameGenStep === "config" && (
        <Button
          variant="primary"
          size="lg"
          onPress={handleStartNaming}
          disabled={!tournament}
          opacity={!tournament ? 0.4 : 1}
          marginTop="$2"
          testID="generate-name-btn"
        >
          {formatUIText("✨ name my league")}
        </Button>
      )}

      {nameGenStep === "done" && (
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
      )}

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
