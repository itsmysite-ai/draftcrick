/**
 * Pitch & Weather Report — AI-powered venue conditions analysis.
 *
 * Generates pitch conditions, weather forecasts, and actionable fantasy tips
 * for upcoming matches. Uses Google Search for real-time weather data.
 *
 * Cache: Redis (1hr TTL) → Gemini (on miss).
 */

import { getLogger } from "../lib/logger";
import { createGeminiClientGlobal } from "./gemini-client";
import { getFromHotCache, setHotCache } from "./sports-cache";

const log = getLogger("pitch-weather");

const MODEL = "gemini-3.1-flash-lite-preview";
const PITCH_WEATHER_CACHE_TTL = 3600; // 1 hour

// ── Types ────────────────────────────────────────────────────

export interface PitchReport {
  pitchType: string; // e.g. "batting-friendly", "seaming", "turning"
  avgFirstInningsScore: number;
  avgSecondInningsScore: number;
  paceVsSpinAdvantage: "pace" | "spin" | "balanced";
  tossAdvantage: "bat_first" | "chase" | "neutral";
  venueInsight: string;
}

export interface WeatherReport {
  temperature: string; // e.g. "32°C"
  humidity: string; // e.g. "65%"
  conditions: string; // e.g. "Clear skies"
  dewFactor: string; // e.g. "Heavy dew expected in 2nd innings"
  impactOnGame: string; // one-liner
}

export interface PitchWeatherResult {
  matchId: string;
  pitch: PitchReport;
  weather: WeatherReport;
  fantasyTips: string[]; // 3 actionable tips
  generatedAt: string;
}

// ── Gemini Client ─────────────────────────────────────────────

let _ai: any = null;
async function getAI() {
  if (!_ai) _ai = await createGeminiClientGlobal();
  return _ai;
}

// ── Prompt ────────────────────────────────────────────────────

function buildPitchWeatherPrompt(
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null
): string {
  return `
You are a cricket analyst specializing in pitch and weather conditions for fantasy cricket.

Match: ${teamA} vs ${teamB}
Format: ${format}
Venue: ${venue ?? "TBD"}

Use Google Search to find:
1. Recent pitch reports and curator statements for the venue
2. Historical average scores at this venue in ${format} format
3. Current weather forecast for the match day
4. Dew conditions typically seen at this venue for evening matches
5. Recent match results at this venue (last 5 matches)

Analyze:
- Pitch behavior (batting-friendly, seaming, turning, balanced)
- Average first and second innings scores
- Whether pace or spin has the advantage
- Toss advantage (bat first vs chase)
- Weather impact on gameplay (humidity, dew, rain risk)

Return in this EXACT format:

[PITCH_START]
PitchType: <batting-friendly|seaming|turning|balanced>
AvgFirstInningsScore: <number>
AvgSecondInningsScore: <number>
PaceVsSpinAdvantage: <pace|spin|balanced>
TossAdvantage: <bat_first|chase|neutral>
VenueInsight: <one sentence about venue characteristics>
Temperature: <e.g. 32°C>
Humidity: <e.g. 65%>
Conditions: <e.g. Clear skies>
DewFactor: <one sentence about dew expectations>
ImpactOnGame: <one sentence about weather impact on gameplay>
FantasyTip1: <actionable fantasy tip based on conditions>
FantasyTip2: <actionable fantasy tip based on conditions>
FantasyTip3: <actionable fantasy tip based on conditions>
[PITCH_END]
`.trim();
}

// ── Parse ─────────────────────────────────────────────────────

function parsePitchWeatherResponse(text: string, matchId: string): PitchWeatherResult | null {
  try {
    const block = text.match(/\[PITCH_START\]([\s\S]*?)\[PITCH_END\]/);
    if (!block) {
      log.warn({ matchId }, "No pitch/weather block found in Gemini response");
      return null;
    }

    const content = block[1]!;
    const get = (key: string): string => {
      const m = content.match(new RegExp(`${key}:\\s*(.+)`));
      return m?.[1]?.trim() ?? "";
    };

    // Parse pace vs spin advantage
    const paceSpinRaw = get("PaceVsSpinAdvantage").toLowerCase();
    const paceVsSpinAdvantage: "pace" | "spin" | "balanced" =
      paceSpinRaw === "pace" || paceSpinRaw === "spin" || paceSpinRaw === "balanced"
        ? paceSpinRaw
        : "balanced";

    // Parse toss advantage
    const tossRaw = get("TossAdvantage").toLowerCase();
    const tossAdvantage: "bat_first" | "chase" | "neutral" =
      tossRaw === "bat_first" || tossRaw === "chase" || tossRaw === "neutral"
        ? tossRaw
        : "neutral";

    const pitch: PitchReport = {
      pitchType: get("PitchType") || "balanced",
      avgFirstInningsScore: parseInt(get("AvgFirstInningsScore")) || 0,
      avgSecondInningsScore: parseInt(get("AvgSecondInningsScore")) || 0,
      paceVsSpinAdvantage,
      tossAdvantage,
      venueInsight: get("VenueInsight") || "",
    };

    const weather: WeatherReport = {
      temperature: get("Temperature") || "",
      humidity: get("Humidity") || "",
      conditions: get("Conditions") || "",
      dewFactor: get("DewFactor") || "",
      impactOnGame: get("ImpactOnGame") || "",
    };

    const fantasyTips = [
      get("FantasyTip1"),
      get("FantasyTip2"),
      get("FantasyTip3"),
    ].filter(Boolean);

    return {
      matchId,
      pitch,
      weather,
      fantasyTips,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    log.error({ matchId, error: String(error) }, "Failed to parse pitch/weather response");
    return null;
  }
}

// ── Core: Get Pitch & Weather ────────────────────────────────

export async function getPitchWeather(
  matchId: string,
  teamA: string,
  teamB: string,
  format: string,
  venue: string | null
): Promise<PitchWeatherResult | null> {
  const cacheKey = `pitch-weather:${matchId}`;

  // Check cache first
  try {
    const cached = await getFromHotCache<PitchWeatherResult>(cacheKey);
    if (cached) {
      log.info({ matchId, match: `${teamA} vs ${teamB}` }, "Returning cached pitch/weather report");
      return cached;
    }
  } catch (error) {
    log.warn({ error: String(error) }, "Cache read failed, proceeding to Gemini");
  }

  const ai = await getAI();
  const prompt = buildPitchWeatherPrompt(teamA, teamB, format, venue);

  try {
    log.info(
      { matchId, match: `${teamA} vs ${teamB}`, venue },
      "Generating pitch/weather report via Gemini"
    );

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0.1, tools: [{ googleSearch: {} }] },
    });

    const text = typeof response.text === "function" ? response.text() : response.text;
    if (!text) {
      log.warn({ matchId }, "Empty Gemini response for pitch/weather");
      return null;
    }

    const result = parsePitchWeatherResponse(text, matchId);

    // Cache the result
    if (result) {
      try {
        await setHotCache(cacheKey, result, PITCH_WEATHER_CACHE_TTL);
        log.info({ cacheKey }, "Cached pitch/weather report for 1 hour");
      } catch (error) {
        log.warn({ error: String(error) }, "Cache write failed");
      }
    }

    return result;
  } catch (error) {
    log.error({ matchId, error: String(error) }, "Gemini pitch/weather generation failed");
    return null;
  }
}
