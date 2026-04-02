import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator, initializeAuth, inMemoryPersistence } from "firebase/auth";

const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-draftplay.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "demo-draftplay",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;

// Use getAuth which auto-selects persistence per platform
let auth: ReturnType<typeof getAuth>;
try {
  auth = getAuth(app);
} catch {
  auth = initializeAuth(app, { persistence: inMemoryPersistence });
}

if (emulatorHost) {
  try {
    connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
  } catch {
    // Already connected — ignore
  }
}

export { auth };
