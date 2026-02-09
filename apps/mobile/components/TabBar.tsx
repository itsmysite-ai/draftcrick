import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { useEffect } from "react";
import { Colors, Gradients, Radius, Shadow } from "../lib/design";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { active: "home", inactive: "home-outline" },
  contests: { active: "trophy", inactive: "trophy-outline" },
  live: { active: "pulse", inactive: "pulse-outline" },
  social: { active: "people", inactive: "people-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

const TAB_LABELS: Record<string, string> = {
  index: "Home",
  contests: "Contests",
  live: "Live",
  social: "Leagues",
  profile: "Profile",
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
  const scale = useSharedValue(1);
  const opacity = useSharedValue(isFocused ? 1 : 0.45);

  useEffect(() => {
    opacity.value = withTiming(isFocused ? 1 : 0.45, { duration: 200 });
  }, [isFocused, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const icons = TAB_ICONS[route] || TAB_ICONS.index;
  const label = TAB_LABELS[route] || route;
  const isLive = route === "live";

  return (
    <TouchableOpacity
      onPress={() => {
        scale.value = withSpring(0.85, { damping: 15 }, () => {
          scale.value = withSpring(1, { damping: 12 });
        });
        onPress();
      }}
      onLongPress={onLongPress}
      style={styles.tabItem}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.tabItemInner, animStyle]}>
        {isFocused && (
          <LinearGradient
            colors={isLive ? (Gradients.live as any) : (Gradients.primary as any)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.activeIndicator}
          />
        )}
        <View style={styles.iconContainer}>
          <Ionicons
            name={isFocused ? icons.active : icons.inactive}
            size={22}
            color={
              isFocused
                ? isLive
                  ? Colors.red
                  : Colors.accent
                : Colors.textTertiary
            }
          />
          {isLive && isFocused && <View style={styles.liveDot} />}
        </View>
        <Animated.Text
          style={[
            styles.tabLabel,
            {
              color: isFocused
                ? isLive
                  ? Colors.red
                  : Colors.accent
                : Colors.textTertiary,
              fontWeight: isFocused ? "700" : "500",
            },
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <LinearGradient
        colors={Gradients.tabBar as any}
        style={styles.gradientBg}
      />
      <View style={styles.container}>
        <View style={styles.tabBarInner}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            return (
              <TabItem
                key={route.key}
                route={route.name}
                isFocused={isFocused}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isFocused && !event.defaultPrevented) {
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
  gradientBg: {
    position: "absolute",
    top: -20,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    paddingHorizontal: 12,
  },
  tabBarInner: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 21, 34, 0.92)",
    borderRadius: Radius["2xl"],
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: 6,
    paddingHorizontal: 4,
    ...Shadow.lg,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
  },
  tabItemInner: {
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: Radius.lg,
    position: "relative",
  },
  activeIndicator: {
    position: "absolute",
    top: 0,
    left: "20%",
    right: "20%",
    height: 2,
    borderRadius: 1,
  },
  iconContainer: {
    position: "relative",
    marginBottom: 2,
  },
  liveDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.red,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
