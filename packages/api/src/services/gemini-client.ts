/**
 * Region-aware Gemini AI client.
 *
 * Routes user-facing requests to the nearest Vertex AI region.
 * Uses API key mode for dev, Vertex AI for production.
 *
 * See /docs/GEO_IMPLEMENTATION_GUIDE.md section 4.
 */

import { getLogger } from "../lib/logger";

const log = getLogger("gemini-client");

const REGION_MAP: Record<string, string> = {
  IN: "asia-south1",
  BD: "asia-southeast1",
  LK: "asia-southeast1",
  NP: "asia-southeast1",
  SG: "asia-southeast1",
  MY: "asia-southeast1",
  TH: "asia-southeast1",
  ID: "asia-southeast1",
  PH: "asia-southeast1",
  VN: "asia-southeast1",
  JP: "asia-northeast1",
  KR: "asia-northeast3",
  AU: "australia-southeast1",
  US: "us-central1",
  CA: "northamerica-northeast1",
  MX: "us-central1",
  BR: "us-central1",
  GB: "europe-west1",
  DE: "europe-west1",
  FR: "europe-west1",
  NL: "europe-west1",
  IT: "europe-west1",
  ES: "europe-west1",
  AE: "asia-south1",
  SA: "asia-south1",
  QA: "asia-south1",
};

const DEFAULT_REGION = "asia-south1";

export function getGeminiRegion(userCountry: string): string {
  return REGION_MAP[userCountry] ?? DEFAULT_REGION;
}

let _GoogleGenAI: any = null;
async function loadGoogleGenAI() {
  if (!_GoogleGenAI) {
    const mod = await import("@google/genai");
    _GoogleGenAI = mod.GoogleGenAI;
  }
  return _GoogleGenAI;
}

/**
 * Create a region-specific Gemini client for user-facing requests.
 */
export async function createGeminiClient(userCountry: string) {
  const GoogleGenAI = await loadGoogleGenAI();
  const project = process.env.GCP_PROJECT_ID;

  if (project) {
    const region = getGeminiRegion(userCountry);
    log.info({ userCountry, region }, "Creating region-aware Gemini client");
    return new GoogleGenAI({ vertexai: true, project, location: region });
  }

  const apiKey = process.env.GOOGLE_CLOUD_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
}

/**
 * Create a Gemini client for background/batch jobs (global endpoint).
 */
export async function createGeminiClientGlobal() {
  const GoogleGenAI = await loadGoogleGenAI();
  const project = process.env.GCP_PROJECT_ID;

  if (project) {
    log.info("Creating global Gemini client for batch jobs");
    return new GoogleGenAI({ vertexai: true, project, location: "global" });
  }

  const apiKey = process.env.GOOGLE_CLOUD_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
}

/** Default model for all Gemini API calls */
export const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

/** Standard Google Search grounding tool */
export const GEMINI_SEARCH_TOOLS = [{ googleSearch: {} }];
