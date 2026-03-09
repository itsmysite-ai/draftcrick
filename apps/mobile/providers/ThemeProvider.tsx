import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from "react";
import { TamaguiProvider, Theme } from "tamagui";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const STORAGE_KEY_MODE = "draftplay_theme_mode";
const STORAGE_KEY_SPORT = "draftplay_sport";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [sport, setSportState] = useState<Sport>("cricket");
  const [loaded, setLoaded] = useState(false);

  // Load persisted preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const [savedMode, savedSport] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_MODE),
          AsyncStorage.getItem(STORAGE_KEY_SPORT),
        ]);
        if (savedMode === "light" || savedMode === "dark") setModeState(savedMode);
        if (savedSport === "cricket" || savedSport === "f1") setSportState(savedSport as Sport);
      } catch {
        // Storage unavailable — use defaults
      }
      setLoaded(true);
    })();
  }, []);

  // Persist on change
  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY_MODE, m).catch(() => {});
  };

  const setSport = (s: Sport) => {
    setSportState(s);
    AsyncStorage.setItem(STORAGE_KEY_SPORT, s).catch(() => {});
  };

  const toggleMode = () => {
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
  };

  // Build Tamagui theme name: for cricket we use the default light/dark,
  // for other sports we use sport_mode sub-themes
  const themeName = sport === "cricket" ? mode : `${sport}_${mode}`;

  const value = useMemo(() => {
    const t = getColors(sport, mode) as typeof Colors;
    const roles = getRoleColors(sport, mode);
    return { mode, setMode, toggleMode, sport, setSport, t, roles, themeName };
  }, [mode, sport, themeName]);

  // Don't render until preferences are loaded to avoid flash
  if (!loaded) return null;

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
