import { styled, Button as TamaguiButton } from "tamagui";

export const Button = styled(TamaguiButton, {
  borderRadius: 10, // 10px - draftplay.ai button radius
  fontFamily: "$mono", // DM Mono for all buttons
  fontWeight: "500",
  pressStyle: {
    scale: 0.97,
    opacity: 0.85,
  },

  variants: {
    variant: {
      primary: {
        backgroundColor: "$accentBackground",
        color: "$accentColor",
        hoverStyle: {
          backgroundColor: "$colorAccentHover",
          scale: 1.02,
          opacity: 0.92,
        },
      },
      secondary: {
        backgroundColor: "$backgroundSurface",
        color: "$color",
        borderWidth: 1,
        borderColor: "$borderColor",
        hoverStyle: {
          backgroundColor: "$backgroundHover",
          borderColor: "$colorAccent",
          scale: 1.02,
        },
      },
      accent: {
        backgroundColor: "$accentBackground",
        color: "$accentColor",
        hoverStyle: {
          backgroundColor: "$colorAccentHover",
          scale: 1.02,
          opacity: 0.92,
        },
      },
      danger: {
        backgroundColor: "$error",
        color: "#FFFFFF",
        hoverStyle: {
          opacity: 0.85,
          scale: 1.02,
        },
      },
      ghost: {
        backgroundColor: "transparent",
        color: "$color",
        hoverStyle: {
          backgroundColor: "$backgroundPress",
          scale: 1.02,
        },
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
