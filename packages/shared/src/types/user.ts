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
  cashBalance: number;
  bonusBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalWinnings: number;
  updatedAt: Date;
}

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "entry_fee"
  | "winnings"
  | "bonus"
  | "refund"
  | "tds";

export type TransactionStatus =
  | "pending"
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
  gateway: string | null;
  gatewayRef: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}
