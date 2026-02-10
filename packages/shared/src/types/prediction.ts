export type PredictionType =
  | "winner"
  | "margin"
  | "top_scorer"
  | "top_bowler"
  | "toss";

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  predictionType: PredictionType;
  predictionValue: string;
  isCorrect: boolean | null;
  pointsEarned: number;
  createdAt: Date;
}
