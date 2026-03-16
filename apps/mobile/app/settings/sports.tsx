import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack } from "tamagui";
import { Text } from "../../components/SportText";
import { Button, BackButton, formatUIText } from "@draftplay/ui";
import { HeaderControls } from "../../components/HeaderControls";
import { useTheme } from "../../providers/ThemeProvider";
import { trpc } from "../../lib/trpc";
import type { Sport } from "@draftplay/shared";

const SPORTS: { key: Sport; label: string; icon: string }[] = [
  { key: "cricket", label: "Cricket", icon: "\u{1F3CF}" },
  { key: "f1", label: "Formula 1", icon: "\u{1F3CE}\uFE0F" },
];

export default function SportsSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { availableSports, setAvailableSports, setSport } = useTheme();
  const [selected, setSelected] = useState<Sport[]>([...availableSports]);
  const savePreferences = trpc.auth.savePreferences.useMutation();
  const prefs = trpc.auth.getPreferences.useQuery(undefined, { retry: false });

  const toggle = (key: Sport) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    const sports = selected as ("cricket" | "f1")[];
    await savePreferences.mutateAsync({
      sports,
      preferredFormat: prefs.data?.preferredFormat ?? null,
      country: prefs.data?.country ?? null,
      state: prefs.data?.state ?? null,
    });
    setAvailableSports(sports);
    if (!sports.includes(availableSports[0])) {
      setSport(sports[0]);
    }
    router.back();
  };

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background" testID="sports-settings-screen">
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <BackButton onPress={() => router.back()} />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("sports")}
          </Text>
        </XStack>
        <HeaderControls />
      </XStack>

      <YStack flex={1} paddingHorizontal="$4">
        <Text fontFamily="$body" fontSize={14} color="$colorMuted" marginBottom="$6">
          {formatUIText("select the sports you follow")}
        </Text>
        <YStack gap="$3">
          {SPORTS.map((sport) => {
            const isSelected = selected.includes(sport.key);
            return (
              <XStack
                key={sport.key}
                borderRadius={12}
                paddingHorizontal="$5"
                paddingVertical="$4"
                borderWidth={1}
                backgroundColor={isSelected ? "$colorAccentLight" : "$backgroundSurface"}
                borderColor={isSelected ? "$accentBackground" : "$borderColor"}
                onPress={() => toggle(sport.key)}
                cursor="pointer"
                pressStyle={{ scale: 0.97, opacity: 0.9 }}
                alignItems="center"
                gap="$3"
              >
                <Text fontSize={24}>{sport.icon}</Text>
                <Text fontFamily="$mono" fontWeight="600" fontSize={16} color={isSelected ? "$accentBackground" : "$color"}>
                  {sport.label}
                </Text>
              </XStack>
            );
          })}
        </YStack>
        <YStack marginTop="auto" marginBottom={32}>
          <Button
            variant="primary"
            size="lg"
            disabled={selected.length === 0 || savePreferences.isPending}
            opacity={selected.length === 0 ? 0.4 : 1}
            onPress={handleSave}
            testID="sports-settings-save-btn"
          >
            {formatUIText(savePreferences.isPending ? "saving..." : "save")}
          </Button>
        </YStack>
      </YStack>
    </YStack>
  );
}
