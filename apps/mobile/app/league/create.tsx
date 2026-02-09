import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";
import { FontFamily } from "../../lib/design";

type LeagueFormat = "salary_cap" | "draft" | "auction" | "prediction";
type Template = "casual" | "competitive" | "pro" | "custom";

const FORMATS: { value: LeagueFormat; label: string; desc: string }[] = [
  { value: "salary_cap", label: "Salary Cap", desc: "Classic fantasy with budget constraints" },
  { value: "draft", label: "Snake Draft", desc: "Take turns picking players" },
  { value: "auction", label: "Auction", desc: "Bid on players with limited budget" },
  { value: "prediction", label: "Prediction", desc: "Predict match outcomes" },
];

export default function CreateLeagueScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<LeagueFormat>("salary_cap");
  const [template, setTemplate] = useState<Template>("casual");
  const [tournament, setTournament] = useState("IPL 2026");
  const [maxMembers, setMaxMembers] = useState("10");
  const [isPrivate, setIsPrivate] = useState(true);

  const TEMPLATES: { value: Template; label: string; desc: string; color: string }[] = [
    { value: "casual", label: "Casual", desc: "Relaxed rules, generous transfers", color: t.accent },
    { value: "competitive", label: "Competitive", desc: "Trading, playoffs, waiver wire", color: t.amber },
    { value: "pro", label: "Pro", desc: "Strict rules, trade vetoes, advanced scoring", color: t.red },
  ];

  const createMutation = trpc.league.create.useMutation({
    onSuccess: (league) => {
      router.replace(`/league/${league!.id}` as any);
    },
  });

  const handleCreate = () => {
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      format,
      template,
      tournament,
      maxMembers: parseInt(maxMembers) || 10,
      isPrivate,
    });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: t.text, fontSize: 24, fontWeight: "800", marginBottom: 24 }}>Create League</Text>

      {/* Name */}
      <Text style={{ color: t.textTertiary, fontSize: 13, marginBottom: 6, fontWeight: "600" }}>LEAGUE NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. The Willow Warriors"
        placeholderTextColor={t.textTertiary}
        style={{
          backgroundColor: t.bg, color: t.text, borderRadius: 12, padding: 14, fontSize: 16,
          borderWidth: 1, borderColor: t.border, marginBottom: 20,
        }}
      />

      {/* Tournament */}
      <Text style={{ color: t.textTertiary, fontSize: 13, marginBottom: 6, fontWeight: "600" }}>TOURNAMENT</Text>
      <TextInput
        value={tournament}
        onChangeText={setTournament}
        placeholder="e.g. IPL 2026"
        placeholderTextColor={t.textTertiary}
        style={{
          backgroundColor: t.bg, color: t.text, borderRadius: 12, padding: 14, fontSize: 16,
          borderWidth: 1, borderColor: t.border, marginBottom: 20,
        }}
      />

      {/* Format */}
      <Text style={{ color: t.textTertiary, fontSize: 13, marginBottom: 8, fontWeight: "600" }}>FORMAT</Text>
      <View style={{ marginBottom: 20 }}>
        {FORMATS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => setFormat(f.value)}
            style={{
              backgroundColor: format === f.value ? t.accentMuted : t.bgSurface,
              borderRadius: 12, padding: 14, marginBottom: 8,
              borderWidth: 1, borderColor: format === f.value ? t.accent : t.border,
            }}
          >
            <Text style={{ color: format === f.value ? t.accent : t.text, fontWeight: "700", fontSize: 15 }}>{f.label}</Text>
            <Text style={{ color: t.textTertiary, fontSize: 12, marginTop: 2 }}>{f.desc}</Text>
          </Pressable>
        ))}
      </View>

      {/* Template */}
      <Text style={{ color: t.textTertiary, fontSize: 13, marginBottom: 8, fontWeight: "600" }}>TEMPLATE</Text>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
        {TEMPLATES.map((tmpl) => (
          <Pressable
            key={tmpl.value}
            onPress={() => setTemplate(tmpl.value)}
            style={{
              flex: 1, backgroundColor: template === tmpl.value ? `${tmpl.color}15` : t.bgSurface,
              borderRadius: 12, padding: 14, alignItems: "center",
              borderWidth: 1, borderColor: template === tmpl.value ? tmpl.color : t.border,
            }}
          >
            <Text style={{ color: template === tmpl.value ? tmpl.color : t.text, fontWeight: "700", fontSize: 15 }}>
              {tmpl.label}
            </Text>
            <Text style={{ color: t.textTertiary, fontSize: 10, marginTop: 4, textAlign: "center" }}>{tmpl.desc}</Text>
          </Pressable>
        ))}
      </View>

      {/* Max Members */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ color: t.textTertiary, fontSize: 13, marginBottom: 6, fontWeight: "600" }}>MAX MEMBERS</Text>
          <TextInput
            value={maxMembers}
            onChangeText={setMaxMembers}
            keyboardType="numeric"
            style={{
              backgroundColor: t.bg, color: t.text, borderRadius: 12, padding: 14, fontSize: 16,
              borderWidth: 1, borderColor: t.border,
            }}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: t.textTertiary, fontSize: 13, marginBottom: 6, fontWeight: "600" }}>VISIBILITY</Text>
          <Pressable
            onPress={() => setIsPrivate(!isPrivate)}
            style={{
              backgroundColor: t.bg, borderRadius: 12, padding: 14,
              borderWidth: 1, borderColor: t.border, alignItems: "center",
            }}
          >
            <Text style={{ color: isPrivate ? t.accent : t.amber, fontWeight: "700", fontSize: 16 }}>
              {isPrivate ? "Private" : "Public"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Create Button */}
      <Pressable
        onPress={handleCreate}
        disabled={createMutation.isPending || !name.trim()}
        style={{
          backgroundColor: !name.trim() ? t.textTertiary : t.accent,
          borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8,
        }}
      >
        <Text style={{ color: t.bg, fontSize: 18, fontWeight: "800" }}>
          {createMutation.isPending ? "Creating..." : "Create League"}
        </Text>
      </Pressable>

      {createMutation.error && (
        <Text style={{ color: t.red, textAlign: "center", marginTop: 12 }}>
          {createMutation.error.message}
        </Text>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
