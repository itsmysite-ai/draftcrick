import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface LiveScore {
  matchId: string;
  runs: number;
  wickets: number;
  overs: string;
  currentBatsmen: string[];
  currentBowler: string;
  recentBalls: string[];
}

const SOCKET_URL = process.env.EXPO_PUBLIC_WS_URL ?? "http://localhost:3001";

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: false,
    });
  }
  return socket;
}

export function useLiveScore(matchId: string | null) {
  const [score, setScore] = useState<LiveScore | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!matchId) return;

    const s = getSocket();

    s.connect();

    s.on("connect", () => {
      setIsConnected(true);
      s.emit("join:match", matchId);
    });

    s.on("disconnect", () => {
      setIsConnected(false);
    });

    s.on(`score:${matchId}`, (data: LiveScore) => {
      setScore(data);
    });

    return () => {
      s.emit("leave:match", matchId);
      s.off(`score:${matchId}`);
      // Don't disconnect — shared socket
    };
  }, [matchId]);

  return { score, isConnected };
}
