import { View, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useEffect, useMemo } from "react";
import { Platform } from "react-native";
import { Gradients, Radius, FontFamily } from "../lib/design";
import { useTheme } from "../providers/ThemeProvider";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const TABS: Record<string, {
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
  label: string;
}> = {
  index: { active: "home", inactive: "home-outline", label: "home" },
  contests: { active: "trophy", inactive: "trophy-outline", label: "contests" },
  live: { active: "pulse", inactive: "pulse-outline", label: "live" },
  buzz: { active: "chatbubbles", inactive: "chatbubbles-outline", label: "buzz" },
  social: { active: "people", inactive: "people-outline", label: "leagues" },
  profile: { active: "person", inactive: "person-outline", label: "profile" },
};

function TabItem({
  route,
  isFocused,
  onPress,
  onLongPress,
}: {
  route: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { t } = useTheme();
  const scale = useSharedValue(1);
  const tabOpacity = useSharedValue(isFocused ? 1 : 0.5);

  useEffect(() => {
    tabOpacity.value = withTiming(isFocused ? 1 : 0.7, { duration: 180 });
  }, [isFocused, tabOpacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: tabOpacity.value,
  }));

  const tab = TABS[route] || TABS.index;
  const isLive = route === "live";

  const iconColor = isFocused ? (isLive ? t.red : t.accent) : t.text;

  return (
    <Pressable
      onPress={() => {
        scale.value = withSpring(0.88, { damping: 15 }, () => {
          scale.value = withSpring(1, { damping: 12 });
        });
        onPress();
      }}
      onLongPress={onLongPress}
      style={styles.tabItem}
    >
      <Animated.View style={[styles.tabItemInner, animStyle]}>
        <Ionicons
          name={isFocused ? tab.active : tab.inactive}
          size={21}
          color={iconColor}
        />
        {isLive && isFocused && (
          <View style={[styles.liveDot, { backgroundColor: t.red }]} />
        )}
        <Animated.Text
          style={[
            styles.tabLabel,
            {
              color: iconColor,
              fontFamily: isFocused ? FontFamily.bodySemiBold : FontFamily.body,
            },
          ]}
        >
          {tab.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { mode, t } = useTheme();

  const gradientColors = useMemo(
    () =>
      mode === "light"
        ? (["rgba(247, 245, 240, 0)", "rgba(247, 245, 240, 0.9)", "#F7F5F0"] as const)
        : Gradients.tabBar,
    [mode],
  );

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <LinearGradient colors={gradientColors as any} style={styles.fade} />
      <View style={styles.barOuter}>
        <View
          style={[
            styles.bar,
            { backgroundColor: t.bgSurface, borderColor: t.border },
          ]}
        >
          {state.routes
            .filter((route) => {
              // On web, buzz lives in the sidebar — hide it from tab bar
              if (route.name === "buzz" && Platform.OS === "web") {
                return false;
              }
              return true;
            })
            .map((route) => {
              const idx = state.routes.findIndex((r) => r.key === route.key);
              return (
                <TabItem
                  key={route.key}
                  route={route.name}
                  isFocused={state.index === idx}
                  onPress={() => {
                    const event = navigation.emit({
                      type: "tabPress",
                      target: route.key,
                      canPreventDefault: true,
                    });
                    if (state.index !== idx && !event.defaultPrevented) {
                      navigation.navigate(route.name, route.params);
                    }
                  }}
                  onLongPress={() => {
                    navigation.emit({ type: "tabLongPress", target: route.key });
                  }}
                />
              );
            })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  fade: {
    position: "absolute",
    top: -24,
    left: 0,
    right: 0,
    bottom: 0,
  },
  barOuter: {
    paddingHorizontal: 16,
  },
  bar: {
    flexDirection: "row",
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
  },
  tabItemInner: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: Radius.md,
  },
  liveDot: {
    position: "absolute",
    top: 6,
    right: 10,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.1,
  },
});
