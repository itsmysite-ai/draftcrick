import { TextInput, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { BackButton, Button, Card, ModeToggle, formatUIText } from "@draftcrick/ui";
import { trpc } from "../../../lib/trpc";
import { useTheme } from "../../../providers/ThemeProvider";
import { RULE_CATEGORY_LABELS, getRulesByCategory, type RuleCategory } from "@draftcrick/shared";

const CATEGORIES: RuleCategory[] = ["teamComposition", "scoring", "boosters", "transfers", "playoffs", "salary", "autoManagement", "scoringModifiers", "draft", "auction"];

export default function LeagueSettingsScreen() {
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const { data: league, refetch } = trpc.league.getById.useQuery({ id: leagueId! });
  const updateMutation = trpc.league.updateSettings.useMutation({ onSuccess: () => { Alert.alert("Settings updated!"); refetch(); } });
  const regenCodeMutation = trpc.league.regenerateInviteCode.useMutation({ onSuccess: () => refetch() });
  const [name, setName] = useState("");
  const [maxMembers, setMaxMembers] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<RuleCategory | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => { if (league) { setName(league.name); setMaxMembers(String(league.maxMembers)); } }, [league]);

  const rules = (league?.rules ?? {}) as Record<string, unknown>;
  const handleSave = () => { updateMutation.mutate({ leagueId: leagueId!, name: name.trim() || undefined, maxMembers: parseInt(maxMembers) || undefined }); };
  const handleRegenCode = () => { Alert.alert("Regenerate Code?", "The current invite code will stop working.", [{ text: "Cancel", style: "cancel" }, { text: "Regenerate", onPress: () => regenCodeMutation.mutate({ leagueId: leagueId! }) }]); };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background.val }} contentContainerStyle={{ padding: 16 }}>
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingTop={insets.top + 8}
        paddingBottom="$3"
        marginBottom="$5"
      >
        <XStack alignItems="center" gap="$3">
          <BackButton onPress={() => router.back()} />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("league settings")}
          </Text>
        </XStack>
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>
      <Card padding="$4" marginBottom="$4">
        <Text fontFamily="$mono" fontSize={12} color="$colorMuted" fontWeight="600" marginBottom="$2">BASIC SETTINGS</Text>
        <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginBottom="$1">League Name</Text>
        <TextInput value={name} onChangeText={setName} style={{ backgroundColor: theme.background.val, color: theme.color.val, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.borderColor.val, marginBottom: 12 }} />
        <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginBottom="$1">Max Members</Text>
        <TextInput value={maxMembers} onChangeText={setMaxMembers} keyboardType="numeric" style={{ backgroundColor: theme.background.val, color: theme.color.val, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.borderColor.val, marginBottom: 12 }} />
        <Button variant="primary" size="md" onPress={handleSave} disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving..." : "Save Changes"}</Button>
      </Card>
      <Card padding="$4" marginBottom="$4">
        <Text fontFamily="$mono" fontSize={12} color="$colorMuted" fontWeight="600" marginBottom="$2">INVITE CODE</Text>
        <Text fontFamily="$mono" fontSize={20} fontWeight="700" color="$accentBackground" letterSpacing={2} marginBottom="$3">{league?.inviteCode ?? "---"}</Text>
        <Button variant="danger" size="sm" onPress={handleRegenCode}>Regenerate Code</Button>
      </Card>
      <YStack marginBottom="$4">
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
          <Text fontFamily="$heading" fontWeight="700" fontSize={18} color="$color">League Rules</Text>
          <XStack onPress={() => setShowAdvanced(!showAdvanced)} cursor="pointer"><Text fontFamily="$body" fontSize={13} color="$accentBackground">{showAdvanced ? "Simple Mode" : "Advanced Mode"}</Text></XStack>
        </XStack>
        {CATEGORIES.map((cat) => {
          const catRules = getRulesByCategory(cat);
          const displayRules = showAdvanced ? catRules : catRules.filter((r) => !r.advanced);
          if (displayRules.length === 0) return null;
          const isExpanded = expandedCategory === cat;
          return (
            <YStack key={cat} marginBottom="$2">
              <XStack backgroundColor="$backgroundSurface" borderTopLeftRadius="$3" borderTopRightRadius="$3" borderBottomLeftRadius={isExpanded ? 0 : "$3"} borderBottomRightRadius={isExpanded ? 0 : "$3"} padding="$4" justifyContent="space-between" alignItems="center" onPress={() => setExpandedCategory(isExpanded ? null : cat)} cursor="pointer" pressStyle={{ opacity: 0.8 }}>
                <Text fontFamily="$body" fontWeight="600" fontSize={15} color="$color">{RULE_CATEGORY_LABELS[cat]}</Text>
                <Text fontFamily="$body" fontSize={14} color="$colorMuted">{isExpanded ? "\u2212" : "+"}</Text>
              </XStack>
              {isExpanded && (
                <YStack backgroundColor="$backgroundSurface" borderBottomLeftRadius="$3" borderBottomRightRadius="$3" padding="$4" paddingTop="$1" borderTopWidth={1} borderTopColor="$borderColor">
                  {displayRules.map((rule) => {
                    const keyParts = rule.key.split("."); const categoryKey = keyParts[0]!; const ruleKey = keyParts[1]!;
                    const categoryRules = (rules[categoryKey] ?? rules) as Record<string, unknown>;
                    const currentValue = categoryRules[ruleKey] ?? rule.default;
                    return (
                      <XStack key={rule.key} justifyContent="space-between" alignItems="center" paddingVertical="$2" borderBottomWidth={1} borderBottomColor="$borderColor">
                        <YStack flex={1} marginRight="$3">
                          <Text fontFamily="$body" fontSize={13} fontWeight="600" color="$color">{rule.label}</Text>
                          <Text fontFamily="$body" fontSize={11} color="$colorMuted">{rule.comfortDescription}</Text>
                        </YStack>
                        <YStack backgroundColor="$background" borderRadius="$2" paddingHorizontal="$3" paddingVertical="$1" minWidth={60} alignItems="center">
                          <Text fontFamily="$mono" fontSize={13} fontWeight="700" color="$accentBackground">{typeof currentValue === "boolean" ? (currentValue ? "ON" : "OFF") : String(currentValue)}</Text>
                        </YStack>
                      </XStack>
                    );
                  })}
                </YStack>
              )}
            </YStack>
          );
        })}
      </YStack>
      <YStack height={40} />
    </ScrollView>
  );
}
