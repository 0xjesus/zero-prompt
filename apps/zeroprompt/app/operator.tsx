import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useSubnet } from "../context/SubnetContext";
import { API_URL } from "../config/api";
import { useWriteContract } from "wagmi";
import {
  SUBNET_REWARDS_ADDRESS,
  SUBNET_REWARDS_ABI,
  SUBNET_CHAIN_ID,
  formatZerop,
  fetchCurrentEpoch,
} from "../lib/subnetContracts";
import {
  ArrowLeft,
  Server,
  Wallet,
  RefreshCw,
  TrendingUp,
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  DollarSign,
  Award,
  Zap,
  ExternalLink,
  Plus,
  Settings,
  Gift,
} from "lucide-react-native";

interface OperatorDetails {
  address: string;
  endpoint: string;
  supportedModels: string[];
  stakeAmount: string;
  performanceScore: number;
  stakeWeight: number;
  isActive: boolean;
  pendingRewards: string;
  isHealthy?: boolean;
  latencyMs?: number;
  currentEpoch?: {
    requests: number;
    successful: number;
    avgLatencyMs: number;
    weightedRequests: number;
    estimatedReward: string;
  };
}

interface OperatorStats {
  address: string;
  stats24h: {
    requests: number;
    successRate: string;
    avgLatencyMs: number;
  };
  stats7d: {
    requests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  };
  pendingRewards: string;
}

export default function OperatorScreen() {
  const router = useRouter();
  const { theme: colors } = useTheme();
  const { user, getHeaders } = useAuth();
  const { myOperator, isLoadingOperator, refreshMyOperator } = useSubnet();
  const { writeContractAsync } = useWriteContract();

  const [operators, setOperators] = useState<OperatorDetails[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<OperatorDetails | null>(null);
  const [operatorStats, setOperatorStats] = useState<OperatorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [, setClaimSuccess] = useState(false);

  const styles = createStyles(colors);

  const handleClaimRewards = async () => {
    if (!writeContractAsync) return;
    setIsClaiming(true);
    setClaimSuccess(false);
    try {
      const currentEpoch = await fetchCurrentEpoch();
      // Claim all epochs up to current
      const epochs = [];
      for (let i = 1; i <= currentEpoch; i++) epochs.push(BigInt(i));
      if (epochs.length === 0) return;

      await writeContractAsync({
        address: SUBNET_REWARDS_ADDRESS as `0x${string}`,
        abi: SUBNET_REWARDS_ABI,
        functionName: "claimMultipleEpochs",
        args: [epochs],
        chainId: SUBNET_CHAIN_ID,
      });
      setClaimSuccess(true);
      await refreshMyOperator();
    } catch (err: any) {
      console.error("[Operator] Claim error:", err);
    } finally {
      setIsClaiming(false);
    }
  };

  // Fetch all operators (for now, showing network operators)
  const fetchOperators = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/operators`, {
        headers: getHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        setOperators(data.operators || []);
      } else {
        throw new Error("Failed to fetch operators");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  // Fetch stats for selected operator
  const fetchOperatorStats = useCallback(async (operatorAddress: string) => {
    setIsLoadingStats(true);

    try {
      const res = await fetch(`${API_URL}/operators/${operatorAddress}/stats`, {
        headers: getHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        setOperatorStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch operator stats:", err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [getHeaders]);

  // Fetch operator details
  const fetchOperatorDetails = useCallback(async (operatorAddress: string) => {
    try {
      const res = await fetch(`${API_URL}/operators/${operatorAddress}`, {
        headers: getHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedOperator(data);
        fetchOperatorStats(operatorAddress);
      }
    } catch (err) {
      console.error("Failed to fetch operator details:", err);
    }
  }, [getHeaders, fetchOperatorStats]);

  useEffect(() => {
    fetchOperators();
  }, [fetchOperators]);

  // Format stake amount
  const formatStake = (amount: string) => {
    const num = parseFloat(amount);
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k ZEROP`;
    }
    return `${num.toFixed(2)} ZEROP`;
  };

  // Format rewards
  const formatRewards = (amount: string) => {
    const num = parseFloat(amount);
    return `${num.toFixed(4)} ZEROP`;
  };

  // Truncate endpoint
  const truncateEndpoint = (endpoint: string) => {
    if (endpoint.length > 30) {
      return endpoint.substring(0, 30) + "...";
    }
    return endpoint;
  };

  // Not connected state
  if (!user?.walletAddress) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Operator Dashboard</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.connectContainer}>
          <Wallet size={64} color={colors.primary} />
          <Text style={styles.connectTitle}>Connect Your Wallet</Text>
          <Text style={styles.connectSubtitle}>
            Connect your wallet to manage your operator nodes and claim rewards.
          </Text>
        </View>
      </View>
    );
  }

  // Operator detail view
  if (selectedOperator) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedOperator(null)}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Node Details</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => fetchOperatorDetails(selectedOperator.address)}
          >
            <RefreshCw size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Status Card */}
          <View style={styles.card}>
            <View style={styles.statusHeader}>
              <View style={[
                styles.statusBadge,
                { backgroundColor: selectedOperator.isHealthy ? colors.success + "20" : colors.error + "20" }
              ]}>
                {selectedOperator.isHealthy ? (
                  <CheckCircle size={16} color={colors.success} />
                ) : (
                  <XCircle size={16} color={colors.error} />
                )}
                <Text style={[
                  styles.statusText,
                  { color: selectedOperator.isHealthy ? colors.success : colors.error }
                ]}>
                  {selectedOperator.isHealthy ? "Online" : "Offline"}
                </Text>
              </View>
              {selectedOperator.latencyMs !== undefined && (
                <Text style={styles.latencyText}>
                  {selectedOperator.latencyMs}ms latency
                </Text>
              )}
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Endpoint</Text>
              <Text style={styles.detailValue}>{truncateEndpoint(selectedOperator.endpoint)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Performance Score</Text>
              <Text style={styles.detailValue}>{selectedOperator.performanceScore}/100</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Stake Weight</Text>
              <Text style={styles.detailValue}>{selectedOperator.stakeWeight}%</Text>
            </View>
          </View>

          {/* Staking Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Award size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Staking</Text>
            </View>

            <View style={styles.stakeAmount}>
              <Text style={styles.stakeValue}>{formatStake(selectedOperator.stakeAmount)}</Text>
              <Text style={styles.stakeLabel}>Staked</Text>
            </View>

            <View style={styles.rewardsContainer}>
              <View style={styles.rewardItem}>
                <Text style={styles.rewardLabel}>Pending Rewards</Text>
                <Text style={styles.rewardValue}>{formatRewards(selectedOperator.pendingRewards)}</Text>
              </View>
              {selectedOperator.currentEpoch && (
                <View style={styles.rewardItem}>
                  <Text style={styles.rewardLabel}>Est. This Epoch</Text>
                  <Text style={styles.rewardValue}>
                    {formatRewards(selectedOperator.currentEpoch.estimatedReward)}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.claimButton}
              onPress={() => handleClaimRewards()}
              disabled={isClaiming}
            >
              {isClaiming ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <DollarSign size={18} color={colors.background} />
              )}
              <Text style={styles.claimButtonText}>
                {isClaiming ? "Claiming..." : "Claim Rewards"}
              </Text>
            </TouchableOpacity>

            {/* Navigation links */}
            <View style={styles.navLinks}>
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => router.push("/stake")}
              >
                <Award size={16} color={colors.primary} />
                <Text style={styles.navLinkText}>Manage Stake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => router.push("/node-config")}
              >
                <Settings size={16} color={colors.primary} />
                <Text style={styles.navLinkText}>Configure Node</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Current Epoch Stats */}
          {selectedOperator.currentEpoch && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Activity size={20} color={colors.success} />
                <Text style={styles.cardTitle}>Current Epoch</Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxValue}>
                    {selectedOperator.currentEpoch.requests}
                  </Text>
                  <Text style={styles.statBoxLabel}>Requests</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxValue}>
                    {selectedOperator.currentEpoch.requests > 0
                      ? Math.round((selectedOperator.currentEpoch.successful / selectedOperator.currentEpoch.requests) * 100)
                      : 0}%
                  </Text>
                  <Text style={styles.statBoxLabel}>Success Rate</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxValue}>
                    {selectedOperator.currentEpoch.avgLatencyMs}ms
                  </Text>
                  <Text style={styles.statBoxLabel}>Avg Latency</Text>
                </View>
              </View>
            </View>
          )}

          {/* Historical Stats */}
          {operatorStats && !isLoadingStats && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <TrendingUp size={20} color={colors.warning} />
                <Text style={styles.cardTitle}>Historical Stats</Text>
              </View>

              <View style={styles.statsSection}>
                <Text style={styles.statsTitle}>Last 24 Hours</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{operatorStats.stats24h.requests}</Text>
                    <Text style={styles.statLabel}>Requests</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{operatorStats.stats24h.successRate}%</Text>
                    <Text style={styles.statLabel}>Success</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{operatorStats.stats24h.avgLatencyMs}ms</Text>
                    <Text style={styles.statLabel}>Avg Latency</Text>
                  </View>
                </View>
              </View>

              <View style={styles.statsSection}>
                <Text style={styles.statsTitle}>Last 7 Days</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{operatorStats.stats7d.requests}</Text>
                    <Text style={styles.statLabel}>Requests</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {(operatorStats.stats7d.totalInputTokens + operatorStats.stats7d.totalOutputTokens).toLocaleString()}
                    </Text>
                    <Text style={styles.statLabel}>Tokens</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {isLoadingStats && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {/* Supported Models */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Zap size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Supported Models</Text>
            </View>

            <View style={styles.modelsContainer}>
              {selectedOperator.supportedModels.map((model, index) => (
                <View key={index} style={styles.modelChip}>
                  <Text style={styles.modelChipText}>{model}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // Operators list view
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Operator Dashboard</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchOperators}>
          <RefreshCw size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Register New Node Button */}
        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => router.push('/register-operator')}
        >
          <Plus size={20} color={colors.background} />
          <Text style={styles.registerButtonText}>Register New Node</Text>
        </TouchableOpacity>

        {/* My Operator */}
        {myOperator && (
          <>
            <Text style={styles.sectionTitle}>My Operator</Text>
            {isLoadingOperator ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View style={styles.operatorCard}>
                <View style={styles.operatorHeader}>
                  <View style={styles.operatorTitle}>
                    <Server size={18} color={colors.primary} />
                    <Text style={styles.operatorName}>My Node</Text>
                  </View>
                  <View style={[
                    styles.healthBadge,
                    { backgroundColor: myOperator.isActive ? colors.success + "20" : colors.error + "20" }
                  ]}>
                    <View style={[
                      styles.healthDot,
                      { backgroundColor: myOperator.isActive ? colors.success : colors.error }
                    ]} />
                    <Text style={[
                      styles.healthText,
                      { color: myOperator.isActive ? colors.success : colors.error }
                    ]}>
                      {myOperator.isActive ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.operatorEndpoint} numberOfLines={1}>
                  {myOperator.endpoint}
                </Text>

                <View style={styles.operatorStats}>
                  <View style={styles.operatorStat}>
                    <Award size={14} color={colors.textSecondary} />
                    <Text style={styles.operatorStatText}>
                      {parseFloat(formatZerop(myOperator.stakeAmount)).toFixed(0)} ZEROP
                    </Text>
                  </View>
                  <View style={styles.operatorStat}>
                    <Zap size={14} color={colors.textSecondary} />
                    <Text style={styles.operatorStatText}>
                      {myOperator.supportedModels.length} model{myOperator.supportedModels.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>

                {/* Performance Score Indicator */}
                {myOperator.performanceScore != null && (
                  <View style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>Performance</Text>
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: myOperator.performanceScore >= 70 ? colors.success :
                               myOperator.performanceScore >= 40 ? colors.warning : colors.error
                      }}>
                        {myOperator.performanceScore}/100
                      </Text>
                    </View>
                    <View style={{ height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{
                        height: 5,
                        width: `${Math.min(myOperator.performanceScore, 100)}%`,
                        backgroundColor: myOperator.performanceScore >= 70 ? colors.success :
                                         myOperator.performanceScore >= 40 ? colors.warning : colors.error,
                        borderRadius: 3,
                      }} />
                    </View>
                  </View>
                )}

                <View style={styles.myOpActions}>
                  <TouchableOpacity
                    style={styles.myOpActionBtn}
                    onPress={() => router.push("/node-config")}
                  >
                    <Settings size={14} color={colors.primary} />
                    <Text style={styles.myOpActionText}>Configure</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.myOpActionBtn}
                    onPress={() => router.push("/stake")}
                  >
                    <Award size={14} color={colors.primary} />
                    <Text style={styles.myOpActionText}>Stake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.myOpActionBtn}
                    onPress={() => handleClaimRewards()}
                    disabled={isClaiming}
                  >
                    {isClaiming ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <Gift size={14} color={colors.primary} />
                    )}
                    <Text style={styles.myOpActionText}>Claim</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Server size={20} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Become an Operator</Text>
            <Text style={styles.infoText}>
              Run an Ollama node, stake ZEROP, and earn rewards for serving AI inference requests.
            </Text>
          </View>
        </View>

        {/* Economics Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.warning + '15' }]}>
          <TrendingUp size={20} color={colors.warning} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>How Economics Work</Text>
            <Text style={styles.infoText}>
              Earn ZEROP by running an Ollama node. Register → Stake (min 1,000 ZEROP) → Serve requests → Claim rewards each epoch.
            </Text>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                marginTop: 8,
              }}
              onPress={() => router.push('/network')}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>
                Learn More
              </Text>
              <ExternalLink size={12} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Operators List */}
        <Text style={styles.sectionTitle}>Network Operators</Text>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading operators...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchOperators}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : operators.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Server size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No operators found</Text>
            <Text style={styles.emptySubtext}>
              Be the first to register an operator node!
            </Text>
          </View>
        ) : (
          operators.map((operator) => (
            <TouchableOpacity
              key={operator.address}
              style={styles.operatorCard}
              onPress={() => fetchOperatorDetails(operator.address)}
            >
              <View style={styles.operatorHeader}>
                <View style={styles.operatorTitle}>
                  <Server size={18} color={colors.primary} />
                  <Text style={styles.operatorName}>{operator.address.slice(0, 6)}...{operator.address.slice(-4)}</Text>
                </View>
                <View style={[
                  styles.healthBadge,
                  { backgroundColor: operator.isHealthy ? colors.success + "20" : colors.error + "20" }
                ]}>
                  <View style={[
                    styles.healthDot,
                    { backgroundColor: operator.isHealthy ? colors.success : colors.error }
                  ]} />
                  <Text style={[
                    styles.healthText,
                    { color: operator.isHealthy ? colors.success : colors.error }
                  ]}>
                    {operator.isHealthy ? "Online" : "Offline"}
                  </Text>
                </View>
              </View>

              <Text style={styles.operatorEndpoint} numberOfLines={1}>
                {operator.endpoint}
              </Text>

              <View style={styles.operatorStats}>
                <View style={styles.operatorStat}>
                  <Award size={14} color={colors.textSecondary} />
                  <Text style={styles.operatorStatText}>
                    {formatStake(operator.stakeAmount)}
                  </Text>
                </View>
                <View style={styles.operatorStat}>
                  <Activity size={14} color={colors.textSecondary} />
                  <Text style={styles.operatorStatText}>
                    Score: {operator.performanceScore}
                  </Text>
                </View>
                <View style={styles.operatorStat}>
                  <Clock size={14} color={colors.textSecondary} />
                  <Text style={styles.operatorStatText}>
                    {operator.latencyMs || 0}ms
                  </Text>
                </View>
              </View>

              <View style={styles.operatorModels}>
                {operator.supportedModels.slice(0, 3).map((model, idx) => (
                  <View key={idx} style={styles.miniModelChip}>
                    <Text style={styles.miniModelText}>{model}</Text>
                  </View>
                ))}
                {operator.supportedModels.length > 3 && (
                  <Text style={styles.moreModels}>
                    +{operator.supportedModels.length - 3} more
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* View Network Economics Button */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: colors.primary + '15',
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.primary + '30',
            marginTop: 8,
          }}
          onPress={() => router.push('/network')}
        >
          <TrendingUp size={18} color={colors.primary} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
            View Network Economics
          </Text>
        </TouchableOpacity>

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
      textAlign: "center"
    },
    infoCard: {
      flexDirection: "row",
      backgroundColor: colors.primary + "15",
      borderRadius: 16,
      padding: 16,
      gap: 12,
      marginBottom: 20
    },
    infoContent: {
      flex: 1
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 12
    },
    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
      gap: 12
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary
    },
    errorContainer: {
      alignItems: "center",
      padding: 40
    },
    errorText: {
      fontSize: 14,
      color: colors.error,
      marginBottom: 16
    },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8
    },
    retryButtonText: {
      color: colors.background,
      fontWeight: "600"
    },
    emptyContainer: {
      alignItems: "center",
      padding: 40
    },
    emptyText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginTop: 16
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4
    },
    operatorCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border
    },
    operatorHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8
    },
    operatorTitle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8
    },
    operatorName: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text
    },
    healthBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12
    },
    healthDot: {
      width: 6,
      height: 6,
      borderRadius: 3
    },
    healthText: {
      fontSize: 12,
      fontWeight: "500"
    },
    operatorEndpoint: {
      fontSize: 13,
      color: colors.textSecondary,
      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
      marginBottom: 12
    },
    operatorStats: {
      flexDirection: "row",
      gap: 16,
      marginBottom: 12
    },
    operatorStat: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4
    },
    operatorStatText: {
      fontSize: 12,
      color: colors.textSecondary
    },
    operatorModels: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6
    },
    miniModelChip: {
      backgroundColor: colors.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6
    },
    miniModelText: {
      fontSize: 11,
      color: colors.text
    },
    moreModels: {
      fontSize: 11,
      color: colors.textSecondary,
      alignSelf: "center"
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
    statusHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20
    },
    statusText: {
      fontSize: 14,
      fontWeight: "600"
    },
    latencyText: {
      fontSize: 13,
      color: colors.textSecondary
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    detailLabel: {
      fontSize: 14,
      color: colors.textSecondary
    },
    detailValue: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text
    },
    stakeAmount: {
      alignItems: "center",
      marginBottom: 16
    },
    stakeValue: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.text
    },
    stakeLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4
    },
    rewardsContainer: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginBottom: 16,
      paddingVertical: 12,
      backgroundColor: colors.background,
      borderRadius: 12
    },
    rewardItem: {
      alignItems: "center"
    },
    rewardLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4
    },
    rewardValue: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.success
    },
    claimButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      padding: 14,
      borderRadius: 12
    },
    claimButtonText: {
      color: colors.background,
      fontSize: 16,
      fontWeight: "600"
    },
    statsGrid: {
      flexDirection: "row",
      justifyContent: "space-around"
    },
    statBox: {
      alignItems: "center"
    },
    statBoxValue: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text
    },
    statBoxLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4
    },
    statsSection: {
      marginBottom: 16
    },
    statsTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 12
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-around"
    },
    statItem: {
      alignItems: "center"
    },
    statValue: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4
    },
    modelsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    modelChip: {
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8
    },
    modelChipText: {
      fontSize: 13,
      color: colors.text
    },
    registerButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 14,
      gap: 8,
      marginBottom: 20,
    },
    registerButtonText: {
      color: colors.background,
      fontSize: 16,
      fontWeight: "600",
    },
    navLinks: {
      flexDirection: "row",
      gap: 12,
      marginTop: 12,
    },
    navLink: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      padding: 10,
      borderRadius: 10,
      backgroundColor: colors.primary + "15",
    },
    navLinkText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.primary,
    },
    myOpActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    myOpActionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.primary + "12",
    },
    myOpActionText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
  });
