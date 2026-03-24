import { ScrollView, Linking, TextInput, Pressable } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import { Card, Button, ModeToggle, AnnouncementBanner, TierBadge, AlertModal, formatUIText, formatBadgeText } from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";
import { useAuth } from "../../providers/AuthProvider";
import { useNotifications } from "../../providers/NotificationProvider";

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
  const { user, setUser, signOut } = useAuth();
  const isLoggedIn = !!user;
  const wallet = trpc.wallet.getBalance.useQuery(undefined, { retry: false, enabled: isLoggedIn });
  const myTier = trpc.subscription.getMyTier.useQuery(undefined, { retry: false, enabled: isLoggedIn });
  const { availableSports } = useTheme();
  const { unreadCount } = useNotifications();
  const prefs = trpc.auth.getPreferences.useQuery(undefined, { retry: false, enabled: isLoggedIn });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation();
  const updateNameMutation = trpc.auth.updateDisplayName.useMutation({
    onSuccess: (data: any) => {
      if (data && !data.ok && data.error) {
        setNameError(data.error);
      } else {
        setNameError(null);
        setIsEditingName(false);
        // Update auth user immediately so avatar color changes
        if (user) {
          setUser({ ...user, displayName: editName.trim(), username: editName.trim() });
        }
        prefs.refetch();
      }
    },
  });

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

  const sportsLabel = availableSports.map((s) => s === "cricket" ? "Cricket" : "F1").join(", ");
  const locationLabel = prefs.data?.country
    ? prefs.data.state
      ? `${prefs.data.state}, ${prefs.data.country}`
      : prefs.data.country
    : undefined;

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top} testID="profile-screen">
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
            {/* Avatar — colored circle with initial */}
            <YStack
              width={72}
              height={72}
              borderRadius={36}
              alignItems="center"
              justifyContent="center"
              marginBottom="$4"
              // @ts-ignore — dynamic HSL color
              style={isLoggedIn ? { backgroundColor: avatarColor } : undefined}
              backgroundColor={isLoggedIn ? undefined : "$backgroundSurface"}
              borderWidth={isLoggedIn ? 0 : 2}
              borderColor="$borderColor"
            >
              {isLoggedIn ? (
                <Text fontSize={28} fontWeight="700" color="white">
                  {displayName[0]?.toUpperCase() ?? "?"}
                </Text>
              ) : (
                <Ionicons name="person-outline" size={24} color={theme.colorMuted?.val} />
              )}
            </YStack>

            {/* Funky name with edit */}
            {isLoggedIn && !isEditingName ? (
              <Pressable
                onPress={() => { setEditName(displayName); setIsEditingName(true); }}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}
              >
                <Text fontFamily="$heading" fontSize={22} color="$color" testID="profile-username">
                  {displayName}
                </Text>
                <Ionicons name="pencil-outline" size={14} color={theme.colorMuted?.val} />
              </Pressable>
            ) : isLoggedIn && isEditingName ? (
              <YStack alignItems="center" marginBottom={4} gap="$1">
                <XStack gap="$2" alignItems="center">
                  <TextInput
                    value={editName}
                    onChangeText={(t) => { setEditName(t); setNameError(null); }}
                    maxLength={30}
                    autoFocus
                    style={{
                      fontSize: 20,
                      fontWeight: "700",
                      color: theme.color?.val,
                      borderBottomWidth: 2,
                      borderBottomColor: nameError ? "#d93025" : theme.accentBackground?.val,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      minWidth: 150,
                      textAlign: "center",
                    }}
                    onSubmitEditing={() => {
                      if (editName.trim().length >= 3) {
                        updateNameMutation.mutate({ displayName: editName.trim() });
                      }
                    }}
                  />
                  <Pressable
                    onPress={() => {
                      if (editName.trim().length >= 3) {
                        updateNameMutation.mutate({ displayName: editName.trim() });
                      }
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={24} color={theme.accentBackground?.val} />
                  </Pressable>
                  <Pressable onPress={() => { setIsEditingName(false); setNameError(null); }}>
                    <Ionicons name="close-circle" size={24} color={theme.colorMuted?.val} />
                  </Pressable>
                </XStack>
                {nameError && (
                  <Text fontFamily="$body" fontSize={12} color="#d93025">
                    {nameError}
                  </Text>
                )}
              </YStack>
            ) : (
              <Text fontFamily="$heading" fontSize={22} color="$color" marginBottom={4} testID="profile-username">
                Guest User
              </Text>
            )}

            <Text fontFamily="$body" fontSize={14} color="$colorSecondary" marginBottom="$5">
              {isLoggedIn
                ? formatUIText("fantasy sports champion in the making")
                : formatUIText("sign in to track your journey")}
            </Text>
            {!isLoggedIn && (
              <Button
                variant="primary"
                size="md"
                onPress={() => router.push("/auth/login")}
                testID="profile-signin-btn"
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
                    {formatUIText("Pop Coins")}
                  </Text>
                  <Text fontFamily="$heading" fontSize={28} color="$accentBackground">
                    {wallet.data.coinBalance.toLocaleString()} PC
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
                  { l: "Earned", v: wallet.data.totalEarned, i: "arrow-up-outline" as const },
                  { l: "Spent", v: wallet.data.totalSpent, i: "arrow-down-outline" as const },
                  { l: "Won", v: wallet.data.totalWon, i: "trending-up" as const },
                ].map((x, i) => (
                  <YStack key={i} flex={1} alignItems="center" gap={3}>
                    <Ionicons name={x.i} size={13} color={theme.colorMuted.val} />
                    <Text fontFamily="$body" fontSize={10} color="$colorMuted">
                      {x.l}
                    </Text>
                    <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
                      {x.v.toLocaleString()}
                    </Text>
                  </YStack>
                ))}
              </XStack>
            </Card>
          </Animated.View>
        )}

        {isLoggedIn && myTier.data && (
          <Animated.View entering={FadeInDown.delay(120).springify()}>
            <Card
              pressable
              onPress={() => router.push("/subscription" as never)}
              marginBottom="$5"
              testID="subscription-card"
            >
              <XStack justifyContent="space-between" alignItems="center">
                <YStack gap="$1">
                  <Text fontFamily="$mono" fontSize={10} color="$colorMuted" letterSpacing={0.5}>
                    {formatBadgeText("subscription")}
                  </Text>
                  <Text fontFamily="$heading" fontSize={18} color="$color">
                    {myTier.data.tier === "basic" ? "Basic Plan" : myTier.data.tier === "pro" ? "Pro Plan" : "Elite Plan"}
                  </Text>
                </YStack>
                <XStack alignItems="center" gap="$3">
                  <TierBadge tier={myTier.data.tier} testID="profile-tier-badge" />
                  <Ionicons name="chevron-forward" size={16} color={theme.colorMuted.val} />
                </XStack>
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
              icon="baseball-outline"
              label={formatUIText("Sports")}
              value={sportsLabel}
              accent
              onPress={() => router.push("/settings/sports" as never)}
            />
            {locationLabel && (
              <SettingRow
                icon="location-outline"
                label={formatUIText("Location")}
                value={locationLabel}
                onPress={() => router.push("/settings/location" as never)}
              />
            )}
            <SettingRow
              icon="wallet-outline"
              label={formatUIText("Wallet")}
              onPress={() => router.push("/wallet" as never)}
            />
            <SettingRow
              icon="diamond-outline"
              label={formatUIText("Subscription")}
              value={myTier.data ? myTier.data.tier.toUpperCase() : undefined}
              accent={myTier.data?.tier !== "basic"}
              onPress={() => router.push("/subscription" as never)}
            />
            <SettingRow
              icon="notifications-outline"
              label={formatUIText("Notifications")}
              value={unreadCount > 0 ? `${unreadCount} new` : "On"}
              onPress={() => router.push("/notifications/inbox" as never)}
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
              { i: "mail-outline" as const, l: "Support", route: null, action: () => Linking.openURL("mailto:support@draftplay.ai?subject=DraftPlay%20Support%20Request") },
              { i: "document-text-outline" as const, l: "Terms", route: "/legal/terms", action: null },
              { i: "shield-checkmark-outline" as const, l: "Privacy", route: "/legal/privacy", action: null },
            ].map((link, idx) => (
              <Card
                key={idx}
                pressable
                flex={1}
                alignItems="center"
                gap="$2"
                onPress={link.action ? link.action : link.route ? () => router.push(link.route as any) : undefined}
                testID={`profile-link-${idx}`}
              >
                <Ionicons name={link.i} size={18} color={theme.colorMuted.val} />
                <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$colorMuted">
                  {link.l}
                </Text>
              </Card>
            ))}
          </XStack>
        </Animated.View>

        {isLoggedIn && (
          <Animated.View entering={FadeInDown.delay(320).springify()}>
            <Button
              variant="secondary"
              size="md"
              onPress={async () => {
                await signOut();
                router.replace("/auth/login");
              }}
              marginTop="$5"
              testID="sign-out-btn"
              iconAfter={
                <Ionicons name="log-out-outline" size={14} color={theme.color.val} />
              }
            >
              {formatUIText("Sign Out")}
            </Button>
          </Animated.View>
        )}

        {isLoggedIn && (
          <Animated.View entering={FadeInDown.delay(360).springify()}>
            <Button
              variant="ghost"
              size="md"
              onPress={() => setShowDeleteModal(true)}
              marginTop="$3"
              testID="delete-account-btn"
            >
              <Text fontFamily="$body" fontSize={13} color="$error">
                {formatUIText("delete account")}
              </Text>
            </Button>
          </Animated.View>
        )}

        <YStack height={120} />
      </ScrollView>

      <AlertModal
        visible={showDeleteModal}
        title="Delete Account"
        message="This permanently deletes your account, teams, and all data. This cannot be undone."
        onDismiss={() => setShowDeleteModal(false)}
        actions={[
          {
            label: "Cancel",
            variant: "ghost",
            onPress: () => setShowDeleteModal(false),
          },
          {
            label: isDeleting ? "Deleting..." : "Delete Forever",
            variant: "danger",
            onPress: async () => {
              setIsDeleting(true);
              try {
                await deleteAccountMutation.mutateAsync();
                await signOut();
                router.replace("/auth/login");
              } catch {
                setShowDeleteModal(false);
              } finally {
                setIsDeleting(false);
              }
            },
          },
        ]}
      />
    </YStack>
  );
}
