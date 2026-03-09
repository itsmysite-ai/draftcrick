/**
 * Navigation context store — holds data that screens pass to each other.
 *
 * Instead of encoding teamA/teamB/format/venue/tournament as URL query
 * parameters (which creates ugly URLs), sender screens call
 * `setMatchContext(...)` before `router.push("/team/create?matchId=X")`.
 * The receiving screen reads the context from the store.
 *
 * The store auto-clears after the data is consumed via `consumeMatchContext()`.
 */

import { create } from "zustand";

export interface MatchNavContext {
  matchId: string;
  contestId?: string;
  teamA?: string;
  teamB?: string;
  format?: string;
  venue?: string;
  tournament?: string;
}

interface NavigationStore {
  matchContext: MatchNavContext | null;
  setMatchContext: (ctx: MatchNavContext) => void;
  consumeMatchContext: () => MatchNavContext | null;
  clearMatchContext: () => void;
}

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  matchContext: null,
  setMatchContext: (ctx) => set({ matchContext: ctx }),
  consumeMatchContext: () => {
    const ctx = get().matchContext;
    // Don't clear immediately — the receiving screen may re-render
    // and need the data again. Clear on next navigation instead.
    return ctx;
  },
  clearMatchContext: () => set({ matchContext: null }),
}));
