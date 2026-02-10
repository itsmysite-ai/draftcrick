import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@draftcrick/api";

export const trpc = createTRPCReact<AppRouter>();

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/trpc";

export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: API_URL,
        transformer: superjson,
      }),
    ],
  });
}
