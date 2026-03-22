/**
 * AI Insights Bottom Sheet — gives team builder access to all match center AI features.
 *
 * Tabs: Overview | Captain | Differentials | Conditions | H2H
 * Data is lazy-loaded per tab using the same tRPC queries as the match center.
 */

import { Modal, Pressable, Dimensions, ScrollView } from "react-native";
import { useState, useMemo } from "react";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "./SportText";
import {
  Card,
  Badge,
  FilterPill,
  EggLoadingSpinner,
  TierBadge,
  FDRInsightCard,
  CaptainPicksCard,
  DifferentialsCard,
  PlayingXICard,
  PitchWeatherCard,
  H2HStatsCard,
  formatUIText,
  formatBadgeText,
} from "@draftplay/ui";
import { trpc } from "../lib/trpc";
import { usePaywall } from "../hooks/usePaywall";

const SCREEN_HEIGHT = Dimensions.get("window").height;

type InsightTab = "overview" | "captain" | "differentials" | "conditions" | "h2h" | "tools";

const TABS: { key: InsightTab; label: string; emoji: string }[] = [
  { key: "overview", label: "overview", emoji: "📊" },
  { key: "captain", label: "captain", emoji: "👑" },
  { key: "differentials", label: "diffs", emoji: "💎" },
  { key: "conditions", label: "conditions", emoji: "🌤️" },
  { key: "h2h", label: "h2h", emoji: "⚔️" },
  { key: "tools", label: "tools", emoji: "🛠️" },
];

interface AIInsightsSheetProps {
  visible: boolean;
  onClose: () => void;
  matchId: string;
  teamA: string;
  teamB: string;
  format: string;
  venue?: string | null;
  tournament?: string;
  /** Player list for captain picks / differentials queries */
  players: Array<{ name: string; role: string; team: string }>;
  /** If set, auto-open to this tab */
  initialTab?: InsightTab;
  /** Called when user wants to navigate to a tool (compare/solver) — sheet closes first */
  onNavigate?: (route: "compare" | "solver") => void;
}

export function AIInsightsSheet({
  visible,
  onClose,
  matchId,
  teamA,
  teamB,
  format,
  venue,
  tournament,
  players,
  initialTab = "overview",
  onNavigate,
}: AIInsightsSheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { hasAccess, canAccess, gateFeature } = usePaywall();

  const [activeTab, setActiveTab] = useState<InsightTab>(initialTab);

  // ── Lazy-loaded queries — only fetch when tab is active ──

  const fdrQuery = trpc.analytics.getFixtureDifficulty.useQuery(
    { matchId, teamA, teamB, format, venue, tournament: tournament || "unknown" },
    { enabled: visible && activeTab === "overview", staleTime: 60 * 60_000, retry: 1 },
  );

  const playingXIQuery = trpc.analytics.getPlayingXI.useQuery(
    { matchId, teamA, teamB, format, venue, tournament: tournament || "unknown" },
    { enabled: visible && activeTab === "overview" && canAccess("hasPlayingXI"), staleTime: 60 * 60_000, retry: 1 },
  );

  const captainPicksQuery = trpc.analytics.getCaptainPicks.useQuery(
    { matchId, teamA, teamB, format, venue, tournament: tournament || "unknown", players },
    { enabled: visible && activeTab === "captain" && canAccess("hasCaptainPicks"), staleTime: 2 * 60 * 60_000, retry: 1 },
  );

  const differentialsQuery = trpc.analytics.getDifferentials.useQuery(
    { matchId, teamA, teamB, format, venue, tournament: tournament || "unknown", players },
    { enabled: visible && activeTab === "differentials" && canAccess("hasDifferentials"), staleTime: 2 * 60 * 60_000, retry: 1 },
  );

  const pitchWeatherQuery = trpc.analytics.getPitchWeather.useQuery(
    { matchId, teamA, teamB, format, venue },
    { enabled: visible && activeTab === "conditions" && canAccess("hasPitchWeather"), staleTime: 60 * 60_000, retry: 1 },
  );

  const h2hQuery = trpc.analytics.getHeadToHead.useQuery(
    { teamA, teamB, format, venue },
    { enabled: visible && activeTab === "h2h" && canAccess("hasHeadToHead"), staleTime: 6 * 60 * 60_000, retry: 1 },
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <YStack gap="$4">
            {/* FDR Section */}
            <YStack>
              <Text fontFamily="$mono" fontWeight="600" fontSize={11} color="$colorMuted" letterSpacing={0.5} marginBottom="$2">
                {formatBadgeText("fixture difficulty")}
              </Text>
              {fdrQuery.isLoading ? (
                <EggLoadingSpinner size={24} message={formatUIText("loading fdr")} />
              ) : fdrQuery.data ? (
                <FDRInsightCard data={fdrQuery.data as any} teamA={teamA} teamB={teamB} hasProAccess={hasAccess("pro")} />
              ) : (
                <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center">
                  {formatUIText("fdr not available")}
                </Text>
              )}
            </YStack>

            {/* Playing XI Preview */}
            {canAccess("hasPlayingXI") && (
              <YStack>
                <Text fontFamily="$mono" fontWeight="600" fontSize={11} color="$colorMuted" letterSpacing={0.5} marginBottom="$2">
                  {formatBadgeText("playing xi prediction")}
                </Text>
                <PlayingXICard data={playingXIQuery.data as any} isLoading={playingXIQuery.isLoading} />
              </YStack>
            )}
            {!canAccess("hasPlayingXI") && (
              <XStack alignItems="center" gap="$2">
                <TierBadge tier="pro" size="sm" />
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{formatUIText("playing xi prediction")}</Text>
              </XStack>
            )}
          </YStack>
        );

      case "captain":
        if (!canAccess("hasCaptainPicks")) {
          return (
            <YStack alignItems="center" gap="$3" paddingVertical="$6">
              <Text fontSize={32}>👑</Text>
              <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" textAlign="center">
                {formatUIText("captain picks")}
              </Text>
              <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center">
                {formatUIText("ai-recommended captain & vice-captain choices")}
              </Text>
              <TierBadge tier="pro" size="md" />
            </YStack>
          );
        }
        return <CaptainPicksCard data={captainPicksQuery.data as any} isLoading={captainPicksQuery.isLoading} />;

      case "differentials":
        if (!canAccess("hasDifferentials")) {
          return (
            <YStack alignItems="center" gap="$3" paddingVertical="$6">
              <Text fontSize={32}>💎</Text>
              <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" textAlign="center">
                {formatUIText("differentials")}
              </Text>
              <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center">
                {formatUIText("low-ownership high-upside picks")}
              </Text>
              <TierBadge tier="pro" size="md" />
            </YStack>
          );
        }
        return <DifferentialsCard data={differentialsQuery.data as any} isLoading={differentialsQuery.isLoading} />;

      case "conditions":
        if (!canAccess("hasPitchWeather")) {
          return (
            <YStack alignItems="center" gap="$3" paddingVertical="$6">
              <Text fontSize={32}>🌤️</Text>
              <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" textAlign="center">
                {formatUIText("weather & pitch")}
              </Text>
              <TierBadge tier="pro" size="md" />
            </YStack>
          );
        }
        return <PitchWeatherCard data={pitchWeatherQuery.data as any} isLoading={pitchWeatherQuery.isLoading} />;

      case "h2h":
        if (!canAccess("hasHeadToHead")) {
          return (
            <YStack alignItems="center" gap="$3" paddingVertical="$6">
              <Text fontSize={32}>⚔️</Text>
              <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" textAlign="center">
                {formatUIText("head to head")}
              </Text>
              <TierBadge tier="pro" size="md" />
            </YStack>
          );
        }
        return <H2HStatsCard data={h2hQuery.data as any} teamA={teamA} teamB={teamB} format={format} isLoading={h2hQuery.isLoading} />;

      case "tools":
        return (
          <YStack gap="$3">
            {/* Compare Players */}
            <Pressable onPress={() => {
              if (!canAccess("hasPlayerCompare")) {
                gateFeature("hasPlayerCompare", "pro", "Compare Players", "Side-by-side player comparison tool");
                return;
              }
              onClose();
              onNavigate?.("compare");
            }}>
              <Card padding="$4">
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={20}>⚖️</Text>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                      {formatUIText("compare players")}
                    </Text>
                    <Text fontFamily="$body" fontSize={11} color="$colorMuted" marginTop={2}>
                      {formatUIText("side-by-side player comparison")}
                    </Text>
                  </YStack>
                  {!canAccess("hasPlayerCompare") ? (
                    <TierBadge tier="pro" />
                  ) : (
                    <Text fontFamily="$mono" fontSize={12} color="$colorMuted">→</Text>
                  )}
                </XStack>
              </Card>
            </Pressable>

            {/* Team Solver */}
            <Pressable onPress={() => {
              if (!canAccess("hasTeamSolver")) {
                gateFeature("hasTeamSolver", "elite", "Team Solver", "Auto-pick the optimal 11 within your budget");
                return;
              }
              onClose();
              onNavigate?.("solver");
            }}>
              <Card padding="$4">
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={20}>🤖</Text>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                      {formatUIText("team solver")}
                    </Text>
                    <Text fontFamily="$body" fontSize={11} color="$colorMuted" marginTop={2}>
                      {formatUIText("auto-pick optimal 11 within budget")}
                    </Text>
                  </YStack>
                  {!canAccess("hasTeamSolver") ? (
                    <TierBadge tier="elite" />
                  ) : (
                    <Text fontFamily="$mono" fontSize={12} color="$colorMuted">→</Text>
                  )}
                </XStack>
              </Card>
            </Pressable>
          </YStack>
        );

      default:
        return null;
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        entering={SlideInDown.duration(300).springify()}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: SCREEN_HEIGHT * 0.75,
          backgroundColor: theme.background.val,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: insets.bottom + 8,
        }}
      >
        {/* Handle */}
        <YStack alignItems="center" paddingTop="$3" paddingBottom="$2">
          <YStack width={36} height={4} borderRadius={2} backgroundColor="$borderColor" />
        </YStack>

        {/* Title */}
        <XStack paddingHorizontal="$4" paddingBottom="$2" alignItems="center" justifyContent="space-between">
          <XStack alignItems="center" gap="$2">
            <Text fontSize={16}>🤖</Text>
            <Text fontFamily="$mono" fontWeight="600" fontSize={15} color="$color" letterSpacing={-0.5}>
              {formatUIText("ai insights")}
            </Text>
          </XStack>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text fontFamily="$mono" fontSize={14} color="$colorMuted">✕</Text>
          </Pressable>
        </XStack>

        {/* Tab Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingBottom: 8 }}>
          {TABS.map((tab) => (
            <FilterPill key={tab.key} active={activeTab === tab.key} onPress={() => setActiveTab(tab.key)}>
              <XStack alignItems="center" gap="$1">
                <Text fontSize={12}>{tab.emoji}</Text>
                <Text fontFamily="$mono" fontSize={10} fontWeight="700" color={activeTab === tab.key ? "$background" : "$colorMuted"}>
                  {formatBadgeText(tab.label)}
                </Text>
              </XStack>
            </FilterPill>
          ))}
        </ScrollView>

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {renderTabContent()}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
