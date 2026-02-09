import { styled, XStack } from "tamagui";

/**
 * FilterPill — Role filter button with rounded pill shape
 * Used for filtering players by role, format, etc.
 * Active state inverts colors
 */
export const FilterPill = styled(XStack, {
  paddingHorizontal: "$3",
  paddingVertical: "$2",
  borderRadius: "$round", // Pill shape
  borderWidth: 1,
  borderColor: "$borderColor",
  backgroundColor: "$backgroundSurface",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  pressStyle: {
    opacity: 0.8,
    scale: 0.97,
  },

  variants: {
    active: {
      true: {
        backgroundColor: "$color",
        borderColor: "$color",
      },
    },
  } as const,

  defaultVariants: {
    active: false,
  },
});
