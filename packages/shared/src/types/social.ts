export type ReferralStatus = "pending" | "credited";

export interface Referral {
  id: string;
  referrerId: string;
  refereeId: string;
  bonusAmount: number;
  status: ReferralStatus;
  createdAt: Date;
}

export type NotificationType =
  | "match_reminder"
  | "score_milestone"
  | "contest_result"
  | "social"
  | "system";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: Date;
}

// Firestore types for real-time data
export interface ChatMessage {
  id: string;
  userId: string;
  content: string;
  type: "text" | "gif" | "card";
  reactions: Record<string, string[]>;
  timestamp: Date;
}

export interface ActivityFeedItem {
  id: string;
  type: "contest_join" | "win" | "prediction" | "milestone" | "referral";
  actorId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface UserPresence {
  online: boolean;
  lastSeen: Date;
  currentScreen: string | null;
}
