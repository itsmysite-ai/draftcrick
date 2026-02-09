import { styled, Button as TamaguiButton } from "tamagui";

export const Button = styled(TamaguiButton, {
  borderRadius: "$3", // 12px
  fontWeight: "600",
  pressStyle: {
    scale: 0.97,
    opacity: 0.9,
  },

  variants: {
    variant: {
      primary: {
        backgroundColor: "$accentBackground",
        color: "$accentColor",
      },
      secondary: {
        backgroundColor: "$backgroundSurface",
        color: "$color",
        borderWidth: 1,
        borderColor: "$borderColor",
      },
      danger: {
        backgroundColor: "$red",
        color: "$white",
      },
      ghost: {
        backgroundColor: "transparent",
        color: "$color",
      },
    },
    size: {
      sm: {
        height: 36,
        paddingHorizontal: "$3",
        fontSize: 13,
      },
      md: {
        height: 44,
        paddingHorizontal: "$4",
        fontSize: 15,
      },
      lg: {
        height: 52,
        paddingHorizontal: "$6",
        fontSize: 17,
      },
      // Comfort Mode: larger touch targets (48px minimum)
      comfort: {
        height: 56,
        paddingHorizontal: "$6",
        fontSize: 18,
      },
    },
  } as const,

  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});
