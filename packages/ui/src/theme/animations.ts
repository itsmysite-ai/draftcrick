import { createAnimations } from "@tamagui/animations-css";

/**
 * tami·draft animations.
 * Mode toggle: 0.3s spring easing for pill, 0.4s ease for surfaces.
 * Hatch modal: spring easing for wobble/reveal.
 */
export const animations = createAnimations({
  fast: "ease-in 150ms",
  medium: "ease-in 300ms",
  slow: "ease-out 400ms",
  bouncy: "cubic-bezier(.34,1.56,.64,1) 300ms",
  lazy: "ease-in 600ms",
  spring: "cubic-bezier(.34,1.2,.64,1) 300ms",
  themeSwitch: "ease 400ms",
});
