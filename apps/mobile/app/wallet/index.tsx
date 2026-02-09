import { ScrollView, ActivityIndicator, RefreshControl, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Card, Button } from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";

export default function WalletScreen() {
  const router = useRouter();
  const theme = useTamaguiTheme();
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
      Alert.alert("Deposit Successful", "Funds have been added to your wallet");
    },
    onError: (error) => {
      Alert.alert("Deposit Failed", error.message);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([wallet.refetch(), transactions.refetch()]);
    setRefreshing(false);
  }, [wallet, transactions]);

  // Not authenticated
  if (wallet.error?.data?.code === "UNAUTHORIZED") {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" padding="$5">
        <Text fontFamily="$heading" fontWeight="700" fontSize={20} color="$color" marginBottom="$2">
          Sign In Required
        </Text>
        <Text fontFamily="$body" fontSize={14} color="$colorMuted" marginBottom="$5">
          Sign in to access your wallet
        </Text>
        <Button variant="primary" size="md" onPress={() => router.push("/auth/login")}>
          Sign In
        </Button>
      </YStack>
    );
  }

  if (wallet.isLoading) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <ActivityIndicator color={theme.accentBackground.val} size="large" />
      </YStack>
    );
  }

  const w = wallet.data;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.val }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentBackground.val} />
      }
    >
      {/* Balance Card */}
      {w && (
        <Card margin="$4" padding="$5" borderColor="$colorAccentLight">
          <Text fontFamily="$mono" fontSize={12} color="$colorMuted" textTransform="uppercase" letterSpacing={0.5}>
            Total Balance
          </Text>
          <Text fontFamily="$heading" fontWeight="800" fontSize={36} color="$accentBackground" marginTop="$1" marginBottom="$4">
            {"\u20B9"}{w.totalBalance.toFixed(2)}
          </Text>
          <XStack borderTopWidth={1} borderTopColor="$borderColor" paddingTop="$4">
            <YStack flex={1} alignItems="center">
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted">Cash</Text>
              <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$color" marginTop="$1">
                {"\u20B9"}{w.cashBalance.toFixed(2)}
              </Text>
            </YStack>
            <YStack width={1} backgroundColor="$borderColor" />
            <YStack flex={1} alignItems="center">
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted">Bonus</Text>
              <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$color" marginTop="$1">
                {"\u20B9"}{w.bonusBalance.toFixed(2)}
              </Text>
            </YStack>
            <YStack width={1} backgroundColor="$borderColor" />
            <YStack flex={1} alignItems="center">
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted">Winnings</Text>
              <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$accentBackground" marginTop="$1">
                {"\u20B9"}{w.totalWinnings.toFixed(2)}
              </Text>
            </YStack>
          </XStack>
        </Card>
      )}

      {/* Action Buttons */}
      <XStack paddingHorizontal="$4" gap="$3" marginBottom="$4">
        <Button variant="primary" size="md" flex={1} onPress={() => setShowDeposit(!showDeposit)}>
          {showDeposit ? "Cancel" : "Add Cash"}
        </Button>
        <Button variant="secondary" size="md" flex={1}>
          Withdraw
        </Button>
      </XStack>

      {/* Deposit Form */}
      {showDeposit && (
        <Card marginHorizontal="$4" marginBottom="$4" padding="$4">
          <Text fontFamily="$heading" fontWeight="700" fontSize={16} color="$color" marginBottom="$3">
            Add Cash
          </Text>
          <TextInput
            placeholder="Enter amount"
            placeholderTextColor={theme.placeholderColor.val}
            keyboardType="numeric"
            value={depositAmount}
            onChangeText={setDepositAmount}
            style={{
              backgroundColor: theme.background.val,
              borderRadius: 10,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 18,
              color: theme.color.val,
              fontWeight: "700",
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
                Alert.alert("Invalid Amount", "Enter a valid amount");
                return;
              }
              deposit.mutate({ amount });
            }}
          >
            {deposit.isPending ? "Processing..." : `Add \u20B9${depositAmount || "0"}`}
          </Button>
        </Card>
      )}

      {/* Stats Row */}
      {w && (
        <XStack paddingHorizontal="$4" gap="$3" marginBottom="$4">
          <Card flex={1} padding="$3">
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted">Total Deposited</Text>
            <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$color" marginTop="$1">
              {"\u20B9"}{w.totalDeposited.toFixed(0)}
            </Text>
          </Card>
          <Card flex={1} padding="$3">
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted">Total Withdrawn</Text>
            <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$color" marginTop="$1">
              {"\u20B9"}{w.totalWithdrawn.toFixed(0)}
            </Text>
          </Card>
        </XStack>
      )}

      {/* Transaction History */}
      <YStack paddingHorizontal="$4" marginBottom="$8">
        <Text fontFamily="$heading" fontWeight="700" fontSize={18} color="$color" marginBottom="$3">
          Recent Transactions
        </Text>
        {transactions.isLoading ? (
          <ActivityIndicator color={theme.accentBackground.val} style={{ padding: 20 }} />
        ) : transactions.data && transactions.data.length > 0 ? (
          transactions.data.map((txn) => {
            const isCredit = txn.type === "deposit" || txn.type === "winnings" || txn.type === "bonus" || txn.type === "refund";
            return (
              <Card key={txn.id} marginBottom="$1" padding="$4">
                <XStack justifyContent="space-between" alignItems="center">
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" textTransform="capitalize">
                      {txn.type.replace("_", " ").toUpperCase()}
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
            );
          })
        ) : (
          <Card padding="$6" alignItems="center">
            <Text fontFamily="$body" color="$colorMuted" fontSize={14}>No transactions yet</Text>
          </Card>
        )}
      </YStack>
    </ScrollView>
  );
}
