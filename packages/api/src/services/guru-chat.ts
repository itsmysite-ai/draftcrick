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
  upcomingMatches?: Array<{ id: string; teamA: string; teamB: string; date: string }>;
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
    contextBlock += "\n\nUpcoming Matches:\n";
    for (const m of context.upcomingMatches.slice(0, 10)) {
      contextBlock += `- ${m.teamA} vs ${m.teamB} (${m.date})\n`;
    }
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

  return `
You are Cricket Guru, the AI assistant for DraftPlay — a fantasy cricket platform.

Your personality:
- Expert cricket analyst with deep knowledge of player stats, match conditions, and fantasy strategy
- Friendly but direct — give actionable advice, not vague suggestions
- Use cricket terminology naturally (yorker, powerplay, death overs, etc.)
- When recommending players, always explain WHY with stats or match context
- Keep responses concise (2-4 paragraphs max unless asked for detailed analysis)

Your capabilities:
1. Captain and vice-captain recommendations
2. Transfer/trade suggestions
3. Team analysis and rating
4. Player comparisons
5. Match previews and predictions
6. Chip/power-up timing advice (when to use Wildcard, Triple Captain, etc.)
7. Fixture difficulty analysis
8. Rule explanations
9. Injury impact analysis

Rules:
- Never recommend specific betting or gambling actions
- Be honest when you're uncertain — say "based on available data" not "definitely"
- If asked about a player you don't have data for, say so
- Respond in the same language the user writes in
${contextBlock}
`.trim();
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

    const responseText =
      typeof response.text === "function" ? response.text() : response.text;
    const guruResponse: GuruMessage = {
      role: "guru",
      content: responseText ?? "I'm having trouble thinking right now. Try asking again!",
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
