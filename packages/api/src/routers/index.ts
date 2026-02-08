import { router, publicProcedure } from "../trpc";
import { authRouter } from "./auth";
import { matchRouter } from "./match";
import { playerRouter } from "./player";
import { contestRouter } from "./contest";
import { teamRouter } from "./team";
import { leagueRouter } from "./league";
import { predictionRouter } from "./prediction";
import { walletRouter } from "./wallet";
import { seedCricketData } from "../services/cricket-data";

export const appRouter = router({
  auth: authRouter,
  match: matchRouter,
  player: playerRouter,
  contest: contestRouter,
  team: teamRouter,
  league: leagueRouter,
  prediction: predictionRouter,
  wallet: walletRouter,

  /**
   * Seed database with development data (dev only)
   */
  seed: publicProcedure.mutation(async ({ ctx }) => {
    return seedCricketData(ctx.db);
  }),
});

export type AppRouter = typeof appRouter;
