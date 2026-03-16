import { TextInput } from "react-native";
import { XStack, YStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../primitives/SportText";
import type { RuleDefinition } from "@draftplay/shared";

interface RuleEditorProps {
  rule: RuleDefinition;
  value: number | boolean | string;
  onChange: (key: string, value: number | boolean | string) => void;
  error?: string;
}

/**
 * RuleEditor — renders the appropriate control for a league rule definition.
 * Supports boolean (toggle), number (stepper), and select (pills) types.
 */
export function RuleEditor({ rule, value, onChange, error }: RuleEditorProps) {
  const theme = useTamaguiTheme();

  return (
    <YStack>
      <XStack justifyContent="space-between" alignItems="center" paddingVertical="$2" borderBottomWidth={1} borderBottomColor="$borderColor">
        <YStack flex={1} marginRight="$3">
          <Text fontFamily="$body" fontSize={13} fontWeight="600" color="$color">{rule.label}</Text>
          <Text fontFamily="$body" fontSize={11} color="$colorMuted">{rule.comfortDescription}</Text>
          {error && <Text fontFamily="$body" fontSize={10} color="$error" marginTop="$1">{error}</Text>}
        </YStack>
        {rule.type === "boolean" && (
          <BooleanToggle value={value as boolean} onToggle={() => onChange(rule.key, !value)} />
        )}
        {(rule.type === "number" || rule.type === "range") && (
          <NumberStepper
            value={value as number}
            step={rule.step ?? 1}
            min={rule.min}
            max={rule.max}
            onChange={(v) => onChange(rule.key, v)}
            theme={theme}
          />
        )}
        {rule.type === "select" && rule.options && (
          <SelectPills
            options={rule.options}
            value={value as string}
            onChange={(v) => onChange(rule.key, v)}
          />
        )}
      </XStack>
    </YStack>
  );
}

function BooleanToggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <XStack
      width={44}
      height={24}
      borderRadius={12}
      backgroundColor={value ? "$accentBackground" : "$backgroundSurfaceAlt"}
      position="relative"
      cursor="pointer"
      onPress={onToggle}
      pressStyle={{ opacity: 0.8 }}
      animation="quick"
    >
      <YStack
        width={18}
        height={18}
        borderRadius={9}
        position="absolute"
        top={3}
        left={value ? 23 : 3}
        backgroundColor={value ? "$backgroundSurface" : "$white"}
        alignItems="center"
        justifyContent="center"
        shadowColor="$shadowColor"
        shadowOffset={{ width: 0, height: 1 }}
        shadowOpacity={0.2}
        shadowRadius={3}
        elevation={2}
        animation="bouncy"
      />
    </XStack>
  );
}

function NumberStepper({
  value,
  step,
  min,
  max,
  onChange,
  theme,
}: {
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  theme: any;
}) {
  const decrement = () => {
    const next = Math.round((value - step) * 100) / 100;
    if (min !== undefined && next < min) return;
    onChange(next);
  };
  const increment = () => {
    const next = Math.round((value + step) * 100) / 100;
    if (max !== undefined && next > max) return;
    onChange(next);
  };
  const handleText = (text: string) => {
    const parsed = parseFloat(text);
    if (!isNaN(parsed)) onChange(parsed);
  };

  return (
    <XStack alignItems="center" gap="$1">
      <YStack
        width={28}
        height={28}
        borderRadius={6}
        backgroundColor="$backgroundSurface"
        alignItems="center"
        justifyContent="center"
        cursor="pointer"
        onPress={decrement}
        pressStyle={{ opacity: 0.7 }}
        opacity={min !== undefined && value <= min ? 0.3 : 1}
      >
        <Text fontFamily="$mono" fontSize={16} fontWeight="700" color="$color">{"\u2212"}</Text>
      </YStack>
      <TextInput
        value={String(value)}
        onChangeText={handleText}
        keyboardType="numeric"
        style={{
          width: 52,
          textAlign: "center",
          backgroundColor: theme.background.val,
          color: theme.color.val,
          borderRadius: 6,
          padding: 4,
          fontSize: 13,
          fontFamily: "DM Mono",
          fontWeight: "700",
          borderWidth: 1,
          borderColor: theme.borderColor.val,
        }}
      />
      <YStack
        width={28}
        height={28}
        borderRadius={6}
        backgroundColor="$backgroundSurface"
        alignItems="center"
        justifyContent="center"
        cursor="pointer"
        onPress={increment}
        pressStyle={{ opacity: 0.7 }}
        opacity={max !== undefined && value >= max ? 0.3 : 1}
      >
        <Text fontFamily="$mono" fontSize={16} fontWeight="700" color="$color">+</Text>
      </YStack>
    </XStack>
  );
}

function SelectPills({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <XStack flexWrap="wrap" gap="$1" justifyContent="flex-end" maxWidth="60%">
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <YStack
            key={opt.value}
            paddingHorizontal="$2"
            paddingVertical="$1"
            borderRadius={999}
            borderWidth={1}
            borderColor={isActive ? "$accentBackground" : "$borderColor"}
            backgroundColor={isActive ? "$accentBackground" : "transparent"}
            cursor="pointer"
            onPress={() => onChange(opt.value)}
            pressStyle={{ opacity: 0.8, scale: 0.97 }}
          >
            <Text
              fontFamily="$mono"
              fontSize={10}
              fontWeight="600"
              color={isActive ? "$white" : "$colorMuted"}
            >
              {opt.label}
            </Text>
          </YStack>
        );
      })}
    </XStack>
  );
}
