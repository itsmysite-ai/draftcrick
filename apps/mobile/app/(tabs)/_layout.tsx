import { Tabs } from "expo-router";
import { FontFamily } from "../../lib/design";
import { CustomTabBar } from "../../components/TabBar";
import { useTheme } from "../../providers/ThemeProvider";

export default function TabLayout() {
  const { t } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: t.bg,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: t.text,
        headerTitleStyle: { fontWeight: "700", fontSize: 17, fontFamily: FontFamily.heading },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ headerShown: false }} />
      <Tabs.Screen name="contests" options={{ headerShown: false }} />
      <Tabs.Screen name="live" options={{ headerShown: false }} />
      <Tabs.Screen name="social" options={{ headerShown: false }} />
      <Tabs.Screen name="profile" options={{ headerShown: false }} />
    </Tabs>
  );
}
