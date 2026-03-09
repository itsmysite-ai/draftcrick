import { CricketBatIcon } from "./CricketBatIcon";
import { CricketBallIcon } from "./CricketBallIcon";
import { RacingHelmetIcon } from "./RacingHelmetIcon";
import { CheckeredFlagIcon } from "./CheckeredFlagIcon";

interface SportIconProps {
  sport: string;
  size?: number;
  color?: string;
}

/**
 * Renders the primary icon for a given sport.
 * Cricket → CricketBatIcon, F1 → RacingHelmetIcon
 */
export function SportPrimaryIcon({ sport, size = 16, color }: SportIconProps) {
  switch (sport) {
    case "f1":
      return <RacingHelmetIcon size={size} color={color} />;
    case "cricket":
    default:
      return <CricketBatIcon size={size} />;
  }
}

/**
 * Renders the secondary icon for a given sport.
 * Cricket → CricketBallIcon, F1 → CheckeredFlagIcon
 */
export function SportSecondaryIcon({ sport, size = 16 }: Omit<SportIconProps, "color">) {
  switch (sport) {
    case "f1":
      return <CheckeredFlagIcon size={size} />;
    case "cricket":
    default:
      return <CricketBallIcon size={size} />;
  }
}
