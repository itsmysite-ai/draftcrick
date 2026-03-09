import { XStack } from "tamagui";
import { ModeToggle } from "./ModeToggle";
import { SportDropdown } from "./SportDropdown";

interface HeaderControlsProps {
  mode: "light" | "dark";
  onToggle: () => void;
  sport: string;
  onSportChange: (sport: string) => void;
  accentColor?: string;
  textColor?: string;
  mutedColor?: string;
  surfaceColor?: string;
  borderColor?: string;
}

/**
 * HeaderControls — combined sport dropdown + theme toggle.
 * Drop-in replacement for standalone ModeToggle in all screen headers.
 */
export function HeaderControls({
  mode,
  onToggle,
  sport,
  onSportChange,
  accentColor,
  textColor,
  mutedColor,
  surfaceColor,
  borderColor,
}: HeaderControlsProps) {
  return (
    <XStack alignItems="center" gap="$2">
      <SportDropdown
        activeSport={sport}
        onSportChange={onSportChange}
        accentColor={accentColor}
        textColor={textColor}
        mutedColor={mutedColor}
        surfaceColor={surfaceColor}
        borderColor={borderColor}
      />
      <ModeToggle mode={mode} onToggle={onToggle} />
    </XStack>
  );
}
