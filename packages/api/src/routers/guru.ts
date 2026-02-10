import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";

const NOT_IMPLEMENTED = () => {
  throw new TRPCError({
    code: "METHOD_NOT_SUPPORTED",
    message: "NOT_IMPLEMENTED — wired in Phase 3",
  });
};

export const guruRouter = router({
  startConversation: protectedProcedure
    .input(
      z.object({
        initialMessage: z.string().min(1),
        contextSnapshot: z.record(z.any()).optional(),
      })
    )
    .mutation(async () => NOT_IMPLEMENTED()),

  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        message: z.string().min(1),
      })
    )
    .mutation(async () => NOT_IMPLEMENTED()),

  getConversations: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
      }).optional()
    )
    .query(async () => NOT_IMPLEMENTED()),
});
