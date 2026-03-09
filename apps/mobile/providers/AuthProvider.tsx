import React, { createContext, useContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { setTRPCToken } from "../lib/trpc";

interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  email: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  firebaseToken: string | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  firebaseToken: null,
  error: null,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

/**
 * AuthProvider wraps the app with Firebase Auth state.
 *
 * Firebase Auth handles sign-in (email/password, Google, Apple, Phone OTP).
 * The Firebase ID token is sent to our API server via Authorization: Bearer <token>.
 * The API server verifies the token with firebase-admin and extracts the user.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [firebaseToken, setFirebaseToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setFirebaseToken(token);
        setTRPCToken(token);
        setUser({
          id: firebaseUser.uid,
          username: firebaseUser.displayName ?? firebaseUser.email?.split("@")[0] ?? "",
          displayName: firebaseUser.displayName ?? "",
          avatarUrl: firebaseUser.photoURL,
          role: "user",
          email: firebaseUser.email,
        });
      } else {
        setFirebaseToken(null);
        setTRPCToken(null);
        setUser(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setError(e.message ?? "Sign in failed");
      throw e;
    }
  };

  const signUp = async (email: string, password: string) => {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Set token immediately so tRPC calls right after signUp work
      const token = await cred.user.getIdToken();
      setFirebaseToken(token);
      setTRPCToken(token);
    } catch (e: any) {
      setError(e.message ?? "Sign up failed");
      throw e;
    }
  };

  const handleSignOut = async () => {
    setError(null);
    try {
      await auth.signOut();
    } catch (e: any) {
      setError(e.message ?? "Sign out failed");
      throw e;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, firebaseToken, error, signIn, signUp, signOut: handleSignOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
