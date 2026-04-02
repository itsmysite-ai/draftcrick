import { XStack, YStack } from "tamagui";
import { SportDropdown, ModeToggle, SportPrimaryIcon } from "@draftplay/ui";
import { Text } from "./SportText";
import { useTheme } from "../providers/ThemeProvider";
import { useNotifications } from "../providers/NotificationProvider";
import { useRouter } from "expo-router";

/**
 * HeaderControls — self-contained sport dropdown + notification bell + theme toggle.
 * Uses ThemeProvider hooks internally so screens just render <HeaderControls />.
 * Sport dropdown sits to the left of the notification bell and light/dark toggle.
 * Pass hideSport to show only the theme toggle (e.g. onboarding).
 * Pass hideNotifications to hide the bell (e.g. on the inbox screen itself).
 *
 * If the user selected only 1 sport, shows a static sport badge instead of a dropdown.
 * If the user selected 2 sports, shows the normal dropdown.
 */
export function HeaderControls({ hideSport, hideNotifications }: { hideSport?: boolean; hideNotifications?: boolean } = {}) {
  const { mode, toggleMode, sport, setSport, availableSports, t } = useTheme();
  const { unreadCount } = useNotifications();
  const router = useRouter();

  // TODO: Re-enable when F1 or other sports are implemented
  // const showDropdown = !hideSport && availableSports.length > 1;
  // const showStaticBadge = !hideSport && availableSports.length === 1;
  const showDropdown = false;
  const showStaticBadge = false;
  const sportLabel = sport === "cricket" ? "Cricket" : "F1";

  return (
    <XStack alignItems="center" gap="$2">
      {showDropdown && (
        <SportDropdown
          activeSport={sport}
          onSportChange={(s) => setSport(s as any)}
          accentColor={t.accent}
          textColor={t.text}
          mutedColor={t.textTertiary}
          surfaceColor={t.bgSurface}
          borderColor={t.border}
        />
      )}
      {showStaticBadge && (
        <XStack
          alignItems="center"
          gap={5}
          paddingHorizontal={10}
          paddingVertical={5}
          borderRadius={8}
          backgroundColor={"$backgroundSurfaceAlt" as any}
        >
          <SportPrimaryIcon sport={sport} size={13} color={t.accent} />
          <Text
            fontFamily="$mono"
            fontSize={11}
            fontWeight="600"
            color="$color"
            textTransform="uppercase"
            letterSpacing={0.3}
          >
            {sportLabel}
          </Text>
        </XStack>
      )}
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
      <ModeToggle mode={mode} onToggle={toggleMode} />
    </XStack>
  );
}
