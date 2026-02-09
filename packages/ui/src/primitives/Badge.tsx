import { styled, Text } from "tamagui";

export const Badge = styled(Text, {
  paddingHorizontal: "$2",
  paddingVertical: "$1",
  borderRadius: "$6", // 24px - chip/badge radius
  fontSize: 12,
  fontWeight: "600",
  overflow: "hidden",

  variants: {
    variant: {
      default: {
        backgroundColor: "$backgroundSurface",
        color: "$color",
      },
      success: {
        backgroundColor: "$green",
        color: "$navy",
      },
      warning: {
        backgroundColor: "$amber",
        color: "$navy",
      },
      danger: {
        backgroundColor: "$red",
        color: "$white",
      },
      live: {
        backgroundColor: "$red",
        color: "$white",
      },
      captain: {
        backgroundColor: "$amber",
        color: "$navy",
      },
      role: {
        backgroundColor: "$charcoal",
        color: "$green",
      },
    },
    size: {
      sm: {
        fontSize: 10,
        paddingHorizontal: "$1",
        paddingVertical: 2,
      },
      md: {
        fontSize: 12,
        paddingHorizontal: "$2",
        paddingVertical: "$1",
      },
      lg: {
        fontSize: 14,
        paddingHorizontal: "$3",
        paddingVertical: "$1",
      },
    },
  } as const,

  defaultVariants: {
    variant: "default",
    size: "md",
  },
});
