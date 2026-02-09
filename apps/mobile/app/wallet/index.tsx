import { ScrollView, RefreshControl, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Button,
  ModeToggle,
  AnnouncementBanner,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";

export default function WalletScreen() {
  const router = useRouter();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);

  const wallet = trpc.wallet.getBalance.useQuery(undefined, { retry: false });
  const transactions = trpc.wallet.getTransactions.useQuery({ limit: 20 }, { retry: false });

  const deposit = trpc.wallet.deposit.useMutation({
    onSuccess: () => {
      wallet.refetch();
      transactions.refetch();
      setDepositAmount("");
      setShowDeposit(false);
      Alert.alert(formatUIText("deposit successful"), formatUIText("funds have been added to your wallet"));
    },
    onError: (error) => {
      Alert.alert(formatUIText("deposit failed"), error.message);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([wallet.refetch(), transactions.refetch()]);
    setRefreshing(false);
  }, [wallet, transactions]);

  if (wallet.error?.data?.code === "UNAUTHORIZED") {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" padding="$5">
        <Text fontSize={DesignSystem.emptyState.iconSize} marginBottom="$4">
          {DesignSystem.emptyState.icon}
        </Text>
        <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5} marginBottom="$2">
          {formatUIText("sign in required")}
        </Text>
        <Text fontFamily="$body" fontSize={14} color="$colorMuted" marginBottom="$5">
          {formatUIText("sign in to access your wallet")}
        </Text>
        <Button variant="primary" size="md" onPress={() => router.push("/auth/login")}>
          {formatUIText("sign in")}
        </Button>
      </YStack>
    );
  }

  if (wallet.isLoading) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <EggLoadingSpinner size={48} message={formatUIText("loading wallet")} />
      </YStack>
    );
  }

  const w = wallet.data;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.val }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentBackground.val} />}
    >
      <XStack justifyContent="flex-end" paddingHorizontal="$4" paddingTop="$4">
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>

      <AnnouncementBanner />

      {/* Balance Card */}
      {w && (
        <Card margin="$4" marginTop="$2" padding="$5" borderColor="$colorAccentLight">
          <Text fontFamily="$mono" fontSize={12} color="$colorMuted" letterSpacing={0.5}>
            {formatBadgeText("total balance")}
          </Text>
          <Text fontFamily="$mono" fontWeight="800" fontSize={36} color="$accentBackground" marginTop="$1" marginBottom="$4">
            {"\u20B9"}{w.totalBalance.toFixed(2)}
          </Text>
          <XStack borderTopWidth={1} borderTopColor="$borderColor" paddingTop="$4">
            <YStack flex={1} alignItems="center">
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{formatUIText("cash")}</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color" marginTop="$1">
                {"\u20B9"}{w.cashBalance.toFixed(2)}
              </Text>
            </YStack>
            <YStack width={1} backgroundColor="$borderColor" />
            <YStack flex={1} alignItems="center">
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{formatUIText("bonus")}</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color" marginTop="$1">
                {"\u20B9"}{w.bonusBalance.toFixed(2)}
              </Text>
            </YStack>
            <YStack width={1} backgroundColor="$borderColor" />
            <YStack flex={1} alignItems="center">
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{formatUIText("winnings")}</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$accentBackground" marginTop="$1">
                {"\u20B9"}{w.totalWinnings.toFixed(2)}
              </Text>
            </YStack>
          </XStack>
        </Card>
      )}

      {/* Action Buttons */}
      <XStack paddingHorizontal="$4" gap="$3" marginBottom="$4">
        <Button variant="primary" size="md" flex={1} onPress={() => setShowDeposit(!showDeposit)}>
          {showDeposit ? formatUIText("cancel") : formatUIText("add cash")}
        </Button>
        <Button variant="secondary" size="md" flex={1}>
          {formatUIText("withdraw")}
        </Button>
      </XStack>

      {/* Deposit Form */}
      {showDeposit && (
        <Card marginHorizontal="$4" marginBottom="$4" padding="$4">
          <Text fontFamily="$mono" fontWeight="500" fontSize={16} color="$color" letterSpacing={-0.5} marginBottom="$3">
            {formatUIText("add cash")}
          </Text>
          <TextInput
            placeholder={formatUIText("enter amount")}
            placeholderTextColor={theme.placeholderColor.val}
            keyboardType="numeric"
            value={depositAmount}
            onChangeText={setDepositAmount}
            style={{
              backgroundColor: theme.background.val,
              borderRadius: DesignSystem.radius.lg,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 18,
              color: theme.color.val,
              fontWeight: "700",
              fontFamily: "DM Mono",
              borderWidth: 1,
              borderColor: theme.borderColor.val,
              marginBottom: 12,
            }}
          />
          <XStack gap="$2" marginBottom="$3">
            {[100, 500, 1000, 2000].map((amount) => (
              <XStack
                key={amount}
                flex={1}
                backgroundColor="$borderColor"
                borderRadius="$2"
                paddingVertical="$2"
                alignItems="center"
                justifyContent="center"
                onPress={() => setDepositAmount(String(amount))}
                cursor="pointer"
                pressStyle={{ scale: 0.97, opacity: 0.9 }}
              >
                <Text fontFamily="$mono" fontWeight="600" fontSize={13} color="$color">
                  {"\u20B9"}{amount}
                </Text>
              </XStack>
            ))}
          </XStack>
          <Button
            variant="primary"
            size="md"
            disabled={!depositAmount || deposit.isPending}
            opacity={!depositAmount ? 0.4 : 1}
            onPress={() => {
              const amount = Number(depositAmount);
              if (isNaN(amount) || amount < 1) {
                Alert.alert(formatUIText("invalid amount"), formatUIText("enter a valid amount"));
                return;
              }
              deposit.mutate({ amount });
            }}
          >
            {deposit.isPending ? formatUIText("processing...") : `${formatUIText("add")} \u20B9${depositAmount || "0"}`}
          </Button>
        </Card>
      )}

      {/* Stats Row */}
      {w && (
        <XStack paddingHorizontal="$4" gap="$3" marginBottom="$4">
          <Card flex={1} padding="$3">
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{formatUIText("total deposited")}</Text>
            <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color" marginTop="$1">
              {"\u20B9"}{w.totalDeposited.toFixed(0)}
            </Text>
          </Card>
          <Card flex={1} padding="$3">
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{formatUIText("total withdrawn")}</Text>
            <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color" marginTop="$1">
              {"\u20B9"}{w.totalWithdrawn.toFixed(0)}
            </Text>
          </Card>
        </XStack>
      )}

      {/* Transaction History */}
      <YStack paddingHorizontal="$4" marginBottom="$8">
        <Text {...textStyles.sectionHeader} marginBottom="$3">
          {formatUIText("recent transactions")}
        </Text>
        {transactions.isLoading ? (
          <EggLoadingSpinner size={32} message={formatUIText("loading transactions")} />
        ) : transactions.data && transactions.data.length > 0 ? (
          transactions.data.map((txn, i) => {
            const isCredit = txn.type === "deposit" || txn.type === "winnings" || txn.type === "bonus" || txn.type === "refund";
            return (
              <Animated.View key={txn.id} entering={FadeInDown.delay(i * 25).springify()}>
                <Card marginBottom="$1" padding="$4">
                  <XStack justifyContent="space-between" alignItems="center">
                    <YStack flex={1}>
                      <Text fontFamily="$mono" fontWeight="600" fontSize={13} color="$color">
                        {formatBadgeText(txn.type.replace("_", " "))}
                      </Text>
                      <Text fontFamily="$mono" fontSize={11} color="$colorMuted" marginTop={2}>
                        {new Date(txn.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </Text>
                    </YStack>
                    <Text
                      fontFamily="$mono"
                      fontWeight="700"
                      fontSize={16}
                      marginLeft="$3"
                      color={isCredit ? "$accentBackground" : "$error"}
                    >
                      {isCredit ? "+" : "-"}{"\u20B9"}{txn.amount.toFixed(2)}
                    </Text>
                  </XStack>
                </Card>
              </Animated.View>
            );
          })
        ) : (
          <Card padding="$6" alignItems="center">
            <Text fontSize={DesignSystem.emptyState.iconSize} marginBottom="$3">
              {DesignSystem.emptyState.icon}
            </Text>
            <Text {...textStyles.hint}>{formatUIText("no transactions yet")}</Text>
          </Card>
        )}
      </YStack>
    </ScrollView>
  );
}
