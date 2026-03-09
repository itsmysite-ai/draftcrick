import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator, initializeAuth, browserLocalPersistence } from "firebase/auth";

const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-draftplay.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "demo-draftplay",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// When using the emulator, initialize auth with emulator connection before any validation
let auth: ReturnType<typeof getAuth>;
if (emulatorHost) {
  try {
    // initializeAuth throws if auth is already initialized (e.g. hot reload)
    auth = initializeAuth(app, { persistence: browserLocalPersistence });
  } catch {
    auth = getAuth(app);
  }
  // connectAuthEmulator is idempotent — safe to call again on hot reload
  try {
    connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
  } catch {
    // Already connected — ignore
  }
} else {
  auth = getAuth(app);
}

export { auth };
