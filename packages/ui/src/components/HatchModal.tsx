import { useEffect, useState } from "react";
import { YStack, XStack, Text, styled } from "tamagui";
import { InitialsAvatar } from "./InitialsAvatar";

type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

interface Player {
  name: string;
  role: RoleKey;
  team: string;
  ovr: number;
}

interface HatchModalProps {
  player: Player;
  onClose: () => void;
}

const Overlay = styled(YStack, {
  position: "fixed" as any,
  inset: 0,
  zIndex: 100,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "$colorOverlay",
  animation: "quick",
});

const ModalCard = styled(YStack, {
  backgroundColor: "$backgroundSurface",
  borderRadius: 24,
  padding: "$6",
  paddingTop: "$8",
  paddingBottom: "$6",
  alignItems: "center",
  minWidth: 300,
  borderWidth: 1,
  borderColor: "$borderColor",
  shadowColor: "$shadowColor",
  shadowOffset: { width: 0, height: 24 },
  shadowOpacity: 0.3,
  shadowRadius: 40,
  elevation: 10,
  animation: "quick",
  enterStyle: {
    scale: 0.92,
    opacity: 0,
    y: 10,
  },
});

/**
 * HatchModal — Egg-hatching animation for draft picks
 * Stages: Egg wobbles (2s) → Reveals player initials avatar
 * Tamagotchi-inspired moment: the core brand interaction
 */
export function HatchModal({ player, onClose }: HatchModalProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = [600, 500, 500, 900];
    if (stage < 4) {
      const timeout = setTimeout(() => setStage((s) => s + 1), timers[stage]);
      return () => clearTimeout(timeout);
    }
  }, [stage]);

  const roleBg = `$role${player.role}LightBg` as const;
  const roleText = `$role${player.role}LightText` as const;

  return (
    <Overlay onPress={stage >= 4 ? onClose : undefined}>
      <ModalCard onPress={(e: any) => e.stopPropagation()}>
        {/* Egg or Avatar */}
        <YStack
          width={96}
          height={96}
          marginBottom="$5"
          alignItems="center"
          justifyContent="center"
          animation="bouncy"
          rotate={
            stage === 1 ? "-12deg" : stage === 2 ? "12deg" : stage === 3 ? "-6deg" : "0deg"
          }
          scale={stage === 3 ? 1.1 : stage >= 4 ? 1 : 1.05}
        >
          {stage < 4 ? (
            <Text fontSize={64} lineHeight={96}>
              🥚
            </Text>
          ) : (
            <YStack
              animation="quick"
              enterStyle={{ scale: 0.9, opacity: 0 }}
            >
              <InitialsAvatar name={player.name} playerRole={player.role} ovr={player.ovr} size={96} />
            </YStack>
          )}
        </YStack>

        {/* Status text */}
        {stage < 4 ? (
          <XStack alignItems="center" gap="$1">
            <Text 
              fontFamily="$mono"
              fontSize={13}
              color="$colorMuted"
              animation="quick"
              opacity={stage >= 0 ? 1 : 0}
            >
              hatching
            </Text>
            <Text fontFamily="$mono" fontSize={13} color="$colorMuted">
              {"·".repeat(Math.min(stage + 1, 3))}
            </Text>
          </XStack>
        ) : (
          <YStack
            alignItems="center"
            animation="quick"
            enterStyle={{ opacity: 0, y: 10 }}
          >
            {/* Player name */}
            <Text
              fontFamily="$body"
              fontSize={20}
              fontWeight="700"
              color="$color"
              marginBottom="$2"
            >
              {player.name}
            </Text>

            {/* Role + Team */}
            <XStack alignItems="center" gap="$2" marginBottom="$2">
              <YStack
                backgroundColor={roleBg as any}
                paddingHorizontal="$2"
                paddingVertical={2}
                borderRadius={5}
              >
                <Text
                  fontFamily="$mono"
                  fontSize={10}
                  fontWeight="600"
                  color={roleText as any}
                >
                  {player.role}
                </Text>
              </YStack>
              <Text fontFamily="$mono" fontSize={11} color="$colorSecondary">
                {player.team}
              </Text>
            </XStack>

            {/* Success message */}
            <YStack
              backgroundColor="$colorAccentLight"
              paddingHorizontal="$3"
              paddingVertical="$1"
              borderRadius={8}
              marginBottom="$5"
            >
              <Text fontFamily="$mono" fontSize={11} fontWeight="600" color="$colorAccent">
                joined your squad! 🏏
              </Text>
            </YStack>

            {/* Tap to continue */}
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
              tap to continue
            </Text>
          </YStack>
        )}
      </ModalCard>
    </Overlay>
  );
}
