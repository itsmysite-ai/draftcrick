import { useState, useRef } from "react";
import { Pressable, Modal, TouchableWithoutFeedback } from "react-native";
import { XStack, YStack } from "tamagui";
import { Text } from "../primitives/SportText";
import { SportPrimaryIcon } from "./SportIcon";

/** Available sports */
const SPORTS = [
  { key: "cricket", label: "Cricket" },
  { key: "f1", label: "F1" },
] as const;

interface SportDropdownProps {
  activeSport: string;
  onSportChange: (sport: string) => void;
  accentColor?: string;
  textColor?: string;
  mutedColor?: string;
  surfaceColor?: string;
  borderColor?: string;
}

/**
 * SportDropdown — compact sport selector that shows a dropdown menu.
 * Designed to sit in the header bar next to the ModeToggle.
 */
export function SportDropdown({
  activeSport,
  onSportChange,
  accentColor = "#3D9968",
  textColor = "#EDECEA",
  mutedColor = "#5E5D5A",
  surfaceColor = "#1C1D1B",
  borderColor = "#333432",
}: SportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0, width: 0 });
  const triggerRef = useRef<any>(null);

  const activeSportConfig = SPORTS.find((s) => s.key === activeSport) ?? SPORTS[0];

  const handleOpen = () => {
    if (triggerRef.current) {
      triggerRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setDropdownPos({ x, y: y + height + 4, width: Math.max(width, 120) });
        setOpen(true);
      });
    } else {
      setOpen(true);
    }
  };

  const handleSelect = (key: string) => {
    onSportChange(key);
    setOpen(false);
  };

  return (
    <>
      <Pressable ref={triggerRef} onPress={handleOpen}>
        <XStack
          testID="sport-dropdown-trigger"
          alignItems="center"
          gap={5}
          paddingHorizontal={10}
          paddingVertical={5}
          borderRadius={8}
          backgroundColor={"$backgroundSurfaceAlt" as any}
          pressStyle={{ opacity: 0.7 }}
        >
          <SportPrimaryIcon sport={activeSport} size={13} color={accentColor} />
          <Text
            fontFamily="$mono"
            fontSize={11}
            fontWeight="600"
            color="$color"
            textTransform="uppercase"
            letterSpacing={0.3}
          >
            {activeSportConfig.label}
          </Text>
          <Text fontSize={8} color="$colorMuted" marginLeft={-2}>▼</Text>
        </XStack>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <YStack flex={1}>
            <YStack
              position="absolute"
              top={dropdownPos.y}
              left={dropdownPos.x}
              minWidth={dropdownPos.width}
              backgroundColor={surfaceColor as any}
              borderRadius={10}
              borderWidth={1}
              borderColor={borderColor as any}
              overflow="hidden"
              shadowColor="#000"
              shadowOffset={{ width: 0, height: 4 }}
              shadowOpacity={0.25}
              shadowRadius={12}
              elevation={8}
              zIndex={999}
            >
              {SPORTS.map(({ key, label }) => {
                const isActive = key === activeSport;
                return (
                  <Pressable key={key} onPress={() => handleSelect(key)}>
                    <XStack
                      testID={`sport-option-${key}`}
                      alignItems="center"
                      gap={8}
                      paddingHorizontal={14}
                      paddingVertical={10}
                      backgroundColor={isActive ? (`${accentColor}15` as any) : ("transparent" as any)}
                    >
                      <SportPrimaryIcon sport={key} size={14} color={isActive ? accentColor : mutedColor} />
                      <Text
                        fontFamily="$mono"
                        fontSize={12}
                        fontWeight={isActive ? "700" : "500"}
                        color={isActive ? (accentColor as any) : (textColor as any)}
                        textTransform="uppercase"
                        letterSpacing={0.3}
                      >
                        {label}
                      </Text>
                      {isActive && (
                        <Text fontSize={10} color={accentColor as any} marginLeft="auto">✓</Text>
                      )}
                    </XStack>
                  </Pressable>
                );
              })}
            </YStack>
          </YStack>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
