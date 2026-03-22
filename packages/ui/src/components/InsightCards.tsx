/**
 * Reusable AI Insight Card components — extracted from match center.
 * Used in both match/[id].tsx and the AI Insights bottom sheet in team builder.
 *
 * All cards accept data as props (no internal queries) and are collapsible.
 */

import React from "react";
import { YStack, XStack } from "tamagui";
import { Text } from "../primitives/SportText";
import { Badge } from "../primitives/Badge";
import { FDRBadge } from "./FDRBadge";
import { TierBadge } from "./TierBadge";
import { EggLoadingSpinner } from "./EggLoadingSpinner";
import { formatUIText, formatBadgeText } from "../constants/designSystem";

// ── Types ──────────────────────────────────────────────────────

export interface FDRData {
  teamA: { overallFdr: number; battingFdr: number; bowlingFdr: number };
  teamB: { overallFdr: number; battingFdr: number; bowlingFdr: number };
}

export interface CaptainPick {
  playerName: string;
  confidence: "high" | "medium" | "low";
  reason: string;
}

export interface CaptainPicksData {
  captainPicks: CaptainPick[];
  viceCaptainPicks: CaptainPick[];
  summary?: string;
}

export interface DifferentialPick {
  playerName: string;
  expectedOwnership: number;
  upsideReason: string;
  projectedPoints: number;
}

export interface DifferentialsData {
  picks: DifferentialPick[];
}

export interface PlayingXIPlayer {
  name: string;
  role: string;
  confidence: number;
}

export interface PlayingXITeam {
  teamName: string;
  predictedXI: PlayingXIPlayer[];
}

export interface PlayingXIData {
  teamA: PlayingXITeam | null;
  teamB: PlayingXITeam | null;
  keyChanges?: string[];
}

export interface PitchWeatherData {
  pitch?: {
    pitchType: string;
    paceVsSpinAdvantage: string;
    avgFirstInningsScore: number | string;
    avgSecondInningsScore: number | string;
  };
  weather?: {
    conditions: string;
    temperature: string;
    humidity: string;
    dewFactor?: string;
  };
  fantasyTips?: string[];
}

export interface H2HData {
  overall?: { teamAWins: number; teamBWins: number; draws: number };
  inFormat?: { teamAWins: number; teamBWins: number; totalMatches: number };
  venueRecord?: string;
  keyInsight?: string;
}

// ── FDR Insight Card ───────────────────────────────────────────

export function FDRInsightCard({
  data,
  teamA,
  teamB,
  hasProAccess,
}: {
  data: FDRData;
  teamA: string;
  teamB: string;
  hasProAccess: boolean;
}) {
  return (
    <YStack gap="$3">
      <Text fontFamily="$mono" fontSize={10} color="$colorMuted" textAlign="center">
        {formatUIText("lower fdr = easier fixture for your fantasy picks")}
      </Text>
      <XStack justifyContent="space-around">
        {[
          { label: teamA, d: data.teamA },
          { label: teamB, d: data.teamB },
        ].map((t) => (
          <YStack key={t.label} alignItems="center" gap="$2">
            <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
              {t.label}
            </Text>
            <FDRBadge fdr={t.d.overallFdr} size="lg" showLabel />
            {hasProAccess ? (
              <XStack gap="$3" marginTop="$1">
                <YStack alignItems="center">
                  <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                    {formatUIText("bat")}
                  </Text>
                  <FDRBadge fdr={t.d.battingFdr} size="sm" />
                </YStack>
                <YStack alignItems="center">
                  <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                    {formatUIText("bowl")}
                  </Text>
                  <FDRBadge fdr={t.d.bowlingFdr} size="sm" />
                </YStack>
              </XStack>
            ) : (
              <XStack marginTop="$1" alignItems="center" gap="$1">
                <TierBadge tier="pro" size="sm" />
                <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                  {formatUIText("bat/bowl split")}
                </Text>
              </XStack>
            )}
          </YStack>
        ))}
      </XStack>
    </YStack>
  );
}

// ── Captain Picks Card ─────────────────────────────────────────

export function CaptainPicksCard({
  data,
  isLoading,
}: {
  data: CaptainPicksData | null;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <EggLoadingSpinner size={24} message={formatUIText("analyzing picks")} />;
  }
  if (!data) {
    return (
      <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center">
        {formatUIText("no picks available")}
      </Text>
    );
  }
  return (
    <YStack gap="$3">
      <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
        {formatBadgeText("top captain picks (2x)")}
      </Text>
      {(data.captainPicks ?? []).map((p, i) => (
        <XStack key={i} alignItems="flex-start" gap="$2">
          <Text fontFamily="$mono" fontWeight="800" fontSize={14} color="$colorCricket" marginTop={2}>
            #{i + 1}
          </Text>
          <YStack flex={1} gap="$1">
            <XStack alignItems="center" gap="$2">
              <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                {p.playerName}
              </Text>
              <Badge
                variant={p.confidence === "high" ? "live" : p.confidence === "medium" ? "warning" : "default"}
                size="sm"
              >
                {p.confidence}
              </Badge>
            </XStack>
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
              {p.reason}
            </Text>
          </YStack>
        </XStack>
      ))}
      <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5} marginTop="$2">
        {formatBadgeText("top vice-captain picks (1.5x)")}
      </Text>
      {(data.viceCaptainPicks ?? []).map((p, i) => (
        <XStack key={i} alignItems="flex-start" gap="$2">
          <Text fontFamily="$mono" fontWeight="800" fontSize={14} color="$accentBackground" marginTop={2}>
            #{i + 1}
          </Text>
          <YStack flex={1} gap="$1">
            <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
              {p.playerName}
            </Text>
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
              {p.reason}
            </Text>
          </YStack>
        </XStack>
      ))}
      {data.summary && (
        <Text fontFamily="$body" fontSize={11} color="$colorSecondary" marginTop="$1">
          {data.summary}
        </Text>
      )}
    </YStack>
  );
}

// ── Differentials Card ─────────────────────────────────────────

export function DifferentialsCard({
  data,
  isLoading,
}: {
  data: DifferentialsData | null;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <EggLoadingSpinner size={24} message={formatUIText("finding differentials")} />;
  }
  if (!data) {
    return (
      <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center">
        {formatUIText("no data available")}
      </Text>
    );
  }
  return (
    <YStack gap="$3">
      {(data.picks ?? []).map((p, i) => (
        <XStack key={i} alignItems="flex-start" gap="$2">
          <Text fontFamily="$mono" fontWeight="800" fontSize={14} color="$accentBackground" marginTop={2}>
            #{i + 1}
          </Text>
          <YStack flex={1} gap="$1">
            <XStack alignItems="center" gap="$2">
              <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                {p.playerName}
              </Text>
              <Badge variant="role" size="sm">
                ~{p.expectedOwnership}% est. ownership
              </Badge>
            </XStack>
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
              {p.upsideReason}
            </Text>
          </YStack>
          <Text fontFamily="$mono" fontWeight="700" fontSize={13} color="$accentBackground" marginTop={2}>
            {p.projectedPoints} pts
          </Text>
        </XStack>
      ))}
    </YStack>
  );
}

// ── Playing XI Card ────────────────────────────────────────────

export function PlayingXICard({
  data,
  isLoading,
}: {
  data: PlayingXIData | null;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <EggLoadingSpinner size={24} message={formatUIText("predicting lineup")} />;
  }
  if (!data) {
    return (
      <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center">
        {formatUIText("no prediction available")}
      </Text>
    );
  }
  return (
    <YStack gap="$3">
      {[data.teamA, data.teamB].map(
        (team) =>
          team && (
            <YStack key={team.teamName} gap="$1">
              <Text fontFamily="$mono" fontSize={11} fontWeight="700" color="$accentBackground" letterSpacing={0.5}>
                {formatBadgeText(team.teamName)}
              </Text>
              {(team.predictedXI ?? []).map((p, i) => (
                <XStack key={i} alignItems="center" gap="$2" paddingVertical={2}>
                  <Text fontFamily="$mono" fontSize={10} color="$colorMuted" width={16}>
                    {i + 1}.
                  </Text>
                  <Text fontFamily="$body" fontSize={12} color="$color" flex={1}>
                    {p.name}
                  </Text>
                  <Badge variant="default" size="sm">
                    {formatBadgeText(p.role)}
                  </Badge>
                  <Text fontFamily="$mono" fontSize={10} color={p.confidence >= 80 ? "$colorCricket" : "$colorMuted"}>
                    {p.confidence}%
                  </Text>
                </XStack>
              ))}
            </YStack>
          ),
      )}
      {(data.keyChanges ?? []).length > 0 && (
        <YStack marginTop="$1">
          <Text fontFamily="$mono" fontSize={9} color="$colorMuted" letterSpacing={0.5}>
            {formatBadgeText("key changes")}
          </Text>
          {data.keyChanges!.map((c, i) => (
            <Text key={i} fontFamily="$body" fontSize={11} color="$colorSecondary">
              {c}
            </Text>
          ))}
        </YStack>
      )}
    </YStack>
  );
}

// ── Pitch & Weather Card ───────────────────────────────────────

export function PitchWeatherCard({
  data,
  isLoading,
}: {
  data: PitchWeatherData | null;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <EggLoadingSpinner size={24} message={formatUIText("checking conditions")} />;
  }
  if (!data) {
    return (
      <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center">
        {formatUIText("no data available")}
      </Text>
    );
  }
  return (
    <YStack gap="$3">
      {data.pitch && (
        <YStack gap="$1">
          <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
            {formatBadgeText("pitch")}
          </Text>
          <XStack alignItems="center" gap="$2">
            <Text fontFamily="$body" fontWeight="700" fontSize={13} color="$color">
              {data.pitch.pitchType}
            </Text>
            <Badge variant="default" size="sm">
              {data.pitch.paceVsSpinAdvantage}
            </Badge>
          </XStack>
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            avg 1st innings: {data.pitch.avgFirstInningsScore} · 2nd innings: {data.pitch.avgSecondInningsScore}
          </Text>
        </YStack>
      )}
      {data.weather && (
        <YStack gap="$1">
          <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
            {formatBadgeText("weather")}
          </Text>
          <XStack alignItems="center" gap="$2">
            <Text fontFamily="$body" fontWeight="700" fontSize={13} color="$color">
              {data.weather.conditions}
            </Text>
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
              {data.weather.temperature} · {data.weather.humidity}
            </Text>
          </XStack>
          {data.weather.dewFactor && (
            <Text fontFamily="$mono" fontSize={10} color="$colorAccent">
              {data.weather.dewFactor}
            </Text>
          )}
        </YStack>
      )}
      {(data.fantasyTips ?? []).length > 0 && (
        <YStack marginTop="$1">
          <Text fontFamily="$mono" fontSize={9} color="$colorMuted" letterSpacing={0.5}>
            {formatBadgeText("fantasy tips")}
          </Text>
          {data.fantasyTips!.map((tip, i) => (
            <Text key={i} fontFamily="$body" fontSize={11} color="$colorSecondary">
              {tip}
            </Text>
          ))}
        </YStack>
      )}
    </YStack>
  );
}

// ── H2H Stats Card ─────────────────────────────────────────────

export function H2HStatsCard({
  data,
  teamA,
  teamB,
  format,
  isLoading,
}: {
  data: H2HData | null;
  teamA: string;
  teamB: string;
  format: string;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <EggLoadingSpinner size={24} message={formatUIText("loading h2h")} />;
  }
  if (!data) {
    return (
      <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center">
        {formatUIText("couldn't load head to head data")}
      </Text>
    );
  }
  return (
    <YStack gap="$2">
      <XStack justifyContent="space-around">
        <YStack alignItems="center">
          <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$accentBackground">
            {data.overall?.teamAWins ?? 0}
          </Text>
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            {teamA} wins
          </Text>
        </YStack>
        <YStack alignItems="center">
          <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$colorMuted">
            {data.overall?.draws ?? 0}
          </Text>
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            draws
          </Text>
        </YStack>
        <YStack alignItems="center">
          <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$colorCricket">
            {data.overall?.teamBWins ?? 0}
          </Text>
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            {teamB} wins
          </Text>
        </YStack>
      </XStack>
      <Text fontFamily="$mono" fontSize={10} color="$colorMuted" textAlign="center">
        {format}: {data.inFormat?.teamAWins ?? 0}-{data.inFormat?.teamBWins ?? 0} ({data.inFormat?.totalMatches ?? 0}{" "}
        matches)
      </Text>
      {data.venueRecord && (
        <Text fontFamily="$body" fontSize={11} color="$colorSecondary" textAlign="center">
          {data.venueRecord}
        </Text>
      )}
      {data.keyInsight && (
        <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$accentBackground" textAlign="center" marginTop="$1">
          {data.keyInsight}
        </Text>
      )}
    </YStack>
  );
}
