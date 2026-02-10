import { styled, XStack } from "tamagui";

/**
 * SegmentTab — Segmented control tab button
 * Used in tab switchers (Draft/Team, Browse/My Contests, etc.)
 * Container uses surfaceAlt, active tab uses surface with shadow
 */
export const SegmentTab = styled(XStack, {
  flex: 1,
  paddingVertical: "$3",
  borderRadius: "$3",
  alignItems: "center",
  justifyContent: "center",
  gap: "$2",
  cursor: "pointer",
  pressStyle: {
    opacity: 0.9,
  },

  variants: {
    active: {
      true: {
        backgroundColor: "$backgroundSurface",
        shadowColor: "$shadowColor",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      },
      false: {
        backgroundColor: "transparent",
      },
    },
  } as const,

  defaultVariants: {
    active: false,
  },
});
