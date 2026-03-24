import { useRouter, Link } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Button,
  AnnouncementBanner,
  formatUIText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { HeaderControls } from "../../components/HeaderControls";
import { useTheme } from "../../providers/ThemeProvider";
import { trpc } from "../../lib/trpc";
import { INDIA_STATES } from "@draftplay/shared";

export default function OnboardingScreen() {
  const router = useRouter();
  const theme = useTamaguiTheme();
  const { setAvailableSports, setSport } = useTheme();

  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const savePreferences = trpc.auth.savePreferences.useMutation();
  const acceptTermsMutation = trpc.auth.acceptTerms.useMutation();

  const handleComplete = async () => {
    await acceptTermsMutation.mutateAsync();
    await savePreferences.mutateAsync({
      sports: ["cricket"],
      preferredFormat: null,
      country: "IN",
      state: selectedState,
    });
    setAvailableSports(["cricket"]);
    setSport("cricket" as any);
    router.replace("/(tabs)");
  };

  const isSaving = acceptTermsMutation.isPending || savePreferences.isPending;

  return (
    <YStack flex={1} backgroundColor="$background" paddingHorizontal="$6" paddingTop={60} testID="onboarding-screen">
      <XStack justifyContent="space-between" alignItems="center" marginBottom={40}>
        <XStack flex={1} />
        <XStack justifyContent="center" flex={2}>
          <YStack width={24} height={8} borderRadius={4} backgroundColor="$accentBackground" />
        </XStack>
        <XStack flex={1} justifyContent="flex-end">
          <HeaderControls hideSport />
        </XStack>
      </XStack>

      <AnnouncementBanner marginHorizontal={0} />

      <YStack flex={1}>
        <YStack alignItems="center" marginBottom="$3">
          <DraftPlayLogo size={48} animate />
        </YStack>
        <Text fontFamily="$mono" fontWeight="500" fontSize={24} color="$color" letterSpacing={-0.5} marginBottom="$2">
          {formatUIText("where are you located?")}
        </Text>
        <Text fontFamily="$body" fontSize={16} color="$colorMuted" marginBottom="$6">
          {formatUIText("this helps us personalize your experience")}
        </Text>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
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
                backgroundColor={selectedState === s.code ? "$colorAccentLight" : "$backgroundSurface"}
                borderColor={selectedState === s.code ? "$accentBackground" : "$borderColor"}
                onPress={() => setSelectedState(s.code)}
                cursor="pointer"
                pressStyle={{ scale: 0.96, opacity: 0.9 }}
              >
                <Text fontFamily="$mono" fontWeight="500" fontSize={13} color={selectedState === s.code ? "$accentBackground" : "$color"}>
                  {s.name}
                </Text>
              </XStack>
            ))}
          </XStack>

          <XStack
            gap="$3"
            alignItems="center"
            onPress={() => setTermsAccepted(!termsAccepted)}
            cursor="pointer"
            testID="onboarding-terms-checkbox"
            marginBottom="$4"
          >
            <YStack
              width={22}
              height={22}
              borderRadius={4}
              borderWidth={2}
              borderColor={termsAccepted ? "$accentBackground" : "$borderColor"}
              backgroundColor={termsAccepted ? "$accentBackground" : "transparent"}
              alignItems="center"
              justifyContent="center"
            >
              {termsAccepted && (
                <Text color="white" fontSize={14} fontWeight="700">
                  ✓
                </Text>
              )}
            </YStack>
            <Text fontFamily="$body" fontSize={13} color="$colorSecondary" flex={1}>
              I agree to the{" "}
              <Link href="/legal/terms" asChild>
                <Text fontFamily="$body" fontSize={13} color="$accentBackground" textDecorationLine="underline">
                  Terms of Service
                </Text>
              </Link>
              {" "}and{" "}
              <Link href="/legal/privacy" asChild>
                <Text fontFamily="$body" fontSize={13} color="$accentBackground" textDecorationLine="underline">
                  Privacy Policy
                </Text>
              </Link>
              .
            </Text>
          </XStack>
        </ScrollView>

        <YStack marginTop="auto" marginBottom={32}>
          <Button
            variant="primary"
            size="lg"
            disabled={!termsAccepted || !selectedState || isSaving}
            disabledStyle={{ opacity: 0.5 }}
            onPress={handleComplete}
            testID="onboarding-complete-btn"
          >
            {formatUIText(isSaving ? "saving..." : "let's go")}
          </Button>
        </YStack>
      </YStack>
    </YStack>
  );
}
