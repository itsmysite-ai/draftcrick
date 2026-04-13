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
import { h2hRouter } from "./h2h";
import { notificationRouter } from "./notifications";
import { adminRouter } from "./admin";
import { subscriptionRouter } from "./subscription";
import { chatRouter } from "./chat";
import { auctionAiRouter } from "./auction-ai";
import { cricketManagerRouter } from "./cricket-manager";
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
  h2h: h2hRouter,
  notification: notificationRouter,
  admin: adminRouter,
  subscription: subscriptionRouter,
  chat: chatRouter,
  auctionAi: auctionAiRouter,
  cricketManager: cricketManagerRouter,

  seed: publicProcedure.mutation(async ({ ctx }) => {
    return seedCricketData(ctx.db);
  }),
});

export type AppRouter = typeof appRouter;
