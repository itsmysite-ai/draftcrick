import { YStack, XStack, styled } from "tamagui";
import { Text } from "../primitives/SportText";
import { Button } from "../primitives/Button";
import { formatUIText } from "../constants/designSystem";

export interface AlertAction {
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  onPress: () => void;
}

export interface AlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  actions: AlertAction[];
  onDismiss?: () => void;
}

const Overlay = styled(YStack, {
  position: "fixed" as any,
  inset: 0,
  zIndex: 200,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "$colorOverlay",
  animation: "quick" as any,
});

const ModalCard = styled(YStack, {
  backgroundColor: "$backgroundSurface",
  borderRadius: 20,
  padding: "$5",
  minWidth: 300,
  maxWidth: 360,
  borderWidth: 1,
  borderColor: "$borderColor",
  shadowColor: "$shadowColor",
  shadowOffset: { width: 0, height: 16 },
  shadowOpacity: 0.25,
  shadowRadius: 32,
  elevation: 10,
  animation: "quick" as any,
  enterStyle: {
    scale: 0.94,
    opacity: 0,
    y: 8,
  },
});

/**
 * AlertModal — cross-platform custom alert/confirm dialog.
 * Replaces native Alert.alert / window.confirm with a styled modal
 * that matches the draftplay.ai design system.
 */
export function AlertModal({ visible, title, message, actions, onDismiss }: AlertModalProps) {
  if (!visible) return null;

  return (
    <Overlay onPress={onDismiss}>
      <ModalCard onPress={(e: any) => e.stopPropagation()}>
        <Text
          fontFamily="$body"
          fontWeight="700"
          fontSize={17}
          color="$color"
          marginBottom="$2"
        >
          {formatUIText(title)}
        </Text>
        <Text
          fontFamily="$body"
          fontSize={13}
          color="$colorSecondary"
          lineHeight={20}
          marginBottom="$5"
        >
          {formatUIText(message)}
        </Text>
        <XStack gap="$3" justifyContent="flex-end">
          {actions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant ?? (i === actions.length - 1 ? "primary" : "ghost")}
              size="md"
              onPress={action.onPress}
              flex={actions.length <= 2 ? 1 : undefined}
            >
              {formatUIText(action.label)}
            </Button>
          ))}
        </XStack>
      </ModalCard>
    </Overlay>
  );
}
