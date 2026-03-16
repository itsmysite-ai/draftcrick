/**
 * draftplay.ai Design System Constants
 * Global styling rules to ensure consistency across all screens
 */

export const DesignSystem = {
  /**
   * Text Casing Rules
   * - lowercase: Most UI text
   * - UPPERCASE: Role badges, team codes, status labels
   * - Title Case: Player names, tab labels
   */
  textCasing: {
    ui: (text: string) => text.toLowerCase(),
    badge: (text: string) => text.toUpperCase(),
    titleCase: (text: string) => text,
  },

  /**
   * Font Families
   * - mono: Stats, numbers, badges, codes, timers
   * - body: All other text
   */
  fonts: {
    mono: "$mono", // DM Mono - for data
    body: "$body", // DM Sans - for content
  },

  /**
   * Font Sizes (consistent across app)
   */
  fontSize: {
    xs: 9,   // Tiny badges, labels
    sm: 10,  // Small labels, hints
    base: 11, // Stats, secondary text
    md: 12,  // Filter pills, badges
    lg: 13,  // Buttons, tab labels
    xl: 14,  // Player names, body text
    "2xl": 17, // Headers
    "3xl": 20, // Large headings
    "4xl": 22, // Timer
  },

  /**
   * Border Radius (consistent rounding)
   */
  radius: {
    sm: 5,   // Small badges
    md: 10,  // Buttons
    lg: 12,  // Tabs container
    xl: 14,  // Avatar
    "2xl": 16, // Cards
    "3xl": 20, // Pills
    full: 999, // Fully rounded
  },

  /**
   * Spacing (use Tamagui tokens: $1-$9)
   */
  spacing: {
    xs: "$1",  // 4px
    sm: "$2",  // 8px
    md: "$3",  // 12px
    lg: "$4",  // 16px
    xl: "$5",  // 20px
    "2xl": "$6", // 24px
  },

  /**
   * Animation Timings
   */
  animation: {
    fast: 200,    // Quick interactions
    normal: 300,  // Standard transitions
    slow: 400,    // Mode changes
    hatch: 2000,  // Egg hatch animation
  },

  /**
   * Button Styles
   */
  button: {
    sizes: {
      sm: { height: 32, paddingHorizontal: "$4", fontSize: 11 },
      md: { height: 40, paddingHorizontal: "$5", fontSize: 13 },
      lg: { height: 48, paddingHorizontal: "$6", fontSize: 15 },
    },
    radius: 10,
    fontFamily: "$mono",
    fontWeight: "500",
  },

  /**
   * Card Styles
   */
  card: {
    radius: 16,
    padding: "$4",
    borderWidth: 1,
  },

  /**
   * Empty States
   */
  emptyState: {
    icon: "▶",
    iconSize: 48,
    message: "draft players to build your squad",
  },

  /**
   * Player Avatar
   */
  avatar: {
    defaultSize: 46,
    borderRadius: (size: number) => Math.round(size * 0.3),
    hoverScale: 1.12,
  },

  /**
   * Role Colors (matches theme tokens)
   */
  roles: {
    BAT: {
      name: "Batsmen",
      emoji: "🏏",
      token: "BAT",
    },
    BOWL: {
      name: "Bowlers",
      emoji: "🔴",
      token: "BOWL",
    },
    AR: {
      name: "All-Rounders",
      emoji: "⚡",
      token: "AR",
    },
    WK: {
      name: "Keepers",
      emoji: "🧤",
      token: "WK",
    },
  },
} as const;

/**
 * Sport-specific role metadata.
 * Returns the role definitions for the given sport.
 */
export const SPORT_ROLES: Record<string, Record<string, { name: string; emoji: string; token: string }>> = {
  cricket: {
    BAT: { name: "Batsmen", emoji: "🏏", token: "BAT" },
    BOWL: { name: "Bowlers", emoji: "🔴", token: "BOWL" },
    AR: { name: "All-Rounders", emoji: "⚡", token: "AR" },
    WK: { name: "Keepers", emoji: "🧤", token: "WK" },
  },
  f1: {
    DRV: { name: "Drivers", emoji: "🏎️", token: "DRV" },
    CON: { name: "Constructors", emoji: "🏗️", token: "CON" },
    TP: { name: "Team Principals", emoji: "👔", token: "TP" },
  },
};

export function getRolesForDesignSystem(sport: string) {
  return SPORT_ROLES[sport] ?? SPORT_ROLES.cricket;
}

/**
 * Common Text Components Props
 */
export const textStyles = {
  /**
   * Player Name
   */
  playerName: {
    fontFamily: "$body",
    fontWeight: "600",
    fontSize: 14,
    color: "$color",
  },

  /**
   * Secondary Text (team codes, labels)
   */
  secondary: {
    fontFamily: "$mono",
    fontSize: 11,
    color: "$colorMuted",
  },

  /**
   * Stat Label
   */
  stat: {
    fontFamily: "$mono",
    fontSize: 11,
  },

  /**
   * Small Label/Hint
   */
  hint: {
    fontFamily: "$mono",
    fontSize: 10,
    color: "$colorMuted",
  },

  /**
   * Section Header
   */
  sectionHeader: {
    fontFamily: "$mono",
    fontSize: 12,
    fontWeight: "600",
    color: "$color",
    textTransform: "lowercase" as const,
  },
} as const;

/**
 * Utility to format text with lowercase rule
 */
export const formatUIText = (text: string): string => {
  return text.toLowerCase();
};

/**
 * Utility to format role/badge text with uppercase rule
 */
export const formatBadgeText = (text: string): string => {
  return text.replace(/_/g, " ").toUpperCase();
};

/**
 * Strip "Men" / "Women" suffix and abbreviate long franchise names.
 * "India Men" → "India", "Royal Challengers Bengaluru" → "Royal Challengers Beng."
 * Keeps city-based short names intact ("Mumbai Indians" stays as-is).
 */
const TEAM_ABBREVIATIONS: Record<string, string> = {
  "Royal Challengers Bengaluru": "RCB",
  "Royal Challengers Bangalore": "RCB",
  "Sunrisers Hyderabad": "SRH",
  "Chennai Super Kings": "CSK",
  "Mumbai Indians": "MI",
  "Kolkata Knight Riders": "KKR",
  "Rajasthan Royals": "RR",
  "Delhi Capitals": "DC",
  "Punjab Kings": "PBKS",
  "Lucknow Super Giants": "LSG",
  "Gujarat Titans": "GT",
};

export const formatTeamName = (name: string): string => {
  const cleaned = name.replace(/ Men$| Women$/, "");
  return TEAM_ABBREVIATIONS[cleaned] ?? cleaned;
};
