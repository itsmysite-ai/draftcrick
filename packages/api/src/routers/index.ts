import { router, publicProcedure } from "../trpc";
import { authRouter } from "./auth";
import { matchRouter } from "./match";
import { playerRouter } from "./player";
import { contestRouter } from "./contest";
import { teamRouter } from "./team";
import { leagueRouter } from "./league";
import { predictionRouter } from "./prediction";
import { walletRouter } from "./wallet";
import { draftRouter } from "./draft";
import { tradeRouter } from "./trade";
import { sportsRouter } from "./sports";
import { tournamentRouter } from "./tournament";
import { commissionerRouter } from "./commissioner";
import { analyticsRouter } from "./analytics";
import { guruRouter } from "./guru";
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
  draft: draftRouter,
  trade: tradeRouter,
  sports: sportsRouter,
  tournament: tournamentRouter,
  commissioner: commissionerRouter,
  analytics: analyticsRouter,
  guru: guruRouter,

  seed: publicProcedure.mutation(async ({ ctx }) => {
    return seedCricketData(ctx.db);
  }),
});

export type AppRouter = typeof appRouter;
