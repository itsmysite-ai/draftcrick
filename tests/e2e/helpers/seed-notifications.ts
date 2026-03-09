/**
 * Seed test notifications directly into the database.
 *
 * Used by both API tests and E2E screenshot tests to populate
 * the notification inbox with realistic sample data.
 *
 * Uses raw postgres to avoid @draftplay/db resolution issues from test dir.
 */

import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:Dreamproject@34.57.117.132:5432/draftplay";

let _sql: ReturnType<typeof postgres> | null = null;

function getSql() {
  if (!_sql) _sql = postgres(DATABASE_URL);
  return _sql;
}

export interface SeedNotification {
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead?: boolean;
  createdAt?: Date;
}

export const SAMPLE_NOTIFICATIONS: SeedNotification[] = [
  {
    type: "urgent_deadline",
    title: "Team lock in 30 minutes!",
    body: "IND vs AUS starts at 7:30 PM — finalize your team now",
    data: { matchId: "match-001" },
    isRead: false,
    createdAt: new Date(Date.now() - 25 * 60 * 1000), // 25 min ago
  },
  {
    type: "score_update",
    title: "Your team scored 142 pts!",
    body: "Virat Kohli 87(54) — you're now #3 in the contest",
    data: { contestId: "contest-001" },
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  },
  {
    type: "status_alert",
    title: "Player status: Jasprit Bumrah",
    body: "Doubtful for tomorrow's match — consider a swap",
    data: { playerId: "player-001" },
    isRead: false,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
  },
  {
    type: "rank_change",
    title: "You moved up to #12!",
    body: "IPL Fantasy League — you gained 4 positions this week",
    data: { leagueId: "league-001" },
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
  },
  {
    type: "deadline_reminder",
    title: "Match tomorrow: CSK vs MI",
    body: "Set your lineup by 3:30 PM — don't miss the deadline",
    data: { matchId: "match-002" },
    isRead: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  },
];

/**
 * Insert sample notifications for a user.
 * Returns the IDs of inserted notifications.
 */
export async function seedTestNotifications(userId: string): Promise<string[]> {
  const sql = getSql();

  const results: string[] = [];
  for (const n of SAMPLE_NOTIFICATIONS) {
    const rows = await sql`
      INSERT INTO notifications (user_id, type, title, body, data, is_read, created_at)
      VALUES (
        ${userId},
        ${n.type},
        ${n.title},
        ${n.body},
        ${JSON.stringify(n.data ?? null)}::jsonb,
        ${n.isRead ?? false},
        ${n.createdAt ?? new Date()}
      )
      RETURNING id
    `;
    results.push(rows[0].id);
  }

  return results;
}

/**
 * Clean up test notifications for a user.
 */
export async function clearTestNotifications(userId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM notifications WHERE user_id = ${userId}`;
}
