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
