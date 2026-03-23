import { useRouter } from "expo-router";
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
import { INDIA_STATES, INDIA_BANNED_STATES } from "@draftplay/shared";

export default function OnboardingScreen() {
  const router = useRouter();
  const theme = useTamaguiTheme();
  const { setAvailableSports, setSport } = useTheme();

  // Location declaration state (India only)
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [confirmLocation, setConfirmLocation] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const savePreferences = trpc.auth.savePreferences.useMutation();
  const acceptTermsMutation = trpc.auth.acceptTerms.useMutation();

  const isBannedState = selectedState
    ? (INDIA_BANNED_STATES as readonly string[]).includes(selectedState)
    : false;

  const handleComplete = async () => {
    await acceptTermsMutation.mutateAsync();
    await savePreferences.mutateAsync({
      sports: ["cricket"],
      preferredFormat: null,
      country: "IN",
      state: selectedState,
    });
    // Cricket is the only sport — set it directly
    setAvailableSports(["cricket"]);
    setSport("cricket" as any);
    router.replace("/(tabs)");
  };

  const selectedStateName =
    INDIA_STATES.find((s) => s.code === selectedState)?.name ?? selectedState;

  const locationLabel = selectedStateName
    ? `${selectedStateName}, India`
    : "India";

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
        <Text fontFamily="$body" fontSize={18} color="$colorMuted" marginBottom="$6">
          {formatUIText("select your state")}
        </Text>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* State picker */}
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

          {/* Banned state warning */}
          {isBannedState && (
            <YStack
              backgroundColor="$red3"
              borderRadius={12}
              padding="$4"
              marginBottom="$6"
              borderWidth={1}
              borderColor="$red7"
            >
              <Text fontFamily="$mono" fontWeight="600" fontSize={16} color="$red11" marginBottom="$2">
                {formatUIText("not available in your state")}
              </Text>
              <Text fontFamily="$body" fontSize={14} color="$red10">
                DraftPlay is not available in {selectedStateName} due to local regulations
                regarding fantasy sports. We hope to serve you in the future if
                regulations change.
              </Text>
            </YStack>
          )}

          {/* Legal confirmation checkboxes — hidden when banned */}
          {!isBannedState && (
            <YStack gap="$4" marginTop="$4" marginBottom="$6">
              <XStack
                gap="$3"
                alignItems="flex-start"
                onPress={() => setConfirmLocation(!confirmLocation)}
                cursor="pointer"
              >
                <YStack
                  width={22}
                  height={22}
                  borderRadius={4}
                  borderWidth={2}
                  borderColor={confirmLocation ? "$accentBackground" : "$borderColor"}
                  backgroundColor={confirmLocation ? "$accentBackground" : "transparent"}
                  alignItems="center"
                  justifyContent="center"
                  marginTop={2}
                >
                  {confirmLocation && (
                    <Text color="white" fontSize={14} fontWeight="700">
                      ✓
                    </Text>
                  )}
                </YStack>
                <Text fontFamily="$body" fontSize={13} color="$colorSecondary" flex={1}>
                  I confirm I am located in {locationLabel} and I am eligible to
                  participate in fantasy sports under local laws.
                </Text>
              </XStack>

              <XStack
                gap="$3"
                alignItems="flex-start"
                onPress={() => setConfirmUpdate(!confirmUpdate)}
                cursor="pointer"
              >
                <YStack
                  width={22}
                  height={22}
                  borderRadius={4}
                  borderWidth={2}
                  borderColor={confirmUpdate ? "$accentBackground" : "$borderColor"}
                  backgroundColor={confirmUpdate ? "$accentBackground" : "transparent"}
                  alignItems="center"
                  justifyContent="center"
                  marginTop={2}
                >
                  {confirmUpdate && (
                    <Text color="white" fontSize={14} fontWeight="700">
                      ✓
                    </Text>
                  )}
                </YStack>
                <Text fontFamily="$body" fontSize={13} color="$colorSecondary" flex={1}>
                  I understand that I must update my location if I move to a
                  different state.
                </Text>
              </XStack>

              <XStack
                gap="$3"
                alignItems="flex-start"
                onPress={() => setAgeConfirmed(!ageConfirmed)}
                cursor="pointer"
                testID="onboarding-age-checkbox"
              >
                <YStack
                  width={22}
                  height={22}
                  borderRadius={4}
                  borderWidth={2}
                  borderColor={ageConfirmed ? "$accentBackground" : "$borderColor"}
                  backgroundColor={ageConfirmed ? "$accentBackground" : "transparent"}
                  alignItems="center"
                  justifyContent="center"
                  marginTop={2}
                >
                  {ageConfirmed && (
                    <Text color="white" fontSize={14} fontWeight="700">
                      ✓
                    </Text>
                  )}
                </YStack>
                <Text fontFamily="$body" fontSize={13} color="$colorSecondary" flex={1}>
                  I confirm I am 18 years or older.
                </Text>
              </XStack>

              <XStack
                gap="$3"
                alignItems="flex-start"
                onPress={() => setTermsAccepted(!termsAccepted)}
                cursor="pointer"
                testID="onboarding-terms-checkbox"
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
                  marginTop={2}
                >
                  {termsAccepted && (
                    <Text color="white" fontSize={14} fontWeight="700">
                      ✓
                    </Text>
                  )}
                </YStack>
                <Text fontFamily="$body" fontSize={13} color="$colorSecondary" flex={1}>
                  I agree to the Terms of Service and Privacy Policy.
                </Text>
              </XStack>
            </YStack>
          )}
        </ScrollView>

        <YStack marginTop="auto" marginBottom={32}>
          {isBannedState ? (
            <Button
              variant="primary"
              size="lg"
              disabled
              disabledStyle={{ opacity: 0.5 }}
              testID="onboarding-blocked-btn"
            >
              {formatUIText("not available in your state")}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              disabled={
                !confirmLocation ||
                !confirmUpdate ||
                !ageConfirmed ||
                !termsAccepted ||
                !selectedState ||
                isSaving
              }
              disabledStyle={{ opacity: 0.5 }}
              onPress={handleComplete}
              testID="onboarding-complete-btn"
            >
              {formatUIText(isSaving ? "saving..." : "let's go")}
            </Button>
          )}
        </YStack>
      </YStack>
    </YStack>
  );
}
