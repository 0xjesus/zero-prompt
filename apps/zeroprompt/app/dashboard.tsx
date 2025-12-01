import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Image
} from "react-native";
import { ethers } from "ethers";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useBilling } from "../context/BillingContext";
import {
  Wallet,
  CreditCard,
  TrendingUp,
  Clock,
  RefreshCw,
  ArrowLeft,
  ChevronDown,
  Send,
  DollarSign,
  Activity
} from "lucide-react-native";

const ZEROPROMPT_LOGO = require('../assets/logos/zero-prompt-logo.png');

export default function DashboardScreen() {
  const router = useRouter();
  const { theme: colors } = useTheme();
  const { user, connectWallet, isConnecting, logout } = useAuth();
  const {
    account,
    deposits,
    usage,
    nativePrice,
    selectedNetwork,
    networks,
    isLoading,
    error,
    setSelectedNetwork,
    refreshBilling,
    calculateCredits,
    executeDeposit
  } = useBilling();

  const [depositAmount, setDepositAmount] = useState("");
  const [estimatedCredits, setEstimatedCredits] = useState<string | null>(null);
  const [isDepositing, setIsDepositing] = useState(false);
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "deposits" | "usage">("overview");
  const [nativeBalance, setNativeBalance] = useState<string | null>(null);

  // Get current network info
  const currentNetwork = networks.find((n) => n.id === selectedNetwork);
  const currencySymbol = currentNetwork?.config.nativeCurrency.symbol || "AVAX";

  // Fetch native balance
  const fetchNativeBalance = useCallback(async () => {
    if (Platform.OS !== "web" || !user?.walletAddress) {
      setNativeBalance(null);
      return;
    }
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) return;

      const balanceHex = await ethereum.request({
        method: "eth_getBalance",
        params: [user.walletAddress, "latest"]
      });
      const balanceWei = BigInt(balanceHex);
      const balanceEth = ethers.formatEther(balanceWei);
      setNativeBalance(balanceEth);
    } catch (err) {
      console.error("Failed to fetch native balance:", err);
    }
  }, [user?.walletAddress]);

  // Fetch native balance on mount and when wallet changes
  useEffect(() => {
    fetchNativeBalance();
  }, [fetchNativeBalance]);

  // Calculate estimated credits when deposit amount changes
  useEffect(() => {
    const updateEstimate = async () => {
      if (depositAmount && parseFloat(depositAmount) > 0) {
        const credits = await calculateCredits(depositAmount);
        setEstimatedCredits(credits);
      } else {
        setEstimatedCredits(null);
      }
    };
    updateEstimate();
  }, [depositAmount, calculateCredits]);

  // Handle deposit
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;

    setIsDepositing(true);
    try {
      const txHash = await executeDeposit(depositAmount);
      if (txHash) {
        setDepositAmount("");
        setEstimatedCredits(null);
        alert(`Deposit successful! TX: ${txHash.slice(0, 10)}...`);
      }
    } catch (err: any) {
      alert(`Deposit failed: ${err.message}`);
    } finally {
      setIsDepositing(false);
    }
  };

  // Format timestamp
  const formatDate = (timestamp: number) => {
    if (!timestamp) return "Never";
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Format USD
  const formatUSD = (value: string | undefined) => {
    if (!value) return "$0.00";
    const num = parseFloat(value);
    return `$${num.toFixed(4)}`;
  };

  // Truncate address
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const styles = createStyles(colors);

  // Not connected state
  if (!user?.walletAddress) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Dashboard</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.connectContainer}>
          <Wallet size={64} color={colors.primary} />
          <Text style={styles.connectTitle}>Connect Your Wallet</Text>
          <Text style={styles.connectSubtitle}>
            Connect your wallet to view your credits, deposit funds, and track your usage.
          </Text>
          <TouchableOpacity
            style={[styles.connectButton, isConnecting && styles.buttonDisabled]}
            onPress={connectWallet}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.connectButtonText}>Connect Wallet</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => { refreshBilling(); fetchNativeBalance(); }}>
          <RefreshCw size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Wallet Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Wallet size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Wallet</Text>
          </View>
          <View style={styles.walletInfo}>
            <View>
              <Text style={styles.walletAddress}>{truncateAddress(user.walletAddress)}</Text>
              {nativeBalance && (
                <Text style={styles.nativeBalance}>
                  {parseFloat(nativeBalance).toFixed(4)} {currencySymbol}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={logout}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </View>

          {/* Network Selector */}
          <TouchableOpacity
            style={styles.networkSelector}
            onPress={() => setShowNetworkDropdown(!showNetworkDropdown)}
          >
            <Text style={styles.networkText}>{currentNetwork?.config.name || "Select Network"}</Text>
            <ChevronDown size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {showNetworkDropdown && (
            <View style={styles.networkDropdown}>
              {networks.map((network) => (
                <TouchableOpacity
                  key={network.id}
                  style={[
                    styles.networkOption,
                    selectedNetwork === network.id && styles.networkOptionActive
                  ]}
                  onPress={() => {
                    setSelectedNetwork(network.id);
                    setShowNetworkDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.networkOptionText,
                      selectedNetwork === network.id && styles.networkOptionTextActive
                    ]}
                  >
                    {network.config.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Credits Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <CreditCard size={20} color={colors.success} />
            <Text style={styles.cardTitle}>Credits Balance</Text>
          </View>

          {isLoading ? (
            <ActivityIndicator style={{ padding: 20 }} color={colors.primary} />
          ) : (
            <>
              <Text style={styles.balanceAmount}>{formatUSD(account?.creditsUSD)}</Text>
              <Text style={styles.balanceSubtext}>Available Credits</Text>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Total Deposited</Text>
                  <Text style={styles.statValue}>
                    {parseFloat(account?.totalDeposited || "0").toFixed(4)} {currencySymbol}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Total Used</Text>
                  <Text style={styles.statValue}>{formatUSD(account?.totalUsedUSD)}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Deposit Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Send size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Deposit Funds</Text>
          </View>

          {nativePrice && (
            <Text style={styles.priceInfo}>
              Current {currencySymbol} Price: ${nativePrice.toFixed(2)}
            </Text>
          )}

          <View style={styles.depositInputContainer}>
            <TextInput
              style={styles.depositInput}
              placeholder={`Amount in ${currencySymbol}`}
              placeholderTextColor={colors.textSecondary}
              value={depositAmount}
              onChangeText={setDepositAmount}
              keyboardType="decimal-pad"
            />
            <Text style={styles.currencyLabel}>{currencySymbol}</Text>
          </View>

          {estimatedCredits && (
            <Text style={styles.estimateText}>
              You'll receive approximately {formatUSD(estimatedCredits)} in credits
            </Text>
          )}

          <TouchableOpacity
            style={[
              styles.depositButton,
              (!depositAmount || isDepositing) && styles.buttonDisabled
            ]}
            onPress={handleDeposit}
            disabled={!depositAmount || isDepositing}
          >
            {isDepositing ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <DollarSign size={18} color={colors.background} />
                <Text style={styles.depositButtonText}>Deposit</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "overview" && styles.tabActive]}
            onPress={() => setActiveTab("overview")}
          >
            <Activity size={16} color={activeTab === "overview" ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === "overview" && styles.tabTextActive]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "deposits" && styles.tabActive]}
            onPress={() => setActiveTab("deposits")}
          >
            <TrendingUp size={16} color={activeTab === "deposits" ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === "deposits" && styles.tabTextActive]}>
              Deposits ({deposits.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "usage" && styles.tabActive]}
            onPress={() => setActiveTab("usage")}
          >
            <Image source={ZEROPROMPT_LOGO} style={{width: 18, height: 18}} resizeMode="contain" />
            <Text style={[styles.tabText, activeTab === "usage" && styles.tabTextActive]}>
              Usage ({usage.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Account Summary</Text>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Account Status</Text>
              <Text style={[styles.summaryValue, { color: account?.isActive ? colors.success : colors.error }]}>
                {account?.isActive ? "Active" : "Inactive"}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Deposits</Text>
              <Text style={styles.summaryValue}>{account?.depositCount || 0}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Last Deposit</Text>
              <Text style={styles.summaryValue}>{formatDate(account?.lastDepositTime || 0)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Last Usage</Text>
              <Text style={styles.summaryValue}>{formatDate(account?.lastUsageTime || 0)}</Text>
            </View>
          </View>
        )}

        {activeTab === "deposits" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Deposit History</Text>
            {deposits.length === 0 ? (
              <Text style={styles.emptyText}>No deposits yet</Text>
            ) : (
              deposits.slice().reverse().map((deposit, index) => (
                <View key={index} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <TrendingUp size={16} color={colors.success} />
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyAmount}>
                        +{parseFloat(deposit.amountNative).toFixed(4)} {currencySymbol}
                      </Text>
                      <Text style={styles.historyDate}>{formatDate(deposit.timestamp)}</Text>
                    </View>
                  </View>
                  <Text style={styles.historyCredits}>{formatUSD(deposit.amountUSD)}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === "usage" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Usage History</Text>
            {usage.length === 0 ? (
              <Text style={styles.emptyText}>No usage yet</Text>
            ) : (
              usage.slice().reverse().map((record, index) => (
                <View key={index} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <Image source={ZEROPROMPT_LOGO} style={{width: 18, height: 18}} resizeMode="contain" />
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyModel}>{record.model}</Text>
                      <Text style={styles.historyTokens}>
                        {record.inputTokens + record.outputTokens} tokens
                      </Text>
                    </View>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyCost}>-{formatUSD(record.amountUSD)}</Text>
                    <Text style={styles.historyDate}>{formatDate(record.timestamp)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
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
    connectContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32
    },
    connectTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
      marginTop: 24,
      marginBottom: 12
    },
    connectSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 32
    },
    connectButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 12,
      minWidth: 200,
      alignItems: "center"
    },
    connectButtonText: {
      color: colors.background,
      fontSize: 16,
      fontWeight: "600"
    },
    buttonDisabled: {
      opacity: 0.5
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border
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
    walletInfo: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12
    },
    walletAddress: {
      fontSize: 14,
      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
      color: colors.text
    },
    nativeBalance: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.success,
      marginTop: 4
    },
    disconnectText: {
      fontSize: 14,
      color: colors.error
    },
    networkSelector: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.background,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border
    },
    networkText: {
      fontSize: 14,
      color: colors.text
    },
    networkDropdown: {
      marginTop: 8,
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden"
    },
    networkOption: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    networkOptionActive: {
      backgroundColor: colors.primary + "20"
    },
    networkOptionText: {
      fontSize: 14,
      color: colors.text
    },
    networkOptionTextActive: {
      color: colors.primary,
      fontWeight: "600"
    },
    balanceAmount: {
      fontSize: 36,
      fontWeight: "700",
      color: colors.success,
      textAlign: "center",
      marginBottom: 4
    },
    balanceSubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 16
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    statItem: {
      alignItems: "center"
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4
    },
    statValue: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text
    },
    priceInfo: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12
    },
    depositInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12
    },
    depositInput: {
      flex: 1,
      padding: 12,
      fontSize: 16,
      color: colors.text
    },
    currencyLabel: {
      paddingRight: 12,
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary
    },
    estimateText: {
      fontSize: 13,
      color: colors.success,
      marginBottom: 12
    },
    depositButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      padding: 14,
      borderRadius: 8
    },
    depositButtonText: {
      color: colors.background,
      fontSize: 16,
      fontWeight: "600"
    },
    tabsContainer: {
      flexDirection: "row",
      marginBottom: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 4
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 8
    },
    tabActive: {
      backgroundColor: colors.background
    },
    tabText: {
      fontSize: 13,
      color: colors.textSecondary
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: "600"
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 16
    },
    summaryItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    summaryLabel: {
      fontSize: 14,
      color: colors.textSecondary
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: 20
    },
    historyItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    historyLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12
    },
    historyInfo: {
      gap: 2
    },
    historyAmount: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.success
    },
    historyModel: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text
    },
    historyTokens: {
      fontSize: 12,
      color: colors.textSecondary
    },
    historyDate: {
      fontSize: 12,
      color: colors.textSecondary
    },
    historyCredits: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.success
    },
    historyRight: {
      alignItems: "flex-end"
    },
    historyCost: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.warning
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
    }
  });
