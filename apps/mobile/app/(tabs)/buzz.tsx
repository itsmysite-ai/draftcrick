import { useState, useEffect, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable, KeyboardAvoidingView, Platform, Keyboard } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import { Card, formatUIText, formatBadgeText, DraftPlayLogo, Badge } from "@draftplay/ui";
import { HeaderControls } from "../../components/HeaderControls";
import { SubHeader } from "../../components/SubHeader";
import { ChatRoom, RoomPickerSheet, type BuzzRoom } from "../../components/chat";
import { trpc } from "../../lib/trpc";

// Tab bar height (pill bar + outer padding)
const TAB_BAR_HEIGHT = 70;
const STICKY_ROOM_KEY = "draftplay.buzz.lastRoomId";

export default function BuzzScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [stickyHydrated, setStickyHydrated] = useState(false);

  const { data: rooms } = trpc.chat.getActiveRooms.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // Always include the general room (id: null) as the first option,
  // followed by any active match rooms returned from the server.
  const allRooms: BuzzRoom[] = useMemo(() => {
    const base: BuzzRoom = { id: null, name: "general", type: "general" };
    const matchRooms = (rooms ?? []).map(
      (r): BuzzRoom => ({ id: r.id, name: r.name, type: "match" })
    );
    return [base, ...matchRooms];
  }, [rooms]);

  const activeRoomMeta = useMemo(
    () => allRooms.find((r) => r.id === activeRoom) ?? allRooms[0]!,
    [allRooms, activeRoom]
  );

  // Sticky room — restore last selection on first mount; once a server
  // room list arrives, validate that the sticky room still exists, fall
  // back to general if not.
  useEffect(() => {
    AsyncStorage.getItem(STICKY_ROOM_KEY)
      .then((stored) => {
        if (stored !== null) setActiveRoom(stored === "__general__" ? null : stored);
      })
      .finally(() => setStickyHydrated(true));
  }, []);

  useEffect(() => {
    if (!stickyHydrated) return;
    if (activeRoom === null) {
      AsyncStorage.setItem(STICKY_ROOM_KEY, "__general__");
    } else {
      AsyncStorage.setItem(STICKY_ROOM_KEY, activeRoom);
    }
  }, [activeRoom, stickyHydrated]);

  // If the sticky room has gone away (match concluded), fall back to general.
  useEffect(() => {
    if (!rooms || activeRoom === null) return;
    const exists = rooms.some((r) => r.id === activeRoom);
    if (!exists) setActiveRoom(null);
  }, [rooms, activeRoom]);

  // Live match banner — show in general room when at least one match is
  // chatting, suggesting the user opt in.
  const liveMatchRoom = useMemo(() => {
    if (activeRoom !== null) return null;
    if (!rooms || rooms.length === 0) return null;
    return rooms[0] ?? null;
  }, [activeRoom, rooms]);

  const tabBarOffset = TAB_BAR_HEIGHT + Math.max(insets.bottom, 8);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s1 = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const s2 = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { s1.remove(); s2.remove(); };
  }, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background.val }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <YStack flex={1} paddingTop={insets.top}>
        {/* Header */}
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$3"
          alignItems="center"
          justifyContent="space-between"
        >
          <XStack alignItems="center" gap="$2">
            <DraftPlayLogo size={24} />
            <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color">
              {formatUIText("buzz")}
            </Text>
          </XStack>
          <HeaderControls />
        </XStack>

        <SubHeader />

        {/* Room switcher — single chip showing active room. Tap → picker sheet. */}
        <YStack paddingHorizontal="$4" marginBottom="$3">
          <Pressable onPress={() => setPickerOpen(true)}>
            <XStack
              backgroundColor="$backgroundSurface"
              borderWidth={1}
              borderColor="$borderColor"
              borderRadius={12}
              paddingHorizontal="$3"
              paddingVertical="$3"
              alignItems="center"
              gap="$2"
            >
              <Text fontSize={20}>
                {activeRoomMeta.type === "general" ? "💬" : "🏏"}
              </Text>
              <YStack flex={1}>
                <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color" numberOfLines={1}>
                  {activeRoomMeta.type === "general" ? "general" : activeRoomMeta.name}
                </Text>
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted" marginTop={1}>
                  {activeRoomMeta.type === "general"
                    ? formatUIText("league-wide chat")
                    : formatUIText("match chat")}
                </Text>
              </YStack>
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                {formatBadgeText("change")} ▾
              </Text>
            </XStack>
          </Pressable>

          {/* Live match banner — only visible when in general AND a match
              room is active. Lets users opt-in to match-specific chat without
              auto-redirecting them. */}
          {liveMatchRoom && (
            <Pressable onPress={() => setActiveRoom(liveMatchRoom.id)} style={{ marginTop: 8 }}>
              <Card
                padding="$3"
                borderColor="$accentBackground"
                borderWidth={1}
              >
                <XStack alignItems="center" gap="$2">
                  <Badge variant="live" size="sm">
                    {formatBadgeText("live")}
                  </Badge>
                  <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" flex={1} numberOfLines={1}>
                    {liveMatchRoom.name} — {formatUIText("join the chat")}
                  </Text>
                  <Text fontFamily="$mono" fontSize={12} color="$accentBackground">
                    →
                  </Text>
                </XStack>
              </Card>
            </Pressable>
          )}
        </YStack>

        {/* Chat room — skipKeyboard since KAV wraps entire screen */}
        <YStack flex={1} paddingBottom={keyboardVisible ? 0 : tabBarOffset}>
          <ChatRoom matchId={activeRoom} skipKeyboard />
        </YStack>
      </YStack>

      <RoomPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        rooms={allRooms}
        activeRoomId={activeRoom}
        onSelect={setActiveRoom}
      />
    </KeyboardAvoidingView>
  );
}
