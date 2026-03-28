/**
 * Shared score parsing utilities — used across home, live, and match center screens.
 */

const TEAM_ABBREV_MAP: Record<string, string[]> = {
  "rcb": ["royal challengers bengaluru", "royal challengers bangalore"],
  "srh": ["sunrisers hyderabad"], "csk": ["chennai super kings"],
  "mi": ["mumbai indians"], "kkr": ["kolkata knight riders"],
  "rr": ["rajasthan royals"], "dc": ["delhi capitals"],
  "pbks": ["punjab kings"], "lsg": ["lucknow super giants"], "gt": ["gujarat titans"],
};

function matchesTeam(raw: string, team?: string): boolean {
  if (!team) return false;
  const abbr = raw.replace(/[:\s].*$/, "").toLowerCase().trim();
  const t = team.toLowerCase();
  if (abbr === t) return true;
  // Abbreviation lookup: "srh" → ["sunrisers hyderabad"]
  const abbrNames = TEAM_ABBREV_MAP[abbr];
  if (abbrNames && abbrNames.some((n) => t.includes(n) || n.includes(t))) return true;
  // Reverse: team is "sunrisers hyderabad" → find its abbreviation
  const teamEntry = Object.entries(TEAM_ABBREV_MAP).find(([, names]) => names.some((n) => t.includes(n) || n.includes(t)));
  if (teamEntry && teamEntry[0] === abbr) return true;
  // Fallback: first-letter abbreviation match
  const words = t.split(/\s+/);
  const teamAbbr = words.map((w) => w[0]).join("");
  if (teamAbbr === abbr) return true;
  return false;
}

export function parseTeamScores(scoreSummary: string | null | undefined, teamA?: string, teamB?: string) {
  if (!scoreSummary) return { scoreA: null, scoreB: null, oversA: null, oversB: null };
  const parts = scoreSummary.split(/\s*\|\s*|\s+vs\s+/i);
  const extract = (part: string) => {
    const s = part.match(/(\d+\/\d+|\d+(?=\s*\())/);
    const o = part.match(/\(([^)]+)\)/);
    return { score: s ? s[1] : null, overs: o ? o[1] : null, raw: part };
  };

  const parsed = parts.map((p) => extract(p));
  let scoreA: string | null = null, oversA: string | null = null;
  let scoreB: string | null = null, oversB: string | null = null;

  for (const p of parsed) {
    if (!p.score) continue;
    if (teamA && matchesTeam(p.raw, teamA)) { scoreA = p.score; oversA = p.overs ?? null; }
    else if (teamB && matchesTeam(p.raw, teamB)) { scoreB = p.score; oversB = p.overs ?? null; }
    else if (!scoreA) { scoreA = p.score; oversA = p.overs ?? null; }
    else { scoreB = p.score; oversB = p.overs ?? null; }
  }
  return { scoreA, scoreB, oversA, oversB };
}

export function getTeamRole(
  tossWinner: string | null, tossDecision: string | null, teamA: string,
  scoreSummary?: string | null, teamB?: string,
): "bat" | "bowl" | null {
  // Detect current batting team from score summary (handles 2nd innings)
  if (scoreSummary) {
    const parts = scoreSummary.split(/\s*\|\s*/);
    const lastPart = parts[parts.length - 1] ?? "";
    const abbr = lastPart.replace(/[:\s].*$/, "").toLowerCase().trim();
    if (abbr) {
      const isA = teamMatchesAbbr(abbr, teamA);
      const isB = teamB ? teamMatchesAbbr(abbr, teamB) : false;
      if (isA) return "bat";
      if (isB) return "bowl";
    }
  }
  // Fallback: toss info
  if (!tossWinner || !tossDecision) return null;
  const winnerChoseBat = tossDecision.toLowerCase().includes("bat");
  const t = teamA.toLowerCase();
  const w = tossWinner.toLowerCase();
  const teamAWonToss = w.includes(t) || t.includes(w.slice(0, 4)) || w.includes(t.slice(0, 4));
  if (teamAWonToss) return winnerChoseBat ? "bat" : "bowl";
  return winnerChoseBat ? "bowl" : "bat";
}

function teamMatchesAbbr(abbr: string, team: string): boolean {
  const t = team.toLowerCase();
  if (abbr === t) return true;
  const names = TEAM_ABBREV_MAP[abbr];
  if (names?.some((n) => t.includes(n) || n.includes(t))) return true;
  const entry = Object.entries(TEAM_ABBREV_MAP).find(([, ns]) => ns.some((n) => t.includes(n) || n.includes(t)));
  return entry?.[0] === abbr;
}

export function didTeamAWin(result: string | null, teamA: string): boolean | null {
  if (!result) return null;
  const r = result.toLowerCase();
  if (r.includes("no result") || r.includes("tied") || r.includes("draw")) return null;
  return r.includes(teamA.toLowerCase().slice(0, 4));
}
