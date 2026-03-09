import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { TamaguiProvider, Theme } from "tamagui";
import { tamaguiConfig } from "../../../tamagui.config";
import { SportFontProvider } from "@draftplay/ui";
import {
  Colors,
  getColors,
  getRoleColors,
} from "../lib/design";
import type { Sport } from "@draftplay/shared";

type ThemeMode = "light" | "dark";

type RoleColorMap = Record<string, { bg: string; text: string; lightBg: string; lightText: string }>;

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  sport: Sport;
  setSport: (sport: Sport) => void;
  t: typeof Colors;
  roles: RoleColorMap;
  /** Tamagui theme name (e.g. "cricket_dark", "f1_light") */
  themeName: string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [sport, setSport] = useState<Sport>("cricket");

  const toggleMode = () => setMode((m) => (m === "light" ? "dark" : "light"));

  // Build Tamagui theme name: for cricket we use the default light/dark,
  // for other sports we use sport_mode sub-themes
  const themeName = sport === "cricket" ? mode : `${sport}_${mode}`;

  const value = useMemo(() => {
    const t = getColors(sport, mode) as typeof Colors;
    const roles = getRoleColors(sport, mode);
    return { mode, setMode, toggleMode, sport, setSport, t, roles, themeName };
  }, [mode, sport, themeName]);

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={themeName}>
      <Theme name={themeName as any}>
        <SportFontProvider sport={sport}>
          <ThemeContext.Provider value={value}>
            {children}
          </ThemeContext.Provider>
        </SportFontProvider>
      </Theme>
    </TamaguiProvider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/** Convenience hook — just the sport context */
export function useSport() {
  const { sport, setSport } = useTheme();
  return { sport, setSport };
}
