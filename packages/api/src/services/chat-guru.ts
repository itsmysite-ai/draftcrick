/**
 * AI Guru — Cricket personality for the Buzz chat.
 *
 * Generates contextual messages: reactions, hot takes, celebrations, banter.
 * Runs periodically during live matches or when triggered by user activity.
 */

import { getLogger } from "../lib/logger";
import { createGeminiClient, GEMINI_MODEL } from "./gemini-client";
import { getDb } from "@draftplay/db";
import { chatMessages } from "@draftplay/db";
import { desc, and, isNull, eq } from "drizzle-orm";

const log = getLogger("chat-guru");

const GURU_SYSTEM_PROMPT = `You are "Guru", a witty cricket-obsessed AI personality in the DraftPlay fantasy cricket chat.

Your personality:
- Fun, energetic, cricket-mad
- Use cricket terminology naturally
- Use emojis generously (🏏 🔥 🚀 💀 😂 👏 ⚡ 🎯)
- Keep messages SHORT (max 100 chars) — you're in a chat, not writing an essay
- Playful trash talk is OK, toxicity is NOT
- Reference players, matches, stats when relevant
- Drop hot takes, celebrate big moments, react to user messages
- Occasionally ask engaging questions to spark conversation

You MUST respond with a valid JSON array of 1-2 messages. Each message has:
- "message": the chat text (max 100 chars)
- "type": one of "ai_reaction", "ai_hottake", "ai_celebration"

Example response:
[{"message": "Kohli in the form of his life! 🔥 Captain him or regret it", "type": "ai_hottake"}]`;

/**
 * Generate AI chat messages based on recent conversation context.
 * Inserts them directly into the chat_messages table.
 */
export async function generateGuruMessages(matchId: string | null): Promise<void> {
  try {
    const db = getDb();

    // Get last 15 messages for context
    const conditions = matchId
      ? [eq(chatMessages.matchId, matchId)]
      : [isNull(chatMessages.matchId)];

    const recentMessages = await db
      .select({
        message: chatMessages.message,
        type: chatMessages.type,
        displayName: chatMessages.displayName,
      })
      .from(chatMessages)
      .where(and(...conditions))
      .orderBy(desc(chatMessages.createdAt))
      .limit(15);

    const chatContext = recentMessages
      .reverse()
      .map((m) => {
        const name = m.type.startsWith("ai_") ? "guru" : (m.displayName ?? "anon");
        return `${name}: ${m.message}`;
      })
      .join("\n");

    const prompt = chatContext
      ? `Here's the recent chat:\n${chatContext}\n\nGenerate 1-2 contextual responses. React to what people are saying, or drop a hot take.`
      : `The chat is empty. Generate 1 welcoming/engaging message to kick things off. Ask a fun cricket question or drop a hot take about current cricket.`;

    const genAI = await createGeminiClient(process.env.GEMINI_DEFAULT_REGION || "IN");
    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: GURU_SYSTEM_PROMPT,
        temperature: 0.9,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    });

    const text = response?.text?.trim();
    if (!text) {
      log.warn("Guru: empty response from Gemini");
      return;
    }

    let guruMessages: { message: string; type: string }[];
    try {
      guruMessages = JSON.parse(text);
      if (!Array.isArray(guruMessages)) guruMessages = [guruMessages];
    } catch {
      log.warn({ text }, "Guru: failed to parse Gemini response");
      return;
    }

    // Insert guru messages
    for (const msg of guruMessages.slice(0, 2)) {
      if (!msg.message || msg.message.length > 280) continue;
      const type = ["ai_reaction", "ai_hottake", "ai_celebration"].includes(msg.type)
        ? msg.type
        : "ai_reaction";

      await db.insert(chatMessages).values({
        userId: null,
        matchId,
        message: msg.message,
        type,
        displayName: "guru",
      });
    }

    log.debug({ matchId, count: guruMessages.length }, "Guru messages generated");
  } catch (error) {
    log.warn({ error: String(error), matchId }, "Guru generation failed");
  }
}
