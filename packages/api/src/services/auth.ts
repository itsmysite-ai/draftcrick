import type { App, ServiceAccount } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";

let firebaseApp: App | null = null;
let firebaseAuth: Auth | null = null;

/**
 * Firebase Admin SDK — lazy-initialized singleton.
 * Used to verify Firebase Auth ID tokens on the API server.
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_PRIVATE_KEY (JSON-escaped PEM)
 *   FIREBASE_CLIENT_EMAIL
 *
 * Or: GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON file.
 */
export async function getFirebaseAuth(): Promise<Auth> {
  if (firebaseAuth) return firebaseAuth;

  // Lazy import to avoid bundling firebase-admin when not needed
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");

  const existing = getApps();
  if (existing.length > 0) {
    firebaseApp = existing[0]!;
  } else {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (projectId && privateKey && clientEmail) {
      firebaseApp = initializeApp({
        credential: cert({ projectId, privateKey, clientEmail } as ServiceAccount),
      });
    } else {
      // Falls back to GOOGLE_APPLICATION_CREDENTIALS or GCE metadata
      firebaseApp = initializeApp();
    }
  }

  firebaseAuth = getAuth(firebaseApp);
  return firebaseAuth;
}

/**
 * Verify a Firebase ID token from Authorization: Bearer <token> header.
 * Returns the decoded token (contains uid, email, etc.) or null.
 */
export async function verifyIdToken(token: string) {
  try {
    const auth = await getFirebaseAuth();
    return await auth.verifyIdToken(token);
  } catch {
    return null;
  }
}

/**
 * Extract Firebase ID token from request headers.
 * Supports: Authorization: Bearer <token>
 */
export function extractBearerToken(headers: Headers): string | null {
  const auth = headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  return null;
}
