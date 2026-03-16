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
import { COUNTRIES, INDIA_STATES } from "@draftplay/shared";

const SPORTS = [
  { key: "cricket", label: "cricket", icon: "\u{1F3CF}" },
  { key: "f1", label: "formula 1", icon: "\u{1F3CE}\uFE0F" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const theme = useTamaguiTheme();
  const { setAvailableSports, setSport } = useTheme();
  const [step, setStep] = useState(0);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);

  // Location declaration state
  const [selectedCountry, setSelectedCountry] = useState<string>("IN");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [confirmLocation, setConfirmLocation] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const savePreferences = trpc.auth.savePreferences.useMutation();
  const acceptTermsMutation = trpc.auth.acceptTerms.useMutation();

  const handleComplete = async () => {
    const sports = selectedSports as ("cricket" | "f1")[];
    await acceptTermsMutation.mutateAsync();
    await savePreferences.mutateAsync({
      sports,
      preferredFormat: null,
      country: selectedCountry,
      state: selectedState,
    });
    // Update theme provider so dropdown reflects selection immediately
    setAvailableSports(sports);
    setSport(sports[0] as any);
    router.replace("/(tabs)");
  };

  const selectedCountryName =
    COUNTRIES.find((c) => c.code === selectedCountry)?.name ?? selectedCountry;
  const selectedStateName =
    INDIA_STATES.find((s) => s.code === selectedState)?.name ?? selectedState;

  const locationLabel =
    selectedCountry === "IN" && selectedStateName
      ? `${selectedStateName}, India`
      : selectedCountryName;

  const isSaving = acceptTermsMutation.isPending || savePreferences.isPending;

  return (
    <YStack flex={1} backgroundColor="$background" paddingHorizontal="$6" paddingTop={60} testID="onboarding-screen">
      <XStack justifyContent="space-between" alignItems="center" marginBottom={40}>
        <XStack flex={1} />
        <XStack justifyContent="center" gap="$2" flex={2}>
          {[0, 1].map((i) => (
            <YStack key={i} width={step >= i ? 24 : 8} height={8} borderRadius={4} backgroundColor={step >= i ? "$accentBackground" : "$borderColor"} />
          ))}
        </XStack>
        <XStack flex={1} justifyContent="flex-end">
          <HeaderControls hideSport />
        </XStack>
      </XStack>

      <AnnouncementBanner marginHorizontal={0} />

      {step === 0 && (
        <YStack flex={1}>
          <YStack alignItems="center" marginBottom="$3">
            <DraftPlayLogo size={48} animate />
          </YStack>
          <Text fontFamily="$mono" fontWeight="500" fontSize={24} color="$color" letterSpacing={-0.5} marginBottom="$2">
            {formatUIText("pick your sports")}
          </Text>
          <Text fontFamily="$body" fontSize={18} color="$colorMuted" marginBottom="$8">
            {formatUIText("what do you follow?")}
          </Text>
          <YStack gap="$3">
            {SPORTS.map((sport) => {
              const selected = selectedSports.includes(sport.key);
              return (
                <XStack
                  key={sport.key}
                  borderRadius={12}
                  paddingHorizontal="$5"
                  paddingVertical="$4"
                  borderWidth={1}
                  backgroundColor={selected ? "$colorAccentLight" : "$backgroundSurface"}
                  borderColor={selected ? "$accentBackground" : "$borderColor"}
                  onPress={() =>
                    setSelectedSports((prev) =>
                      prev.includes(sport.key)
                        ? prev.filter((s) => s !== sport.key)
                        : [...prev, sport.key]
                    )
                  }
                  cursor="pointer"
                  pressStyle={{ scale: 0.97, opacity: 0.9 }}
                  hoverStyle={{ backgroundColor: "$backgroundSurfaceHover" }}
                  alignItems="center"
                  gap="$3"
                  testID={`sport-pill-${sport.key}`}
                >
                  <Text fontSize={24}>{sport.icon}</Text>
                  <Text fontFamily="$mono" fontWeight="600" fontSize={16} color={selected ? "$accentBackground" : "$color"}>
                    {sport.label}
                  </Text>
                </XStack>
              );
            })}
          </YStack>
          <YStack marginTop="auto" marginBottom={32}>
            <Button variant="primary" size="lg" disabled={selectedSports.length === 0} disabledStyle={{ opacity: 0.5 }} onPress={() => setStep(1)} testID="onboarding-next-btn">
              {formatUIText("next")}
            </Button>
          </YStack>
        </YStack>
      )}

      {step === 1 && (
        <YStack flex={1}>
          <Text fontFamily="$mono" fontWeight="500" fontSize={24} color="$color" letterSpacing={-0.5} marginBottom="$2">
            {formatUIText("where are you located?")}
          </Text>
          <Text fontFamily="$body" fontSize={18} color="$colorMuted" marginBottom="$6">
            {formatUIText("select your country and region")}
          </Text>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {/* Country picker */}
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
                  backgroundColor={selectedCountry === c.code ? "$colorAccentLight" : "$backgroundSurface"}
                  borderColor={selectedCountry === c.code ? "$accentBackground" : "$borderColor"}
                  onPress={() => {
                    setSelectedCountry(c.code);
                    setSelectedState(null);
                  }}
                  cursor="pointer"
                  pressStyle={{ scale: 0.96, opacity: 0.9 }}
                >
                  <Text fontFamily="$mono" fontWeight="500" fontSize={13} color={selectedCountry === c.code ? "$accentBackground" : "$color"}>
                    {c.name}
                  </Text>
                </XStack>
              ))}
            </XStack>

            {/* State picker (India only) */}
            {selectedCountry === "IN" && (
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
              </>
            )}

            {/* Legal confirmation checkboxes */}
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
                  different state or country.
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
                  I confirm I am 13 years or older.
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
          </ScrollView>

          <YStack marginTop="auto" marginBottom={32}>
            <Button
              variant="primary"
              size="lg"
              disabled={
                !confirmLocation ||
                !confirmUpdate ||
                !ageConfirmed ||
                !termsAccepted ||
                (selectedCountry === "IN" && !selectedState) ||
                isSaving
              }
              disabledStyle={{ opacity: 0.5 }}
              onPress={handleComplete}
              testID="onboarding-complete-btn"
            >
              {formatUIText(isSaving ? "saving..." : "let's go")}
            </Button>
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}
