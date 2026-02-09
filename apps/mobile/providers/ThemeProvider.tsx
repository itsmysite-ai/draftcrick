import { createContext, useContext, useState, type ReactNode } from "react";
import { Colors, ColorsLight, RoleColors, RoleColorsLight } from "../lib/design";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  t: typeof Colors;
  roles: typeof RoleColors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  const toggleMode = () => setMode((m) => (m === "light" ? "dark" : "light"));
  const t = mode === "light" ? ColorsLight : Colors;
  const roles = mode === "light" ? RoleColorsLight : RoleColors;

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleMode, t, roles }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
