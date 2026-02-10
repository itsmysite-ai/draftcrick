
import { create } from 'zustand';
import { Player, Theme } from './types';

interface DraftState {
  theme: Theme;
  userTeam: Player[];
  selectedTournament: string | null;
  setTheme: (theme: Theme) => void;
  setUserTeam: (team: Player[]) => void;
  setSelectedTournament: (tournament: string | null) => void;
  togglePlayer: (player: Player) => void;
}

export const useStore = create<DraftState>((set) => ({
  theme: (localStorage.getItem('theme') as Theme) || 'system',
  userTeam: [],
  selectedTournament: null,
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
  setUserTeam: (team) => set({ userTeam: team }),
  setSelectedTournament: (tournament) => set({ selectedTournament: tournament }),
  togglePlayer: (p) => set((state) => {
    const exists = state.userTeam.find(item => item.id === p.id);
    if (exists) {
      return { userTeam: state.userTeam.filter(item => item.id !== p.id) };
    } else {
      if (state.userTeam.length >= 11) return state;
      return { userTeam: [...state.userTeam, p] };
    }
  }),
}));
