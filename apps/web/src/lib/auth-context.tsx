"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "./firebase";

type AdminRole = "admin" | "support" | null;

interface AuthContextType {
  user: FirebaseUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  /** The user's staff role: "admin", "support", or null */
  staffRole: AdminRole;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAdmin: false,
  staffRole: null,
  token: null,
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staffRole, setStaffRole] = useState<AdminRole>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        setToken(idToken);
        // Check admin/support claim from token (set by server)
        const tokenResult = await firebaseUser.getIdTokenResult();
        const role = tokenResult.claims.role as string | undefined;
        const hasAdmin = tokenResult.claims.admin === true || role === "admin";
        const hasSupport = role === "support";
        setIsAdmin(hasAdmin || hasSupport); // both can access admin panel
        setStaffRole(hasAdmin ? "admin" : hasSupport ? "support" : null);
      } else {
        setToken(null);
        setIsAdmin(false);
        setStaffRole(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const handleSignInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleSignOut = async () => {
    await auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin, staffRole, token, signIn, signInWithGoogle: handleSignInWithGoogle, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
