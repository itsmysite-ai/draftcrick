/**
 * Returns a human-readable relative time string.
 * e.g., "in 2 hours", "5 minutes ago", "Tomorrow at 3:30 PM"
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60_000);
  const diffHours = Math.round(diffMs / 3_600_000);
  const diffDays = Math.round(diffMs / 86_400_000);

  if (Math.abs(diffMins) < 1) return "just now";

  if (diffMins > 0) {
    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffHours < 24) return `in ${diffHours}h`;
    if (diffDays === 1) return `Tomorrow at ${formatTime(date)}`;
    if (diffDays < 7) return `${getDayName(date)} at ${formatTime(date)}`;
    return formatDate(date);
  }

  const absMins = Math.abs(diffMins);
  const absHours = Math.abs(diffHours);
  const absDays = Math.abs(diffDays);

  if (absMins < 60) return `${absMins}m ago`;
  if (absHours < 24) return `${absHours}h ago`;
  if (absDays === 1) return "Yesterday";
  if (absDays < 7) return `${absDays}d ago`;
  return formatDate(date);
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMatchDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getDayName(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

export function isMatchLocked(startTime: Date): boolean {
  return new Date() >= startTime;
}

export function getTimeUntilLock(startTime: Date): string {
  const diffMs = startTime.getTime() - Date.now();
  if (diffMs <= 0) return "Locked";

  const hours = Math.floor(diffMs / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);

  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
