import { styled, Text } from "tamagui";

export const Badge = styled(Text, {
  paddingHorizontal: "$2",
  paddingVertical: "$1",
  borderRadius: "$6", // 24px - chip/badge radius
  fontFamily: "$mono",
  fontWeight: "600",
  overflow: "hidden",
  
  // Disable Tamagui's automatic font size lookup
  fontStyle: undefined,
  textTransform: undefined,

  variants: {
    variant: {
      default: {
        backgroundColor: "$backgroundSurface",
        color: "$color",
      },
      success: {
        backgroundColor: "$success",
        color: "$white",
      },
      warning: {
        backgroundColor: "$warning",
        color: "$charcoalDeep",
      },
      danger: {
        backgroundColor: "$error",
        color: "$white",
      },
      live: {
        backgroundColor: "$live",
        color: "$white",
        shadowColor: "$liveGlow",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      captain: {
        backgroundColor: "$cricket",
        color: "$white",
      },
      role: {
        backgroundColor: "$backgroundSurfaceAlt",
        color: "$colorAccent",
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
}) as any; // Cast to any to bypass Tamagui's size prop type checking
