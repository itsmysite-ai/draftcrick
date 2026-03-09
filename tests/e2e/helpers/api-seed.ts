/**
 * API seed helpers — utilities for seeding test data.
 * Used by E2E tests that need pre-existing data (matches, contests, etc.).
 *
 * NOTE: Most data comes from the Gemini AI cache, so seeding is minimal.
 * These helpers are primarily for verifying API responses directly.
 */

const API_BASE = process.env.API_URL ?? "http://localhost:3001";

/**
 * Call a tRPC query endpoint directly (GET request).
 * Returns the parsed JSON result.
 */
export async function trpcQuery<T = unknown>(
  path: string,
  input?: Record<string, unknown>,
): Promise<T> {
  const inputParam = input ? `?input=${encodeURIComponent(JSON.stringify(input))}` : "";
  const url = `${API_BASE}/trpc/${path}${inputParam}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`tRPC ${path} failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.result?.data as T;
}

/**
 * Call a tRPC mutation endpoint directly (POST request).
 * Returns the parsed JSON result.
 */
export async function trpcMutate<T = unknown>(
  path: string,
  input: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const url = `${API_BASE}/trpc/${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`tRPC ${path} mutation failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.result?.data as T;
}
