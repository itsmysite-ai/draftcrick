import { XStack } from "tamagui";
import { SportDropdown, ModeToggle } from "@draftplay/ui";
import { useTheme } from "../providers/ThemeProvider";

/**
 * HeaderControls — self-contained sport dropdown + theme toggle.
 * Uses ThemeProvider hooks internally so screens just render <HeaderControls />.
 * Sport dropdown sits to the left of the light/dark toggle.
 */
export function HeaderControls() {
  const { mode, toggleMode, sport, setSport, t } = useTheme();

  return (
    <XStack alignItems="center" gap="$2">
      <SportDropdown
        activeSport={sport}
        onSportChange={(s) => setSport(s as any)}
        accentColor={t.accent}
        textColor={t.text}
        mutedColor={t.textTertiary}
        surfaceColor={t.bgSurface}
        borderColor={t.border}
      />
      <ModeToggle mode={mode} onToggle={toggleMode} />
    </XStack>
  );
}
