import { XStack, YStack, Text, type GetProps } from "tamagui";

interface ModeToggleProps extends Omit<GetProps<typeof XStack>, "children"> {
  mode: "light" | "dark";
  onToggle: () => void;
}

/**
 * ModeToggle — Sun/moon pill switch for theme toggle
 * Pill-shaped toggle (44×24px) with sliding circle
 * Light mode: surfaceAlt track, dark mode: accent track
 */
export function ModeToggle({ mode, onToggle, ...props }: ModeToggleProps) {
  return (
    <XStack
      width={44}
      height={24}
      borderRadius={12}
      backgroundColor={mode === "dark" ? "$accentBackground" : "$backgroundSurfaceAlt"}
      position="relative"
      cursor="pointer"
      onPress={onToggle}
      pressStyle={{ opacity: 0.8 }}
      animation="quick"
      {...props}
    >
      <YStack
        width={18}
        height={18}
        borderRadius={9}
        position="absolute"
        top={3}
        left={mode === "dark" ? 23 : 3}
        backgroundColor={mode === "dark" ? "$backgroundSurface" : "$white"}
        alignItems="center"
        justifyContent="center"
        shadowColor="$shadowColor"
        shadowOffset={{ width: 0, height: 1 }}
        shadowOpacity={0.2}
        shadowRadius={3}
        elevation={2}
        animation="bouncy"
      >
        <Text fontSize={10}>{mode === "dark" ? "🌙" : "☀️"}</Text>
      </YStack>
    </XStack>
  );
}
