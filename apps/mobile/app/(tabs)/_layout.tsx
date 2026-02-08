import { Tabs } from "expo-router";

/**
 * Standard mode: 5-tab bottom navigation
 * Home | Contests | Live | Social | Profile
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#00F5A0",
        tabBarInactiveTintColor: "#6C757D",
        tabBarStyle: {
          backgroundColor: "#0A1628",
          borderTopColor: "#1A2332",
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        headerStyle: { backgroundColor: "#0A1628" },
        headerTintColor: "#FFFFFF",
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
        name="contests"
        options={{
          title: "Contests",
          tabBarLabel: "Contests",
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "Live",
          tabBarLabel: "Live",
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: "Social",
          tabBarLabel: "Social",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
        }}
      />
    </Tabs>
  );
}
