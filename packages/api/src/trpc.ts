import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context as HonoContext } from "hono";
import type { Database } from "@draftplay/db";
import type { SubscriptionTier } from "@draftplay/shared";

/**
 * Context available to all tRPC procedures.
 */
export interface TRPCContext {
  db: Database;
  user: { id: string; firebaseUid: string; role: string; email: string | null } | null;
  /** User's subscription tier — resolved during auth, available to all procedures */
  tier?: SubscriptionTier;
  req: HonoContext;
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/**
 * Protected procedure - requires authenticated user.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Admin procedure - requires admin role.
 */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Support procedure - requires admin or support role.
 * Used for endpoints that support engineers need (user management, subscription overrides).
 */
export const supportProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || (ctx.user.role !== "admin" && ctx.user.role !== "support")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin or support access required",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/** Export middleware builder for external middleware files (e.g. tier.ts) */
export const middleware = t.middleware;

/**
 * Pro tier procedure - requires at least Pro subscription.
 * Use for features like unlimited guru, projected points, rate my team, etc.
 */
export const proProcedure = protectedProcedure.use(({ ctx, next }) => {
  const tier = ctx.tier ?? "basic";
  if (tier !== "pro" && tier !== "elite") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: JSON.stringify({
        type: "PAYWALL",
        currentTier: tier,
        requiredTier: "pro",
        title: "Pro feature",
        description: "This feature requires a Pro subscription or above. Upgrade to unlock.",
      }),
    });
  }
  return next({ ctx: { ...ctx, tier } });
});

/**
 * Elite tier procedure - requires Elite subscription.
 * Use for premium features like confidence intervals, priority guru, etc.
 */
export const eliteProcedure = protectedProcedure.use(({ ctx, next }) => {
  const tier = ctx.tier ?? "basic";
  if (tier !== "elite") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: JSON.stringify({
        type: "PAYWALL",
        currentTier: tier,
        requiredTier: "elite",
        title: "Elite feature",
        description: "This feature requires an Elite subscription. Upgrade to unlock.",
      }),
    });
  }
  return next({ ctx: { ...ctx, tier } });
});
