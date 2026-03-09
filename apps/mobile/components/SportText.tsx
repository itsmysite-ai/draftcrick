/**
 * Sport-aware Text for mobile app screens.
 * Uses the shared SportFontContext from @draftplay/ui.
 *
 * F1: ALL text is italic + bold (formula1.com style).
 */
import { Text as TamaguiText, type TextProps } from "tamagui";
import { useSportFont } from "@draftplay/ui";

export function Text(props: TextProps) {
  const { resolve, defaultBody, shouldItalicize, resolveFontWeight } = useSportFont();

  const fontFamily = props.fontFamily
    ? resolve(props.fontFamily as string)
    : defaultBody;

  const fontStyle = shouldItalicize() ? "italic" : props.fontStyle;
  const fontWeight = resolveFontWeight(props.fontWeight as any);

  return (
    <TamaguiText
      {...props}
      fontFamily={fontFamily as any}
      fontStyle={fontStyle as any}
      fontWeight={fontWeight as any}
    />
  );
}

export { type TextProps } from "tamagui";
