import { XStack, YStack } from "tamagui";
import { Alert } from "react-native";
import { Text } from "./SportText";
import { ModeToggle, SportDropdown, SportPrimaryIcon, formatUIText } from "@draftplay/ui";
import { useTheme } from "../providers/ThemeProvider";
import { useAuth } from "../providers/AuthProvider";
import { trpc } from "../lib/trpc";

/**
 * SubHeader — sits below the main header strip.
 * Contains: Daily PC Claim CTA | Sport Switcher | Theme Toggle
 */
export function SubHeader() {
  const { mode, toggleMode, sport, setSport, availableSports, t } = useTheme();
  const { isLoading: authLoading } = useAuth();

  const wallet = trpc.wallet.getBalance.useQuery(undefined, {
    retry: false,
    enabled: !authLoading,
    staleTime: 60_000,
  });

  const claimDaily = trpc.wallet.claimDaily.useMutation({
    onSuccess: (data) => {
      wallet.refetch();
      Alert.alert(
        formatUIText("daily reward claimed!"),
        `+${data.coinsAwarded} PC${data.streakBonus > 0 ? ` (includes +${data.streakBonus} streak bonus)` : ""}\nStreak: ${data.newStreak} day${data.newStreak > 1 ? "s" : ""}`,
      );
    },
    onError: (error) => {
      Alert.alert(formatUIText("already claimed"), error.message);
    },
  });

  const w = wallet.data;
  const canClaim = w?.canClaimDaily ?? false;
  const streak = w?.currentStreak ?? 0;

  const showDropdown = availableSports.length > 1;
  const sportLabel = sport === "cricket" ? "Cricket" : "F1";

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="$5"
      paddingVertical="$2"
      backgroundColor="$background"
    >
      {/* Daily PC Claim */}
      <XStack
        alignItems="center"
        gap="$2"
        paddingHorizontal={10}
        paddingVertical={6}
        borderRadius={8}
        backgroundColor={canClaim ? "$accentBackground" : "$backgroundSurface"}
        pressStyle={{ opacity: 0.7 }}
        onPress={() => {
          if (canClaim && !claimDaily.isPending) {
            claimDaily.mutate();
          }
        }}
        opacity={claimDaily.isPending ? 0.6 : 1}
        cursor={canClaim ? "pointer" : "default"}
        testID="subheader-claim"
      >
        <Text fontSize={13}>💰</Text>
        <Text
          fontFamily="$mono"
          fontSize={11}
          fontWeight="600"
          color={canClaim ? "$accentColor" : "$colorMuted"}
        >
          {claimDaily.isPending
            ? formatUIText("claiming...")
            : canClaim
              ? formatUIText("claim PC")
              : streak > 0
                ? `${streak}d streak ✓`
                : formatUIText("claimed ✓")}
        </Text>
      </XStack>

      <XStack alignItems="center" gap="$2">
        {/* Sport Switcher */}
        {showDropdown ? (
          <SportDropdown
            activeSport={sport}
            onSportChange={(s) => setSport(s as any)}
            accentColor={t.accent}
            textColor={t.text}
            mutedColor={t.textTertiary}
            surfaceColor={t.bgSurface}
            borderColor={t.border}
          />
        ) : (
          <XStack
            alignItems="center"
            gap={5}
            paddingHorizontal={10}
            paddingVertical={5}
            borderRadius={8}
            backgroundColor="$backgroundSurface"
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

        {/* Theme Toggle */}
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>
    </XStack>
  );
}
