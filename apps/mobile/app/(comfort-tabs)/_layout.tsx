import { Tabs } from "expo-router";

/**
 * Comfort Mode: 3-tab simplified navigation
 * Home | My Team | Help
 *
 * Larger touch targets, simpler labels, fewer options.
 */
export default function ComfortTabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#00F5A0",
        tabBarInactiveTintColor: "#6C757D",
        tabBarStyle: {
          backgroundColor: "#0A1628",
          borderTopColor: "#1A2332",
          height: 70, // Larger for comfort mode (48px+ targets)
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 14, // Larger text in comfort mode
          fontWeight: "700",
        },
        headerStyle: { backgroundColor: "#0A1628" },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontSize: 20 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarLabel: "Home",
        }}
      />
      <Tabs.Screen
        name="my-team"
        options={{
          title: "My Team",
          tabBarLabel: "My Team",
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          title: "Help",
          tabBarLabel: "Help",
        }}
      />
    </Tabs>
  );
}
