import { styled, Button as TamaguiButton } from "tamagui";

export const Button = styled(TamaguiButton, {
  borderRadius: 10, // 10px - tami·draft button radius
  fontFamily: "$mono", // DM Mono for all buttons
  fontWeight: "500",
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
        backgroundColor: "$backgroundSurfaceAlt",
        color: "$colorMuted",
        hoverStyle: {
          backgroundColor: "$accentBackground",
          color: "$white",
        },
      },
      accent: {
        backgroundColor: "$accentBackground",
        color: "$white",
      },
      danger: {
        backgroundColor: "$error",
        color: "$white",
      },
      ghost: {
        backgroundColor: "transparent",
        color: "$color",
      },
    },
    size: {
      sm: {
        height: 32,
        paddingHorizontal: "$4",
        fontSize: 11,
      },
      md: {
        height: 40,
        paddingHorizontal: "$5",
        fontSize: 13,
      },
      lg: {
        height: 48,
        paddingHorizontal: "$6",
        fontSize: 15,
      },
    },
  } as const,

  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});
