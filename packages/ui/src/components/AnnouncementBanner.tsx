import { useState, useEffect, useRef, useCallback } from "react";
import { XStack, YStack, Text, type GetProps } from "tamagui";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

// ─────────────────────────────────────────────────────────────────────────────
// ANNOUNCEMENTS — edit here to update across all screens
// ─────────────────────────────────────────────────────────────────────────────
const ANNOUNCEMENTS = [
  "t20 world cup fantasy is live — draft your dream xi now",
  "auction draft mode: bid on players in real-time",
  "pro tip: diversify picks across roles for higher points",
  "league trades: swap players with friends in your league",
  "coming soon: head-to-head contests with friends",
];

const TYPING_SPEED = 38;       // ms per character
const PAUSE_DURATION = 3200;   // ms to hold the full text
const FLIP_DURATION = 280;     // ms for the railway-station flip transition
// ─────────────────────────────────────────────────────────────────────────────

interface AnnouncementContext {
  matchInfo?: string;       // e.g. "IND vs NZ starts in 2 hours!"
  contestCount?: number;    // e.g. 3 → "you're in 3 contests today!"
  streakDays?: number;      // e.g. 5 → "day 5 streak — keep it up!"
}

interface AnnouncementBannerProps extends Omit<GetProps<typeof YStack>, "children"> {
  context?: AnnouncementContext;
}

/**
 * AnnouncementBanner — railway-station-style announcement strip
 *
 * - Typing effect: text appears character by character
 * - Multiple announcements cycle automatically
 * - Split-flap / departure-board transition between announcements
 *
 * Edit ANNOUNCEMENTS above to update content across every screen.
 */
function buildContextualAnnouncements(ctx?: AnnouncementContext): string[] {
  const msgs: string[] = [];
  if (ctx?.matchInfo) msgs.push(ctx.matchInfo);
  if (ctx?.contestCount && ctx.contestCount > 0) {
    msgs.push(`you're in ${ctx.contestCount} contest${ctx.contestCount > 1 ? "s" : ""} today — good luck!`);
  }
  if (ctx?.streakDays && ctx.streakDays > 0) {
    msgs.push(`day ${ctx.streakDays} streak — keep it up for bonus coins!`);
  }
  return msgs;
}

export function AnnouncementBanner(props: AnnouncementBannerProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [cursorVisible, setCursorVisible] = useState(true);
  const [announcementIndex, setAnnouncementIndex] = useState(0);

  // Reanimated shared values for the flip transition
  const flipY = useSharedValue(0);
  const flipOpacity = useSharedValue(1);

  // Refs for timer cleanup
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (cursorTimer.current) clearInterval(cursorTimer.current);
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
  }, []);

  // Cursor blink
  useEffect(() => {
    cursorTimer.current = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 520);
    return () => {
      if (cursorTimer.current) clearInterval(cursorTimer.current);
    };
  }, []);

  // Build combined announcement list: contextual first, then static
  const contextMsgs = buildContextualAnnouncements(props.context);
  const allAnnouncements = contextMsgs.length > 0
    ? [...contextMsgs, ...ANNOUNCEMENTS]
    : ANNOUNCEMENTS;

  // Typing + cycling logic
  useEffect(() => {
    const text = allAnnouncements[announcementIndex % allAnnouncements.length] ?? "";
    let charIndex = 0;
    setDisplayedText("");

    const typeNext = () => {
      if (charIndex <= text.length) {
        setDisplayedText(text.slice(0, charIndex));
        charIndex++;
        typingTimer.current = setTimeout(typeNext, TYPING_SPEED);
      } else {
        // Typing done — pause, then flip to next
        pauseTimer.current = setTimeout(() => {
          triggerFlip();
        }, PAUSE_DURATION);
      }
    };

    typeNext();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcementIndex, clearTimers]);

  // Railway-station flip transition
  const triggerFlip = () => {
    // Slide up + fade out (old text departing)
    flipY.value = withSequence(
      withTiming(-18, { duration: FLIP_DURATION, easing: Easing.in(Easing.cubic) }),
      // snap back to entry position
      withTiming(18, { duration: 0 }),
      // Slide up into place (new text arriving)
      withTiming(0, { duration: FLIP_DURATION, easing: Easing.out(Easing.cubic) }),
    );

    flipOpacity.value = withSequence(
      // Fade out
      withTiming(0, { duration: FLIP_DURATION, easing: Easing.in(Easing.quad) }),
      // Stay invisible at snap
      withTiming(0, { duration: 0 }),
      // Fade in
      withTiming(1, { duration: FLIP_DURATION, easing: Easing.out(Easing.quad) }),
    );

    // Advance index at the midpoint of the flip
    setTimeout(() => {
      setAnnouncementIndex((i) => (i + 1) % allAnnouncements.length);
    }, FLIP_DURATION);
  };

  const animatedTextStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: flipY.value }],
    opacity: flipOpacity.value,
  }));

  return (
    <YStack
      marginHorizontal="$4"
      marginVertical="$3"
      backgroundColor="$backgroundSurface"
      borderRadius="$3"
      paddingVertical="$2"
      paddingHorizontal="$4"
      overflow="hidden"
      {...props}
    >
      <XStack alignItems="center" gap="$3" height={18}>
        <YStack width={3} height={14} borderRadius={2} backgroundColor="$accentBackground" />
        <Animated.View style={[{ flex: 1 }, animatedTextStyle]}>
          <Text
            fontFamily="$mono"
            fontSize={11}
            color="$colorSecondary"
            letterSpacing={-0.2}
            numberOfLines={1}
          >
            {displayedText}
            <Text
              fontFamily="$mono"
              fontSize={11}
              color="$accentBackground"
              opacity={cursorVisible ? 1 : 0}
            >
              {"▎"}
            </Text>
          </Text>
        </Animated.View>
      </XStack>
    </YStack>
  );
}
