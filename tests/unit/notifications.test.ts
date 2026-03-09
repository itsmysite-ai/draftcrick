/**
 * Unit Tests — Notification Preferences & Quiet Hours
 *
 * Tests the pure shouldSendNotification() function.
 * No network, no DB — just preference logic.
 *
 * Run: npx tsx tests/unit/notifications.test.ts
 */

// ── Test runner ────────────────────────────────────────────────

interface TestCase { name: string; fn: () => void }
const tests: TestCase[] = [];
function test(name: string, fn: () => void) { tests.push({ name, fn }); }
function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }
function assertEq(a: unknown, b: unknown, msg: string) {
  if (a !== b) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ── Replicate shouldSendNotification logic ──────────────────

interface UserNotificationPrefs {
  deadlines: boolean;
  scores: boolean;
  statusAlerts: boolean;
  rankChanges: boolean;
  promotions: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

type NotificationType =
  | "deadline_reminder"
  | "urgent_deadline"
  | "score_update"
  | "status_alert"
  | "rank_change";

const TYPE_TO_PREF: Record<NotificationType, string> = {
  deadline_reminder: "deadlines",
  urgent_deadline: "deadlines",
  score_update: "scores",
  status_alert: "statusAlerts",
  rank_change: "rankChanges",
};

function shouldSendNotification(
  prefs: UserNotificationPrefs,
  type: NotificationType,
  now: Date = new Date()
): boolean {
  const prefField = TYPE_TO_PREF[type];
  if (prefField && !(prefs as any)[prefField]) {
    return false;
  }

  if (prefs.quietHoursStart && prefs.quietHoursEnd) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = prefs.quietHoursStart.split(":").map(Number);
    const [endH, endM] = prefs.quietHoursEnd.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return false;
      }
    } else {
      if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
        return false;
      }
    }
  }

  return true;
}

// ── Default prefs helper ────────────────────────────────────

const ALL_ON: UserNotificationPrefs = {
  deadlines: true,
  scores: true,
  statusAlerts: true,
  rankChanges: true,
  promotions: false,
  quietHoursStart: null,
  quietHoursEnd: null,
};

// ═══════════════════════════════════════════════════════════════
// PREFERENCE TESTS
// ═══════════════════════════════════════════════════════════════

test("Enabled type outside quiet hours → true", () => {
  const result = shouldSendNotification(ALL_ON, "deadline_reminder", new Date("2026-03-03T14:00:00"));
  assertEq(result, true, "should send");
});

test("Disabled deadline type → false", () => {
  const prefs = { ...ALL_ON, deadlines: false };
  assertEq(shouldSendNotification(prefs, "deadline_reminder"), false, "deadline_reminder");
  assertEq(shouldSendNotification(prefs, "urgent_deadline"), false, "urgent_deadline");
});

test("Disabled scores type → false", () => {
  const prefs = { ...ALL_ON, scores: false };
  assertEq(shouldSendNotification(prefs, "score_update"), false, "score_update");
});

test("Disabled statusAlerts → false", () => {
  const prefs = { ...ALL_ON, statusAlerts: false };
  assertEq(shouldSendNotification(prefs, "status_alert"), false, "status_alert");
});

test("Disabled rankChanges → false", () => {
  const prefs = { ...ALL_ON, rankChanges: false };
  assertEq(shouldSendNotification(prefs, "rank_change"), false, "rank_change");
});

// ═══════════════════════════════════════════════════════════════
// QUIET HOURS TESTS
// ═══════════════════════════════════════════════════════════════

test("During overnight quiet hours (23:00) → false", () => {
  const prefs = { ...ALL_ON, quietHoursStart: "22:00", quietHoursEnd: "07:00" };
  const at11pm = new Date("2026-03-03T23:00:00");
  assertEq(shouldSendNotification(prefs, "score_update", at11pm), false, "11pm in quiet hours");
});

test("During overnight quiet hours (02:00) → false", () => {
  const prefs = { ...ALL_ON, quietHoursStart: "22:00", quietHoursEnd: "07:00" };
  const at2am = new Date("2026-03-04T02:00:00");
  assertEq(shouldSendNotification(prefs, "score_update", at2am), false, "2am in quiet hours");
});

test("Outside overnight quiet hours (14:00) → true", () => {
  const prefs = { ...ALL_ON, quietHoursStart: "22:00", quietHoursEnd: "07:00" };
  const at2pm = new Date("2026-03-03T14:00:00");
  assertEq(shouldSendNotification(prefs, "score_update", at2pm), true, "2pm outside quiet hours");
});

test("During same-day quiet hours (10:00, range 09:00-17:00) → false", () => {
  const prefs = { ...ALL_ON, quietHoursStart: "09:00", quietHoursEnd: "17:00" };
  const at10am = new Date("2026-03-03T10:00:00");
  assertEq(shouldSendNotification(prefs, "deadline_reminder", at10am), false, "10am in quiet hours");
});

test("Outside same-day quiet hours (20:00, range 09:00-17:00) → true", () => {
  const prefs = { ...ALL_ON, quietHoursStart: "09:00", quietHoursEnd: "17:00" };
  const at8pm = new Date("2026-03-03T20:00:00");
  assertEq(shouldSendNotification(prefs, "deadline_reminder", at8pm), true, "8pm outside quiet hours");
});

test("No quiet hours set → always true for enabled type", () => {
  assertEq(shouldSendNotification(ALL_ON, "score_update", new Date("2026-03-03T03:00:00")), true, "3am no quiet hours");
});

test("Quiet hours edge: exactly at start → false", () => {
  const prefs = { ...ALL_ON, quietHoursStart: "22:00", quietHoursEnd: "07:00" };
  const at10pm = new Date("2026-03-03T22:00:00");
  assertEq(shouldSendNotification(prefs, "score_update", at10pm), false, "exactly 10pm");
});

test("Quiet hours edge: exactly at end → true", () => {
  const prefs = { ...ALL_ON, quietHoursStart: "22:00", quietHoursEnd: "07:00" };
  const at7am = new Date("2026-03-04T07:00:00");
  assertEq(shouldSendNotification(prefs, "score_update", at7am), true, "exactly 7am");
});

// ═══════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log("\n=== Unit Tests: Notifications (Preferences & Quiet Hours) ===\n");
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    process.stdout.write(`  [RUN] ${t.name} ... `);
    try {
      t.fn();
      console.log("PASS");
      passed++;
    } catch (err: any) {
      console.log(`FAIL: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed, ${tests.length} total\n`);
  if (failed > 0) process.exit(1);
}

main();
