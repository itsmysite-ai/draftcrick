/**
 * Paywall — modal overlay shown when a user tries to access a tier-gated feature.
 * Shows lock icon, feature name, required tier, and upgrade CTA.
 */

import { XStack, YStack, Text } from "tamagui";
import { DesignSystem } from "../constants/designSystem";
import { TierBadge } from "./TierBadge";

const formatUIText = DesignSystem.textCasing.ui;
const formatBadgeText = DesignSystem.textCasing.badge;

export interface PaywallProps {
  /** Which tier is required to access this feature */
  requiredTier: "pro" | "elite";
  /** Name of the feature being gated */
  featureName: string;
  /** Brief description of what the feature does */
  description?: string;
  /** Called when user taps "Upgrade" */
  onUpgrade: () => void;
  /** Called when user taps dismiss / backdrop */
  onDismiss: () => void;
  /** Whether the modal is visible */
  visible: boolean;
  testID?: string;
}

export function Paywall({
  requiredTier,
  featureName,
  description,
  onUpgrade,
  onDismiss,
  visible,
  testID = "paywall",
}: PaywallProps) {
  if (!visible) return null;

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      backgroundColor="rgba(0,0,0,0.6)"
      justifyContent="center"
      alignItems="center"
      zIndex={1000}
      onPress={onDismiss}
      testID={testID}
    >
      <YStack
        backgroundColor="$backgroundSurface"
        borderRadius="$4"
        padding="$6"
        marginHorizontal="$6"
        maxWidth={340}
        width="100%"
        alignItems="center"
        gap="$4"
        onPress={(e: any) => e.stopPropagation()}
        testID={`${testID}-card`}
      >
        {/* Lock icon */}
        <YStack
          width={56}
          height={56}
          borderRadius={28}
          backgroundColor="$colorAccentLight"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize={28}>🔒</Text>
        </YStack>

        {/* Feature name */}
        <Text
          fontFamily="$heading"
          fontSize={20}
          fontWeight="700"
          color="$color"
          textAlign="center"
        >
          {featureName}
        </Text>

        {/* Description */}
        {description && (
          <Text
            fontFamily="$body"
            fontSize={14}
            color="$colorSecondary"
            textAlign="center"
            lineHeight={20}
          >
            {description}
          </Text>
        )}

        {/* Required tier */}
        <XStack alignItems="center" gap="$2">
          <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
            {formatBadgeText("requires")}
          </Text>
          <TierBadge tier={requiredTier} size="md" />
        </XStack>

        {/* Upgrade CTA */}
        <YStack
          backgroundColor="$accentBackground"
          paddingVertical="$3"
          paddingHorizontal="$6"
          borderRadius="$3"
          width="100%"
          alignItems="center"
          onPress={onUpgrade}
          cursor="pointer"
          pressStyle={{ opacity: 0.85 }}
          testID={`${testID}-upgrade-btn`}
        >
          <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$accentColor">
            {formatUIText(`upgrade to ${requiredTier}`)}
          </Text>
        </YStack>

        {/* Dismiss */}
        <Text
          fontFamily="$body"
          fontSize={13}
          color="$colorMuted"
          onPress={onDismiss}
          cursor="pointer"
          testID={`${testID}-dismiss-btn`}
        >
          {formatUIText("maybe later")}
        </Text>
      </YStack>
    </YStack>
  );
}
