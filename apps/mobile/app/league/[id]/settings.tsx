import { View, Text, TextInput, Pressable, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { trpc } from "../../../lib/trpc";
import { RULE_CATEGORY_LABELS, getRulesByCategory, type RuleCategory } from "@draftcrick/shared";

const BG = "#111210";
const CARD = "#1C1D1B";
const ACCENT = "#5DB882";
const GOLD = "#D4A43D";
const TEXT = "#EDECEA";
const MUTED = "#5E5D5A";
const INPUT_BG = "#111210";

const CATEGORIES: RuleCategory[] = [
  "teamComposition", "scoring", "boosters", "transfers",
  "playoffs", "salary", "autoManagement", "scoringModifiers",
  "draft", "auction",
];

export default function LeagueSettingsScreen() {
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: league, refetch } = trpc.league.getById.useQuery({ id: leagueId! });
  const updateMutation = trpc.league.updateSettings.useMutation({
    onSuccess: () => {
      Alert.alert("Settings updated!");
      refetch();
    },
  });
  const regenCodeMutation = trpc.league.regenerateInviteCode.useMutation({
    onSuccess: () => refetch(),
  });

  const [name, setName] = useState("");
  const [maxMembers, setMaxMembers] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<RuleCategory | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (league) {
      setName(league.name);
      setMaxMembers(String(league.maxMembers));
    }
  }, [league]);

  const rules = (league?.rules ?? {}) as Record<string, unknown>;

  const handleSave = () => {
    updateMutation.mutate({
      leagueId: leagueId!,
      name: name.trim() || undefined,
      maxMembers: parseInt(maxMembers) || undefined,
    });
  };

  const handleRegenCode = () => {
    Alert.alert("Regenerate Code?", "The current invite code will stop working.", [
      { text: "Cancel", style: "cancel" },
      { text: "Regenerate", onPress: () => regenCodeMutation.mutate({ leagueId: leagueId! }) },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: TEXT, fontSize: 22, fontWeight: "800", marginBottom: 20 }}>League Settings</Text>

      {/* Basic Settings */}
      <View style={{ backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <Text style={{ color: MUTED, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>BASIC SETTINGS</Text>

        <Text style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>League Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={{
            backgroundColor: INPUT_BG, color: TEXT, borderRadius: 10, padding: 12,
            borderWidth: 1, borderColor: "#333432", marginBottom: 12,
          }}
        />

        <Text style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>Max Members</Text>
        <TextInput
          value={maxMembers}
          onChangeText={setMaxMembers}
          keyboardType="numeric"
          style={{
            backgroundColor: INPUT_BG, color: TEXT, borderRadius: 10, padding: 12,
            borderWidth: 1, borderColor: "#333432", marginBottom: 12,
          }}
        />

        <Pressable onPress={handleSave} disabled={updateMutation.isPending}
          style={{ backgroundColor: ACCENT, borderRadius: 10, padding: 12, alignItems: "center" }}
        >
          <Text style={{ color: BG, fontWeight: "700" }}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Text>
        </Pressable>
      </View>

      {/* Invite Code */}
      <View style={{ backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <Text style={{ color: MUTED, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>INVITE CODE</Text>
        <Text style={{ color: ACCENT, fontSize: 20, fontWeight: "700", letterSpacing: 2, marginBottom: 12 }}>
          {league?.inviteCode ?? "---"}
        </Text>
        <Pressable onPress={handleRegenCode}
          style={{ backgroundColor: "#E5484D20", borderRadius: 10, padding: 10, alignItems: "center" }}
        >
          <Text style={{ color: "#E5484D", fontWeight: "600" }}>Regenerate Code</Text>
        </Pressable>
      </View>

      {/* Rule Categories (Collapsible) */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ color: TEXT, fontSize: 18, fontWeight: "700" }}>League Rules</Text>
          <Pressable onPress={() => setShowAdvanced(!showAdvanced)}>
            <Text style={{ color: ACCENT, fontSize: 13 }}>
              {showAdvanced ? "Simple Mode" : "Advanced Mode"}
            </Text>
          </Pressable>
        </View>

        {CATEGORIES.map((cat) => {
          const catRules = getRulesByCategory(cat);
          const displayRules = showAdvanced ? catRules : catRules.filter((r) => !r.advanced);
          if (displayRules.length === 0) return null;

          const isExpanded = expandedCategory === cat;

          return (
            <View key={cat} style={{ marginBottom: 8 }}>
              <Pressable
                onPress={() => setExpandedCategory(isExpanded ? null : cat)}
                style={{
                  backgroundColor: CARD, borderRadius: 12, padding: 14,
                  flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                  borderBottomLeftRadius: isExpanded ? 0 : 12,
                  borderBottomRightRadius: isExpanded ? 0 : 12,
                }}
              >
                <Text style={{ color: TEXT, fontWeight: "600", fontSize: 15 }}>
                  {RULE_CATEGORY_LABELS[cat]}
                </Text>
                <Text style={{ color: MUTED, fontSize: 14 }}>{isExpanded ? "−" : "+"}</Text>
              </Pressable>

              {isExpanded && (
                <View style={{
                  backgroundColor: CARD, borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
                  padding: 14, paddingTop: 4, borderTopWidth: 1, borderTopColor: "#333432",
                }}>
                  {displayRules.map((rule) => {
                    const keyParts = rule.key.split(".");
                    const categoryKey = keyParts[0]!;
                    const ruleKey = keyParts[1]!;
                    const categoryRules = (rules[categoryKey] ?? rules) as Record<string, unknown>;
                    const currentValue = categoryRules[ruleKey] ?? rule.default;

                    return (
                      <View key={rule.key} style={{
                        flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                        paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1C1D1B80",
                      }}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={{ color: TEXT, fontSize: 13, fontWeight: "600" }}>{rule.label}</Text>
                          <Text style={{ color: MUTED, fontSize: 11 }}>{rule.comfortDescription}</Text>
                        </View>
                        <View style={{
                          backgroundColor: INPUT_BG, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
                          minWidth: 60, alignItems: "center",
                        }}>
                          <Text style={{ color: ACCENT, fontSize: 13, fontWeight: "700" }}>
                            {typeof currentValue === "boolean"
                              ? currentValue ? "ON" : "OFF"
                              : String(currentValue)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
