import { useRouter } from "expo-router";
import { useState } from "react";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Button,
  DesignSystem,
  formatUIText,
} from "@draftcrick/ui";

const TEAMS = ["CSK", "MI", "RCB", "KKR", "DC", "SRH", "PBKS", "GT", "LSG", "RR"];
const FORMATS = [
  { key: "salary_cap", label: "salary cap", desc: "build teams within a budget" },
  { key: "draft", label: "draft", desc: "take turns picking players" },
  { key: "prediction", label: "prediction", desc: "predict match outcomes" },
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
          <Text fontSize={48} marginBottom="$3">
            {DesignSystem.emptyState.icon}
          </Text>
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
              >
                <Text fontFamily="$mono" fontWeight="600" fontSize={15} color={favoriteTeam === team ? "$accentBackground" : "$color"}>
                  {team}
                </Text>
              </XStack>
            ))}
          </XStack>
          <YStack marginTop="auto" marginBottom={32}>
            <Button variant="primary" size="lg" disabled={!favoriteTeam} opacity={!favoriteTeam ? 0.4 : 1} onPress={() => setStep(1)}>
              {formatUIText("next")}
            </Button>
          </YStack>
        </YStack>
      )}

      {step === 1 && (
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
            <Button variant="primary" size="lg" disabled={!preferredFormat} opacity={!preferredFormat ? 0.4 : 1} onPress={handleComplete}>
              {formatUIText("let's go")}
            </Button>
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}
