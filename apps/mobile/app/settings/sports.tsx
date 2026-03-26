import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack } from "tamagui";
import { Text } from "../../components/SportText";
import { BackButton, formatUIText } from "@draftplay/ui";
import { HeaderControls } from "../../components/HeaderControls";

export default function SportsSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background" testID="sports-settings-screen">
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <SafeBackButton />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("sports")}
          </Text>
        </XStack>
        <HeaderControls />
      </XStack>

      <YStack flex={1} paddingHorizontal="$4">
        {/* Cricket — active and only sport */}
        <XStack
          borderRadius={12}
          paddingHorizontal="$5"
          paddingVertical="$4"
          borderWidth={1}
          backgroundColor="$colorAccentLight"
          borderColor="$accentBackground"
          alignItems="center"
          gap="$3"
          marginBottom="$4"
        >
          <Text fontSize={24}>{"\u{1F3CF}"}</Text>
          <Text fontFamily="$mono" fontWeight="600" fontSize={16} color="$accentBackground">
            Cricket
          </Text>
          <XStack flex={1} justifyContent="flex-end">
            <Text fontFamily="$mono" fontWeight="500" fontSize={12} color="$accentBackground">
              Active
            </Text>
          </XStack>
        </XStack>

        {/* Coming soon teaser */}
        <YStack
          borderRadius={12}
          padding="$4"
          backgroundColor="$backgroundSurface"
          borderWidth={1}
          borderColor="$borderColor"
        >
          <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$colorMuted" marginBottom="$2">
            {formatUIText("more sports coming soon")}
          </Text>
          <Text fontFamily="$body" fontSize={13} color="$colorSecondary">
            Formula 1, Football, Kabaddi, and more are on the way. Stay tuned!
          </Text>
        </YStack>
      </YStack>
    </YStack>
    </ScrollView>
  );
}
