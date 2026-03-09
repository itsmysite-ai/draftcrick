/**
 * API-Level Tests — Notification Endpoints (L3)
 *
 * Tests token registration, inbox, preferences, and auth requirements.
 * Requires Firebase Auth Emulator + API server running.
 *
 * Run: npx tsx tests/e2e/api/notification.api.test.ts
 */

import {
  createTestUser,
  clearEmulatorAccounts,
  trpcAuthQuery,
  trpcAuthMutate,
  unwrap,
  assert,
  expectTRPCError,
  test,
  describe,
  runTests,
} from "../helpers/api-auth";
import {
  seedTestNotifications,
  clearTestNotifications,
  SAMPLE_NOTIFICATIONS,
} from "../helpers/seed-notifications";

const API_BASE = process.env.API_URL ?? "http://localhost:3001";

// ── Unauthenticated helpers (for auth-requirement tests) ──────

async function trpcQueryNoAuth(path: string, input?: Record<string, unknown>) {
  const inputParam = input
    ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : "";
  const url = `${API_BASE}/trpc/${path}${inputParam}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function trpcMutateNoAuth(path: string, input: Record<string, unknown>) {
  const url = `${API_BASE}/trpc/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

// ═══════════════════════════════════════════════════════════════
// AUTH REQUIREMENT TESTS (no token → UNAUTHORIZED)
// ═══════════════════════════════════════════════════════════════

describe("Notification API", () => {
  const EMAIL = "notif-test@draftplay.test";
  const PASSWORD = "TestPass123!";
  let token: string;
  let dbUserId: string;

  // ── Auth Requirement Tests ────────────────────────────────────

  test("notification.registerToken requires auth", async () => {
    const res = await trpcMutateNoAuth("notification.registerToken", {
      token: "ExponentPushToken[test]",
      platform: "ios",
    });
    expectTRPCError(res, "UNAUTHORIZED");
    console.log("    registerToken correctly requires auth");
  });

  test("notification.getInbox requires auth", async () => {
    const res = await trpcQueryNoAuth("notification.getInbox", { limit: 10 });
    expectTRPCError(res, "UNAUTHORIZED");
    console.log("    getInbox correctly requires auth");
  });

  test("notification.getUnreadCount requires auth", async () => {
    const res = await trpcQueryNoAuth("notification.getUnreadCount");
    expectTRPCError(res, "UNAUTHORIZED");
    console.log("    getUnreadCount correctly requires auth");
  });

  test("notification.getPreferences requires auth", async () => {
    const res = await trpcQueryNoAuth("notification.getPreferences");
    expectTRPCError(res, "UNAUTHORIZED");
    console.log("    getPreferences correctly requires auth");
  });

  test("notification.updatePreferences requires auth", async () => {
    const res = await trpcMutateNoAuth("notification.updatePreferences", {
      deadlines: false,
    });
    expectTRPCError(res, "UNAUTHORIZED");
    console.log("    updatePreferences correctly requires auth");
  });

  test("notification.markRead requires auth", async () => {
    const res = await trpcMutateNoAuth("notification.markRead", {
      id: "00000000-0000-0000-0000-000000000000",
    });
    expectTRPCError(res, "UNAUTHORIZED");
    console.log("    markRead correctly requires auth");
  });

  test("notification.markAllRead requires auth", async () => {
    const res = await trpcMutateNoAuth("notification.markAllRead", {});
    expectTRPCError(res, "UNAUTHORIZED");
    console.log("    markAllRead correctly requires auth");
  });

  // ── Input Validation Tests ────────────────────────────────────

  test("notification.registerToken rejects empty token", async () => {
    const res = await trpcMutateNoAuth("notification.registerToken", {
      token: "",
      platform: "ios",
    });
    assert(res.status !== 200, "Expected validation error for empty token");
    console.log(`    Validation: correctly rejected empty token with ${res.status}`);
  });

  test("notification.registerToken rejects invalid platform", async () => {
    const res = await trpcMutateNoAuth("notification.registerToken", {
      token: "ExponentPushToken[test]",
      platform: "blackberry",
    });
    assert(res.status !== 200, "Expected validation error for invalid platform");
    console.log(`    Validation: correctly rejected invalid platform with ${res.status}`);
  });

  test("notification.updatePreferences rejects invalid quiet hours format", async () => {
    const res = await trpcMutateNoAuth("notification.updatePreferences", {
      quietHoursStart: "10pm",
    });
    assert(res.status !== 200, "Expected validation error for invalid quiet hours");
    console.log(`    Validation: rejected invalid format with ${res.status}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // AUTHENTICATED TESTS (with Firebase Emulator token)
  // ═══════════════════════════════════════════════════════════════

  test("setup: create authenticated test user", async () => {
    await clearEmulatorAccounts();
    const user = await createTestUser(EMAIL, PASSWORD);
    token = user.idToken;
    dbUserId = user.dbUserId!;
    assert(!!token, "Expected valid auth token");
    assert(!!dbUserId, "Expected valid DB user ID");
    console.log(`    authenticated as ${EMAIL} (dbUserId: ${dbUserId})`);
  });

  test("notification.getPreferences returns preferences", async () => {
    // Reset to defaults first (may have stale prefs from a previous run)
    await trpcAuthMutate("notification.updatePreferences", {
      deadlines: true, scores: true, statusAlerts: true,
      rankChanges: true, promotions: false,
      quietHoursStart: null, quietHoursEnd: null,
    }, token);

    const res = await trpcAuthQuery("notification.getPreferences", undefined, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const prefs = unwrap(res);
    assert(prefs.deadlines === true, "Expected deadlines true");
    assert(prefs.scores === true, "Expected scores true");
    assert(prefs.statusAlerts === true, "Expected statusAlerts true");
    assert(prefs.rankChanges === true, "Expected rankChanges true");
    assert(prefs.promotions === false, "Expected promotions false");
    assert(prefs.quietHoursStart === null, "Expected quietHoursStart null");
    assert(prefs.quietHoursEnd === null, "Expected quietHoursEnd null");
    console.log("    preferences reset and verified");
  });

  test("notification.updatePreferences toggles deadlines off", async () => {
    const res = await trpcAuthMutate("notification.updatePreferences", { deadlines: false }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);

    // Verify the update persisted
    const check = await trpcAuthQuery("notification.getPreferences", undefined, token);
    const prefs = unwrap(check);
    assert(prefs.deadlines === false, "Expected deadlines to be false after update");
    console.log("    deadlines toggled off and persisted");
  });

  test("notification.updatePreferences sets quiet hours", async () => {
    const res = await trpcAuthMutate(
      "notification.updatePreferences",
      { quietHoursStart: "22:00", quietHoursEnd: "07:00" },
      token
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);

    const check = await trpcAuthQuery("notification.getPreferences", undefined, token);
    const prefs = unwrap(check);
    assert(prefs.quietHoursStart === "22:00", `Expected quietHoursStart 22:00, got ${prefs.quietHoursStart}`);
    assert(prefs.quietHoursEnd === "07:00", `Expected quietHoursEnd 07:00, got ${prefs.quietHoursEnd}`);
    console.log("    quiet hours set to 22:00–07:00");
  });

  test("notification.updatePreferences clears quiet hours", async () => {
    const res = await trpcAuthMutate(
      "notification.updatePreferences",
      { quietHoursStart: null, quietHoursEnd: null },
      token
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);

    const check = await trpcAuthQuery("notification.getPreferences", undefined, token);
    const prefs = unwrap(check);
    assert(prefs.quietHoursStart === null, "Expected quietHoursStart null after clear");
    assert(prefs.quietHoursEnd === null, "Expected quietHoursEnd null after clear");
    console.log("    quiet hours cleared");
  });

  test("notification.getInbox returns empty for new user", async () => {
    const res = await trpcAuthQuery("notification.getInbox", { limit: 10 }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(Array.isArray(data?.items), "Expected items array");
    assert(data.items.length === 0, `Expected 0 items, got ${data.items.length}`);
    console.log("    inbox empty for new user");
  });

  test("notification.getUnreadCount returns 0 for new user", async () => {
    const res = await trpcAuthQuery("notification.getUnreadCount", undefined, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.count === 0, `Expected count 0, got ${data?.count}`);
    console.log("    unread count is 0");
  });

  test("notification.registerToken registers a push token", async () => {
    const res = await trpcAuthMutate(
      "notification.registerToken",
      { token: "ExponentPushToken[test-abc-123]", platform: "ios" },
      token
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    console.log("    push token registered successfully");
  });

  test("notification.removeToken deactivates a push token", async () => {
    const res = await trpcAuthMutate(
      "notification.removeToken",
      { token: "ExponentPushToken[test-abc-123]" },
      token
    );
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    console.log("    push token deactivated successfully");
  });

  test("notification.markAllRead succeeds with no notifications", async () => {
    const res = await trpcAuthMutate("notification.markAllRead", {}, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.count === 0, `Expected 0 marked, got ${data?.count}`);
    console.log("    markAllRead returned count: 0");
  });

  // ═══════════════════════════════════════════════════════════════
  // SEEDED NOTIFICATION TESTS (populate inbox, verify retrieval)
  // ═══════════════════════════════════════════════════════════════

  test("seed: insert sample notifications into inbox", async () => {
    const ids = await seedTestNotifications(dbUserId);
    assert(ids.length === SAMPLE_NOTIFICATIONS.length, `Expected ${SAMPLE_NOTIFICATIONS.length} inserted, got ${ids.length}`);
    console.log(`    seeded ${ids.length} notifications`);
  });

  test("notification.getInbox returns seeded notifications", async () => {
    const res = await trpcAuthQuery("notification.getInbox", { limit: 20 }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(Array.isArray(data?.items), "Expected items array");
    assert(data.items.length === SAMPLE_NOTIFICATIONS.length, `Expected ${SAMPLE_NOTIFICATIONS.length} items, got ${data.items.length}`);

    // Verify ordering (newest first)
    for (let i = 1; i < data.items.length; i++) {
      const prev = new Date(data.items[i - 1].createdAt).getTime();
      const curr = new Date(data.items[i].createdAt).getTime();
      assert(prev >= curr, `Items not sorted by createdAt desc at index ${i}`);
    }
    console.log(`    inbox has ${data.items.length} notifications, correctly sorted`);
  });

  test("notification.getUnreadCount reflects seeded data", async () => {
    const res = await trpcAuthQuery("notification.getUnreadCount", undefined, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    const expectedUnread = SAMPLE_NOTIFICATIONS.filter((n) => !n.isRead).length;
    assert(data?.count === expectedUnread, `Expected ${expectedUnread} unread, got ${data?.count}`);
    console.log(`    unread count: ${data.count} (expected ${expectedUnread})`);
  });

  test("notification.markRead marks one notification as read", async () => {
    // Get first unread notification
    const inbox = await trpcAuthQuery("notification.getInbox", { limit: 20 }, token);
    const items = unwrap(inbox)?.items ?? [];
    const unreadItem = items.find((i: any) => !i.isRead);
    assert(!!unreadItem, "Expected at least one unread notification");

    const res = await trpcAuthMutate("notification.markRead", { id: unreadItem.id }, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);

    // Verify unread count decreased
    const countRes = await trpcAuthQuery("notification.getUnreadCount", undefined, token);
    const newCount = unwrap(countRes)?.count;
    const expectedUnread = SAMPLE_NOTIFICATIONS.filter((n) => !n.isRead).length - 1;
    assert(newCount === expectedUnread, `Expected ${expectedUnread} unread after markRead, got ${newCount}`);
    console.log(`    marked one read — unread count: ${newCount}`);
  });

  test("notification.markAllRead marks remaining as read", async () => {
    const res = await trpcAuthMutate("notification.markAllRead", {}, token);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = unwrap(res);
    assert(data?.count >= 1, `Expected at least 1 marked, got ${data?.count}`);

    // Verify all read now
    const countRes = await trpcAuthQuery("notification.getUnreadCount", undefined, token);
    const finalCount = unwrap(countRes)?.count;
    assert(finalCount === 0, `Expected 0 unread after markAllRead, got ${finalCount}`);
    console.log(`    marked ${data.count} as read — unread count: 0`);
  });

  test("cleanup: remove seeded notifications", async () => {
    await clearTestNotifications(dbUserId);
    const inbox = await trpcAuthQuery("notification.getInbox", { limit: 20 }, token);
    const items = unwrap(inbox)?.items ?? [];
    assert(items.length === 0, `Expected 0 after cleanup, got ${items.length}`);
    console.log("    cleaned up seeded notifications");
  });
});

runTests("Notification API Tests (L3)");
