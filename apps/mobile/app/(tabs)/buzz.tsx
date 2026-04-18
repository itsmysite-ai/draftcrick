import { useState, useEffect, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable, KeyboardAvoidingView, Platform, Keyboard } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import { Card, formatUIText, formatBadgeText, formatTeamName, DraftPlayLogo, Badge } from "@draftplay/ui";
import { HeaderControls } from "../../components/HeaderControls";
import { SubHeader } from "../../components/SubHeader";
import { ChatRoom, RoomPickerSheet, type BuzzRoom } from "../../components/chat";
import { trpc } from "../../lib/trpc";

// Tab bar height (pill bar + outer padding)
const TAB_BAR_HEIGHT = 70;
const STICKY_ROOM_KEY = "draftplay.buzz.lastRoomId";

/**
 * Server returns match-room names as "Gujarat Titans vs Kolkata Knight
 * Riders" — far too wide for a chat header. Convert each side via the
 * design-system formatTeamName helper so we display "GT vs KKR".
 */
function abbreviateMatchRoom(name: string): string {
  const parts = name.split(/\s+vs\s+/i);
  if (parts.length !== 2) return name;
  return `${formatTeamName(parts[0]!)} vs ${formatTeamName(parts[1]!)}`;
}

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

  // Server's getActiveRooms already includes the general room at the
  // head of its response. Previously we were prepending our own
  // hardcoded general entry AND re-typing every server room as a match
  // — which produced two "general" rows in the picker (one hardcoded,
  // one from the server mistyped) and also caused the live-match
  // banner to say "general LIVE" because it picked up the server's
  // general row treated as the first match room.
  const allRooms: BuzzRoom[] = useMemo(() => {
    const fromServer = rooms ?? [];
    const mapped = fromServer.map(
      (r: any): BuzzRoom => ({
        id: r.id ?? null,
        name: r.type === "match" ? abbreviateMatchRoom(r.name) : r.name,
        type: r.type === "match" ? "match" : "general",
      })
    );
    // Fallback: if the server hasn't responded yet, make sure we at
    // least have the general room so the picker never renders empty.
    if (mapped.length === 0) {
      return [{ id: null, name: "general", type: "general" }];
    }
    return mapped;
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
    const exists = rooms.some((r: any) => r.id === activeRoom);
    if (!exists) setActiveRoom(null);
  }, [rooms, activeRoom]);

  // Live match banner — show in general room when at least one actual
  // match room exists, suggesting the user opt in. Explicitly find the
  // first room of type "match" — rooms[0] is the general room from the
  // server, which would have made the banner say "general LIVE".
  const liveMatchRoom = useMemo(() => {
    if (activeRoom !== null) return null;
    if (!rooms || rooms.length === 0) return null;
    return (rooms as any[]).find((r) => r.type === "match") ?? null;
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

        {/* Room switcher — single chip showing active room. Tap → picker sheet.
            When the active room is a live match, a subtle red dot inline next
            to the room name signals you're in a live conversation. */}
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
                <XStack alignItems="center" gap="$2">
                  <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color" numberOfLines={1} flexShrink={1}>
                    {activeRoomMeta.type === "general" ? "general" : activeRoomMeta.name}
                  </Text>
                  {activeRoomMeta.type === "match" && (
                    <Badge variant="live" size="sm">
                      {formatBadgeText("live")}
                    </Badge>
                  )}
                </XStack>
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
              room is active. The LIVE badge sits *next to* the match name
              so it's unambiguous which thing is live (the match below,
              not the general room above). */}
          {liveMatchRoom && (
            <Pressable onPress={() => setActiveRoom(liveMatchRoom.id)} style={{ marginTop: 8 }}>
              <Card
                padding="$3"
                borderColor="$accentBackground"
                borderWidth={1}
              >
                <XStack alignItems="center" gap="$2">
                  <Text fontSize={16}>🏏</Text>
                  <YStack flex={1}>
                    <XStack alignItems="center" gap="$2">
                      <Text fontFamily="$body" fontWeight="700" fontSize={13} color="$color" numberOfLines={1} flexShrink={1}>
                        {abbreviateMatchRoom(liveMatchRoom.name)}
                      </Text>
                      <Badge variant="live" size="sm">
                        {formatBadgeText("live")}
                      </Badge>
                    </XStack>
                    <Text fontFamily="$body" fontSize={11} color="$colorMuted" marginTop={1}>
                      {formatUIText("tap to join the match chat")}
                    </Text>
                  </YStack>
                  <Text fontFamily="$mono" fontSize={16} color="$accentBackground">
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
