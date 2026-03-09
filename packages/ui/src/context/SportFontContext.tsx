/**
 * Sport Font Context — shared between packages/ui components and mobile app.
 *
 * Provides font family remapping based on the active sport.
 * The mobile ThemeProvider sets the sport value; UI components
 * read it to resolve the correct font tokens.
 *
 * Cricket (default): $body/$mono stay as-is
 * F1: $body → $f1Body, $heading → $f1Heading, $mono → $f1Mono
 *     ALL text is italic + bold where possible (formula1.com style).
 */
import { createContext, useContext, type ReactNode } from "react";

type Sport = "cricket" | "f1" | string;

interface SportFontContextValue {
  sport: Sport;
}

const SportFontContext = createContext<SportFontContextValue>({ sport: "cricket" });

export function SportFontProvider({
  sport,
  children,
}: {
  sport: Sport;
  children: ReactNode;
}) {
  return (
    <SportFontContext.Provider value={{ sport }}>
      {children}
    </SportFontContext.Provider>
  );
}

const F1_FONT_MAP: Record<string, string> = {
  "$body": "$f1Body",
  "$heading": "$f1Heading",
  "$mono": "$f1Mono",
};

/**
 * Returns the resolved fontFamily token for the current sport,
 * plus F1-specific style overrides (all italic, bump to bold).
 */
export function useSportFont() {
  const { sport } = useContext(SportFontContext);
  const isF1 = sport === "f1";

  function resolve(token: string | undefined): string | undefined {
    if (!token || !isF1) return token;
    return F1_FONT_MAP[token] ?? token;
  }

  /** Default body font for the current sport */
  const defaultBody = isF1 ? "$f1Body" : "$body";

  /** F1: ALL text is italic */
  function shouldItalicize(): boolean {
    return isF1;
  }

  /**
   * F1: bump font weight to bold.
   * 400 → 700, 500 → 700, 600 stays 600, 700+ stays as-is.
   */
  function resolveFontWeight(
    fontWeight: string | number | undefined,
  ): string | number | undefined {
    if (!isF1 || !fontWeight) return isF1 ? "700" : fontWeight;
    const w = Number(fontWeight);
    if (isNaN(w)) return fontWeight === "bold" ? "bold" : "700";
    return w < 600 ? "700" : fontWeight;
  }

  return { sport, resolve, defaultBody, shouldItalicize, resolveFontWeight, isF1 };
}
