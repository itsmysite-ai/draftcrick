import { styled, YStack } from "tamagui";

export const Card = styled(YStack, {
  backgroundColor: "$backgroundSurface",
  borderRadius: "$3", // 12px
  padding: "$4",
  borderWidth: 1,
  borderColor: "$borderColor",

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
        pressStyle: {
          scale: 0.98,
          backgroundColor: "$backgroundSurfaceHover",
        },
        cursor: "pointer",
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
