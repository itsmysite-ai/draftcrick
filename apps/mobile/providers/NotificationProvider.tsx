/**
 * NotificationProvider — L3
 *
 * Handles push notification lifecycle:
 * - Request permissions after auth
 * - Register Expo push token with backend
 * - Handle foreground notifications
 * - Handle notification tap → navigate to relevant screen
 * - Clean up token on logout
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { Platform, AppState } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "./AuthProvider";
import { trpc } from "../lib/trpc";

interface NotificationContextType {
  expoPushToken: string | null;
  hasPermission: boolean;
  unreadCount: number;
  requestPermission: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  hasPermission: false,
  unreadCount: 0,
  requestPermission: async () => false,
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const notificationListenerRef = useRef<any>(null);
  const responseListenerRef = useRef<any>(null);

  // Unread count from backend
  const unreadQuery = trpc.notification.getUnreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 5_000, // refresh every 5 seconds
  });
  const unreadCount = unreadQuery.data?.count ?? 0;

  const registerMutation = trpc.notification.registerToken.useMutation();
  const removeMutation = trpc.notification.removeToken.useMutation();

  const requestPermission = useCallback(async (): Promise<boolean> => {
    // Only request on real devices, not web or simulators
    if (Platform.OS === "web") return false;

    try {
      const Notifications = await import("expo-notifications");
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        setHasPermission(false);
        return false;
      }

      setHasPermission(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Register push token when user signs in
  useEffect(() => {
    if (!user || Platform.OS === "web") return;

    let cancelled = false;

    async function setupNotifications() {
      try {
        const Notifications = await import("expo-notifications");

        // Set up Android channels
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("deadlines", {
            name: "Match Deadlines",
            importance: Notifications.AndroidImportance.HIGH,
            sound: "default",
          });
          await Notifications.setNotificationChannelAsync("scores", {
            name: "Score Updates",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
          await Notifications.setNotificationChannelAsync("alerts", {
            name: "Player & Rank Alerts",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        // Configure foreground notification behavior
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        // Request permission
        const granted = await requestPermission();
        if (!granted || cancelled) return;

        // Get Expo push token
        const Constants = await import("expo-constants");
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.default.expoConfig?.extra?.eas?.projectId,
        });
        const token = tokenData.data;

        if (cancelled) return;
        setExpoPushToken(token);

        // Register with backend
        registerMutation.mutate({
          token,
          platform: Platform.OS as "ios" | "android",
        });

        // Listen for notification taps
        responseListenerRef.current =
          Notifications.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data;
            if (!data?.type) return;

            switch (data.type) {
              case "deadline_reminder":
              case "urgent_deadline":
                if (data.matchId) router.push(`/match/${data.matchId}` as never);
                else router.push("/notifications/inbox" as never);
                break;
              case "score_update":
                if (data.contestId) router.push(`/contest/${data.contestId}` as never);
                else router.push("/notifications/inbox" as never);
                break;
              case "status_alert":
              case "rank_change":
              default:
                router.push("/notifications/inbox" as never);
                break;
            }
          });
      } catch {
        // Silently handle — notifications are non-critical
      }
    }

    setupNotifications();

    return () => {
      cancelled = true;
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
        responseListenerRef.current = null;
      }
    };
  }, [user]);

  // Clean up token on logout
  useEffect(() => {
    if (!user && expoPushToken) {
      removeMutation.mutate({ token: expoPushToken });
      setExpoPushToken(null);
      setHasPermission(false);
    }
  }, [user]);

  return (
    <NotificationContext.Provider
      value={{ expoPushToken, hasPermission, unreadCount, requestPermission }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
