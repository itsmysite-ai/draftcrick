/**
 * Mapping of technical/jargon terms to plain English for Comfort Mode.
 * Used in UI to dynamically replace labels when Comfort Mode is active.
 */
export const COMFORT_LABELS: Record<string, string> = {
  // Navigation
  "H2H": "One-on-One",
  "GPP": "Big Tournament",
  "Draft": "Pick Players",
  "Auction": "Bid for Players",
  "Salary Cap": "Budget Team",

  // Scoring
  "TPB": "Top Batting Points",
  "SR": "Strike Rate",
  "ER": "Economy Rate",
  "Fantasy Points": "Your Points",
  "Multiplier": "Bonus",

  // Team Building
  "Captain (2x)": "Captain (earns double points)",
  "Vice-Captain (1.5x)": "Vice-Captain (earns extra points)",
  "Power Player": "Super Player (earns triple points)",
  "Waiver Wire": "Unclaimed Players",
  "Overseas": "Foreign Player",

  // Contest
  "Entry Fee": "Join Price",
  "Prize Pool": "Total Prizes",
  "Guaranteed": "Prizes locked in (contest runs even if not full)",
  "Rake": "Platform Fee",
  "Max Entries": "Maximum Players",

  // Status
  "Upcoming": "Starting Soon",
  "Live": "Playing Now",
  "Settled": "Results Ready",
  "Locked": "Teams Locked",

  // Actions
  "Join Contest": "Play Now",
  "Create League": "Start a Group",
  "Submit Team": "Save My Team",
  "Auto Pick": "Pick For Me",
};

/**
 * Get the comfort-friendly label, falling back to the original if not mapped.
 */
export function getComfortLabel(key: string): string {
  return COMFORT_LABELS[key] ?? key;
}
