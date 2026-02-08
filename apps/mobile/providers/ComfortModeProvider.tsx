import React, { createContext, useContext } from "react";
import { create } from "zustand";

interface ComfortModeState {
  enabled: boolean;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
}

export const useComfortModeStore = create<ComfortModeState>((set) => ({
  enabled: false,
  toggle: () => set((state) => ({ enabled: !state.enabled })),
  enable: () => set({ enabled: true }),
  disable: () => set({ enabled: false }),
}));

const ComfortModeContext = createContext<ComfortModeState | null>(null);

export function ComfortModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = useComfortModeStore();

  return (
    <ComfortModeContext.Provider value={store}>
      {children}
    </ComfortModeContext.Provider>
  );
}

export function useComfortMode() {
  const context = useContext(ComfortModeContext);
  if (!context) {
    return useComfortModeStore();
  }
  return context;
}
