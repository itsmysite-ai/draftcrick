import { YStack, XStack, Text, type GetProps } from "tamagui";

type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

interface InitialsAvatarProps extends Omit<GetProps<typeof YStack>, "children" | "role"> {
  name: string;
  playerRole: RoleKey;
  ovr: number;
  size?: number;
  imageUrl?: string; // Future: AI-generated portraits
}

/**
 * InitialsAvatar — Player avatar with role-colored background
 * Shows player initials (first + last name) with OVR badge
 * Future-proof for AI-generated portraits via imageUrl prop
 */
export function InitialsAvatar({
  name,
  playerRole,
  ovr,
  size = 46,
  imageUrl,
  ...props
}: InitialsAvatarProps) {
  const initials = getInitials(name);

  // Role color tokens based on current mode
  const roleBg = `$role${playerRole}Bg` as const;
  const roleText = `$role${playerRole}Text` as const;

  return (
    <YStack
      width={size}
      height={size}
      borderRadius={Math.round(size * 0.3)} // ~30% for rounded square
      backgroundColor={roleBg as any}
      alignItems="center"
      justifyContent="center"
      position="relative"
      animation="bouncy"
      {...props}
    >
      {/* Future: Image support */}
      {imageUrl ? (
        <YStack
          width="100%"
          height="100%"
          borderRadius={Math.round(size * 0.3)}
          overflow="hidden"
        >
          {/* <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} /> */}
        </YStack>
      ) : (
        <Text
          fontFamily="$mono"
          fontSize={size * 0.36}
          fontWeight="500"
          color={roleText as any}
          letterSpacing={1}
          lineHeight={size * 0.36}
        >
          {initials}
        </Text>
      )}

      {/* OVR Badge */}
      <XStack
        position="absolute"
        bottom={-5}
        right={-5}
        backgroundColor="$color"
        paddingHorizontal={5}
        paddingVertical={1}
        borderRadius={6}
      >
        <Text
          fontFamily="$mono"
          fontSize={9}
          fontWeight="700"
          color="$background"
          lineHeight={16}
        >
          {ovr}
        </Text>
      </XStack>
    </YStack>
  );
}

/**
 * Derives initials from player name
 * First letter of first name + first letter of last name
 * For compound names: Quinton de Kock → QK
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) {
    const first = parts[0];
    return first ? first.substring(0, 2).toUpperCase() : "??";
  }
  const firstInitial = parts[0]?.[0] ?? "";
  const lastInitial = parts[parts.length - 1]?.[0] ?? "";
  return (firstInitial + lastInitial).toUpperCase() || "??";
}
