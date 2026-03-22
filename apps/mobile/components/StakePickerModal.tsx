/**
 * Stake Picker Modal — H2H challenge stake selection.
 *
 * Preset stakes: Free | 10 | 25 | 50 | 100 | Custom
 * Shows user's current PlayCoins balance.
 */

import { Modal, Pressable, TextInput } from "react-native";
import { useState } from "react";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "./SportText";
import {
  Card,
  Badge,
  Button,
  FilterPill,
  formatUIText,
  formatBadgeText,
} from "@draftplay/ui";

const PRESET_STAKES = [0, 10, 25, 50, 100] as const;

interface StakePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (stake: number) => void;
  teamA: string;
  teamB: string;
  userBalance?: number;
  isCreating?: boolean;
}

export function StakePickerModal({
  visible,
  onClose,
  onConfirm,
  teamA,
  teamB,
  userBalance = 0,
  isCreating = false,
}: StakePickerModalProps) {
  const theme = useTamaguiTheme();
  const [selectedStake, setSelectedStake] = useState<number>(0);
  const [customStake, setCustomStake] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const effectiveStake = showCustom ? (parseInt(customStake, 10) || 0) : selectedStake;
  const hasEnoughBalance = effectiveStake === 0 || userBalance >= effectiveStake;

  const handleConfirm = () => {
    if (!hasEnoughBalance) return;
    onConfirm(effectiveStake);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
        <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />

        <Animated.View entering={SlideInDown.duration(300).springify()} style={{ width: "90%", maxWidth: 360, backgroundColor: theme.background.val, borderRadius: 16, padding: 20, elevation: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}>
          {/* Title */}
          <YStack alignItems="center" marginBottom="$4">
            <Text fontSize={24} marginBottom="$2">⚔️</Text>
            <Text fontFamily="$body" fontWeight="700" fontSize={18} color="$color" textAlign="center">
              {formatUIText("challenge a friend")}
            </Text>
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted" marginTop="$1">
              {teamA} vs {teamB}
            </Text>
          </YStack>

          {/* Stake Label */}
          <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5} marginBottom="$2">
            {formatBadgeText("set stake")}
          </Text>

          {/* Preset Stakes — 3-column grid for uniform sizing */}
          <XStack flexWrap="wrap" gap="$2" marginBottom="$3">
            {[...PRESET_STAKES, -1].map((amount) => {
              const isCustom = amount === -1;
              const isActive = isCustom ? showCustom : (!showCustom && selectedStake === amount);
              return (
                <FilterPill
                  key={amount}
                  active={isActive}
                  onPress={() => {
                    if (isCustom) { setShowCustom(true); }
                    else { setSelectedStake(amount); setShowCustom(false); }
                  }}
                  minWidth="30%"
                  flex={1}
                  flexBasis="30%"
                >
                  <Text
                    fontFamily="$mono"
                    fontSize={12}
                    fontWeight="700"
                    color={isActive ? "$background" : "$colorMuted"}
                  >
                    {isCustom ? formatUIText("custom") : amount === 0 ? formatUIText("free") : `${amount} PC`}
                  </Text>
                </FilterPill>
              );
            })}
          </XStack>

          {/* Custom Input */}
          {showCustom && (
            <XStack alignItems="center" gap="$2" marginBottom="$3">
              <TextInput
                value={customStake}
                onChangeText={(t) => setCustomStake(t.replace(/[^0-9]/g, ""))}
                placeholder="0"
                placeholderTextColor={theme.colorMuted?.val}
                keyboardType="number-pad"
                maxLength={5}
                style={{
                  flex: 1,
                  fontFamily: "monospace",
                  fontSize: 16,
                  fontWeight: "700",
                  color: theme.color?.val,
                  backgroundColor: theme.backgroundSurface?.val,
                  borderWidth: 1,
                  borderColor: theme.borderColor?.val,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  textAlign: "center",
                }}
              />
              <Text fontFamily="$mono" fontSize={12} color="$colorMuted">PC</Text>
            </XStack>
          )}

          {/* Balance */}
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
              {formatUIText("your balance")}
            </Text>
            <Text fontFamily="$mono" fontWeight="700" fontSize={13} color={hasEnoughBalance ? "$color" : "$error"}>
              {userBalance.toLocaleString()} PC
            </Text>
          </XStack>

          {!hasEnoughBalance && (
            <Text fontFamily="$body" fontSize={11} color="$error" textAlign="center" marginBottom="$3">
              {formatUIText("not enough playcoins for this stake")}
            </Text>
          )}

          {/* Action Buttons */}
          <XStack gap="$3">
            <Button variant="secondary" size="md" flex={1} onPress={onClose}>
              {formatUIText("cancel")}
            </Button>
            <Button
              variant="primary"
              size="md"
              flex={2}
              disabled={!hasEnoughBalance || isCreating}
              opacity={!hasEnoughBalance ? 0.4 : 1}
              onPress={handleConfirm}
              testID="create-challenge-btn"
            >
              {isCreating ? formatUIText("creating...") : effectiveStake === 0 ? formatUIText("create free duel") : formatUIText(`stake ${effectiveStake} PC`)}
            </Button>
          </XStack>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
