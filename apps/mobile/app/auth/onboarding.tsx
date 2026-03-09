import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Button,
  ModeToggle,
  AnnouncementBanner,
  DesignSystem,
  formatUIText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { useTheme } from "../../providers/ThemeProvider";
import { trpc } from "../../lib/trpc";
import { COUNTRIES, INDIA_STATES } from "@draftplay/shared";

const TEAMS = ["CSK", "MI", "RCB", "KKR", "DC", "SRH", "PBKS", "GT", "LSG", "RR"];
const FORMATS = [
  { key: "salary_cap", label: "salary cap", desc: "build teams within a budget" },
  { key: "draft", label: "draft", desc: "take turns picking players" },
  { key: "prediction", label: "prediction", desc: "predict match outcomes" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const [step, setStep] = useState(0);
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [preferredFormat, setPreferredFormat] = useState<string | null>(null);

  // Location declaration state
  const [selectedCountry, setSelectedCountry] = useState<string>("IN");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [confirmLocation, setConfirmLocation] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState(false);

  const updateDeclaration = trpc.geo.updateDeclaration.useMutation();

  const handleLocationNext = async () => {
    await updateDeclaration.mutateAsync({
      country: selectedCountry,
      state: selectedState ?? undefined,
    });
    setStep(2);
  };

  const handleComplete = () => {
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

  return (
    <YStack flex={1} backgroundColor="$background" paddingHorizontal="$6" paddingTop={60} testID="onboarding-screen">
      <XStack justifyContent="space-between" alignItems="center" marginBottom={40}>
        <XStack flex={1} />
        <XStack justifyContent="center" gap="$2" flex={2}>
          {[0, 1, 2].map((i) => (
            <YStack key={i} width={step >= i ? 24 : 8} height={8} borderRadius={4} backgroundColor={step >= i ? "$accentBackground" : "$borderColor"} />
          ))}
        </XStack>
        <XStack flex={1} justifyContent="flex-end">
          <ModeToggle mode={mode} onToggle={toggleMode} />
        </XStack>
      </XStack>

      <AnnouncementBanner marginHorizontal={0} />

      {step === 0 && (
        <YStack flex={1}>
          <YStack alignItems="center" marginBottom="$3">
            <DraftPlayLogo size={48} animate />
          </YStack>
          <Text fontFamily="$mono" fontWeight="500" fontSize={24} color="$color" letterSpacing={-0.5} marginBottom="$2">
            {formatUIText("pick your team")}
          </Text>
          <Text fontFamily="$body" fontSize={18} color="$colorMuted" marginBottom="$8">
            {formatUIText("who do you support?")}
          </Text>
          <XStack flexWrap="wrap" gap="$3">
            {TEAMS.map((team) => (
              <XStack
                key={team}
                borderRadius="$round"
                paddingHorizontal="$5"
                paddingVertical="$3"
                borderWidth={1}
                backgroundColor={favoriteTeam === team ? "$colorAccentLight" : "$backgroundSurface"}
                borderColor={favoriteTeam === team ? "$accentBackground" : "$borderColor"}
                onPress={() => setFavoriteTeam(team)}
                cursor="pointer"
                pressStyle={{ scale: 0.96, opacity: 0.9 }}
                hoverStyle={{ backgroundColor: "$backgroundSurfaceHover" }}
                testID={`team-pill-${team}`}
              >
                <Text fontFamily="$mono" fontWeight="600" fontSize={15} color={favoriteTeam === team ? "$accentBackground" : "$color"}>
                  {team}
                </Text>
              </XStack>
            ))}
          </XStack>
          <YStack marginTop="auto" marginBottom={32}>
            <Button variant="primary" size="lg" disabled={!favoriteTeam} opacity={!favoriteTeam ? 0.4 : 1} onPress={() => setStep(1)} testID="onboarding-next-btn">
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
            </YStack>
          </ScrollView>

          <YStack marginTop="auto" marginBottom={32}>
            <Button
              variant="primary"
              size="lg"
              disabled={
                !confirmLocation ||
                !confirmUpdate ||
                (selectedCountry === "IN" && !selectedState) ||
                updateDeclaration.isPending
              }
              opacity={
                !confirmLocation || !confirmUpdate || (selectedCountry === "IN" && !selectedState)
                  ? 0.4
                  : 1
              }
              onPress={handleLocationNext}
              testID="onboarding-location-next-btn"
            >
              {formatUIText(updateDeclaration.isPending ? "saving..." : "next")}
            </Button>
          </YStack>
        </YStack>
      )}

      {step === 2 && (
        <YStack flex={1}>
          <Text fontFamily="$mono" fontWeight="500" fontSize={24} color="$color" letterSpacing={-0.5} marginBottom="$2">
            {formatUIText("choose your style")}
          </Text>
          <Text fontFamily="$body" fontSize={18} color="$colorMuted" marginBottom="$8">
            {formatUIText("how do you want to play?")}
          </Text>
          <YStack gap="$3">
            {FORMATS.map((f) => (
              <Card
                key={f.key}
                pressable
                padding="$5"
                borderColor={preferredFormat === f.key ? "$accentBackground" : "$borderColor"}
                onPress={() => setPreferredFormat(f.key)}
                testID={`format-card-${f.key}`}
              >
                <Text fontFamily="$mono" fontWeight="500" fontSize={17} color={preferredFormat === f.key ? "$accentBackground" : "$color"} letterSpacing={-0.5}>
                  {f.label}
                </Text>
                <Text fontFamily="$body" fontSize={13} color="$colorSecondary" marginTop={2}>
                  {f.desc}
                </Text>
              </Card>
            ))}
          </YStack>
          <YStack marginTop="auto" marginBottom={32}>
            <Button variant="primary" size="lg" disabled={!preferredFormat} opacity={!preferredFormat ? 0.4 : 1} onPress={handleComplete} testID="onboarding-complete-btn">
              {formatUIText("let's go")}
            </Button>
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}
