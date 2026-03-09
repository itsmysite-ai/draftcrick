/**
 * Authenticated API test helpers.
 *
 * Uses Firebase Auth Emulator REST API to create users and get ID tokens,
 * then calls tRPC endpoints with those tokens. No browser needed.
 *
 * Requires:
 *   - Firebase Auth Emulator running on localhost:9099
 *   - API server running on localhost:3001 with FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
 *
 * Start API server for tests:
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 pnpm --filter @draftplay/api dev
 *
 * Or run via the test-with-emulator.js script which sets this up automatically.
 */

const EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "localhost:9099";
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-draftplay";
const API_BASE = process.env.API_URL ?? "http://localhost:3001";

// ── Firebase Emulator Helpers ──────────────────────────────────

/**
 * Create a user in the Firebase Auth Emulator and return the ID token.
 */
export async function createEmulatorUser(
  email: string,
  password: string
): Promise<{ idToken: string; localId: string; email: string }> {
  const res = await fetch(
    `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create emulator user: ${res.status} ${text}`);
  }
  const data = await res.json();
  return { idToken: data.idToken, localId: data.localId, email };
}

/**
 * Sign in an existing emulator user and return a fresh ID token.
 */
export async function signInEmulatorUser(
  email: string,
  password: string
): Promise<{ idToken: string; localId: string }> {
  const res = await fetch(
    `http://${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to sign in emulator user: ${res.status} ${text}`);
  }
  const data = await res.json();
  return { idToken: data.idToken, localId: data.localId };
}

/**
 * Create a user in the Firebase Auth Emulator AND sync them to the PostgreSQL database.
 * This ensures the user has a proper internal UUID for DB operations.
 */
let _userCounter = 0;
export async function createTestUser(
  email?: string,
  password?: string
): Promise<{ idToken: string; localId: string; email: string; dbUserId?: string }> {
  _userCounter++;
  const userEmail = email ?? `testuser-${Date.now()}-${_userCounter}@test.com`;
  const userPass = password ?? "TestPass123!";
  const user = await createEmulatorUser(userEmail, userPass);

  // Sync to DB via auth.syncUser so internal UUID is created
  // Add random suffix to prevent collisions when DB is not cleared between test runs
  const username = `tu${_userCounter}_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
  const syncRes = await trpcAuthMutate(
    "auth.syncUser",
    { username, displayName: `Test User ${_userCounter}` },
    user.idToken
  );

  let dbUserId: string | undefined;
  if (syncRes.status === 200) {
    const data = unwrap(syncRes);
    dbUserId = data?.userId;
  }

  // Get a fresh token — after syncUser, API will resolve to DB UUID
  const signIn = await signInEmulatorUser(userEmail, userPass);

  return { idToken: signIn.idToken, localId: user.localId, email: userEmail, dbUserId };
}

/**
 * Delete all accounts from the Firebase Auth Emulator.
 */
export async function clearEmulatorAccounts(): Promise<void> {
  await fetch(
    `http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    { method: "DELETE" }
  );
}

// ── tRPC Authenticated Call Helpers ────────────────────────────

/**
 * Call a tRPC query with an auth token.
 */
export async function trpcAuthQuery(
  path: string,
  input?: Record<string, unknown>,
  token?: string
): Promise<{ status: number; data: any }> {
  // superjson transformer expects input wrapped in {json: ...}
  const inputParam = input
    ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
    : "";
  const url = `${API_BASE}/trpc/${path}${inputParam}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  return { status: res.status, data: await res.json().catch(() => null) };
}

/**
 * Call a tRPC mutation with an auth token.
 */
export async function trpcAuthMutate(
  path: string,
  input?: Record<string, unknown>,
  token?: string
): Promise<{ status: number; data: any }> {
  const url = `${API_BASE}/trpc/${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ json: input ?? {} }),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

/**
 * Unwrap tRPC response data — handles both {result:{data:{json:...}}} and {result:{data:...}}
 */
export function unwrap(res: { status: number; data: any }): any {
  const d = res.data?.result?.data;
  return d?.json !== undefined ? d.json : d;
}

/**
 * Assert helper — throws on failure.
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

/**
 * Expect a tRPC error response with a specific code.
 */
export function expectTRPCError(
  res: { status: number; data: any },
  expectedCode: string
): void {
  const error = res.data?.error;
  const errorData = error?.json ?? error;
  const code = errorData?.data?.code ?? errorData?.code;
  // tRPC uses HTTP status codes: UNAUTHORIZED=401, FORBIDDEN=403, NOT_FOUND=404, BAD_REQUEST=400, CONFLICT=409
  const codeMap: Record<string, number> = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    BAD_REQUEST: 400,
    CONFLICT: 409,
    PRECONDITION_FAILED: 412,
  };
  const expectedStatus = codeMap[expectedCode];
  if (expectedStatus && res.status === expectedStatus) return;
  if (code === expectedCode) return;
  // Check message for code
  const msg = errorData?.message ?? "";
  if (msg.toLowerCase().includes(expectedCode.toLowerCase())) return;
  throw new Error(
    `Expected tRPC error ${expectedCode} (HTTP ${expectedStatus}), got HTTP ${res.status} with code=${code}, message=${msg}`
  );
}

// ── Minimal Test Runner ────────────────────────────────────────

interface TestCase {
  name: string;
  fn: () => Promise<void>;
}

const _tests: TestCase[] = [];

export function test(name: string, fn: () => Promise<void>) {
  _tests.push({ name, fn });
}

export function describe(_name: string, fn: () => void) {
  fn(); // just collects tests
}

/**
 * Preflight check: verify emulator + API are accessible and tokens work.
 * Returns true if auth tokens work with the API, false otherwise.
 */
export async function preflightCheck(): Promise<boolean> {
  try {
    // 1. Check emulator is running
    const emulatorRes = await fetch(`http://${EMULATOR_HOST}`).catch(() => null);
    if (!emulatorRes?.ok) {
      console.log("  [PREFLIGHT] Firebase Auth Emulator not running on " + EMULATOR_HOST);
      return false;
    }

    // 2. Check API is running
    const apiRes = await fetch(`${API_BASE}/trpc/auth.getSession`).catch(() => null);
    if (!apiRes) {
      console.log("  [PREFLIGHT] API server not running on " + API_BASE);
      return false;
    }

    // 3. Check emulator tokens work with API
    const testUser = await createEmulatorUser(
      `preflight-${Date.now()}@test.com`,
      "PreflightPass123!"
    );
    const tokenTestRes = await trpcAuthQuery("auth.getProfile", undefined, testUser.idToken);
    if (tokenTestRes.status === 401) {
      console.log("  [PREFLIGHT] API server doesn't accept emulator tokens.");
      console.log("  [PREFLIGHT] Restart API with: FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 pnpm --filter @draftplay/api dev");
      return false;
    }
    return true;
  } catch (e: any) {
    console.log(`  [PREFLIGHT] Error: ${e.message}`);
    return false;
  }
}

export async function runTests(suiteName: string) {
  console.log(`\n=== ${suiteName} ===\n`);

  // Run preflight check for auth test suites
  if (suiteName.toLowerCase().includes("api") && !suiteName.toLowerCase().includes("public")) {
    const ok = await preflightCheck();
    if (!ok) {
      console.log("  SKIPPED — prerequisites not met.\n");
      process.exit(0); // Exit cleanly, not as failure
    }
  }

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const t of _tests) {
    process.stdout.write(`  [RUN] ${t.name} ... `);
    try {
      await t.fn();
      console.log("PASS");
      passed++;
    } catch (err: any) {
      console.log(`FAIL: ${err.message}`);
      failed++;
      failures.push(`${t.name}: ${err.message}`);
    }
  }

  console.log(`\n  Results: ${passed} passed, ${failed} failed, ${_tests.length} total\n`);

  if (failures.length > 0) {
    console.log("  Failures:");
    for (const f of failures) console.log(`    - ${f}`);
    console.log();
  }

  // Clear for next suite
  _tests.length = 0;

  if (failed > 0) process.exit(1);
}
