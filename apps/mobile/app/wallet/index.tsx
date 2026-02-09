import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback, useMemo } from "react";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";

export default function WalletScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);

  const wallet = trpc.wallet.getBalance.useQuery(undefined, {
    retry: false,
  });

  const transactions = trpc.wallet.getTransactions.useQuery(
    { limit: 20 },
    { retry: false }
  );

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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: t.bg,
        },
        centerContainer: {
          flex: 1,
          backgroundColor: t.bg,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        },
        errorTitle: {
          fontSize: 20,
          fontWeight: "700",
          color: t.text,
          marginBottom: 8,
        },
        errorSubtitle: {
          fontSize: 14,
          color: t.textTertiary,
          marginBottom: 20,
        },
        signInButton: {
          backgroundColor: t.accent,
          paddingHorizontal: 24,
          paddingVertical: 10,
          borderRadius: 10,
        },
        signInText: {
          color: t.textInverse,
          fontSize: 15,
          fontWeight: "700",
        },
        balanceCard: {
          margin: 16,
          backgroundColor: t.bgSurface,
          borderRadius: 16,
          padding: 20,
          borderWidth: 1,
          borderColor: t.accentMuted,
        },
        balanceLabel: {
          fontSize: 12,
          color: t.textTertiary,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
        balanceAmount: {
          fontSize: 36,
          fontWeight: "800",
          color: t.accent,
          marginTop: 4,
          marginBottom: 16,
        },
        breakdownRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          borderTopWidth: 1,
          borderTopColor: t.border,
          paddingTop: 16,
        },
        breakdownItem: {
          flex: 1,
          alignItems: "center",
        },
        breakdownDivider: {
          width: 1,
          backgroundColor: t.border,
        },
        breakdownLabel: {
          fontSize: 11,
          color: t.textTertiary,
        },
        breakdownValue: {
          fontSize: 16,
          fontWeight: "700",
          color: t.text,
          marginTop: 4,
        },
        actionRow: {
          flexDirection: "row",
          paddingHorizontal: 16,
          gap: 12,
          marginBottom: 16,
        },
        depositButton: {
          flex: 1,
          backgroundColor: t.accent,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
        },
        depositButtonText: {
          color: t.textInverse,
          fontSize: 15,
          fontWeight: "700",
        },
        withdrawButton: {
          flex: 1,
          backgroundColor: t.bgSurface,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
          borderWidth: 1,
          borderColor: t.border,
        },
        withdrawButtonText: {
          color: t.text,
          fontSize: 15,
          fontWeight: "600",
        },
        depositForm: {
          marginHorizontal: 16,
          marginBottom: 16,
          backgroundColor: t.bgSurface,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: t.border,
        },
        depositTitle: {
          fontSize: 16,
          fontWeight: "700",
          color: t.text,
          marginBottom: 12,
        },
        amountInput: {
          backgroundColor: t.bg,
          borderRadius: 10,
          paddingHorizontal: 16,
          paddingVertical: 14,
          fontSize: 18,
          color: t.text,
          fontWeight: "700",
          borderWidth: 1,
          borderColor: t.border,
          marginBottom: 12,
        },
        quickAmounts: {
          flexDirection: "row",
          gap: 8,
          marginBottom: 12,
        },
        quickAmountButton: {
          flex: 1,
          backgroundColor: t.border,
          borderRadius: 8,
          paddingVertical: 8,
          alignItems: "center",
        },
        quickAmountText: {
          color: t.text,
          fontSize: 13,
          fontWeight: "600",
        },
        confirmDeposit: {
          backgroundColor: t.accent,
          borderRadius: 10,
          paddingVertical: 14,
          alignItems: "center",
        },
        confirmDepositText: {
          color: t.textInverse,
          fontSize: 15,
          fontWeight: "700",
        },
        statsRow: {
          flexDirection: "row",
          paddingHorizontal: 16,
          gap: 12,
          marginBottom: 16,
        },
        statItem: {
          flex: 1,
          backgroundColor: t.bgSurface,
          borderRadius: 10,
          padding: 12,
          borderWidth: 1,
          borderColor: t.border,
        },
        statLabel: {
          fontSize: 11,
          color: t.textTertiary,
        },
        statValue: {
          fontSize: 16,
          fontWeight: "700",
          color: t.text,
          marginTop: 4,
        },
        section: {
          paddingHorizontal: 16,
          marginBottom: 32,
        },
        sectionTitle: {
          fontSize: 18,
          fontWeight: "700",
          color: t.text,
          marginBottom: 12,
        },
        txnRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: t.bgSurface,
          borderRadius: 10,
          padding: 14,
          marginBottom: 6,
          borderWidth: 1,
          borderColor: t.border,
        },
        txnInfo: {
          flex: 1,
        },
        txnType: {
          fontSize: 13,
          fontWeight: "600",
          color: t.text,
          textTransform: "capitalize",
        },
        txnDate: {
          fontSize: 11,
          color: t.textTertiary,
          marginTop: 2,
        },
        txnAmount: {
          fontSize: 16,
          fontWeight: "700",
          marginLeft: 12,
        },
        emptyTxn: {
          backgroundColor: t.bgSurface,
          borderRadius: 12,
          padding: 24,
          alignItems: "center",
          borderWidth: 1,
          borderColor: t.border,
        },
        emptyTxnText: {
          color: t.textTertiary,
          fontSize: 14,
        },
      }),
    [t]
  );

  // Not authenticated
  if (wallet.error?.data?.code === "UNAUTHORIZED") {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Sign In Required</Text>
        <Text style={styles.errorSubtitle}>
          Sign in to access your wallet
        </Text>
        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => router.push("/auth/login")}
        >
          <Text style={styles.signInText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (wallet.isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={t.accent} size="large" />
      </View>
    );
  }

  const w = wallet.data;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={t.accent}
        />
      }
    >
      {/* Balance Card */}
      {w && (
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>
            ₹{w.totalBalance.toFixed(2)}
          </Text>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Cash</Text>
              <Text style={styles.breakdownValue}>
                ₹{w.cashBalance.toFixed(2)}
              </Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Bonus</Text>
              <Text style={styles.breakdownValue}>
                ₹{w.bonusBalance.toFixed(2)}
              </Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Winnings</Text>
              <Text style={[styles.breakdownValue, { color: t.accent }]}>
                ₹{w.totalWinnings.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.depositButton}
          onPress={() => setShowDeposit(!showDeposit)}
        >
          <Text style={styles.depositButtonText}>
            {showDeposit ? "Cancel" : "Add Cash"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.withdrawButton}>
          <Text style={styles.withdrawButtonText}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      {/* Deposit Form */}
      {showDeposit && (
        <View style={styles.depositForm}>
          <Text style={styles.depositTitle}>Add Cash</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="Enter amount"
            placeholderTextColor={t.textTertiary}
            keyboardType="numeric"
            value={depositAmount}
            onChangeText={setDepositAmount}
          />
          <View style={styles.quickAmounts}>
            {[100, 500, 1000, 2000].map((amount) => (
              <TouchableOpacity
                key={amount}
                style={styles.quickAmountButton}
                onPress={() => setDepositAmount(String(amount))}
              >
                <Text style={styles.quickAmountText}>₹{amount}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[
              styles.confirmDeposit,
              (!depositAmount || deposit.isPending) && { opacity: 0.4 },
            ]}
            disabled={!depositAmount || deposit.isPending}
            onPress={() => {
              const amount = Number(depositAmount);
              if (isNaN(amount) || amount < 1) {
                Alert.alert("Invalid Amount", "Enter a valid amount");
                return;
              }
              deposit.mutate({ amount });
            }}
          >
            <Text style={styles.confirmDepositText}>
              {deposit.isPending ? "Processing..." : `Add ₹${depositAmount || "0"}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stats Row */}
      {w && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Deposited</Text>
            <Text style={styles.statValue}>₹{w.totalDeposited.toFixed(0)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Withdrawn</Text>
            <Text style={styles.statValue}>₹{w.totalWithdrawn.toFixed(0)}</Text>
          </View>
        </View>
      )}

      {/* Transaction History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {transactions.isLoading ? (
          <ActivityIndicator color={t.accent} style={{ padding: 20 }} />
        ) : transactions.data && transactions.data.length > 0 ? (
          transactions.data.map((txn) => {
            const isCredit =
              txn.type === "deposit" ||
              txn.type === "winnings" ||
              txn.type === "bonus" ||
              txn.type === "refund";
            return (
              <View key={txn.id} style={styles.txnRow}>
                <View style={styles.txnInfo}>
                  <Text style={styles.txnType}>
                    {txn.type.replace("_", " ").toUpperCase()}
                  </Text>
                  <Text style={styles.txnDate}>
                    {new Date(txn.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.txnAmount,
                    { color: isCredit ? t.accent : t.red },
                  ]}
                >
                  {isCredit ? "+" : "-"}₹{txn.amount.toFixed(2)}
                </Text>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyTxn}>
            <Text style={styles.emptyTxnText}>No transactions yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
