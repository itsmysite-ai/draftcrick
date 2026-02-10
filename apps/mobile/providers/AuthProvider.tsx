import React, { createContext, useContext, useState, useEffect } from "react";

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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  firebaseToken: null,
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

  useEffect(() => {
    // Firebase Auth onAuthStateChanged listener will be wired here.
    // When Firebase Auth SDK is configured:
    //   import { getAuth, onAuthStateChanged } from "firebase/auth";
    //   const auth = getAuth();
    //   const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    //     if (firebaseUser) {
    //       const token = await firebaseUser.getIdToken();
    //       setFirebaseToken(token);
    //       setUser({ id: firebaseUser.uid, ... });
    //     } else {
    //       setFirebaseToken(null);
    //       setUser(null);
    //     }
    //     setIsLoading(false);
    //   });
    //   return unsubscribe;
    setIsLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    // Firebase Auth signInWithEmailAndPassword will be wired here.
    // import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
    // const auth = getAuth();
    // await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged listener above handles state update.
    setUser(null);
  };

  const signUp = async (email: string, password: string) => {
    // Firebase Auth createUserWithEmailAndPassword will be wired here.
    // import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
    // const auth = getAuth();
    // await createUserWithEmailAndPassword(auth, email, password);
    // Then call tRPC syncUser to create PostgreSQL record.
    setUser(null);
  };

  const signOut = async () => {
    // Firebase Auth signOut will be wired here.
    // import { getAuth } from "firebase/auth";
    // await getAuth().signOut();
    setFirebaseToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, firebaseToken, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
