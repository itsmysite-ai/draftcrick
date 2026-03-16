import { type ReactNode, useState } from "react";
import { Image } from "react-native";
import { YStack, XStack, type GetProps } from "tamagui";
import { Text } from "../primitives/SportText";

type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

interface InitialsAvatarProps extends Omit<GetProps<typeof YStack>, "children" | "role"> {
  name: string;
  playerRole: RoleKey;
  ovr: number | string;
  size?: number;
  imageUrl?: string | null;
  hideBadge?: boolean;
  /** Custom badge content — replaces the default OVR text badge */
  badgeContent?: ReactNode;
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
  hideBadge,
  badgeContent,
  ...props
}: InitialsAvatarProps) {
  const initials = getInitials(name);
  const [imgError, setImgError] = useState(false);

  // Role color tokens based on current mode
  const roleBg = `$role${playerRole}Bg` as const;
  const roleText = `$role${playerRole}Text` as const;

  const showImage = !!imageUrl && !imgError;
  const radius = Math.round(size * 0.3);

  return (
    <YStack
      width={size}
      height={size}
      borderRadius={radius}
      backgroundColor={roleBg as any}
      alignItems="center"
      justifyContent="center"
      position="relative"
      animation="bouncy"
      {...props}
    >
      {showImage ? (
        <YStack
          width="100%"
          height="100%"
          borderRadius={radius}
          overflow="hidden"
        >
          <Image
            source={{ uri: imageUrl! }}
            style={{ width: size, height: size }}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        </YStack>
      ) : (
        <Text
          fontFamily="$mono"
          fontSize={initials.length > 2 ? size * 0.28 : size * 0.36}
          fontWeight="500"
          color={roleText as any}
          letterSpacing={initials.length > 2 ? 0.5 : 1}
          lineHeight={initials.length > 2 ? size * 0.28 : size * 0.36}
        >
          {initials}
        </Text>
      )}

      {/* Badge — show custom badge content always, but hide default OVR when image is showing */}
      {!hideBadge && (!showImage || badgeContent) && (
        <XStack
          position="absolute"
          bottom={size <= 36 ? -3 : -5}
          right={size <= 36 ? -3 : -5}
          backgroundColor="$color"
          paddingHorizontal={size <= 36 ? 3 : 5}
          paddingVertical={size <= 36 ? 1 : 2}
          borderRadius={size <= 36 ? 5 : 6}
          alignItems="center"
          justifyContent="center"
          minWidth={size <= 36 ? 16 : 18}
          minHeight={size <= 36 ? 16 : 18}
        >
          {badgeContent ?? (
            <Text
              fontFamily="$mono"
              fontSize={size <= 36 ? 8 : 9}
              fontWeight="700"
              color="$background"
              lineHeight={size <= 36 ? 14 : 16}
            >
              {ovr}
            </Text>
          )}
        </XStack>
      )}
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
    if (!first) return "??";
    // Short abbreviations (RCB, SRH, MI, DC) — show full text
    if (first.length <= 4) return first.toUpperCase();
    return first.substring(0, 2).toUpperCase();
  }
  const firstInitial = parts[0]?.[0] ?? "";
  const lastInitial = parts[parts.length - 1]?.[0] ?? "";
  return (firstInitial + lastInitial).toUpperCase() || "??";
}
