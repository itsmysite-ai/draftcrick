import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@draftplay/api";
import { auth } from "./firebase";

export const trpc = createTRPCReact<AppRouter>();

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/trpc";

// Legacy setter kept for backward compatibility with AuthProvider
let _firebaseToken: string | null = null;

export function setTRPCToken(token: string | null) {
  _firebaseToken = token;
}

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: API_URL,
        transformer: superjson,
        async headers() {
          // Get fresh token from Firebase on every request.
          // Firebase SDK caches valid tokens and auto-refreshes expired ones.
          const currentUser = auth.currentUser;
          if (currentUser) {
            const token = await currentUser.getIdToken();
            return { Authorization: `Bearer ${token}` };
          }
          // Fallback to cached token (covers edge case during initial auth)
          if (_firebaseToken) {
            return { Authorization: `Bearer ${_firebaseToken}` };
          }
          return {};
        },
      }),
    ],
  });
}
