import type { Server, Socket } from "socket.io";

/**
 * Live score WebSocket handler.
 * Clients join a match room and receive real-time score updates.
 */
export function registerLiveScoreHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join a match room to receive live score updates
    socket.on("join:match", (matchId: string) => {
      socket.join(`match:${matchId}`);
      console.log(`${socket.id} joined match:${matchId}`);
    });

    // Leave a match room
    socket.on("leave:match", (matchId: string) => {
      socket.leave(`match:${matchId}`);
      console.log(`${socket.id} left match:${matchId}`);
    });

    // Join a contest room (for leaderboard updates)
    socket.on("join:contest", (contestId: string) => {
      socket.join(`contest:${contestId}`);
    });

    socket.on("leave:contest", (contestId: string) => {
      socket.leave(`contest:${contestId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

/**
 * Broadcast a score update to all clients watching a match.
 */
export function broadcastScoreUpdate(
  io: Server,
  matchId: string,
  scoreData: {
    runs: number;
    wickets: number;
    overs: string;
    currentBatsmen: string[];
    currentBowler: string;
    recentBalls: string[];
    lastBall?: { runs: number; wicket: boolean; batsman: string; bowler: string };
  }
) {
  io.to(`match:${matchId}`).emit(`score:${matchId}`, {
    matchId,
    ...scoreData,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast a fantasy points update for a match.
 */
export function broadcastPointsUpdate(
  io: Server,
  matchId: string,
  playerPoints: Record<string, number>
) {
  io.to(`match:${matchId}`).emit(`points:${matchId}`, {
    matchId,
    playerPoints,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast leaderboard update for a contest.
 */
export function broadcastLeaderboardUpdate(
  io: Server,
  contestId: string,
  leaderboard: Array<{ rank: number; userId: string; totalPoints: number }>
) {
  io.to(`contest:${contestId}`).emit(`leaderboard:${contestId}`, {
    contestId,
    leaderboard,
    timestamp: new Date().toISOString(),
  });
}
