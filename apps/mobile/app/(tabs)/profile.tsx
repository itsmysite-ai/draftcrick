import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Card, Button, ModeToggle, AnnouncementBanner, formatUIText } from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";

function SettingRow({
  icon,
  label,
  value,
  accent,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  accent?: boolean;
  onPress?: () => void;
  last?: boolean;
}) {
  const theme = useTamaguiTheme();

  return (
    <XStack
      onPress={onPress}
      justifyContent="space-between"
      alignItems="center"
      paddingHorizontal="$4"
      paddingVertical="$3"
      borderBottomWidth={last ? 0 : 1}
      borderBottomColor="$borderColor"
      cursor={onPress ? "pointer" : undefined}
      hoverStyle={onPress ? { backgroundColor: "$backgroundSurfaceHover" } : undefined}
      pressStyle={onPress ? { backgroundColor: "$backgroundPress" } : undefined}
    >
      <XStack alignItems="center" gap="$3">
        <YStack
          width={30}
          height={30}
          borderRadius="$1"
          alignItems="center"
          justifyContent="center"
          backgroundColor={accent ? "$colorAccentLight" : "$backgroundHover"}
        >
          <Ionicons
            name={icon}
            size={15}
            color={accent ? theme.accentBackground.val : theme.colorMuted.val}
          />
        </YStack>
        <Text fontFamily="$body" fontSize={14} color="$color">
          {label}
        </Text>
      </XStack>
      <XStack alignItems="center" gap="$2">
        {value && (
          <Text
            fontFamily="$body"
            fontSize={12}
            color={accent ? "$accentBackground" : "$colorMuted"}
          >
            {value}
          </Text>
        )}
        {onPress && (
          <Ionicons name="chevron-forward" size={14} color={theme.colorMuted.val} />
        )}
      </XStack>
    </XStack>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode, toggleMode } = useTheme();
  const theme = useTamaguiTheme();
  const wallet = trpc.wallet.getBalance.useQuery(undefined, { retry: false });
  const isLoggedIn = !wallet.error;

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.delay(30)}>
          <YStack
            alignItems="center"
            paddingVertical="$8"
            marginBottom="$3"
          >
            <YStack
              width={72}
              height={72}
              borderRadius={36}
              borderWidth={2}
              borderColor="$borderColor"
              backgroundColor="$backgroundSurface"
              alignItems="center"
              justifyContent="center"
              marginBottom="$4"
            >
              <Ionicons
                name={isLoggedIn ? "person" : "person-outline"}
                size={24}
                color={isLoggedIn ? theme.accentBackground.val : theme.colorMuted.val}
              />
            </YStack>
            <Text fontFamily="$heading" fontSize={22} color="$color" marginBottom={4}>
              {isLoggedIn ? "Player" : "Guest User"}
            </Text>
            <Text fontFamily="$body" fontSize={14} color="$colorSecondary" marginBottom="$5">
              {isLoggedIn
                ? formatUIText("Fantasy cricket champion in the making")
                : formatUIText("Sign in to track your journey")}
            </Text>
            {!isLoggedIn && (
              <Button
                variant="primary"
                size="md"
                onPress={() => router.push("/auth/login")}
                iconAfter={
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={theme.accentColor.val}
                  />
                }
              >
                {formatUIText("Sign In")}
              </Button>
            )}
          </YStack>
        </Animated.View>

        <AnnouncementBanner marginHorizontal={0} />

        {isLoggedIn && wallet.data && (
          <Animated.View entering={FadeInDown.delay(80).springify()}>
            <Card
              pressable
              onPress={() => router.push("/wallet" as never)}
              marginBottom="$5"
            >
              <XStack
                justifyContent="space-between"
                alignItems="flex-start"
                marginBottom="$4"
              >
                <YStack>
                  <Text
                    fontFamily="$mono"
                    fontSize={10}
                    color="$colorMuted"
                    letterSpacing={0.5}
                    marginBottom={4}
                  >
                    {formatUIText("Total Balance")}
                  </Text>
                  <Text fontFamily="$heading" fontSize={28} color="$accentBackground">
                    ₹{wallet.data.totalBalance.toFixed(2)}
                  </Text>
                </YStack>
                <YStack
                  width={36}
                  height={36}
                  borderRadius="$2"
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor="$colorAccentLight"
                >
                  <Ionicons
                    name="wallet-outline"
                    size={18}
                    color={theme.accentBackground.val}
                  />
                </YStack>
              </XStack>
              <XStack
                borderTopWidth={1}
                borderTopColor="$borderColor"
                paddingTop="$3"
                gap="$3"
              >
                {[
                  { l: "Cash", v: wallet.data.cashBalance, i: "cash-outline" as const },
                  { l: "Bonus", v: wallet.data.bonusBalance, i: "gift-outline" as const },
                  { l: "Winnings", v: wallet.data.totalWinnings, i: "trending-up" as const },
                ].map((x, i) => (
                  <YStack key={i} flex={1} alignItems="center" gap={3}>
                    <Ionicons name={x.i} size={13} color={theme.colorMuted.val} />
                    <Text fontFamily="$body" fontSize={10} color="$colorMuted">
                      {x.l}
                    </Text>
                    <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
                      ₹{x.v.toFixed(0)}
                    </Text>
                  </YStack>
                ))}
              </XStack>
            </Card>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(160).springify()}>
          <Card padding={0} overflow="hidden" marginBottom="$5">
            <Text
              fontFamily="$mono"
              fontWeight="600"
              fontSize={10}
              letterSpacing={0.5}
              color="$colorMuted"
              paddingHorizontal="$4"
              paddingTop="$4"
              paddingBottom="$2"
            >
              {formatUIText("Settings")}
            </Text>
            <SettingRow icon="language-outline" label={formatUIText("Language")} value="English" />
            <SettingRow
              icon="wallet-outline"
              label={formatUIText("Wallet")}
              onPress={() => router.push("/wallet" as never)}
            />
            <SettingRow
              icon="notifications-outline"
              label={formatUIText("Notifications")}
              value="On"
              onPress={() => {}}
            />
            <XStack
              justifyContent="space-between"
              alignItems="center"
              paddingHorizontal="$4"
              paddingVertical="$3"
              borderBottomWidth={1}
              borderBottomColor="$borderColor"
            >
              <XStack alignItems="center" gap="$3">
                <YStack
                  width={30}
                  height={30}
                  borderRadius="$1"
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor="$backgroundHover"
                >
                  <Ionicons
                    name="moon-outline"
                    size={15}
                    color={theme.colorMuted.val}
                  />
                </YStack>
                <Text fontFamily="$body" fontSize={14} color="$color">
                  {formatUIText("Theme")}
                </Text>
              </XStack>
              <ModeToggle mode={mode} onToggle={toggleMode} />
            </XStack>
            <SettingRow
              icon="information-circle-outline"
              label={formatUIText("App Version")}
              value="0.0.1"
              last
            />
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).springify()}>
          <XStack gap="$3">
            {[
              { i: "help-circle-outline" as const, l: "Help & FAQ" },
              { i: "document-text-outline" as const, l: "Terms" },
              { i: "shield-checkmark-outline" as const, l: "Privacy" },
            ].map((link, idx) => (
              <Card key={idx} pressable flex={1} alignItems="center" gap="$2">
                <Ionicons name={link.i} size={18} color={theme.colorMuted.val} />
                <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$colorMuted">
                  {link.l}
                </Text>
              </Card>
            ))}
          </XStack>
        </Animated.View>

        <YStack height={120} />
      </ScrollView>
    </YStack>
  );
}
