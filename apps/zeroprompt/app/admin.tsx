import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useSendTransaction, useSwitchChain, useChainId } from "wagmi";
import { parseEther } from "viem";
import {
  Shield,
  Wallet,
  ArrowLeft,
  RefreshCw,
  Download,
  Users,
  DollarSign,
  Activity,
  AlertTriangle,
  History,
  ExternalLink,
  Cpu,
  ChevronRight
} from "lucide-react-native";
import { API_URL } from "../config/api";

interface AdminInfo {
  owner: string;
  contractBalance: string;
  contractAddress: string;
  networkName: string;
  currency: string;
  stats: {
    totalUsers: number;
    totalDepositsUSD: string;
    totalUsageUSD: string;
    contractBalance: string;
    currentPrice: number;
  };
  config: {
    minDepositUSD: string;
    freeCreditsUSD: string;
  };
}

interface WithdrawRecord {
  to: string;
  amount: string;
  blockNumber: number;
  transactionHash: string;
  timestamp?: number;
}

interface WithdrawalsResponse {
  withdrawals: WithdrawRecord[];
  count: number;
  currency: string;
  blockExplorer: string;
}

export default function AdminScreen() {
  const router = useRouter();
  const { theme: colors } = useTheme();
  const { user, getHeaders, openWalletModal, isConnecting } = useAuth();

  // Wagmi hooks for transactions
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, isPending: isSendingTx } = useSendTransaction();

  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawRecord[]>([]);
  const [blockExplorer, setBlockExplorer] = useState<string>("");

  // Fetch admin info
  const fetchAdminInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/billing/admin/info`, {
        headers: getHeaders()
      });

      if (!res.ok) {
        throw new Error("Failed to fetch admin info");
      }

      const data = await res.json();
      setAdminInfo(data);

      // Check if current user is owner
      if (user?.walletAddress) {
        setIsOwner(data.owner.toLowerCase() === user.walletAddress.toLowerCase());
      }
    } catch (err: any) {
      console.error("Admin fetch error:", err);
      setError(err.message || "Failed to load admin info");
    } finally {
      setIsLoading(false);
    }
  }, [user?.walletAddress, getHeaders]);

  // Fetch withdraw history
  const fetchWithdrawals = useCallback(async () => {
    try {
      console.log("[Admin] Fetching withdrawals...");
      const headers = getHeaders();
      const res = await fetch(`${API_URL}/billing/admin/withdrawals`, { headers });

      if (!res.ok) {
        console.error("[Admin] Failed to fetch withdrawals, status:", res.status);
        return;
      }

      const data: WithdrawalsResponse = await res.json();
      console.log("[Admin] Withdrawals response:", JSON.stringify(data));
      console.log("[Admin] Setting withdrawals array length:", data.withdrawals?.length);

      if (data.withdrawals && data.withdrawals.length > 0) {
        setWithdrawals(data.withdrawals);
        setBlockExplorer(data.blockExplorer || "");
        console.log("[Admin] Withdrawals state updated successfully");
      } else {
        console.log("[Admin] No withdrawals in response");
        setWithdrawals([]);
      }
    } catch (err: any) {
      console.error("[Admin] Fetch withdrawals error:", err);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchAdminInfo();
    fetchWithdrawals();
  }, [fetchAdminInfo, fetchWithdrawals]);

  // Execute withdraw using wagmi
  const handleWithdraw = async () => {
    if (Platform.OS !== "web") {
      setError("Withdraw only available on web");
      return;
    }

    if (!isOwner) {
      setError("Only contract owner can withdraw");
      return;
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!user?.walletAddress) {
      setError("No wallet connected");
      return;
    }

    setIsWithdrawing(true);
    setError(null);
    setSuccess(null);
    setTxHash(null);

    try {
      // Get transaction from backend - withdraw to connected wallet
      const res = await fetch(`${API_URL}/billing/admin/prepare-withdraw`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          toAddress: user.walletAddress,
          amount: withdrawAmount
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to prepare withdraw");
      }

      const { transaction } = await res.json();

      // Switch network if needed using wagmi
      if (currentChainId !== transaction.chainId) {
        console.log(`Switching chain from ${currentChainId} to ${transaction.chainId}`);
        await switchChainAsync({ chainId: transaction.chainId });
      }

      // Send transaction using wagmi
      const hash = await sendTransactionAsync({
        to: transaction.to as `0x${string}`,
        value: BigInt(transaction.value || "0"),
        data: transaction.data as `0x${string}`,
      });

      console.log("Withdraw transaction sent:", hash);
      setTxHash(hash);
      setSuccess(`Withdrawal sent! TX: ${hash.slice(0, 10)}...`);
      setWithdrawAmount("");

      // Refresh data after a short delay
      setTimeout(() => {
        fetchAdminInfo();
      }, 3000);
    } catch (err: any) {
      console.error("Withdraw error:", err);
      // Provide better error messages
      let errorMessage = err.message || "Withdrawal failed";
      if (err.code === "CALL_EXCEPTION" || errorMessage.includes("reverted")) {
        errorMessage = "Transaction reverted. Make sure you are the contract owner and connected with the correct wallet.";
      } else if (err.code === "ACTION_REJECTED" || err.code === 4001 || errorMessage.includes("rejected")) {
        errorMessage = "Transaction was rejected by user.";
      } else if (errorMessage.includes("User rejected")) {
        errorMessage = "Transaction was cancelled.";
      }
      setError(errorMessage);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const formatUSD = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return `$${num.toFixed(2)}`;
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const styles = createStyles(colors);

  // Not connected
  if (!user?.walletAddress) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Admin Dashboard</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.centerContainer}>
          <Shield size={64} color={colors.warning} />
          <Text style={styles.centerTitle}>Connect Wallet</Text>
          <Text style={styles.centerSubtitle}>
            Please connect your wallet to access the admin dashboard.
          </Text>
          <TouchableOpacity
            style={[styles.connectButton, isConnecting && styles.buttonDisabled]}
            onPress={openWalletModal}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Wallet size={20} color={colors.background} />
                <Text style={styles.connectButtonText}>Connect Wallet</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Admin Dashboard</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerSubtitle}>Loading admin data...</Text>
        </View>
      </View>
    );
  }

  // Not owner warning
  const NotOwnerBanner = () =>
    !isOwner ? (
      <View style={styles.warningBanner}>
        <AlertTriangle size={20} color={colors.warning} />
        <Text style={styles.warningText}>
          You are not the contract owner. Withdrawal functions are disabled.
        </Text>
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Admin Dashboard</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchAdminInfo}>
          <RefreshCw size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <NotOwnerBanner />

        {/* Models Admin Quick Access */}
        <TouchableOpacity
          style={styles.modelsAdminCard}
          onPress={() => router.push("/admin-models")}
        >
          <View style={styles.modelsAdminContent}>
            <View style={styles.modelsAdminIcon}>
              <Cpu size={24} color="#7c3aed" />
            </View>
            <View style={styles.modelsAdminText}>
              <Text style={styles.modelsAdminTitle}>Administrar Modelos</Text>
              <Text style={styles.modelsAdminSubtitle}>
                Sincronizar, ver nuevos modelos y configurar
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Contract Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Shield size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Contract Info</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Network</Text>
            <Text style={styles.infoValue}>{adminInfo?.networkName}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Contract</Text>
            <Text style={styles.infoValueMono}>
              {adminInfo?.contractAddress ? truncateAddress(adminInfo.contractAddress) : "-"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Owner</Text>
            <View style={styles.ownerRow}>
              <Text style={styles.infoValueMono}>
                {adminInfo?.owner ? truncateAddress(adminInfo.owner) : "-"}
              </Text>
              {isOwner && <Text style={styles.youBadge}>YOU</Text>}
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{adminInfo?.currency} Price</Text>
            <Text style={styles.infoValue}>${adminInfo?.stats.currentPrice.toFixed(2)}</Text>
          </View>
        </View>

        {/* Balance Card */}
        <View style={[styles.card, styles.balanceCard]}>
          <View style={styles.cardHeader}>
            <Wallet size={20} color={colors.success} />
            <Text style={styles.cardTitle}>Contract Balance</Text>
          </View>

          <Text style={styles.bigBalance}>
            {parseFloat(adminInfo?.contractBalance || "0").toFixed(4)} {adminInfo?.currency}
          </Text>
          <Text style={styles.balanceUSD}>
            ≈ {formatUSD(
              parseFloat(adminInfo?.contractBalance || "0") * (adminInfo?.stats.currentPrice || 0)
            )}
          </Text>
        </View>

        {/* Stats Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Activity size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Platform Stats</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Users size={24} color={colors.textSecondary} />
              <Text style={styles.statNumber}>{adminInfo?.stats.totalUsers || 0}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
            </View>

            <View style={styles.statBox}>
              <DollarSign size={24} color={colors.success} />
              <Text style={styles.statNumber}>{formatUSD(adminInfo?.stats.totalDepositsUSD || "0")}</Text>
              <Text style={styles.statLabel}>Total Deposits</Text>
            </View>

            <View style={styles.statBox}>
              <Activity size={24} color={colors.warning} />
              <Text style={styles.statNumber}>{formatUSD(adminInfo?.stats.totalUsageUSD || "0")}</Text>
              <Text style={styles.statLabel}>Total Usage</Text>
            </View>
          </View>
        </View>

        {/* Withdraw Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Download size={20} color={colors.error} />
            <Text style={styles.cardTitle}>Withdraw Funds</Text>
          </View>

          <View style={styles.withdrawInputContainer}>
            <TextInput
              style={[styles.withdrawInput, !isOwner && styles.inputDisabled]}
              placeholder={`Amount in ${adminInfo?.currency || "AVAX"}`}
              placeholderTextColor={colors.textSecondary}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              keyboardType="decimal-pad"
              editable={isOwner}
            />
            <Text style={styles.currencyLabel}>{adminInfo?.currency}</Text>
          </View>

          <View style={styles.withdrawButtons}>
            <TouchableOpacity
              style={[
                styles.maxButton,
                !isOwner && styles.buttonDisabled
              ]}
              onPress={() => setWithdrawAmount(adminInfo?.contractBalance || "0")}
              disabled={!isOwner}
            >
              <Text style={styles.maxButtonText}>MAX</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.withdrawButton,
                (!isOwner || isWithdrawing || isSendingTx || !withdrawAmount) && styles.buttonDisabled
              ]}
              onPress={handleWithdraw}
              disabled={!isOwner || isWithdrawing || isSendingTx || !withdrawAmount}
            >
              {(isWithdrawing || isSendingTx) ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Download size={18} color={colors.background} />
                  <Text style={styles.withdrawButtonText}>Withdraw to Wallet</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Config Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Shield size={20} color={colors.textSecondary} />
            <Text style={styles.cardTitle}>Contract Config</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Min Deposit</Text>
            <Text style={styles.infoValue}>{formatUSD(adminInfo?.config.minDepositUSD || "0")}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Free Credits</Text>
            <Text style={styles.infoValue}>{formatUSD(adminInfo?.config.freeCreditsUSD || "0")}</Text>
          </View>
        </View>

        {/* Withdraw History Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <History size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Withdraw History ({withdrawals.length})</Text>
          </View>

          {withdrawals.length === 0 ? (
            <Text style={styles.emptyText}>No withdrawals yet (state empty)</Text>
          ) : (
            withdrawals.map((w, index) => (
              <View key={w.transactionHash} style={[styles.withdrawItem, index === withdrawals.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.withdrawItemHeader}>
                  <Text style={styles.withdrawAmount}>
                    {parseFloat(w.amount).toFixed(4)} {adminInfo?.currency}
                  </Text>
                  {w.timestamp && (
                    <Text style={styles.withdrawDate}>
                      {new Date(w.timestamp * 1000).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <View style={styles.withdrawItemDetails}>
                  <Text style={styles.withdrawTo} numberOfLines={1}>
                    To: {w.to.slice(0, 10)}...{w.to.slice(-8)}
                  </Text>
                  {blockExplorer && (
                    <TouchableOpacity
                      onPress={() => {
                        if (Platform.OS === "web") {
                          window.open(`${blockExplorer}/tx/${w.transactionHash}`, "_blank");
                        }
                      }}
                      style={styles.viewTxButton}
                    >
                      <ExternalLink size={14} color={colors.primary} />
                      <Text style={styles.viewTxText}>View TX</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Messages */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {success && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "web" ? 20 : 50,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    backButton: {
      padding: 8
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text
    },
    refreshButton: {
      padding: 8
    },
    content: {
      flex: 1,
      padding: 16
    },
    centerContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32
    },
    centerTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
      marginTop: 24,
      marginBottom: 12
    },
    centerSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 24
    },
    connectButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12
    },
    connectButtonText: {
      color: colors.background,
      fontSize: 16,
      fontWeight: "600"
    },
    warningBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.warning + "20",
      padding: 16,
      borderRadius: 12,
      marginBottom: 16
    },
    warningText: {
      flex: 1,
      fontSize: 14,
      color: colors.warning
    },
    modelsAdminCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: "#7c3aed40"
    },
    modelsAdminContent: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1
    },
    modelsAdminIcon: {
      backgroundColor: "#7c3aed20",
      padding: 12,
      borderRadius: 12
    },
    modelsAdminText: {
      marginLeft: 14,
      flex: 1
    },
    modelsAdminTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text
    },
    modelsAdminSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border
    },
    balanceCard: {
      alignItems: "center"
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    infoLabel: {
      fontSize: 14,
      color: colors.textSecondary
    },
    infoValue: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text
    },
    infoValueMono: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
      fontFamily: Platform.OS === "web" ? "monospace" : undefined
    },
    ownerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8
    },
    youBadge: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.success,
      backgroundColor: colors.success + "20",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4
    },
    bigBalance: {
      fontSize: 36,
      fontWeight: "700",
      color: colors.success,
      marginBottom: 4
    },
    balanceUSD: {
      fontSize: 16,
      color: colors.textSecondary
    },
    statsGrid: {
      flexDirection: "row",
      justifyContent: "space-around",
      flexWrap: "wrap",
      gap: 16
    },
    statBox: {
      alignItems: "center",
      minWidth: 80
    },
    statNumber: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginTop: 8,
      marginBottom: 4
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary
    },
    withdrawInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12
    },
    withdrawInput: {
      flex: 1,
      padding: 12,
      fontSize: 16,
      color: colors.text
    },
    inputDisabled: {
      opacity: 0.5
    },
    currencyLabel: {
      paddingRight: 12,
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary
    },
    withdrawButtons: {
      flexDirection: "row",
      gap: 12
    },
    maxButton: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary
    },
    maxButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "700"
    },
    withdrawButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.error,
      padding: 14,
      borderRadius: 8
    },
    withdrawButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600"
    },
    buttonDisabled: {
      opacity: 0.5
    },
    errorContainer: {
      backgroundColor: colors.error + "20",
      padding: 12,
      borderRadius: 8,
      marginTop: 8
    },
    errorText: {
      color: colors.error,
      fontSize: 14
    },
    successContainer: {
      backgroundColor: colors.success + "20",
      padding: 12,
      borderRadius: 8,
      marginTop: 8
    },
    successText: {
      color: colors.success,
      fontSize: 14
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: 16
    },
    withdrawItem: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    withdrawItemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4
    },
    withdrawAmount: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text
    },
    withdrawDate: {
      fontSize: 12,
      color: colors.textSecondary
    },
    withdrawItemDetails: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center"
    },
    withdrawTo: {
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
      fontFamily: Platform.OS === "web" ? "monospace" : undefined
    },
    viewTxButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      padding: 4
    },
    viewTxText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: "500"
    }
  });
