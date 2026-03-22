/**
 * Navigation context store — holds data that screens pass to each other.
 *
 * Instead of encoding teamA/teamB/format/venue/tournament as URL query
 * parameters (which creates ugly URLs), sender screens call
 * `setMatchContext(...)` before `router.push("/team/create?matchId=X")`.
 * The receiving screen reads the context from the store.
 *
 * Persisted to sessionStorage on web so context survives page refreshes.
 * On native, the JS runtime stays alive so in-memory Zustand is sufficient.
 */

import { Platform } from "react-native";
import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

export interface SolverPick {
  playerId: string;
  name: string;
  team: string;
  role: string;
  credits: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
}

export interface MatchNavContext {
  matchId: string;
  contestId?: string;
  teamA?: string;
  teamB?: string;
  format?: string;
  venue?: string;
  tournament?: string;
  solverPicks?: SolverPick[];
}

export type FlowStep = "contest_select" | "stake_pick" | "team_build" | "captain_select" | "review";

export interface FlowState {
  step: FlowStep;
  contestId?: string;
  contestType?: "public" | "private" | "h2h";
  contestName?: string;
  entryFee?: number;
  stake?: number;
  opponentId?: string;
}

// Web: sessionStorage survives page refreshes within the same tab.
// Native: no-op storage — Zustand's in-memory state is sufficient since
// the JS runtime stays alive for the app's lifetime.
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const webStorage: StateStorage = {
  getItem: (name) => {
    try { return sessionStorage.getItem(name); } catch { return null; }
  },
  setItem: (name, value) => {
    try { sessionStorage.setItem(name, value); } catch {}
  },
  removeItem: (name) => {
    try { sessionStorage.removeItem(name); } catch {}
  },
};

const storage = Platform.OS === "web" ? webStorage : noopStorage;

interface NavigationStore {
  matchContext: MatchNavContext | null;
  setMatchContext: (ctx: MatchNavContext) => void;
  consumeMatchContext: () => MatchNavContext | null;
  clearMatchContext: () => void;
  flowState: FlowState | null;
  setFlowState: (fs: FlowState) => void;
  advanceFlow: (step: FlowStep) => void;
  resetFlow: () => void;
}

export const useNavigationStore = create<NavigationStore>()(
  persist(
    (set, get) => ({
      matchContext: null,
      setMatchContext: (ctx) => set({ matchContext: ctx }),
      consumeMatchContext: () => {
        const ctx = get().matchContext;
        // Don't clear immediately — the receiving screen may re-render
        // and need the data again. Clear on next navigation instead.
        return ctx;
      },
      clearMatchContext: () => set({ matchContext: null }),
      flowState: null,
      setFlowState: (fs) => set({ flowState: fs }),
      advanceFlow: (step) => {
        const current = get().flowState;
        if (current) set({ flowState: { ...current, step } });
      },
      resetFlow: () => set({ flowState: null }),
    }),
    {
      name: "draftplay_nav_context",
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        matchContext: state.matchContext,
        flowState: state.flowState,
      }),
    },
  ),
);
