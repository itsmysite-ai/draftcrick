import React, { createContext, useContext, useState, useEffect } from "react";
import { Platform } from "react-native";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
} from "firebase/auth";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { auth } from "../lib/firebase";
import { setTRPCToken } from "../lib/trpc";

// Required for expo-auth-session to handle the redirect on native
if (Platform.OS !== "web") {
  WebBrowser.maybeCompleteAuthSession();
}

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

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
  setUser: (user: AuthUser | null) => void;
  isLoading: boolean;
  firebaseToken: string | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  isLoading: true,
  firebaseToken: null,
  error: null,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

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
      const token = await cred.user.getIdToken();
      setFirebaseToken(token);
      setTRPCToken(token);
    } catch (e: any) {
      setError(e.message ?? "Sign up failed");
      throw e;
    }
  };

  const handleSignInWithGoogle = async () => {
    setError(null);
    try {
      if (Platform.OS === "web") {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const token = await result.user.getIdToken();
        setFirebaseToken(token);
        setTRPCToken(token);
      } else {
        // Native: OAuth via expo-auth-session with Expo proxy for stable HTTPS redirect
        const proxyRedirectUri = "https://auth.expo.io/@chandan.social.7/draftplay";
        const discovery = {
          authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
          tokenEndpoint: "https://oauth2.googleapis.com/token",
        };

        const request = new AuthSession.AuthRequest({
          clientId: GOOGLE_WEB_CLIENT_ID || "",
          redirectUri: proxyRedirectUri,
          scopes: ["openid", "profile", "email"],
          responseType: AuthSession.ResponseType.IdToken,
          usePKCE: false,
          extraParams: { nonce: Math.random().toString(36).substring(7) },
        });

        const result = await request.promptAsync(discovery);

        if (result.type === "success" && result.params?.id_token) {
          const credential = GoogleAuthProvider.credential(result.params.id_token);
          const fbResult = await signInWithCredential(auth, credential);
          const token = await fbResult.user.getIdToken();
          setFirebaseToken(token);
          setTRPCToken(token);
        } else if (result.type === "error") {
          throw new Error(result.error?.message ?? "Google sign in failed");
        }
      }
    } catch (e: any) {
      setError(e.message ?? "Google sign in failed");
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
      value={{ user, setUser, isLoading, firebaseToken, error, signIn, signUp, signInWithGoogle: handleSignInWithGoogle, signOut: handleSignOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
