import { createAnimations } from "@tamagui/animations-css";

/**
 * Animation configs for DraftCrick.
 * Spring-based for native feel (Reanimated on mobile, CSS on web).
 */
export const animations = createAnimations({
  fast: "ease-in 150ms",
  medium: "ease-in 300ms",
  slow: "ease-in 450ms",
  bouncy: "ease-in-out 300ms",
  lazy: "ease-in 600ms",
});
