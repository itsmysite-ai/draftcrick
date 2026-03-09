import { XStack } from "tamagui";
import { Text } from "../primitives/SportText";
import { SportPrimaryIcon } from "./SportIcon";

/** Available sports for the picker — matches AVAILABLE_SPORTS in @draftplay/shared */
const PICKER_SPORTS = [
  { key: "cricket", displayName: "Cricket" },
  { key: "f1", displayName: "F1" },
] as const;

interface SportPickerProps {
  activeSport: string;
  onSportChange: (sport: string) => void;
  accentColor?: string;
  textColor?: string;
  mutedColor?: string;
  bgColor?: string;
}

/**
 * Horizontal pill bar for switching between sports.
 * Shows sport icon + display name. Active sport is highlighted.
 */
export function SportPicker({
  activeSport,
  onSportChange,
  accentColor = "#3D9968",
  textColor = "#EDECEA",
  mutedColor = "#5E5D5A",
  bgColor = "transparent",
}: SportPickerProps) {
  return (
    <XStack gap="$2" alignItems="center" paddingHorizontal="$3">
      {PICKER_SPORTS.map(({ key, displayName }) => {
        const isActive = key === activeSport;

        return (
          <XStack
            key={key}
            testID={`sport-picker-${key}`}
            alignItems="center"
            gap={6}
            paddingHorizontal="$3"
            paddingVertical={6}
            borderRadius="$round"
            backgroundColor={(isActive ? `${accentColor}18` : bgColor) as any}
            borderWidth={1}
            borderColor={(isActive ? accentColor : "transparent") as any}
            pressStyle={{ opacity: 0.7, scale: 0.97 }}
            cursor="pointer"
            onPress={() => onSportChange(key)}
          >
            <SportPrimaryIcon
              sport={key}
              size={14}
              color={isActive ? accentColor : mutedColor}
            />
            <Text
              fontSize={12}
              fontWeight="600"
              fontFamily="$body"
              color={(isActive ? textColor : mutedColor) as any}
              textTransform="uppercase"
              letterSpacing={0.5}
            >
              {displayName}
            </Text>
          </XStack>
        );
      })}
    </XStack>
  );
}
