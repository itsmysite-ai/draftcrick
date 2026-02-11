# Logging & Distributed Tracing Guide

This guide covers how to use the structured logging and distributed tracing system across the DraftCrick frontend (Expo + Next.js) and backend (Hono + tRPC).

## Architecture Overview

```
Frontend (React Native / Next.js)         Backend (Hono + tRPC / Cloud Run)
┌──────────────────────────┐               ┌───────────────────────────────┐
│  logger.ts               │               │  logger.ts                    │
│  - child loggers         │   tRPC link   │  - Pino structured JSON       │
│  - batched buffer  ──────┼── headers ───>│  - correlationId middleware   │
│  - tracing headers       │               │                               │
│  - correlation IDs       │   Headers     │  CorrelationMiddleware (Hono) │
│                          ├─ X-Corr-ID ──>│  - extracts/generates ID      │
│                          │  X-User-ID    │  - sets AsyncLocalStorage     │
│                          │  X-Session-ID │  - logs req start/end         │
└──────────────────────────┘               └──────────────┬────────────────┘
                                                          │ JSON to stdout
        Socket.IO                                         v
┌──────────────────────────┐               GCP Cloud Logging
│  Draft / Auction rooms   │               (auto-parsed, filterable)
│  Live score feeds        │
│  - correlationId as      │
│    query param / auth    │
└──────────────────────────┘
```

**Correlation flow**: A `correlationId` is generated on the frontend at the start of each user flow (e.g., joining a draft, creating a team, entering a contest). It is attached to every tRPC request via a custom link and every Socket.IO connection as a query param. The backend middleware extracts it and injects it into every log entry via AsyncLocalStorage. This lets you trace a user action across frontend logs, tRPC calls, WebSocket events, Redis cache operations, and Gemini AI requests.

---

## Backend Logging (Hono + tRPC)

### Logger Setup

Use **Pino** as the structured logger. Configure it once in a shared logger module.

**File: `/packages/api/src/lib/logger.ts`**

```typescript
import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";

// ── Context store ──────────────────────────────────────────
export interface RequestContext {
  correlationId: string;
  userId?: string;
  sessionId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

// ── Root logger ────────────────────────────────────────────
export const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  formatters: {
    level(label) {
      // GCP Cloud Logging expects "severity" not "level"
      return { severity: label.toUpperCase() };
    },
  },
  // GCP adds its own timestamp — omit to avoid redundancy
  timestamp: false,
  mixin() {
    const ctx = requestContext.getStore();
    return {
      ...(ctx?.correlationId && { correlationId: ctx.correlationId }),
      ...(ctx?.userId && { userId: ctx.userId }),
      ...(ctx?.sessionId && { sessionId: ctx.sessionId }),
    };
  },
});

// ── Child logger factory ───────────────────────────────────
export function getLogger(module: string) {
  return rootLogger.child({ module });
}
```

### Creating a Logger

Every file should create a **child logger** scoped to its module:

```typescript
import { getLogger } from "../lib/logger";

const log = getLogger("sports-cache");
```

The module name appears in every log entry as the `module` field.

### Structured Extra Fields

Pass structured metadata as the first argument (Pino convention):

```typescript
log.info({ noteId: note.id, durationMs: elapsed }, "Note generated");
log.error({ contestId, error: String(e) }, "Contest settlement failed");
log.warn({ cacheKey, ttl }, "Cache miss — fetching from Gemini");
```

These fields appear as top-level keys in the JSON output and are filterable in GCP Cloud Logging.

### Correlation Middleware (Hono)

**File: `/packages/api/src/middleware/correlation.ts`**

```typescript
import { createMiddleware } from "hono/factory";
import { randomUUID } from "node:crypto";
import { requestContext, rootLogger } from "../lib/logger";

const QUIET_PATHS = ["/health", "/trpc/log.ingest"];

export const correlationMiddleware = createMiddleware(async (c, next) => {
  // Skip logging for OPTIONS preflight
  if (c.req.method === "OPTIONS") {
    return next();
  }

  const correlationId =
    c.req.header("x-correlation-id") ?? randomUUID().slice(0, 16);
  const userId = c.req.header("x-user-id") ?? "";
  const sessionId = c.req.header("x-session-id") ?? "";

  const ctx = { correlationId, userId, sessionId };

  return requestContext.run(ctx, async () => {
    const isQuiet = QUIET_PATHS.some((p) => c.req.path.startsWith(p));
    const start = Date.now();

    if (!isQuiet) {
      rootLogger.info(
        { method: c.req.method, path: c.req.path, correlationId, userId },
        "Request started"
      );
    }

    await next();

    if (!isQuiet) {
      rootLogger.info(
        {
          method: c.req.method,
          path: c.req.path,
          status: c.res.status,
          durationMs: Date.now() - start,
          correlationId,
        },
        "Request completed"
      );
    }
  });
});
```

Register in `packages/api/src/index.ts` **before** other middleware:

```typescript
import { correlationMiddleware } from "./middleware/correlation";

app.use("*", correlationMiddleware);
app.use("*", logger());  // Hono's built-in logger (optional, can remove after migration)
```

### tRPC Procedure Logging

Add logging to tRPC middleware for protected/admin procedures:

```typescript
import { getLogger } from "../lib/logger";

const log = getLogger("trpc");

export const protectedProcedure = t.procedure.use(async ({ ctx, path, next }) => {
  if (!ctx.user) {
    log.warn({ path }, "Unauthorized tRPC call");
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  log.debug({ path, userId: ctx.user.id }, "Protected procedure called");
  return next({ ctx: { ...ctx, user: ctx.user } });
});
```

### Redis Cache Logging

```typescript
const log = getLogger("sports-cache");

// Cache hit
log.debug({ cacheKey, sport }, "Redis cache hit");

// Cache miss + lock acquired
log.info({ cacheKey, sport }, "Cache miss — fetching from Gemini");

// Cache miss + lock NOT acquired (another instance is fetching)
log.debug({ cacheKey, sport }, "Cache miss — waiting for peer fetch");

// Redis connection error (graceful fallback)
log.warn({ error: String(e) }, "Redis unavailable — falling back to direct Gemini");

// Cache write
log.debug({ cacheKey, ttlSeconds: 86400 }, "Cached Gemini response");
```

### Gemini AI Call Logging

```typescript
const log = getLogger("gemini");

const start = Date.now();
log.info({ model: "gemini-2.5-flash", sport, prompt: prompt.slice(0, 100) }, "Gemini request started");

const response = await ai.models.generateContent({ ... });

log.info(
  { model: "gemini-2.5-flash", sport, durationMs: Date.now() - start, groundingSources: sources.length },
  "Gemini request completed"
);
```

### WebSocket Logging (Socket.IO)

Set correlation context at connection time:

```typescript
import { requestContext, getLogger } from "../lib/logger";

const log = getLogger("draft-room");

io.of("/draft").on("connection", (socket) => {
  const correlationId = (socket.handshake.query.correlationId as string) ?? randomUUID().slice(0, 16);
  const userId = socket.handshake.auth?.userId ?? "";
  const sessionId = socket.handshake.auth?.sessionId ?? "";

  // Store context on the socket for use in event handlers
  socket.data.ctx = { correlationId, userId, sessionId };

  log.info({ correlationId, userId }, "Client connected to draft namespace");

  socket.on("join:draft", (data) => {
    requestContext.run(socket.data.ctx, () => {
      log.info({ draftId: data.draftId, userId }, "Joined draft room");
    });
  });

  socket.on("draft:pick", (data) => {
    requestContext.run(socket.data.ctx, () => {
      log.info({ draftId: data.draftId, playerId: data.playerId, round: data.round }, "Draft pick made");
    });
  });

  socket.on("disconnect", () => {
    log.info({ correlationId, userId }, "Client disconnected from draft namespace");
  });
});
```

### BullMQ Job Logging (Future)

When BullMQ jobs are implemented, wrap each worker in correlation context:

```typescript
const log = getLogger("worker:settlement");

worker.on("active", (job) => {
  const correlationId = job.data.correlationId ?? randomUUID().slice(0, 16);
  requestContext.run({ correlationId, userId: job.data.userId }, () => {
    log.info({ jobId: job.id, contestId: job.data.contestId }, "Settlement job started");
  });
});
```

### GCP Cloud Logging Output Format

Every log line is a single JSON object. GCP Cloud Logging auto-parses it.

```json
{
  "severity": "INFO",
  "message": "Request completed",
  "correlationId": "a1b2c3d4e5f67890",
  "userId": "firebase-uid-123",
  "sessionId": "session-456",
  "module": "sports-cache",
  "method": "GET",
  "path": "/trpc/sports.getDashboard",
  "status": 200,
  "durationMs": 342
}
```

GCP Cloud Logging filter examples:

```
jsonPayload.correlationId="a1b2c3d4e5f67890"
jsonPayload.severity="ERROR"
jsonPayload.userId="firebase-uid-123"
jsonPayload.module="draft-room"
jsonPayload.module="gemini" AND jsonPayload.durationMs>5000
```

---

## Frontend Logging

### Logger Service

**File: `/packages/shared/src/logger.ts`**

Shared across mobile (Expo) and web (Next.js).

```typescript
import { randomUUID } from "expo-crypto"; // or crypto.randomUUID() on web

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "AUDIT";

interface LogEntry {
  level: LogLevel;
  component: string;
  message: string;
  correlationId: string;
  userId?: string;
  sessionId: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

// ── State ──────────────────────────────────────────────────
let buffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let correlationId = randomUUID().slice(0, 16);
let userId: string | undefined;
const sessionId = randomUUID().slice(0, 16);
let apiUrl = "";

// ── Lifecycle ──────────────────────────────────────────────
export function startLogger(baseApiUrl: string) {
  apiUrl = baseApiUrl;
  flushTimer = setInterval(flushBuffer, 10_000);
}

export function stopLogger() {
  flushBuffer();
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
}

export function setLoggerContext(ctx: { userId?: string }) {
  if (ctx.userId) userId = ctx.userId;
}

// ── Correlation IDs ────────────────────────────────────────
export function newCorrelationId(): string {
  correlationId = randomUUID().slice(0, 16);
  return correlationId;
}

export function getCorrelationId(): string {
  return correlationId;
}

// ── Tracing headers (for non-tRPC fetch calls) ────────────
export function getTracingHeaders(): Record<string, string> {
  return {
    "x-correlation-id": correlationId,
    ...(userId && { "x-user-id": userId }),
    "x-session-id": sessionId,
  };
}

// ── Buffer & flush ─────────────────────────────────────────
function enqueue(entry: LogEntry) {
  buffer.push(entry);
  if (entry.level === "ERROR") {
    flushBuffer(); // Errors flush immediately
  }
}

async function flushBuffer() {
  if (buffer.length === 0 || !apiUrl) return;
  const batch = buffer.splice(0);
  try {
    await fetch(`${apiUrl}/trpc/log.ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getTracingHeaders() },
      body: JSON.stringify(batch),
    });
  } catch {
    // Silently drop — don't log about logging failures
  }
}

// ── Child logger factory ───────────────────────────────────
export function createLogger(component: string) {
  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    const entry: LogEntry = {
      level,
      component,
      message,
      correlationId,
      userId,
      sessionId,
      timestamp: new Date().toISOString(),
      meta,
    };

    // Always print to console in dev
    const consoleFn =
      level === "ERROR" ? console.error :
      level === "WARN" ? console.warn :
      console.log;
    consoleFn(`[${component}] ${message}`, meta ?? "");

    // Ship INFO+ to backend
    if (level !== "DEBUG") {
      enqueue(entry);
    }
  };

  return {
    debug: (msg: string, meta?: Record<string, unknown>) => log("DEBUG", msg, meta),
    info:  (msg: string, meta?: Record<string, unknown>) => log("INFO", msg, meta),
    warn:  (msg: string, meta?: Record<string, unknown>) => log("WARN", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("ERROR", msg, meta),
    audit: (msg: string, meta?: Record<string, unknown>) => log("AUDIT", msg, meta),
  };
}
```

### Setup (App Entry Points)

**Mobile (`apps/mobile/app/_layout.tsx`):**

```typescript
import { startLogger, stopLogger, setLoggerContext } from "@draftcrick/shared/logger";

useEffect(() => {
  startLogger(process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001");
  return () => stopLogger();
}, []);

// After Firebase auth resolves:
setLoggerContext({ userId: firebaseUser.uid });
```

**Web (`apps/web/src/lib/providers.tsx`):**

```typescript
import { startLogger, stopLogger, setLoggerContext } from "@draftcrick/shared/logger";

useEffect(() => {
  startLogger(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001");
  return () => stopLogger();
}, []);
```

### Creating a Logger

Every file should create a **child logger** scoped to its component/module:

```typescript
import { createLogger } from "@draftcrick/shared/logger";

const log = createLogger("TeamBuilder");
```

### Log Levels

| Level   | Method       | Shipped to backend? | Use for                                      |
|---------|-------------|---------------------|----------------------------------------------|
| DEBUG   | `log.debug` | No (console only)   | Verbose dev-time info, state dumps           |
| INFO    | `log.info`  | Yes                 | Significant operations, lifecycle events     |
| WARN    | `log.warn`  | Yes                 | Recoverable issues, degraded states          |
| ERROR   | `log.error` | Yes (flush immediately) | Failures, caught exceptions              |
| AUDIT   | `log.audit` | Yes                 | Security-sensitive operations (see below)    |

### Logging Patterns

```typescript
// Basic
log.info("Draft room joined");

// With structured metadata (always use an object, not string interpolation)
log.info("Draft pick made", { draftId, playerId, round: 3 });

// Errors — stringify the error, include relevant IDs
log.error("Failed to submit team", { error: String(e), contestId });

// Debug — only visible in dev console, never shipped
log.debug("WebSocket message received", { type: message.type });
```

### AUDIT Logging

Use `log.audit()` for **infrequent, security-sensitive** operations. Avoid AUDIT on high-frequency reads.

```typescript
// Auth events
log.audit("User logged in", { method: "google" });
log.audit("User logged out");

// Financial operations
log.audit("Wallet deposit initiated", { amount, gateway: "razorpay" });
log.audit("Contest entry paid", { contestId, entryFee });
log.audit("Withdrawal requested", { amount, method: "upi" });

// Geo-compliance
log.audit("Geo-location verified", { zone: "IN-MH", method: "gps" });
log.audit("Feature gated by regulation", { feature: "paid-contest", zone: "IN-AP" });

// Admin actions
log.audit("Admin settled contest", { contestId, winnersCount: 5 });
```

### Attaching Tracing Headers to tRPC

Add a custom tRPC link that injects tracing headers on every request:

**File: `/packages/shared/src/trpc-tracing-link.ts`**

```typescript
import { httpBatchLink } from "@trpc/client";
import { getTracingHeaders } from "./logger";

export function createTracingBatchLink(url: string) {
  return httpBatchLink({
    url,
    headers() {
      return getTracingHeaders();
    },
  });
}
```

**Usage in tRPC client setup:**

```typescript
import { createTracingBatchLink } from "@draftcrick/shared/trpc-tracing-link";

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      createTracingBatchLink(
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/trpc"
      ),
    ],
  });
}
```

### Attaching Correlation IDs to Socket.IO

```typescript
import { io } from "socket.io-client";
import { getCorrelationId, getTracingHeaders } from "@draftcrick/shared/logger";

const socket = io(`${API_URL}/draft`, {
  query: { correlationId: getCorrelationId() },
  auth: {
    userId: currentUser.uid,
    sessionId: getTracingHeaders()["x-session-id"],
  },
});
```

### Correlation IDs for User Flows

Generate a new correlation ID at the start of each significant user flow:

```typescript
import { newCorrelationId, createLogger } from "@draftcrick/shared/logger";

const log = createLogger("DraftRoom");

const joinDraft = async (draftId: string) => {
  const correlationId = newCorrelationId();
  log.info("Joining draft room", { correlationId, draftId });
  // All subsequent tRPC calls and Socket.IO messages will use this ID
};
```

Recommended flow boundaries (when to call `newCorrelationId()`):

| Flow                        | Trigger                                    |
|-----------------------------|--------------------------------------------|
| Draft session               | User taps "Join Draft"                     |
| Auction session             | User taps "Join Auction"                   |
| Team creation               | User opens Team Builder                    |
| Contest entry               | User taps "Enter Contest"                  |
| Wallet transaction          | User initiates deposit/withdrawal          |
| Match viewing session       | User opens a live match                    |

---

## Backend Log Ingestion Endpoint

Add a tRPC procedure to receive frontend logs:

**File: `/packages/api/src/routers/log.ts`**

```typescript
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getLogger } from "../lib/logger";

const frontendLog = getLogger("frontend");

const logEntrySchema = z.object({
  level: z.enum(["INFO", "WARN", "ERROR", "AUDIT"]),
  component: z.string(),
  message: z.string(),
  correlationId: z.string(),
  userId: z.string().optional(),
  sessionId: z.string(),
  timestamp: z.string(),
  meta: z.record(z.unknown()).optional(),
});

export const logRouter = router({
  ingest: publicProcedure
    .input(z.array(logEntrySchema).max(100))
    .mutation(({ input }) => {
      for (const entry of input) {
        const level = entry.level.toLowerCase() as "info" | "warn" | "error";
        const logFn = level === "error" ? frontendLog.error
          : level === "warn" ? frontendLog.warn
          : frontendLog.info;

        logFn(
          {
            component: entry.component,
            correlationId: entry.correlationId,
            userId: entry.userId,
            sessionId: entry.sessionId,
            clientTimestamp: entry.timestamp,
            ...entry.meta,
          },
          entry.message
        );
      }
      return { ok: true };
    }),
});
```

Frontend logs can be distinguished by `module: "frontend"` and further narrowed by `component`.

---

## Privacy Rules

### Never Log

- Payment credentials (card numbers, UPI IDs, bank account details)
- Firebase tokens or API keys
- User passwords or auth secrets
- Full IP addresses (log only the /24 subnet for geo-debugging if needed)
- Razorpay/Stripe webhook payloads (contain payment details)
- Raw Gemini prompts that include user-generated content
- Geo-coordinates beyond city-level precision

### Safe to Log

- Entity IDs: `userId`, `contestId`, `matchId`, `draftId`, `leagueId`, `transactionId`
- Operation types: `"created"`, `"joined"`, `"settled"`, `"picked"`
- Counts and sizes: `{ playerCount: 11 }`, `{ entryCount: 250 }`
- Amounts (for financial audit): `{ amount: 100, currency: "INR" }`
- Status codes and flags: `{ status: 200 }`, `{ isLive: true }`
- Durations: `{ durationMs: 1523 }`
- Geo zones (not coordinates): `{ zone: "IN-MH" }`, `{ region: "asia-south1" }`
- Cache keys and TTLs: `{ cacheKey: "sports:dashboard:cricket", ttl: 86400 }`
- Error messages (review to ensure no PII leaks)

### Examples

```typescript
// GOOD — logs transaction metadata, not payment details
log.audit("Deposit completed", { transactionId, amount: 500, gateway: "razorpay" });

// BAD — logs payment credentials
log.audit("Deposit completed", { transactionId, upiId: "user@bank", cardLast4: "1234" });

// GOOD — logs zone, not exact coordinates
log.info("Geo-location resolved", { zone: "IN-MH", method: "gps" });

// BAD — logs exact GPS coordinates
log.info("Geo-location resolved", { lat: 19.076, lng: 72.877 });

// GOOD — logs player ID, not the selection context
log.info("Draft pick", { draftId, playerId, round: 3 });

// GOOD — logs count, not content
log.debug("Gemini response parsed", { matchCount: 8, sport: "cricket" });

// BAD — logs raw AI response content
log.debug("Gemini response", { content: geminiResponse });
```

---

## Adding Logging to a New File

### Backend

1. Import and create a child logger:
   ```typescript
   import { getLogger } from "../lib/logger";
   const log = getLogger("my-service");
   ```

2. Use structured metadata as the first arg (Pino convention):
   ```typescript
   log.info({ contestId, userId }, "Contest joined");
   ```

3. For tRPC routers, the correlation context is automatically set by the middleware — just log normally.

4. For WebSocket handlers, wrap event callbacks with `requestContext.run()`.

5. Replace any `console.log/error/warn` calls following the level guide above.

### Frontend

1. Import and create a child logger:
   ```typescript
   import { createLogger } from "@draftcrick/shared/logger";
   const log = createLogger("MyComponent");
   ```

2. If the file starts a new user flow, generate a new correlation ID:
   ```typescript
   import { newCorrelationId } from "@draftcrick/shared/logger";
   ```

3. Replace `console.log/error/warn` calls following the level guide above.

4. tRPC calls automatically get tracing headers via the custom link — no extra work needed.

5. For direct `fetch()` calls (rare — prefer tRPC), spread tracing headers:
   ```typescript
   import { getTracingHeaders } from "@draftcrick/shared/logger";

   await fetch(url, {
     headers: { ...getTracingHeaders() },
   });
   ```

---

## Debugging with Correlation IDs

To trace a request end-to-end:

1. **Find the correlation ID** — in dev console, look for `[DraftRoom] Joining draft room { correlationId: "abc123..." }`
2. **Search backend logs** — filter GCP Cloud Logging:
   ```
   jsonPayload.correlationId="abc123..."
   ```
3. **See the full flow** — all frontend logs, tRPC calls, WebSocket events, Redis operations, and Gemini AI requests for that user action share the same ID

For local development:
- Frontend logs appear in Metro (mobile) or browser console (web) with `[ComponentName]` prefixes
- Backend logs appear as JSON lines in the terminal (Pino)
- Use `pino-pretty` for human-readable local output:
  ```bash
  pnpm --filter @draftcrick/api dev | pnpm exec pino-pretty
  ```

---

## Log Level Reference by Module

| Module          | DEBUG                          | INFO                           | WARN                           | ERROR                      |
|-----------------|-------------------------------|--------------------------------|--------------------------------|---------------------------|
| `trpc`          | Procedure calls               | —                              | Unauthorized attempts          | Unhandled procedure errors |
| `sports-cache`  | Cache hits, writes            | Cache misses (Gemini fetch)    | Redis unavailable              | Gemini API failures       |
| `gemini`        | Prompt details                | Request start/complete + duration | Slow responses (>5s)         | API errors, parse failures |
| `draft-room`    | State syncs                   | Join/leave, picks              | Reconnections                  | Invalid picks, crashes     |
| `live-score`    | Score tick broadcasts         | Match start/end                | Stale data warnings            | Feed disconnections       |
| `auth`          | Token verification            | Login/logout (AUDIT)           | Expired tokens                 | Verification failures     |
| `wallet`        | Balance checks                | Deposits/withdrawals (AUDIT)   | Insufficient balance           | Payment gateway errors    |
| `geo`           | Zone lookups                  | Verification events (AUDIT)    | VPN detection triggers         | Geo-service failures      |
| `settlement`    | Score calculations            | Contest settled (AUDIT)        | Partial settlements            | Settlement failures       |
| `frontend`      | UI state, renders             | User actions, navigation       | Degraded network, retries      | Crashes, API failures     |

---

## Dependencies

### Backend
```bash
pnpm --filter @draftcrick/api add pino
pnpm --filter @draftcrick/api add -D pino-pretty  # local dev only
```

### Frontend
No additional dependencies — the logger service uses only built-in APIs (`fetch`, `setInterval`, `console`). Uses `expo-crypto` for `randomUUID()` on mobile (already in Expo).
