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
import { useState, useCallback } from "react";
import { trpc } from "../../lib/trpc";

export default function WalletScreen() {
  const router = useRouter();
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
        <ActivityIndicator color="#5DB882" size="large" />
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
          tintColor="#5DB882"
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
              <Text style={[styles.breakdownValue, { color: "#5DB882" }]}>
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
            placeholderTextColor="#5E5D5A"
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
          <ActivityIndicator color="#5DB882" style={{ padding: 20 }} />
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
                    { color: isCredit ? "#5DB882" : "#E5484D" },
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111210",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#111210",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#EDECEA",
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: "#5E5D5A",
    marginBottom: 20,
  },
  signInButton: {
    backgroundColor: "#5DB882",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  signInText: {
    color: "#111210",
    fontSize: 15,
    fontWeight: "700",
  },
  balanceCard: {
    margin: 16,
    backgroundColor: "#1C1D1B",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(93, 184, 130, 0.19)",
  },
  balanceLabel: {
    fontSize: 12,
    color: "#5E5D5A",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: "#5DB882",
    marginTop: 4,
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#333432",
    paddingTop: 16,
  },
  breakdownItem: {
    flex: 1,
    alignItems: "center",
  },
  breakdownDivider: {
    width: 1,
    backgroundColor: "#333432",
  },
  breakdownLabel: {
    fontSize: 11,
    color: "#5E5D5A",
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EDECEA",
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
    backgroundColor: "#5DB882",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  depositButtonText: {
    color: "#111210",
    fontSize: 15,
    fontWeight: "700",
  },
  withdrawButton: {
    flex: 1,
    backgroundColor: "#1C1D1B",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333432",
  },
  withdrawButtonText: {
    color: "#EDECEA",
    fontSize: 15,
    fontWeight: "600",
  },
  depositForm: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#1C1D1B",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#333432",
  },
  depositTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EDECEA",
    marginBottom: 12,
  },
  amountInput: {
    backgroundColor: "#111210",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: "#EDECEA",
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#333432",
    marginBottom: 12,
  },
  quickAmounts: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  quickAmountButton: {
    flex: 1,
    backgroundColor: "#333432",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  quickAmountText: {
    color: "#EDECEA",
    fontSize: 13,
    fontWeight: "600",
  },
  confirmDeposit: {
    backgroundColor: "#5DB882",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmDepositText: {
    color: "#111210",
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
    backgroundColor: "#1C1D1B",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#333432",
  },
  statLabel: {
    fontSize: 11,
    color: "#5E5D5A",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EDECEA",
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#EDECEA",
    marginBottom: 12,
  },
  txnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1C1D1B",
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#333432",
  },
  txnInfo: {
    flex: 1,
  },
  txnType: {
    fontSize: 13,
    fontWeight: "600",
    color: "#EDECEA",
    textTransform: "capitalize",
  },
  txnDate: {
    fontSize: 11,
    color: "#5E5D5A",
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 12,
  },
  emptyTxn: {
    backgroundColor: "#1C1D1B",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333432",
  },
  emptyTxnText: {
    color: "#5E5D5A",
    fontSize: 14,
  },
});
