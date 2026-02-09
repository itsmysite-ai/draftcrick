import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Button } from "@draftcrick/ui";

const TEAMS = ["CSK", "MI", "RCB", "KKR", "DC", "SRH", "PBKS", "GT", "LSG", "RR"];
const FORMATS = [
  { key: "salary_cap", label: "Salary Cap", icon: "cash-outline" as const, desc: "Build teams within a budget" },
  { key: "draft", label: "Draft", icon: "swap-horizontal-outline" as const, desc: "Take turns picking players" },
  { key: "prediction", label: "Prediction", icon: "analytics-outline" as const, desc: "Predict match outcomes" },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const theme = useTamaguiTheme();
  const [step, setStep] = useState(0);
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [preferredFormat, setPreferredFormat] = useState<string | null>(null);

  const handleComplete = () => {
    router.replace("/(tabs)");
  };

  return (
    <YStack flex={1} backgroundColor="$background" paddingHorizontal="$6" paddingTop={60}>
      <XStack justifyContent="center" gap="$2" marginBottom={40}>
        {[0, 1].map((i) => (
          <YStack key={i} width={step >= i ? 24 : 8} height={8} borderRadius={4} backgroundColor={step >= i ? "$accentBackground" : "$borderColor"} />
        ))}
      </XStack>

      {step === 0 && (
        <YStack flex={1}>
          <Text fontFamily="$heading" fontWeight="700" fontSize={28} color="$color" marginBottom="$2">Pick Your Team</Text>
          <Text fontFamily="$body" fontSize={18} color="$colorMuted" marginBottom="$8">Who do you support?</Text>
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
              >
                <Text fontFamily="$body" fontWeight="600" fontSize={15} color={favoriteTeam === team ? "$accentBackground" : "$color"}>{team}</Text>
              </XStack>
            ))}
          </XStack>
          <YStack marginTop="auto" marginBottom={32}>
            <Button variant="primary" size="lg" disabled={!favoriteTeam} opacity={!favoriteTeam ? 0.4 : 1} onPress={() => setStep(1)}>Next</Button>
          </YStack>
        </YStack>
      )}

      {step === 1 && (
        <YStack flex={1}>
          <Text fontFamily="$heading" fontWeight="700" fontSize={28} color="$color" marginBottom="$2">Choose Your Style</Text>
          <Text fontFamily="$body" fontSize={18} color="$colorMuted" marginBottom="$8">How do you want to play?</Text>
          <YStack gap="$3">
            {FORMATS.map((f) => (
              <XStack
                key={f.key}
                backgroundColor={preferredFormat === f.key ? "$colorAccentLight" : "$backgroundSurface"}
                borderColor={preferredFormat === f.key ? "$accentBackground" : "$borderColor"}
                borderWidth={2}
                borderRadius="$3"
                padding="$5"
                alignItems="center"
                gap="$4"
                onPress={() => setPreferredFormat(f.key)}
                cursor="pointer"
                pressStyle={{ scale: 0.98, backgroundColor: "$backgroundSurfaceHover" }}
              >
                <Ionicons name={f.icon} size={20} color={preferredFormat === f.key ? theme.accentBackground.val : theme.colorMuted.val} />
                <YStack flex={1}>
                  <Text fontFamily="$heading" fontWeight="700" fontSize={17} color={preferredFormat === f.key ? "$accentBackground" : "$color"}>{f.label}</Text>
                  <Text fontFamily="$body" fontSize={13} color="$colorSecondary" marginTop={2}>{f.desc}</Text>
                </YStack>
              </XStack>
            ))}
          </YStack>
          <YStack marginTop="auto" marginBottom={32}>
            <Button variant="primary" size="lg" disabled={!preferredFormat} opacity={!preferredFormat ? 0.4 : 1} onPress={handleComplete}>Let's Go</Button>
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}
