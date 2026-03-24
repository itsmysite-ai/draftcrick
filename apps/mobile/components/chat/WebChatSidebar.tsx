import { Platform } from "react-native";
import { View } from "react-native";
import { ChatRoom } from "./ChatRoom";
import { Text } from "../SportText";
import { formatUIText } from "@draftplay/ui";
import { YStack, XStack } from "tamagui";
import { useTheme } from "../../providers/ThemeProvider";
import { useEffect, useState } from "react";

/**
 * Web-only layout wrapper.
 * - On mobile/native: passthrough.
 * - On web (wide screens): constrains app to phone-width + chat sidebar.
 * - Uses CSS media queries for responsiveness + theme-aware borders.
 */
export function WebLayoutWrapper({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return <WebLayout>{children}</WebLayout>;
}

function WebLayout({ children }: { children: React.ReactNode }) {
  const { t, mode } = useTheme();
  const [isWide, setIsWide] = useState(false);

  // Listen for resize
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1024px = iPad landscape / desktop. Avoids triggering on rotated phones.
    const check = () => setIsWide(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const borderColor = mode === "light" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";

  // Mobile / narrow: no sidebar, no constraint
  if (!isWide) {
    return <>{children}</>;
  }

  // Wide: phone-frame + sidebar
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        justifyContent: "center",
        backgroundColor: t.bg,
        minHeight: "100vh" as any,
      }}
    >
      {/* App frame — fixed phone width */}
      <View
        style={{
          width: 420,
          minWidth: 380,
          minHeight: "100vh" as any,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor,
        }}
      >
        {children}
      </View>

      {/* Chat sidebar — fills remaining space */}
      <View
        style={{
          flex: 1,
          minWidth: 280,
          maxWidth: 420,
          minHeight: "100vh" as any,
          borderRightWidth: 1,
          borderColor,
          backgroundColor: t.bg,
        }}
      >
        {/* Header */}
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$3"
          borderBottomWidth={1}
          borderColor="$borderColor"
          alignItems="center"
          gap="$2"
        >
          <Text fontSize={20}>💬</Text>
          <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color">
            {formatUIText("buzz")}
          </Text>
          <YStack
            backgroundColor="$accentBackground"
            paddingHorizontal="$2"
            paddingVertical={2}
            borderRadius="$round"
            marginLeft="$2"
          >
            <Text fontFamily="$mono" fontWeight="600" fontSize={10} color="white">
              LIVE
            </Text>
          </YStack>
        </XStack>

        {/* Chat */}
        <View style={{ flex: 1 }}>
          <ChatRoom compact />
        </View>
      </View>
    </View>
  );
}
