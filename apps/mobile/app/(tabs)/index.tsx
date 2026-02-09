import { ScrollView as RNScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import {
  XStack,
  YStack,
  Text,
} from "tamagui";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  AnnouncementBanner,
  FilterPill,
  SegmentTab,
  ModeToggle,
  StatLabel,
  formatUIText,
} from "@draftcrick/ui";
import { useTheme } from "../../providers/ThemeProvider";

// ─── Sample player data (replace with tRPC query later) ─────────────
const PLAYERS = [
  { id: 1, name: "Virat Kohli", role: "BAT" as const, team: "IND", ovr: 97, stats: { avg: 53.4, sr: 93.2, runs: 13848 } },
  { id: 2, name: "Jasprit Bumrah", role: "BOWL" as const, team: "IND", ovr: 96, stats: { wkts: 178, econ: 4.2, avg: 21.7 } },
  { id: 3, name: "Pat Cummins", role: "BOWL" as const, team: "AUS", ovr: 95, stats: { wkts: 196, econ: 4.8, avg: 22.1 } },
  { id: 4, name: "Joe Root", role: "BAT" as const, team: "ENG", ovr: 95, stats: { avg: 50.6, sr: 56.2, runs: 12402 } },
  { id: 5, name: "Rashid Khan", role: "BOWL" as const, team: "AFG", ovr: 94, stats: { wkts: 172, econ: 4.1, avg: 19.8 } },
  { id: 6, name: "Ben Stokes", role: "AR" as const, team: "ENG", ovr: 94, stats: { avg: 36.7, sr: 71.4, wkts: 104 } },
  { id: 7, name: "Kane Williamson", role: "BAT" as const, team: "NZ", ovr: 93, stats: { avg: 54.3, sr: 52.1, runs: 8889 } },
  { id: 8, name: "Shakib Al Hasan", role: "AR" as const, team: "BAN", ovr: 93, stats: { avg: 34.8, sr: 68.3, wkts: 237 } },
  { id: 9, name: "Rishabh Pant", role: "WK" as const, team: "IND", ovr: 92, stats: { avg: 44.1, sr: 73.9, runs: 2648 } },
  { id: 10, name: "Kagiso Rabada", role: "BOWL" as const, team: "SA", ovr: 92, stats: { wkts: 168, econ: 5.1, avg: 23.4 } },
  { id: 11, name: "Travis Head", role: "BAT" as const, team: "AUS", ovr: 91, stats: { avg: 42.8, sr: 68.5, runs: 3210 } },
  { id: 12, name: "Quinton de Kock", role: "WK" as const, team: "SA", ovr: 91, stats: { avg: 38.6, sr: 71.2, runs: 5765 } },
];

type Player = (typeof PLAYERS)[number];
type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

// ─── Role color mapping for Tamagui ─────────────────────────────────
const ROLE_TOKENS: Record<RoleKey, { bg: string; text: string; lightBg: string; lightText: string }> = {
  BAT: { bg: "$roleBatBg", text: "$roleBatText", lightBg: "$roleBatLightBg", lightText: "$roleBatLightText" },
  BOWL: { bg: "$roleBowlBg", text: "$roleBowlText", lightBg: "$roleBowlLightBg", lightText: "$roleBowlLightText" },
  AR: { bg: "$roleArBg", text: "$roleArText", lightBg: "$roleArLightBg", lightText: "$roleArLightText" },
  WK: { bg: "$roleWkBg", text: "$roleWkText", lightBg: "$roleWkLightBg", lightText: "$roleWkLightText" },
};


// ─── Main ───────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode, toggleMode, t, roles } = useTheme();

  const [myTeam, setMyTeam] = useState<Player[]>([]);
  const [allDrafted, setAllDrafted] = useState<number[]>([]);
  const [round, setRound] = useState(1);
  const [pick, setPick] = useState(1);
  const [tab, setTab] = useState<"draft" | "team">("draft");
  const [roleFilter, setRoleFilter] = useState<"all" | RoleKey>("all");

  const handleDraft = (player: Player) => {
    setMyTeam((prev) => [...prev, player]);
    setAllDrafted((prev) => [...prev, player.id]);
    setPick((p) => p + 1);
    if (pick % 4 === 0) setRound((r) => r + 1);
  };

  const available = PLAYERS.filter((p) => !allDrafted.includes(p.id));
  const filtered = roleFilter === "all" ? available : available.filter((p) => p.role === roleFilter);
  return (
    <YStack flex={1} backgroundColor="$background">
      <RNScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <Animated.View entering={FadeIn.delay(0)}>
          <XStack
            justifyContent="space-between"
            alignItems="flex-start"
            paddingHorizontal="$4"
            paddingBottom="$5"
            paddingTop={insets.top + 8}
          >
            <YStack>
              <XStack alignItems="center" gap="$2">
                <Text fontSize={22}>🥚</Text>
                <Text fontFamily="$mono" fontSize={17} fontWeight="500" color="$color" letterSpacing={-0.5}>
                  tami·draft
                </Text>
                <XStack backgroundColor="$colorAccentLight" paddingHorizontal={7} paddingVertical={2} borderRadius="$1">
                  <Text fontFamily="$mono" fontSize={9} fontWeight="600" color="$colorAccent">
                    🏏 cricket
                  </Text>
                </XStack>
              </XStack>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted" marginTop={3} marginLeft={30}>
                fantasy cricket companion
              </Text>
            </YStack>

            <ModeToggle mode={mode} onToggle={toggleMode} />
          </XStack>
        </Animated.View>

        {/* ── Happiness Meter ── */}
        <Animated.View entering={FadeInDown.delay(30).springify()}>
          <AnnouncementBanner />
        </Animated.View>

        {/* ── Segment Tabs ── */}
        <XStack
          backgroundColor="$backgroundSurfaceAlt"
          marginHorizontal="$4"
          marginBottom="$3"
          borderRadius="$3"
          padding="$1"
          gap="$1"
        >
          {([
            { key: "draft" as const, label: formatUIText("available"), count: available.length },
            { key: "team" as const, label: formatUIText("my squad"), count: myTeam.length },
          ]).map((tb) => (
            <SegmentTab key={tb.key} active={tab === tb.key} onPress={() => setTab(tb.key)}>
              <Text
                fontFamily="$body"
                fontWeight="600"
                fontSize={13}
                color={tab === tb.key ? "$color" : "$colorMuted"}
              >
                {tb.label}
              </Text>
              <Text fontFamily="$mono" fontSize={11} color={tab === tb.key ? "$colorSecondary" : "$colorMuted"}>
                {tb.count}
              </Text>
            </SegmentTab>
          ))}
        </XStack>

        {/* ── Role Filter ── */}
        {tab === "draft" && (
          <RNScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 14 }}
          >
            {([
              { key: "all" as const, label: "all" },
              { key: "BAT" as const, label: "🏏 batsmen" },
              { key: "BOWL" as const, label: "🎯 bowlers" },
              { key: "AR" as const, label: "⚡ all-round" },
              { key: "WK" as const, label: "🧤 keepers" },
            ]).map((f) => (
              <FilterPill key={f.key} active={roleFilter === f.key} onPress={() => setRoleFilter(f.key)}>
                <Text
                  fontFamily="$body"
                  fontSize={12}
                  fontWeight="500"
                  color={roleFilter === f.key ? "$background" : "$colorSecondary"}
                >
                  {f.label}
                </Text>
              </FilterPill>
            ))}
          </RNScrollView>
        )}

        {/* ── Player List ── */}
        <YStack paddingHorizontal="$4" gap="$2">
          {tab === "draft" ? (
            filtered.length > 0 ? (
              filtered.map((p, i) => {
                const [isHovered, setIsHovered] = useState(false);
                return (
                <Animated.View key={p.id} entering={FadeInDown.delay(60 + i * 40).springify()}>
                  <Card 
                    pressable
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                  >
                    <XStack alignItems="center" gap="$3">
                      <InitialsAvatar 
                        name={p.name} 
                        playerRole={p.role} 
                        ovr={p.ovr}
                        scale={isHovered ? 1.12 : 1}
                      />
                      <YStack flex={1} minWidth={0}>
                        <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" marginBottom={3}>
                          {p.name}
                        </Text>
                        <XStack alignItems="center" gap="$2" flexWrap="wrap">
                          <Badge variant="role" size="sm">{p.role}</Badge>
                          <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{p.team}</Text>
                          <Text color="$borderColor">·</Text>
                          {Object.entries(p.stats).map(([k, v]) => (
                            <StatLabel key={k} label={k} value={v} />
                          ))}
                        </XStack>
                      </YStack>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => handleDraft(p)}
                        backgroundColor={isHovered ? "$accentBackground" : "$backgroundSurfaceAlt"}
                        color={isHovered ? "$white" : "$colorMuted"}
                      >
                        draft
                      </Button>
                    </XStack>
                  </Card>
                </Animated.View>
              )})
            ) : (
              <YStack alignItems="center" paddingVertical="$8">
                <Text fontSize={40} marginBottom="$3">🏏</Text>
                <Text fontFamily="$mono" fontSize={12} color="$colorMuted" textAlign="center">
                  no players in this role
                </Text>
              </YStack>
            )
          ) : myTeam.length > 0 ? (
            myTeam.map((p, i) => (
              <Animated.View key={p.id} entering={FadeInDown.delay(60 + i * 40).springify()}>
                <Card>
                  <XStack alignItems="center" gap="$3">
                    <Text fontFamily="$mono" fontSize={11} color="$colorMuted" width={20} textAlign="center">
                      {i + 1}
                    </Text>
                    <InitialsAvatar name={p.name} playerRole={p.role} ovr={p.ovr} size={40} />
                    <YStack flex={1}>
                      <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" marginBottom={3}>
                        {p.name}
                      </Text>
                      <XStack alignItems="center" gap="$2">
                        <Badge variant="role" size="sm">{p.role}</Badge>
                        <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{p.team}</Text>
                      </XStack>
                    </YStack>
                  </XStack>
                </Card>
              </Animated.View>
            ))
          ) : (
            <YStack alignItems="center" paddingVertical="$8">
              <Text fontSize={48} marginBottom="$4">🥚</Text>
              <Text fontFamily="$mono" fontSize={12} color="$colorMuted" textAlign="center" lineHeight={20}>
                draft cricketers to hatch your squad
              </Text>
            </YStack>
          )}
        </YStack>
      </RNScrollView>
    </YStack>
  );
}
