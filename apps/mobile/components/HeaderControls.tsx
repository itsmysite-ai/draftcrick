import { XStack, YStack } from "tamagui";
import { Text } from "./SportText";
import { useAuth } from "../providers/AuthProvider";
import { useNotifications } from "../providers/NotificationProvider";
import { useRouter } from "expo-router";

/**
 * HeaderControls — notification bell + profile avatar.
 * Sport dropdown and theme toggle have moved to SubHeader.
 */
export function HeaderControls({ hideNotifications }: { hideNotifications?: boolean } = {}) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const router = useRouter();

  const displayName = user?.displayName || user?.username || "Player";

  // Generate consistent avatar color from display name
  const avatarColor = (() => {
    let h1 = 0, h2 = 0;
    for (let i = 0; i < displayName.length; i++) {
      h1 = ((h1 << 5) - h1) + displayName.charCodeAt(i);
      h1 |= 0;
      h2 = ((h2 << 7) + h2) ^ displayName.charCodeAt(i);
      h2 |= 0;
    }
    const hue = Math.abs(h1) % 360;
    const sat = 45 + (Math.abs(h2) % 40);
    const lit = 35 + (Math.abs(h1 ^ h2) % 25);
    return `hsl(${hue}, ${sat}%, ${lit}%)`;
  })();

  return (
    <XStack alignItems="center" gap="$2">
      {!hideNotifications && (
        <YStack
          pressStyle={{ opacity: 0.7 }}
          onPress={() => router.push("/notifications/inbox" as any)}
          cursor="pointer"
          position="relative"
          testID="header-notifications"
        >
          <Text fontSize={18}>🔔</Text>
          {unreadCount > 0 && (
            <YStack
              position="absolute"
              top={-4}
              right={-6}
              width={16}
              height={16}
              borderRadius={8}
              backgroundColor="$error"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontFamily="$mono" fontSize={9} fontWeight="700" color="white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </YStack>
          )}
        </YStack>
      )}

      {/* Profile avatar */}
      <YStack
        pressStyle={{ opacity: 0.7 }}
        onPress={() => router.push("/(tabs)/profile" as any)}
        cursor="pointer"
        testID="header-profile"
      >
        <YStack
          width={30}
          height={30}
          borderRadius={15}
          alignItems="center"
          justifyContent="center"
          // @ts-ignore — dynamic HSL color
          style={user ? { backgroundColor: avatarColor } : undefined}
          backgroundColor={user ? undefined : "$backgroundSurface"}
          borderWidth={user ? 0 : 1}
          borderColor="$borderColor"
        >
          {user ? (
            <Text fontSize={13} fontWeight="700" color="white">
              {displayName[0]?.toUpperCase() ?? "?"}
            </Text>
          ) : (
            <Text fontSize={13} color="$colorMuted">?</Text>
          )}
        </YStack>
      </YStack>
    </XStack>
  );
}
