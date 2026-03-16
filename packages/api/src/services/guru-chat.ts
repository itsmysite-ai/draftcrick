/**
 * Cricket Guru AI Chat Service.
 *
 * Multi-turn conversational AI powered by Gemini with full cricket fantasy context.
 * Capabilities: captain picks, transfer advice, team analysis, player comparisons,
 * rule explanations, match previews, chip advice, fixture analysis.
 *
 * Conversations persisted in guru_conversations table.
 * Rate-limited to 10 messages per hour per user.
 */

import { getLogger } from "../lib/logger";
import { createGeminiClient, createGeminiClientGlobal } from "./gemini-client";
import { eq, desc } from "drizzle-orm";
import type { Database } from "@draftplay/db";

const log = getLogger("guru-chat");

const MODEL = "gemini-3.1-flash-lite-preview";
const MAX_MESSAGES_PER_HOUR = 10;
const MAX_CONVERSATION_MESSAGES = 40; // Trim older messages to stay in context window

// ── Types ────────────────────────────────────────────────────

export interface GuruMessage {
  role: "user" | "guru";
  content: string;
  timestamp: string;
}

export interface GuruContext {
  upcomingMatches?: Array<{
    id: string;
    teamA: string;
    teamB: string;
    date: string;
    format?: string;
    venue?: string;
    tournament?: string;
  }>;
  userTeams?: Array<{ leagueName: string; players: string[] }>;
  fdrData?: Array<{ matchId: string; teamA: string; teamAFdr: number; teamB: string; teamBFdr: number }>;
  projections?: Array<{ playerName: string; projected: number; captainRank: number }>;
}

export interface ConversationData {
  id: string;
  userId: string;
  messages: GuruMessage[];
  contextSnapshot: GuruContext | null;
  createdAt: string;
  updatedAt: string;
}

// ── System Prompt ─────────────────────────────────────────────

function buildSystemPrompt(context: GuruContext): string {
  let contextBlock = "";

  if (context.upcomingMatches?.length) {
    contextBlock += "\n\nCurrent match context (CRICKET):\n";
    for (const m of context.upcomingMatches.slice(0, 10)) {
      contextBlock += `- ${m.teamA} vs ${m.teamB}`;
      if (m.tournament) contextBlock += ` (${m.tournament})`;
      if (m.format) contextBlock += ` — ${m.format}`;
      if (m.venue) contextBlock += ` at ${m.venue}`;
      if (m.date) contextBlock += ` — ${m.date}`;
      contextBlock += "\n";
    }
    contextBlock += "When the user asks about these teams, ALWAYS search for them in the context of cricket and the tournament listed above. For example, if the tournament is Indian Premier League, search for 'RCB vs SRH IPL head to head cricket' not just 'Bengaluru vs Hyderabad'.\n";
  }

  if (context.fdrData?.length) {
    contextBlock += "\nFixture Difficulty Ratings (1=easy, 5=hard):\n";
    for (const f of context.fdrData.slice(0, 10)) {
      contextBlock += `- ${f.teamA} (FDR: ${f.teamAFdr}) vs ${f.teamB} (FDR: ${f.teamBFdr})\n`;
    }
  }

  if (context.projections?.length) {
    contextBlock += "\nTop Projected Players (next match):\n";
    for (const p of context.projections.slice(0, 15)) {
      contextBlock += `- ${p.playerName}: ${p.projected} pts (Captain rank #${p.captainRank})\n`;
    }
  }

  if (context.userTeams?.length) {
    contextBlock += "\nUser's Current Teams:\n";
    for (const t of context.userTeams) {
      contextBlock += `- ${t.leagueName}: ${t.players.join(", ")}\n`;
    }
  }

  return `You are Cricket Guru, a chat assistant inside DraftPlay (a fantasy cricket app). You talk like a knowledgeable cricket friend — casual, warm, and direct.

OUTPUT FORMAT — THIS IS MANDATORY, NO EXCEPTIONS:
You MUST write ONLY in plain text paragraphs. Absolutely NO markdown of any kind. That means:
No # headers. No ** bold **. No * italics *. No - bullet lists. No numbered lists. No tables. No --- dividers. No code blocks. No special formatting whatsoever.
Just plain sentences in short paragraphs separated by blank lines. This is a mobile chat app — your response appears in a small chat bubble. Write like a text message, not an article.

RESPONSE LENGTH — MANDATORY:
Keep every response to 3-5 short paragraphs MAX. Each paragraph should be 1-3 sentences. Get to the point fast. Users are on mobile — they don't want to read essays. If the topic is complex, give the highlights and offer to go deeper if they ask.

CONTENT RULES:
You are a CRICKET expert ONLY. This is a cricket app. "Bengaluru" means RCB, not Bengaluru FC. "Hyderabad" means SRH, not Hyderabad FC. Never discuss football, soccer, or any non-cricket sport.
Never add disclaimers, caveats, or "note" paragraphs at the end. Just end your response naturally.

WHAT YOU DO:
Help users understand cricket — match conditions, pitch reports, venue history, head-to-head records, player form and stats, playing style, team matchups, fantasy scoring rules, how DraftPlay features work, cricket terminology and strategy.

WHAT YOU DON'T DO:
Never make predictions, projections, or build fantasy teams. If asked to build a team, say "check out Build Team on the match page." If asked for captain picks, say "the Captain Picks section on the match page ranks players by projected impact." If asked to project points, say "tap Projected Points on the match page." You can discuss context and form but never say "pick this player" or "he'll score X points."

Never recommend betting. Be honest when uncertain. Respond in the user's language.
${contextBlock}`.trim();
}

// ── Strip Markdown (safety net) ──────────────────────────────

function stripMarkdown(text: string): string {
  return text
    // Remove headers (# ## ### etc.)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic markers
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Remove bullet points (- or * at start of line)
    .replace(/^[\s]*[-*]\s+/gm, "")
    // Remove numbered lists (1. 2. etc.)
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Remove markdown tables (lines starting with |)
    .replace(/^\|.*\|$/gm, "")
    // Remove table separator rows
    .replace(/^[\s]*[|:\-]+[\s]*$/gm, "")
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    // Remove markdown links [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Clean up multiple blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Rate Limiting ─────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 3600000 });
    return true;
  }

  if (entry.count >= MAX_MESSAGES_PER_HOUR) {
    return false;
  }

  entry.count++;
  return true;
}

// ── Core: Send Message ────────────────────────────────────────

export async function sendGuruMessage(
  db: Database,
  userId: string,
  conversationId: string | null,
  message: string,
  context: GuruContext,
  userCountry?: string
): Promise<{ conversationId: string; response: GuruMessage; messages: GuruMessage[] }> {
  // Rate limit check
  if (!checkRateLimit(userId)) {
    return {
      conversationId: conversationId ?? "",
      response: {
        role: "guru",
        content: "You've reached the message limit (10/hour). Take a break and come back soon! Your fantasy team will still be here.",
        timestamp: new Date().toISOString(),
      },
      messages: [],
    };
  }

  const { guruConversations } = await import("@draftplay/db");

  // Load or create conversation
  let conversation: ConversationData;
  let existingMessages: GuruMessage[] = [];

  if (conversationId) {
    const row = await db
      .select()
      .from(guruConversations)
      .where(eq(guruConversations.id, conversationId))
      .limit(1);

    if (row.length > 0) {
      existingMessages = (row[0]!.messages as GuruMessage[]) ?? [];
    }
  }

  // Add user message
  const userMsg: GuruMessage = {
    role: "user",
    content: message,
    timestamp: new Date().toISOString(),
  };
  existingMessages.push(userMsg);

  // Build Gemini conversation
  const systemPrompt = buildSystemPrompt(context);
  const ai = userCountry
    ? await createGeminiClient(userCountry)
    : await createGeminiClientGlobal();

  try {
    log.info({ userId, conversationId, messageLength: message.length }, "Sending to Guru");

    // Build conversation history for Gemini
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Trim to last N messages to stay within context
    const recentMessages = existingMessages.slice(-MAX_CONVERSATION_MESSAGES);

    for (const msg of recentMessages) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      systemInstruction: systemPrompt,
      contents,
      config: {
        temperature: 0.7,
        tools: [{ googleSearch: {} }],
      },
    });

    const rawText =
      typeof response.text === "function" ? response.text() : response.text;
    const responseText = stripMarkdown(rawText ?? "");
    const guruResponse: GuruMessage = {
      role: "guru",
      content: responseText || "I'm having trouble thinking right now. Try asking again!",
      timestamp: new Date().toISOString(),
    };

    existingMessages.push(guruResponse);

    // Persist conversation
    if (conversationId) {
      await db
        .update(guruConversations)
        .set({
          messages: existingMessages,
          contextSnapshot: context,
          updatedAt: new Date(),
        })
        .where(eq(guruConversations.id, conversationId));
    } else {
      const [newConvo] = await db
        .insert(guruConversations)
        .values({
          userId,
          messages: existingMessages,
          contextSnapshot: context,
        })
        .returning({ id: guruConversations.id });

      conversationId = newConvo!.id;
    }

    log.info({ userId, conversationId }, "Guru response generated");

    return {
      conversationId: conversationId!,
      response: guruResponse,
      messages: existingMessages,
    };
  } catch (error) {
    log.error({ userId, error: String(error) }, "Guru chat failed");

    const errorResponse: GuruMessage = {
      role: "guru",
      content: "Sorry, I'm having a moment. Could you try that question again?",
      timestamp: new Date().toISOString(),
    };

    return {
      conversationId: conversationId ?? "",
      response: errorResponse,
      messages: [...existingMessages, errorResponse],
    };
  }
}

// ── Get Conversations ─────────────────────────────────────────

export async function getUserConversations(
  db: Database,
  userId: string,
  limit: number = 20
): Promise<ConversationData[]> {
  const { guruConversations } = await import("@draftplay/db");

  const rows = await db
    .select()
    .from(guruConversations)
    .where(eq(guruConversations.userId, userId))
    .orderBy(desc(guruConversations.updatedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId ?? "",
    messages: (r.messages as GuruMessage[]) ?? [],
    contextSnapshot: (r.contextSnapshot as GuruContext) ?? null,
    createdAt: r.createdAt?.toISOString() ?? "",
    updatedAt: r.updatedAt?.toISOString() ?? "",
  }));
}

// ── Get Single Conversation ───────────────────────────────────

export async function getConversation(
  db: Database,
  conversationId: string
): Promise<ConversationData | null> {
  const { guruConversations } = await import("@draftplay/db");

  const rows = await db
    .select()
    .from(guruConversations)
    .where(eq(guruConversations.id, conversationId))
    .limit(1);

  if (rows.length === 0) return null;

  const r = rows[0]!;
  return {
    id: r.id,
    userId: r.userId ?? "",
    messages: (r.messages as GuruMessage[]) ?? [],
    contextSnapshot: (r.contextSnapshot as GuruContext) ?? null,
    createdAt: r.createdAt?.toISOString() ?? "",
    updatedAt: r.updatedAt?.toISOString() ?? "",
  };
}
