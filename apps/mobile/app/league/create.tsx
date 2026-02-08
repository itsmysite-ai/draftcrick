import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { trpc } from "../../lib/trpc";

const BG = "#0A1628";
const CARD = "#1A2332";
const ACCENT = "#00F5A0";
const TEXT = "#FFFFFF";
const MUTED = "#6C757D";
const INPUT_BG = "#0D1B2A";

type LeagueFormat = "salary_cap" | "draft" | "auction" | "prediction";
type Template = "casual" | "competitive" | "pro" | "custom";

const FORMATS: { value: LeagueFormat; label: string; desc: string }[] = [
  { value: "salary_cap", label: "Salary Cap", desc: "Classic fantasy with budget constraints" },
  { value: "draft", label: "Snake Draft", desc: "Take turns picking players" },
  { value: "auction", label: "Auction", desc: "Bid on players with limited budget" },
  { value: "prediction", label: "Prediction", desc: "Predict match outcomes" },
];

const TEMPLATES: { value: Template; label: string; desc: string; color: string }[] = [
  { value: "casual", label: "Casual", desc: "Relaxed rules, generous transfers", color: "#00F5A0" },
  { value: "competitive", label: "Competitive", desc: "Trading, playoffs, waiver wire", color: "#FFD600" },
  { value: "pro", label: "Pro", desc: "Strict rules, trade vetoes, advanced scoring", color: "#FF4C4C" },
];

export default function CreateLeagueScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<LeagueFormat>("salary_cap");
  const [template, setTemplate] = useState<Template>("casual");
  const [tournament, setTournament] = useState("IPL 2026");
  const [maxMembers, setMaxMembers] = useState("10");
  const [isPrivate, setIsPrivate] = useState(true);

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
    <ScrollView style={{ flex: 1, backgroundColor: BG }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: TEXT, fontSize: 24, fontWeight: "800", marginBottom: 24 }}>Create League</Text>

      {/* Name */}
      <Text style={{ color: MUTED, fontSize: 13, marginBottom: 6, fontWeight: "600" }}>LEAGUE NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. The Willow Warriors"
        placeholderTextColor={MUTED}
        style={{
          backgroundColor: INPUT_BG, color: TEXT, borderRadius: 12, padding: 14, fontSize: 16,
          borderWidth: 1, borderColor: "#2A3442", marginBottom: 20,
        }}
      />

      {/* Tournament */}
      <Text style={{ color: MUTED, fontSize: 13, marginBottom: 6, fontWeight: "600" }}>TOURNAMENT</Text>
      <TextInput
        value={tournament}
        onChangeText={setTournament}
        placeholder="e.g. IPL 2026"
        placeholderTextColor={MUTED}
        style={{
          backgroundColor: INPUT_BG, color: TEXT, borderRadius: 12, padding: 14, fontSize: 16,
          borderWidth: 1, borderColor: "#2A3442", marginBottom: 20,
        }}
      />

      {/* Format */}
      <Text style={{ color: MUTED, fontSize: 13, marginBottom: 8, fontWeight: "600" }}>FORMAT</Text>
      <View style={{ marginBottom: 20 }}>
        {FORMATS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => setFormat(f.value)}
            style={{
              backgroundColor: format === f.value ? "#00F5A015" : CARD,
              borderRadius: 12, padding: 14, marginBottom: 8,
              borderWidth: 1, borderColor: format === f.value ? ACCENT : "#2A3442",
            }}
          >
            <Text style={{ color: format === f.value ? ACCENT : TEXT, fontWeight: "700", fontSize: 15 }}>{f.label}</Text>
            <Text style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{f.desc}</Text>
          </Pressable>
        ))}
      </View>

      {/* Template */}
      <Text style={{ color: MUTED, fontSize: 13, marginBottom: 8, fontWeight: "600" }}>TEMPLATE</Text>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
        {TEMPLATES.map((t) => (
          <Pressable
            key={t.value}
            onPress={() => setTemplate(t.value)}
            style={{
              flex: 1, backgroundColor: template === t.value ? `${t.color}15` : CARD,
              borderRadius: 12, padding: 14, alignItems: "center",
              borderWidth: 1, borderColor: template === t.value ? t.color : "#2A3442",
            }}
          >
            <Text style={{ color: template === t.value ? t.color : TEXT, fontWeight: "700", fontSize: 15 }}>
              {t.label}
            </Text>
            <Text style={{ color: MUTED, fontSize: 10, marginTop: 4, textAlign: "center" }}>{t.desc}</Text>
          </Pressable>
        ))}
      </View>

      {/* Max Members */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ color: MUTED, fontSize: 13, marginBottom: 6, fontWeight: "600" }}>MAX MEMBERS</Text>
          <TextInput
            value={maxMembers}
            onChangeText={setMaxMembers}
            keyboardType="numeric"
            style={{
              backgroundColor: INPUT_BG, color: TEXT, borderRadius: 12, padding: 14, fontSize: 16,
              borderWidth: 1, borderColor: "#2A3442",
            }}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: MUTED, fontSize: 13, marginBottom: 6, fontWeight: "600" }}>VISIBILITY</Text>
          <Pressable
            onPress={() => setIsPrivate(!isPrivate)}
            style={{
              backgroundColor: INPUT_BG, borderRadius: 12, padding: 14,
              borderWidth: 1, borderColor: "#2A3442", alignItems: "center",
            }}
          >
            <Text style={{ color: isPrivate ? ACCENT : "#FFD600", fontWeight: "700", fontSize: 16 }}>
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
          backgroundColor: !name.trim() ? MUTED : ACCENT,
          borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8,
        }}
      >
        <Text style={{ color: BG, fontSize: 18, fontWeight: "800" }}>
          {createMutation.isPending ? "Creating..." : "Create League"}
        </Text>
      </Pressable>

      {createMutation.error && (
        <Text style={{ color: "#FF4C4C", textAlign: "center", marginTop: 12 }}>
          {createMutation.error.message}
        </Text>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
