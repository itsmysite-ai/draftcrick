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
  /** Sports the user selected during onboarding */
  availableSports: Sport[];
  setAvailableSports: (sports: Sport[]) => void;
  t: typeof Colors;
  roles: RoleColorMap;
  /** Tamagui theme name (e.g. "cricket_dark", "f1_light") */
  themeName: string;
}

const STORAGE_KEY_MODE = "draftplay_theme_mode";
const STORAGE_KEY_SPORT = "draftplay_sport";

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY_AVAILABLE_SPORTS = "draftplay_available_sports";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [sport, setSportState] = useState<Sport>("cricket");
  const [availableSports, setAvailableSportsState] = useState<Sport[]>(["cricket", "f1"]);
  const [loaded, setLoaded] = useState(false);

  // Load persisted preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const [savedMode, savedSport, savedAvailable] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_MODE),
          AsyncStorage.getItem(STORAGE_KEY_SPORT),
          AsyncStorage.getItem(STORAGE_KEY_AVAILABLE_SPORTS),
        ]);
        if (savedMode === "light" || savedMode === "dark") setModeState(savedMode);
        if (savedSport === "cricket" || savedSport === "f1") setSportState(savedSport as Sport);
        if (savedAvailable) {
          try {
            const parsed = JSON.parse(savedAvailable) as Sport[];
            if (Array.isArray(parsed) && parsed.length > 0) setAvailableSportsState(parsed);
          } catch { /* ignore parse errors */ }
        }
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

  const setAvailableSports = (sports: Sport[]) => {
    setAvailableSportsState(sports);
    AsyncStorage.setItem(STORAGE_KEY_AVAILABLE_SPORTS, JSON.stringify(sports)).catch(() => {});
    // If current sport is no longer available, switch to the first available
    if (!sports.includes(sport) && sports.length > 0) {
      setSport(sports[0]);
    }
  };

  // Build Tamagui theme name: for cricket we use the default light/dark,
  // for other sports we use sport_mode sub-themes
  const themeName = sport === "cricket" ? mode : `${sport}_${mode}`;

  const value = useMemo(() => {
    const t = getColors(sport, mode) as typeof Colors;
    const roles = getRoleColors(sport, mode);
    return { mode, setMode, toggleMode, sport, setSport, availableSports, setAvailableSports, t, roles, themeName };
  }, [mode, sport, availableSports, themeName]);

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
