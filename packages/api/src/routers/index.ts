import { router } from "../trpc";
import { authRouter } from "./auth";
import { matchRouter } from "./match";
import { playerRouter } from "./player";
import { contestRouter } from "./contest";
import { teamRouter } from "./team";
import { leagueRouter } from "./league";
import { predictionRouter } from "./prediction";

export const appRouter = router({
  auth: authRouter,
  match: matchRouter,
  player: playerRouter,
  contest: contestRouter,
  team: teamRouter,
  league: leagueRouter,
  prediction: predictionRouter,
});

export type AppRouter = typeof appRouter;
