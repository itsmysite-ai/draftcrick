import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  BackButton,
  InitialsAvatar,
  StatLabel,
  ModeToggle,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";

type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const insets = useSafeAreaInsets();
  const player = trpc.player.getById.useQuery({ id: id! }, { enabled: !!id });

  if (player.isLoading) return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
      <EggLoadingSpinner size={48} message={formatUIText("loading player")} />
    </YStack>
  );
  const p = player.data;
  if (!p) return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
      <Text fontSize={DesignSystem.emptyState.iconSize} marginBottom="$4">{DesignSystem.emptyState.icon}</Text>
      <Text {...textStyles.hint}>{formatUIText("player not found")}</Text>
    </YStack>
  );

  const roleKey = ((p.role ?? "BAT").toUpperCase().replace("_", "").substring(0, 4)) as RoleKey;
  const stats = (p.stats as Record<string, unknown>) ?? {};
  const credits = (stats.credits as number) ?? 8.0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background.val }}>
      {/* ── Inline Header ── */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={insets.top + 8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <BackButton onPress={() => router.back()} />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("player")}
          </Text>
        </XStack>
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>

      {/* Player Profile */}
      <YStack padding="$5" alignItems="center">
        <InitialsAvatar name={p.name} playerRole={roleKey} ovr={Math.round(credits * 10)} size={64} />
        <Text fontFamily="$mono" fontWeight="700" fontSize={20} color="$color" marginTop="$3">
          {p.name}
        </Text>
        <XStack alignItems="center" gap="$3" marginTop="$2">
          <Badge variant="role" size="sm">
            {formatBadgeText(p.role?.replace("_", " ") ?? "")}
          </Badge>
          <Text fontFamily="$body" fontSize={14} color="$colorMuted">{p.team}</Text>
        </XStack>
        {p.nationality && (
          <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginTop="$1">
            {p.nationality}
          </Text>
        )}
      </YStack>

      {/* Stats Grid */}
      <XStack flexWrap="wrap" padding="$4" gap="$3">
        <Card flex={1} minWidth="45%" padding="$3">
          <Text {...textStyles.hint}>{formatUIText("credits")}</Text>
          <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color" marginTop="$1">
            {credits.toFixed(1)}
          </Text>
        </Card>
        <Card flex={1} minWidth="45%" padding="$3">
          <Text {...textStyles.hint}>{formatUIText("role")}</Text>
          <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color" marginTop="$1">
            {formatBadgeText(p.role?.replace("_", " ") ?? "")}
          </Text>
        </Card>
      </XStack>

      {/* Recent Match Scores */}
      <YStack paddingHorizontal="$4" marginBottom="$6">
        <Text {...textStyles.sectionHeader} marginBottom="$3">
          {formatUIText("recent performances")}
        </Text>
        {p.matchScores && p.matchScores.length > 0 ? (
          p.matchScores.map((score: { id: string; fantasyPoints: number | null; matchId: string; updatedAt: Date | null }, i: number) => (
            <Animated.View key={score.id ?? i} entering={FadeInDown.delay(i * 30).springify()}>
              <Card marginBottom="$1" padding="$3">
                <XStack justifyContent="space-between" alignItems="center">
                  <Text {...textStyles.playerName}>
                    {formatUIText("match")} {(i + 1).toString()}
                  </Text>
                  <StatLabel label={formatUIText("pts")} value={Number(score.fantasyPoints ?? 0).toFixed(1)} />
                </XStack>
              </Card>
            </Animated.View>
          ))
        ) : (
          <Card padding="$6" alignItems="center">
            <Text fontSize={DesignSystem.emptyState.iconSize} marginBottom="$3">{DesignSystem.emptyState.icon}</Text>
            <Text {...textStyles.hint} textAlign="center">
              {formatUIText("no recent performances available")}
            </Text>
          </Card>
        )}
      </YStack>
    </ScrollView>
  );
}
