import { styled, YStack } from "tamagui";

export const Card = styled(YStack, {
  backgroundColor: "$backgroundSurface",
  borderRadius: 16, // 16px - tami·draft card radius
  padding: "$4",
  borderWidth: 1,
  borderColor: "$borderColor",
  animation: "quick",

  variants: {
    elevated: {
      true: {
        shadowColor: "$shadowColor",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      },
    },
    pressable: {
      true: {
        cursor: "pointer",
        hoverStyle: {
          borderColor: "$accentBackground",
          borderOpacity: 0.35,
        },
        pressStyle: {
          scale: 0.98,
        },
      },
    },
    live: {
      true: {
        borderColor: "$error",
        borderWidth: 2,
      },
    },
  } as const,
});
