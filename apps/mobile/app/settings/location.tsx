import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack } from "tamagui";
import { Text } from "../../components/SportText";
import { Button, BackButton, formatUIText } from "@draftplay/ui";
import { HeaderControls } from "../../components/HeaderControls";
import { trpc } from "../../lib/trpc";
import { COUNTRIES, INDIA_STATES } from "@draftplay/shared";

export default function LocationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefs = trpc.auth.getPreferences.useQuery(undefined, { retry: false });
  const savePreferences = trpc.auth.savePreferences.useMutation();

  const [country, setCountry] = useState<string>(prefs.data?.country ?? "IN");
  const [state, setState] = useState<string | null>(prefs.data?.state ?? null);

  const handleSave = async () => {
    await savePreferences.mutateAsync({
      sports: (prefs.data?.sports as ("cricket" | "f1")[]) ?? ["cricket"],
      preferredFormat: prefs.data?.preferredFormat ?? null,
      country,
      state,
    });
    router.back();
  };

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background" testID="location-settings-screen">
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
            {formatUIText("location")}
          </Text>
        </XStack>
        <HeaderControls />
      </XStack>

      <YStack flex={1} paddingHorizontal="$4">
        <Text fontFamily="$body" fontSize={14} color="$colorMuted" marginBottom="$6">
          {formatUIText("update your country and region")}
        </Text>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$colorSecondary" marginBottom="$3">
            {formatUIText("country")}
          </Text>
          <XStack flexWrap="wrap" gap="$2" marginBottom="$6">
            {COUNTRIES.map((c) => (
              <XStack
                key={c.code}
                borderRadius="$round"
                paddingHorizontal="$4"
                paddingVertical="$2"
                borderWidth={1}
                backgroundColor={country === c.code ? "$colorAccentLight" : "$backgroundSurface"}
                borderColor={country === c.code ? "$accentBackground" : "$borderColor"}
                onPress={() => { setCountry(c.code); setState(null); }}
                cursor="pointer"
                pressStyle={{ scale: 0.96, opacity: 0.9 }}
              >
                <Text fontFamily="$mono" fontWeight="500" fontSize={13} color={country === c.code ? "$accentBackground" : "$color"}>
                  {c.name}
                </Text>
              </XStack>
            ))}
          </XStack>

          {country === "IN" && (
            <>
              <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$colorSecondary" marginBottom="$3">
                {formatUIText("state / union territory")}
              </Text>
              <XStack flexWrap="wrap" gap="$2" marginBottom="$6">
                {INDIA_STATES.map((s) => (
                  <XStack
                    key={s.code}
                    borderRadius="$round"
                    paddingHorizontal="$4"
                    paddingVertical="$2"
                    borderWidth={1}
                    backgroundColor={state === s.code ? "$colorAccentLight" : "$backgroundSurface"}
                    borderColor={state === s.code ? "$accentBackground" : "$borderColor"}
                    onPress={() => setState(s.code)}
                    cursor="pointer"
                    pressStyle={{ scale: 0.96, opacity: 0.9 }}
                  >
                    <Text fontFamily="$mono" fontWeight="500" fontSize={13} color={state === s.code ? "$accentBackground" : "$color"}>
                      {s.name}
                    </Text>
                  </XStack>
                ))}
              </XStack>
            </>
          )}
        </ScrollView>

        <YStack marginTop="auto" marginBottom={32}>
          <Button
            variant="primary"
            size="lg"
            disabled={savePreferences.isPending || (country === "IN" && !state)}
            opacity={country === "IN" && !state ? 0.4 : 1}
            onPress={handleSave}
            testID="location-settings-save-btn"
          >
            {formatUIText(savePreferences.isPending ? "saving..." : "save")}
          </Button>
        </YStack>
      </YStack>
    </YStack>
  );
}
