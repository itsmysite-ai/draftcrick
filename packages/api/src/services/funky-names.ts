/**
 * Generate fun anonymous usernames using AI.
 * Takes an email, asks Gemini to create a fun sports-themed name
 * with zero PII. Falls back to random generation if AI fails.
 */

import { createGeminiClient, GEMINI_MODEL } from "./gemini-client";
import { getLogger } from "../lib/logger";

const log = getLogger("funky-names");

const PROMPT = `Generate a single fun, creative username for a fantasy sports app user.

Rules:
- Must be exactly 2 words joined together in CamelCase followed by underscore and a 1-2 digit number
- Can use sports terminology, gaming culture, animals, space, weather, or anything fun
- Must contain ZERO personal information — do not use any part of the hint provided
- Keep it fun, playful, and family-friendly
- No spaces, no special characters except underscore before the number

The hint about this user (DO NOT include any of this in the name): "{hint}"

Examples of good names: CosmicPanda_7, NeonFalcon_42, TurboPhoenix_11, ChillNinja_88, ShadowViper_3, ElectricWolf_55, MysticRaven_9

Respond with ONLY the username, nothing else.`;

/**
 * Generate a funky anonymous username using AI.
 * @param email - user's email (used as hint, never leaked in the name)
 */
export async function generateFunkyName(email: string | null): Promise<string> {
  try {
    const hint = email ? (email.split("@")[0] ?? "new user") : "new user";
    const genAI = await createGeminiClient(process.env.GEMINI_DEFAULT_REGION || "IN");
    const prompt = PROMPT.replace("{hint}", hint);
    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 1.2, // high creativity
        maxOutputTokens: 32,
      },
    });

    const name = response?.text?.trim().replace(/[^a-zA-Z0-9_]/g, "");
    if (name && name.length >= 5 && name.length <= 30) {
      log.debug({ name }, "AI generated funky name");
      return name;
    }
  } catch (error) {
    log.warn({ error: String(error) }, "AI funky name generation failed, using fallback");
  }

  return randomFallbackName();
}

function randomFallbackName(): string {
  const adjs = [
    "Bold", "Swift", "Sneaky", "Mighty", "Electric", "Cosmic", "Fierce",
    "Shadow", "Golden", "Blazing", "Phantom", "Wild", "Lucky", "Mystic",
    "Savage", "Epic", "Funky", "Slick", "Turbo", "Clutch", "Stealth",
  ];
  const nouns = [
    "Falcon", "Phoenix", "Wolf", "Panda", "Tiger", "Viper", "Ninja",
    "Hawk", "Dragon", "Raven", "Shark", "Eagle", "Lion", "Fox",
  ];
  const adj = adjs[Math.floor(Math.random() * adjs.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}${noun}_${num}`;
}

/**
 * Generate avatar hue from username — consistent color per user.
 */
export function avatarHue(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash) + username.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}
