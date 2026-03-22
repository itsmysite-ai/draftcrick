/**
 * Push Notification Service — L3
 *
 * Handles device token management, user preferences, quiet hours,
 * and sending push notifications via Expo Push API.
 */

import { getLogger } from "../lib/logger";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  pushDeviceTokens,
  notificationPreferences,
  notifications,
} from "@draftplay/db";
import type { Database } from "@draftplay/db";

const log = getLogger("notifications");

// ── Notification Types ──────────────────────────────────────

export const NOTIFICATION_TYPES = {
  DEADLINE_REMINDER: "deadline_reminder",
  URGENT_DEADLINE: "urgent_deadline",
  SCORE_UPDATE: "score_update",
  STATUS_ALERT: "status_alert",
  RANK_CHANGE: "rank_change",
  CONTEST_RESULT: "contest_result",
  PREDICTION_RESULT: "prediction_result",
  PREDICTION_POSTED: "prediction_posted",
  TOURNAMENT_AWARD: "tournament_award",
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// Maps notification types to preference fields
const TYPE_TO_PREF: Record<NotificationType, string> = {
  deadline_reminder: "deadlines",
  urgent_deadline: "deadlines",
  score_update: "scores",
  status_alert: "statusAlerts",
  rank_change: "rankChanges",
  contest_result: "statusAlerts",
  prediction_result: "statusAlerts",
  prediction_posted: "statusAlerts",
  tournament_award: "statusAlerts",
};

// ── Preference Defaults ─────────────────────────────────────

export interface UserNotificationPrefs {
  deadlines: boolean;
  scores: boolean;
  statusAlerts: boolean;
  rankChanges: boolean;
  promotions: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

const DEFAULT_PREFS: UserNotificationPrefs = {
  deadlines: true,
  scores: true,
  statusAlerts: true,
  rankChanges: true,
  promotions: false,
  quietHoursStart: null,
  quietHoursEnd: null,
};

// ── Device Token Management ─────────────────────────────────

export async function registerDeviceToken(
  db: Database,
  userId: string,
  token: string,
  platform: string,
  deviceId?: string
) {
  // If this token belongs to another user, reassign it
  await db
    .update(pushDeviceTokens)
    .set({ isActive: false })
    .where(
      and(
        eq(pushDeviceTokens.token, token),
        sql`${pushDeviceTokens.userId} != ${userId}`
      )
    );

  // Upsert: check if token already exists for this user
  const existing = await db.query.pushDeviceTokens.findFirst({
    where: and(
      eq(pushDeviceTokens.userId, userId),
      eq(pushDeviceTokens.token, token)
    ),
  });

  if (existing) {
    await db
      .update(pushDeviceTokens)
      .set({
        isActive: true,
        platform,
        deviceId: deviceId ?? existing.deviceId,
        updatedAt: new Date(),
      })
      .where(eq(pushDeviceTokens.id, existing.id));
    log.info({ userId, platform }, "Device token updated");
  } else {
    await db.insert(pushDeviceTokens).values({
      userId,
      token,
      platform,
      deviceId: deviceId ?? null,
    });
    log.info({ userId, platform }, "Device token registered");
  }
}

export async function removeDeviceToken(
  db: Database,
  userId: string,
  token: string
) {
  await db
    .update(pushDeviceTokens)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(pushDeviceTokens.userId, userId),
        eq(pushDeviceTokens.token, token)
      )
    );
  log.info({ userId }, "Device token deactivated");
}

export async function removeAllTokensForUser(db: Database, userId: string) {
  await db
    .update(pushDeviceTokens)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(pushDeviceTokens.userId, userId));
  log.info({ userId }, "All device tokens deactivated");
}

// ── User Preferences ────────────────────────────────────────

export async function getUserPreferences(
  db: Database,
  userId: string
): Promise<UserNotificationPrefs> {
  const row = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  });

  if (!row) {
    // Auto-create defaults (wallet pattern)
    await db
      .insert(notificationPreferences)
      .values({ userId })
      .onConflictDoNothing();
    return { ...DEFAULT_PREFS };
  }

  return {
    deadlines: row.deadlines,
    scores: row.scores,
    statusAlerts: row.statusAlerts,
    rankChanges: row.rankChanges,
    promotions: row.promotions,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
  };
}

export async function updateUserPreferences(
  db: Database,
  userId: string,
  prefs: Partial<UserNotificationPrefs>
) {
  const existing = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  });

  if (existing) {
    await db
      .update(notificationPreferences)
      .set({ ...prefs, updatedAt: new Date() })
      .where(eq(notificationPreferences.userId, userId));
  } else {
    await db.insert(notificationPreferences).values({
      userId,
      ...prefs,
    });
  }

  log.info({ userId }, "Notification preferences updated");
}

// ── Quiet Hours & Preference Check ──────────────────────────

export function shouldSendNotification(
  prefs: UserNotificationPrefs,
  type: NotificationType,
  now: Date = new Date()
): boolean {
  // Check if notification type is enabled
  const prefField = TYPE_TO_PREF[type];
  if (prefField && !(prefs as any)[prefField]) {
    return false;
  }

  // Check quiet hours
  if (prefs.quietHoursStart && prefs.quietHoursEnd) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = prefs.quietHoursStart.split(":").map(Number);
    const [endH, endM] = prefs.quietHoursEnd.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      // Same-day range (e.g., 09:00 - 17:00)
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return false;
      }
    } else {
      // Overnight range (e.g., 22:00 - 07:00)
      if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
        return false;
      }
    }
  }

  return true;
}

// ── Send Push Notification ──────────────────────────────────

export async function sendPushNotification(
  db: Database,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  // Check preferences
  const prefs = await getUserPreferences(db, userId);
  if (!shouldSendNotification(prefs, type)) {
    log.info({ userId, type }, "Notification suppressed by user preferences");
    return false;
  }

  // Get active tokens
  const tokens = await db.query.pushDeviceTokens.findMany({
    where: and(
      eq(pushDeviceTokens.userId, userId),
      eq(pushDeviceTokens.isActive, true)
    ),
  });

  // Save to inbox regardless of push delivery
  await db.insert(notifications).values({
    userId,
    type,
    title,
    body,
    data: data ?? null,
  });

  if (tokens.length === 0) {
    log.info({ userId, type }, "No active tokens — saved to inbox only");
    return true;
  }

  // Send via Expo Push API
  const messages = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data: { type, ...data },
    sound: "default" as const,
    priority: type === "urgent_deadline" ? ("high" as const) : ("default" as const),
  }));

  await sendExpoPush(db, messages);
  log.info({ userId, type, tokenCount: tokens.length }, "Push notification sent");
  return true;
}

// ── Batch Send ──────────────────────────────────────────────

export async function sendBatchNotifications(
  db: Database,
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ sent: number; suppressed: number }> {
  if (userIds.length === 0) return { sent: 0, suppressed: 0 };

  // Fetch all preferences in one query
  const allPrefs = await db.query.notificationPreferences.findMany({
    where: inArray(notificationPreferences.userId, userIds),
  });
  const prefsMap = new Map(allPrefs.map((p) => [p.userId, p]));

  // Filter users who should receive this notification
  const eligibleUserIds = userIds.filter((uid) => {
    const pref = prefsMap.get(uid);
    const userPrefs: UserNotificationPrefs = pref
      ? {
          deadlines: pref.deadlines,
          scores: pref.scores,
          statusAlerts: pref.statusAlerts,
          rankChanges: pref.rankChanges,
          promotions: pref.promotions,
          quietHoursStart: pref.quietHoursStart,
          quietHoursEnd: pref.quietHoursEnd,
        }
      : { ...DEFAULT_PREFS };
    return shouldSendNotification(userPrefs, type);
  });

  const suppressed = userIds.length - eligibleUserIds.length;

  if (eligibleUserIds.length === 0) {
    log.info({ type, suppressed }, "All users suppressed — no notifications sent");
    return { sent: 0, suppressed };
  }

  // Bulk insert inbox records
  await db.insert(notifications).values(
    eligibleUserIds.map((uid) => ({
      userId: uid,
      type,
      title,
      body,
      data: data ?? null,
    }))
  );

  // Fetch all active tokens for eligible users
  const allTokens = await db.query.pushDeviceTokens.findMany({
    where: and(
      inArray(pushDeviceTokens.userId, eligibleUserIds),
      eq(pushDeviceTokens.isActive, true)
    ),
  });

  if (allTokens.length > 0) {
    const messages = allTokens.map((t) => ({
      to: t.token,
      title,
      body,
      data: { type, ...data },
      sound: "default" as const,
      priority: type === "urgent_deadline" ? ("high" as const) : ("default" as const),
    }));

    // Chunk into batches of 100 (Expo Push API limit)
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      await sendExpoPush(db, chunk);
    }
  }

  log.info(
    { type, sent: eligibleUserIds.length, suppressed, tokens: allTokens.length },
    "Batch notifications sent"
  );
  return { sent: eligibleUserIds.length, suppressed };
}

// ── Expo Push API ───────────────────────────────────────────

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  priority?: "default" | "high";
}

async function sendExpoPush(
  db: Database,
  messages: ExpoPushMessage[],
  retries = 0
): Promise<void> {
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (res.status === 429 && retries < 3) {
      const delay = Math.pow(2, retries) * 1000;
      log.warn({ retries, delay }, "Expo Push rate limited — retrying");
      await new Promise((r) => setTimeout(r, delay));
      return sendExpoPush(db, messages, retries + 1);
    }

    if (!res.ok) {
      log.error({ status: res.status }, "Expo Push API error");
      return;
    }

    const result = await res.json();
    const tickets = result.data ?? [];

    // Handle DeviceNotRegistered errors — mark tokens inactive
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (
        ticket.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered"
      ) {
        const token = messages[i]?.to;
        if (token) {
          await db
            .update(pushDeviceTokens)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(pushDeviceTokens.token, token));
          log.info({ token: token.slice(0, 20) }, "Token marked inactive (DeviceNotRegistered)");
        }
      }
    }
  } catch (error) {
    log.error({ error: String(error) }, "Expo Push API request failed");
  }
}
