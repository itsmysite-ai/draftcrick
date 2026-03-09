export type UserRole = "user" | "admin" | "moderator";
export type KycStatus = "pending" | "verified" | "rejected";

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  kycStatus: KycStatus;
  comfortMode: boolean;
  preferredLang: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  userId: string;
  favoriteTeam: string | null;
  bio: string | null;
  winCount: number;
  contestCount: number;
  predictionStreak: number;
  badges: string[];
  referralCode: string;
  referredBy: string | null;
  loginStreak: number;
  lastLoginDate: string | null;
}

export interface Wallet {
  userId: string;
  coinBalance: number;
  totalEarned: number;
  totalSpent: number;
  totalWon: number;
  lastDailyClaimAt: Date | null;
  loginStreak: number;
  updatedAt: Date;
}

export type TransactionType =
  | "daily_claim"
  | "contest_entry"
  | "contest_win"
  | "prediction_win"
  | "referral_bonus"
  | "pack_purchase"
  | "streak_bonus"
  | "achievement";

export type TransactionStatus =
  | "completed"
  | "failed"
  | "reversed";

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  contestId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}
