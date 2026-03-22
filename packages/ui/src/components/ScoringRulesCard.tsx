/**
 * ScoringRulesCard — expandable card showing fantasy scoring rules for a match format.
 * Reusable across match detail, contest detail, and onboarding flows.
 *
 * Scoring data is inlined here (mirrored from @draftplay/shared/constants/scoring-rules)
 * to keep the UI package independent.
 */

import { useState } from "react";
import { XStack, YStack } from "tamagui";
import { Text } from "../primitives/SportText";
import { DesignSystem } from "../constants/designSystem";

const formatUIText = DesignSystem.textCasing.ui;
const formatBadgeText = DesignSystem.textCasing.badge;

// ── Inlined scoring rules (from @draftplay/shared) ─────────────────

interface ScoringRules {
  runPoints: number;
  boundaryBonus: number;
  sixBonus: number;
  halfCenturyBonus: number;
  centuryBonus: number;
  strikeRateBonus: { threshold: number; points: number }[];
  duckPenalty: number;
  wicketPoints: number;
  maidenOverPoints: number;
  threeWicketBonus: number;
  fiveWicketBonus: number;
  economyRateBonus: { threshold: number; points: number }[];
  catchPoints: number;
  stumpingPoints: number;
  runOutDirectPoints: number;
  playerOfMatchBonus: number;
}

type MatchFormat = "t20" | "odi" | "test";

const T20: ScoringRules = {
  runPoints: 1, boundaryBonus: 1, sixBonus: 2,
  halfCenturyBonus: 20, centuryBonus: 50,
  strikeRateBonus: [{ threshold: 200, points: 10 }, { threshold: 175, points: 6 }, { threshold: 150, points: 4 }],
  duckPenalty: -5,
  wicketPoints: 25, maidenOverPoints: 15, threeWicketBonus: 15, fiveWicketBonus: 30,
  economyRateBonus: [{ threshold: 4, points: 10 }, { threshold: 5, points: 6 }, { threshold: 6, points: 4 }],
  catchPoints: 10, stumpingPoints: 15, runOutDirectPoints: 15,  playerOfMatchBonus: 25,
};

const ODI: ScoringRules = {
  runPoints: 1, boundaryBonus: 1, sixBonus: 2,
  halfCenturyBonus: 10, centuryBonus: 30,
  strikeRateBonus: [{ threshold: 150, points: 8 }, { threshold: 125, points: 4 }, { threshold: 100, points: 2 }],
  duckPenalty: -3,
  wicketPoints: 25, maidenOverPoints: 10, threeWicketBonus: 10, fiveWicketBonus: 25,
  economyRateBonus: [{ threshold: 3, points: 8 }, { threshold: 4, points: 4 }, { threshold: 5, points: 2 }],
  catchPoints: 8, stumpingPoints: 12, runOutDirectPoints: 12,  playerOfMatchBonus: 20,
};

const TEST: ScoringRules = {
  runPoints: 1, boundaryBonus: 1, sixBonus: 2,
  halfCenturyBonus: 10, centuryBonus: 30,
  strikeRateBonus: [],
  duckPenalty: -4,
  wicketPoints: 20, maidenOverPoints: 5, threeWicketBonus: 10, fiveWicketBonus: 25,
  economyRateBonus: [],
  catchPoints: 8, stumpingPoints: 12, runOutDirectPoints: 12,  playerOfMatchBonus: 15,
};

const FORMAT_MAP: Record<MatchFormat, ScoringRules> = { t20: T20, odi: ODI, test: TEST };

function normalizeFormat(raw?: string | null): MatchFormat {
  if (!raw) return "t20";
  const lower = raw.toLowerCase();
  if (lower.includes("odi") || lower.includes("one day")) return "odi";
  if (lower.includes("test")) return "test";
  return "t20";
}

// ── Build display rows ─────────────────────────────────────────────

interface ScoringRow { label: string; value: string }

function buildRows(rules: ScoringRules) {
  const batting: ScoringRow[] = [
    { label: "Run scored", value: `+${rules.runPoints}` },
    { label: "Boundary bonus (4s)", value: `+${rules.boundaryBonus}` },
    { label: "Six bonus", value: `+${rules.sixBonus}` },
    { label: "Half-century (50)", value: `+${rules.halfCenturyBonus}` },
    { label: "Century (100)", value: `+${rules.centuryBonus}` },
    { label: "Duck (0 runs)", value: `${rules.duckPenalty}` },
  ];
  for (const sr of rules.strikeRateBonus) {
    batting.push({ label: `SR above ${sr.threshold}`, value: `+${sr.points}` });
  }

  const bowling: ScoringRow[] = [
    { label: "Wicket", value: `+${rules.wicketPoints}` },
    { label: "Maiden over", value: `+${rules.maidenOverPoints}` },
    { label: "3-wicket haul", value: `+${rules.threeWicketBonus}` },
    { label: "5-wicket haul", value: `+${rules.fiveWicketBonus}` },
  ];
  for (const er of rules.economyRateBonus) {
    bowling.push({ label: `Economy below ${er.threshold}`, value: `+${er.points}` });
  }

  const fielding: ScoringRow[] = [
    { label: "Catch", value: `+${rules.catchPoints}` },
    { label: "Stumping", value: `+${rules.stumpingPoints}` },
    { label: "Run-out", value: `+${rules.runOutDirectPoints}` },
  ];

  const bonus: ScoringRow[] = [
    { label: "Captain", value: "2x points" },
    { label: "Vice-captain", value: "1.5x points" },
    { label: "Player of the match", value: `+${rules.playerOfMatchBonus}` },
  ];

  return { batting, bowling, fielding, bonus };
}

// ── Sub-components ─────────────────────────────────────────────────

function ScoringSection({ title, icon, rows }: { title: string; icon: string; rows: ScoringRow[] }) {
  return (
    <YStack gap="$1" marginBottom="$3">
      <XStack alignItems="center" gap="$2" marginBottom="$1">
        <Text fontSize={14}>{icon}</Text>
        <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="$color" letterSpacing={0.3}>
          {formatBadgeText(title)}
        </Text>
      </XStack>
      {rows.map((row, i) => (
        <XStack
          key={i}
          justifyContent="space-between"
          alignItems="center"
          paddingVertical={4}
          paddingHorizontal="$2"
          backgroundColor={i % 2 === 0 ? "$backgroundSurface" : "transparent"}
          borderRadius="$1"
        >
          <Text fontFamily="$body" fontSize={12} color="$colorSecondary">
            {row.label}
          </Text>
          <Text
            fontFamily="$mono"
            fontWeight="700"
            fontSize={12}
            color={row.value.startsWith("-") ? "$error" : "$accentBackground"}
          >
            {row.value}
          </Text>
        </XStack>
      ))}
    </YStack>
  );
}

// ── Main component ─────────────────────────────────────────────────

export interface ScoringRulesCardProps {
  /** Match format string — will be normalized to t20/odi/test */
  format?: string | null;
  /** Start expanded (default false) */
  defaultExpanded?: boolean;
  /** Compact mode — no expand toggle, always show all */
  compact?: boolean;
  testID?: string;
}

export function ScoringRulesCard({
  format: rawFormat,
  defaultExpanded = false,
  compact = false,
  testID = "scoring-rules-card",
}: ScoringRulesCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || compact);
  const format = normalizeFormat(rawFormat);
  const rules = FORMAT_MAP[format];
  const { batting, bowling, fielding, bonus } = buildRows(rules);

  const formatLabel = format === "t20" ? "T20" : format === "odi" ? "ODI" : "Test";

  return (
    <YStack testID={testID}>
      {/* Header — tappable to expand/collapse */}
      {!compact && (
        <XStack
          alignItems="center"
          gap="$3"
          padding="$4"
          backgroundColor="$backgroundSurface"
          borderRadius="$4"
          borderWidth={1}
          borderColor="$borderColor"
          onPress={() => setExpanded(!expanded)}
          cursor="pointer"
          hoverStyle={{ borderColor: "$accentBackground" }}
          pressStyle={{ opacity: 0.85, scale: 0.99 }}
          animation="quick"
          testID={`${testID}-toggle`}
        >
          <Text fontSize={20}>📋</Text>
          <YStack flex={1}>
            <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
              {formatUIText(`scoring rules — ${formatLabel}`)}
            </Text>
            <Text fontFamily="$body" fontSize={11} color="$colorMuted" marginTop={2}>
              {formatUIText("how fantasy points are calculated")}
            </Text>
          </YStack>
          <Text fontFamily="$mono" fontSize={12} color="$colorMuted">
            {expanded ? "▲" : "▼"}
          </Text>
        </XStack>
      )}

      {/* Content */}
      {expanded && (
        <YStack
          padding="$4"
          backgroundColor="$backgroundSurface"
          borderRadius="$4"
          borderWidth={1}
          borderColor="$borderColor"
          marginTop={compact ? 0 : "$2"}
          testID={`${testID}-content`}
        >
          {compact && (
            <XStack alignItems="center" gap="$2" marginBottom="$3">
              <Text fontSize={16}>📋</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={13} color="$color">
                {formatUIText(`scoring rules — ${formatLabel}`)}
              </Text>
            </XStack>
          )}

          <ScoringSection title="batting" icon="🏏" rows={batting} />
          <ScoringSection title="bowling" icon="🎯" rows={bowling} />
          <ScoringSection title="fielding" icon="🧤" rows={fielding} />
          <ScoringSection title="multipliers & bonus" icon="⭐" rows={bonus} />
        </YStack>
      )}
    </YStack>
  );
}
