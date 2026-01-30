import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useMode } from "../context/ModeContext";
import { API_URL } from "../config/api";
import {
  ArrowLeft,
  Server,
  Activity,
  Cpu,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Award,
  Globe,
  TrendingUp,
  Pin,
  Check,
  Zap,
  Info,
} from "lucide-react-native";

interface NetworkOperator {
  address: string;
  endpoint: string;
  supportedModels: string[];
  stakeAmount: string;
  isHealthy: boolean;
  latencyMs: number;
  performanceScore: number;
  isActive: boolean;
}

interface NetworkModel {
  id: string;
  name: string;
  nodeCount: number;
  avgLatencyMs: number;
  available: boolean;
}

interface NetworkHealthData {
  totalNodes: number;
  healthyNodes: number;
  unhealthyNodes: number;
  availableModels: string[];
  avgLatencyMs: number;
}

type TabType = "operators" | "models" | "economics";

// Compute stake weight multiplier
const computeStakeWeight = (stake: number): number => {
  if (stake < 1000) return 1.0;
  return 1.0 + Math.min((stake - 1000) / 1000 * 0.1, 1.0);
};

// Get color for performance score
const getScoreColor = (score: number): string => {
  if (score >= 70) return "#4CAF50";
  if (score >= 40) return "#FFC107";
  return "#F44336";
};

export default function NetworkScreen() {
  const router = useRouter();
  const { theme: colors } = useTheme();
  const { selectedNodeAddress, setSelectedNodeAddress, setMode, isDecentralized } = useMode();

  const [operators, setOperators] = useState<NetworkOperator[]>([]);
  const [models, setModels] = useState<NetworkModel[]>([]);
  const [health, setHealth] = useState<NetworkHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("operators");

  // Economics: stake calculator
  const [calcStake, setCalcStake] = useState("5000");

  // Epoch countdown
  const [epochCountdown, setEpochCountdown] = useState("");
  const [currentEpoch, setCurrentEpoch] = useState<number | null>(null);

  const styles = createStyles(colors);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [opsRes, modelsRes, healthRes] = await Promise.all([
        fetch(`${API_URL}/operators`),
        fetch(`${API_URL}/operators/models`),
        fetch(`${API_URL}/operators/health`),
      ]);

      if (opsRes.ok) {
        const data = await opsRes.json();
        setOperators(data.operators || []);
      }
      if (modelsRes.ok) {
        const data = await modelsRes.json();
        setModels(data.models || []);
      }
      if (healthRes.ok) {
        const data = await healthRes.json();
        setHealth(data);
        if (data.currentEpoch != null) {
          setCurrentEpoch(data.currentEpoch);
        }
      }
    } catch (err) {
      console.error("[Network] Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Epoch countdown timer (resets at midnight UTC each day = 24h epochs)
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
      nextMidnight.setUTCHours(0, 0, 0, 0);
      const diff = nextMidnight.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setEpochCountdown(`${hours}h ${minutes}m ${seconds}s`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const truncateEndpoint = (ep: string) =>
    ep.length > 35 ? ep.substring(0, 35) + "..." : ep;

  const handlePinNode = (operatorAddress: string) => {
    setSelectedNodeAddress(operatorAddress);
    if (!isDecentralized) {
      setMode("decentralized");
    }
    Alert.alert("Node Pinned", `Now routing through ${operatorAddress.slice(0, 6)}...${operatorAddress.slice(-4)}`);
  };

  const handleUnpinNode = () => {
    setSelectedNodeAddress(null);
  };

  // Compute total staked across operators
  const totalStaked = operators.reduce((sum, op) => sum + parseFloat(op.stakeAmount || "0"), 0);
  const activeOperators = operators.filter(op => op.isHealthy).length;

  // Stake calculator value
  const calcStakeNum = parseFloat(calcStake) || 0;
  const calcMultiplier = computeStakeWeight(calcStakeNum);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Network Explorer</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchAll}>
          <RefreshCw size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Network Overview */}
        {health && (
          <View style={styles.overviewCard}>
            <View style={styles.overviewHeader}>
              <Globe size={20} color={colors.primary} />
              <Text style={styles.overviewTitle}>Network Overview</Text>
            </View>
            <View style={styles.overviewStats}>
              <View style={styles.overviewStat}>
                <Text style={styles.overviewStatValue}>{health.totalNodes}</Text>
                <Text style={styles.overviewStatLabel}>Total Nodes</Text>
              </View>
              <View style={styles.overviewDivider} />
              <View style={styles.overviewStat}>
                <Text style={[styles.overviewStatValue, { color: colors.success }]}>
                  {health.healthyNodes}
                </Text>
                <Text style={styles.overviewStatLabel}>Healthy</Text>
              </View>
              <View style={styles.overviewDivider} />
              <View style={styles.overviewStat}>
                <Text style={styles.overviewStatValue}>
                  {health.availableModels.length}
                </Text>
                <Text style={styles.overviewStatLabel}>Models</Text>
              </View>
              <View style={styles.overviewDivider} />
              <View style={styles.overviewStat}>
                <Text style={styles.overviewStatValue}>{health.avgLatencyMs}ms</Text>
                <Text style={styles.overviewStatLabel}>Avg Latency</Text>
              </View>
            </View>
          </View>
        )}

        {/* Tab Switch - 3 tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "operators" && styles.tabActive]}
            onPress={() => setActiveTab("operators")}
          >
            <Server size={16} color={activeTab === "operators" ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === "operators" && { color: colors.primary }]}>
              Operators
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "models" && styles.tabActive]}
            onPress={() => setActiveTab("models")}
          >
            <Cpu size={16} color={activeTab === "models" ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === "models" && { color: colors.primary }]}>
              Models
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "economics" && styles.tabActive]}
            onPress={() => setActiveTab("economics")}
          >
            <TrendingUp size={16} color={activeTab === "economics" ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, activeTab === "economics" && { color: colors.primary }]}>
              Economics
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading network data...</Text>
          </View>
        ) : activeTab === "operators" ? (
          <>
            {operators.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Server size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No operators on the network yet</Text>
              </View>
            ) : (
              operators.map((op) => {
                const isPinned = selectedNodeAddress === op.address;
                return (
                  <View key={op.address} style={styles.opCard}>
                    <View style={styles.opHeader}>
                      <View style={styles.opTitle}>
                        <Server size={18} color={colors.primary} />
                        <Text style={styles.opName}>{op.address.slice(0, 6)}...{op.address.slice(-4)}</Text>
                      </View>
                      <View
                        style={[
                          styles.healthBadge,
                          {
                            backgroundColor: op.isHealthy
                              ? colors.success + "20"
                              : colors.error + "20",
                          },
                        ]}
                      >
                        {op.isHealthy ? (
                          <CheckCircle size={12} color={colors.success} />
                        ) : (
                          <XCircle size={12} color={colors.error} />
                        )}
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: op.isHealthy ? colors.success : colors.error,
                          }}
                        >
                          {op.isHealthy ? "Healthy" : "Unhealthy"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.opEndpoint} numberOfLines={1}>
                      {truncateEndpoint(op.endpoint)}
                    </Text>

                    {/* Performance Score Bar */}
                    <View style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>Performance</Text>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: getScoreColor(op.performanceScore) }}>
                          {op.performanceScore}/100
                        </Text>
                      </View>
                      <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" }}>
                        <View
                          style={{
                            height: 6,
                            width: `${Math.min(op.performanceScore, 100)}%`,
                            backgroundColor: getScoreColor(op.performanceScore),
                            borderRadius: 3,
                          }}
                        />
                      </View>
                    </View>

                    <View style={styles.opMeta}>
                      <View style={styles.opMetaItem}>
                        <Award size={12} color={colors.textSecondary} />
                        <Text style={styles.opMetaText}>
                          {parseFloat(op.stakeAmount).toFixed(0)} ZEROP
                        </Text>
                      </View>
                      <View style={styles.opMetaItem}>
                        <Clock size={12} color={colors.textSecondary} />
                        <Text style={styles.opMetaText}>{op.latencyMs}ms</Text>
                      </View>
                      <View style={styles.opMetaItem}>
                        <Cpu size={12} color={colors.textSecondary} />
                        <Text style={styles.opMetaText}>
                          {op.supportedModels.length} model{op.supportedModels.length !== 1 ? "s" : ""}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.opModels}>
                      {op.supportedModels.slice(0, 4).map((model, idx) => (
                        <View key={idx} style={styles.modelTag}>
                          <Text style={styles.modelTagText}>{model}</Text>
                        </View>
                      ))}
                      {op.supportedModels.length > 4 && (
                        <Text style={styles.moreModels}>
                          +{op.supportedModels.length - 4}
                        </Text>
                      )}
                    </View>

                    {/* Pin/Connect Button */}
                    {op.isHealthy && (
                      <TouchableOpacity
                        style={[
                          styles.pinButton,
                          isPinned && styles.pinButtonActive,
                        ]}
                        onPress={() => isPinned ? handleUnpinNode() : handlePinNode(op.address)}
                      >
                        {isPinned ? (
                          <>
                            <Check size={14} color={colors.success} />
                            <Text style={[styles.pinButtonText, { color: colors.success }]}>Connected</Text>
                          </>
                        ) : (
                          <>
                            <Pin size={14} color={colors.primary} />
                            <Text style={[styles.pinButtonText, { color: colors.primary }]}>Use this Node</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </>
        ) : activeTab === "models" ? (
          <>
            {models.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Cpu size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No models available yet</Text>
              </View>
            ) : (
              models.map((model) => (
                <View key={model.id} style={styles.modelCard}>
                  <View style={styles.modelCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modelCardName}>{model.name}</Text>
                      <View style={styles.modelCardMeta}>
                        <View style={styles.opMetaItem}>
                          <Server size={12} color={colors.textSecondary} />
                          <Text style={styles.opMetaText}>
                            {model.nodeCount} node{model.nodeCount !== 1 ? "s" : ""}
                          </Text>
                        </View>
                        <View style={styles.opMetaItem}>
                          <Clock size={12} color={colors.textSecondary} />
                          <Text style={styles.opMetaText}>{model.avgLatencyMs}ms</Text>
                        </View>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.healthBadge,
                        {
                          backgroundColor: model.available
                            ? colors.success + "20"
                            : colors.error + "20",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: model.available ? colors.success : colors.error,
                        }}
                      >
                        {model.available ? "Available" : "Offline"}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        ) : (
          /* Economics Tab */
          <>
            {/* Card 1: Token Overview */}
            <View style={styles.econCard}>
              <View style={styles.econCardHeader}>
                <Zap size={18} color={colors.primary} />
                <Text style={styles.econCardTitle}>Token Overview</Text>
              </View>
              <View style={styles.econRow}>
                <Text style={styles.econLabel}>Token</Text>
                <Text style={styles.econValue}>ZEROP (Native, ZeroPrompt Subnet)</Text>
              </View>
              <View style={styles.econRow}>
                <Text style={styles.econLabel}>Registration</Text>
                <Text style={styles.econValue}>Free (gas only)</Text>
              </View>
              <View style={styles.econRow}>
                <Text style={styles.econLabel}>Min Stake</Text>
                <Text style={styles.econValue}>1,000 ZEROP</Text>
              </View>
              <View style={[styles.econRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.econLabel}>Max Multiplier</Text>
                <Text style={styles.econValue}>2x (at 10,000+ ZEROP)</Text>
              </View>
            </View>

            {/* Card 2: Epoch System */}
            <View style={styles.econCard}>
              <View style={styles.econCardHeader}>
                <Clock size={18} color={colors.primary} />
                <Text style={styles.econCardTitle}>Epoch System</Text>
              </View>
              {currentEpoch != null && (
                <View style={styles.econRow}>
                  <Text style={styles.econLabel}>Current Epoch</Text>
                  <Text style={styles.econValue}>#{currentEpoch}</Text>
                </View>
              )}
              <View style={styles.econRow}>
                <Text style={styles.econLabel}>Duration</Text>
                <Text style={styles.econValue}>24 hours</Text>
              </View>
              <View style={styles.econRow}>
                <Text style={styles.econLabel}>Reward / Request</Text>
                <Text style={styles.econValue}>0.001 ZEROP</Text>
              </View>
              <View style={[styles.econRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.econLabel}>Next Epoch</Text>
                <Text style={[styles.econValue, { color: colors.primary, fontWeight: "700" }]}>
                  {epochCountdown}
                </Text>
              </View>
            </View>

            {/* Card 3: How Rewards Work */}
            <View style={styles.econCard}>
              <View style={styles.econCardHeader}>
                <Info size={18} color={colors.primary} />
                <Text style={styles.econCardTitle}>How Rewards Work</Text>
              </View>
              <Text style={styles.econText}>
                Operators earn ZEROP for serving inference requests. Rewards are distributed proportionally based on:
              </Text>
              <View style={{ gap: 6, marginTop: 8 }}>
                <Text style={styles.econText}>1. Number of requests served</Text>
                <Text style={styles.econText}>
                  2. Performance score (success 40%, latency 30%, uptime 30%)
                </Text>
                <Text style={styles.econText}>
                  3. Stake weight (1x at 1,000 → 2x at 10,000+ ZEROP)
                </Text>
              </View>
              <View style={styles.formulaBox}>
                <Text style={styles.formulaText}>
                  weightedRequests = requests x (score/100) x (stakeWeight/100)
                </Text>
              </View>
            </View>

            {/* Card 4: Stake Weight Calculator */}
            <View style={styles.econCard}>
              <View style={styles.econCardHeader}>
                <Award size={18} color={colors.primary} />
                <Text style={styles.econCardTitle}>Stake Weight Calculator</Text>
              </View>
              <Text style={[styles.econLabel, { marginBottom: 8 }]}>Your Stake Amount (ZEROP)</Text>
              <TextInput
                style={styles.calcInput}
                value={calcStake}
                onChangeText={setCalcStake}
                keyboardType="numeric"
                placeholder="1000"
                placeholderTextColor={colors.textSecondary}
              />
              <View style={styles.calcResult}>
                <Text style={styles.calcResultLabel}>
                  {calcStakeNum.toLocaleString()} ZEROP
                </Text>
                <Text style={styles.calcResultValue}>
                  {calcMultiplier.toFixed(2)}x multiplier
                </Text>
              </View>
              <Text style={[styles.econText, { marginTop: 8, fontSize: 11 }]}>
                Formula: weight = 1.0 + min((stake - 1000) / 1000 x 0.1, 1.0)
              </Text>
            </View>

            {/* Card 5: Performance Scoring */}
            <View style={styles.econCard}>
              <View style={styles.econCardHeader}>
                <Activity size={18} color={colors.primary} />
                <Text style={styles.econCardTitle}>Performance Scoring</Text>
              </View>
              {/* Success Rate */}
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={styles.econLabel}>Success Rate</Text>
                  <Text style={[styles.econLabel, { fontWeight: "600" }]}>40% weight</Text>
                </View>
                <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" }}>
                  <View style={{ height: 8, width: "40%", backgroundColor: "#4CAF50", borderRadius: 4 }} />
                </View>
                <Text style={[styles.econText, { marginTop: 2, fontSize: 11 }]}>
                  % of requests completed without error
                </Text>
              </View>
              {/* Latency */}
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={styles.econLabel}>Latency</Text>
                  <Text style={[styles.econLabel, { fontWeight: "600" }]}>30% weight</Text>
                </View>
                <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" }}>
                  <View style={{ height: 8, width: "30%", backgroundColor: "#2196F3", borderRadius: 4 }} />
                </View>
                <Text style={[styles.econText, { marginTop: 2, fontSize: 11 }]}>
                  Full score {"<"}500ms, zero {">"}5000ms
                </Text>
              </View>
              {/* Uptime */}
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={styles.econLabel}>Uptime</Text>
                  <Text style={[styles.econLabel, { fontWeight: "600" }]}>30% weight</Text>
                </View>
                <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" }}>
                  <View style={{ height: 8, width: "30%", backgroundColor: "#FF9800", borderRadius: 4 }} />
                </View>
                <Text style={[styles.econText, { marginTop: 2, fontSize: 11 }]}>
                  % of health checks passed (every 30s)
                </Text>
              </View>
              <View style={[styles.formulaBox, { marginTop: 12 }]}>
                <Text style={styles.formulaText}>Composite: 0-100 score</Text>
              </View>
            </View>

            {/* Card 6: Network Stats (live) */}
            <View style={styles.econCard}>
              <View style={styles.econCardHeader}>
                <Globe size={18} color={colors.primary} />
                <Text style={styles.econCardTitle}>Network Stats</Text>
              </View>
              <View style={styles.econRow}>
                <Text style={styles.econLabel}>Active Operators</Text>
                <Text style={styles.econValue}>{activeOperators}</Text>
              </View>
              <View style={styles.econRow}>
                <Text style={styles.econLabel}>Total ZEROP Staked</Text>
                <Text style={styles.econValue}>{totalStaked.toLocaleString()}</Text>
              </View>
              <View style={styles.econRow}>
                <Text style={styles.econLabel}>Avg Latency</Text>
                <Text style={styles.econValue}>{health?.avgLatencyMs || 0}ms</Text>
              </View>
              <View style={[styles.econRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.econLabel}>Available Models</Text>
                <Text style={styles.econValue}>{health?.availableModels?.length || 0}</Text>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "web" ? 20 : 50,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: { padding: 8 },
    title: { fontSize: 20, fontWeight: "700", color: colors.text },
    refreshButton: { padding: 8 },
    content: { flex: 1, padding: 16 },
    overviewCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
    },
    overviewHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    overviewTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
    overviewStats: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
    },
    overviewStat: { alignItems: "center" },
    overviewStatValue: { fontSize: 24, fontWeight: "700", color: colors.text },
    overviewStatLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
    overviewDivider: { width: 1, height: 40, backgroundColor: colors.border },
    tabBar: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 4,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    tabActive: {
      backgroundColor: colors.primary + "15",
    },
    tabText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
      gap: 12,
    },
    loadingText: { fontSize: 14, color: colors.textSecondary },
    emptyContainer: { alignItems: "center", padding: 40 },
    emptyText: { fontSize: 16, fontWeight: "600", color: colors.textSecondary, marginTop: 16 },
    opCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    opHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    opTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
    opName: { fontSize: 16, fontWeight: "600", color: colors.text },
    healthBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    opEndpoint: {
      fontSize: 13,
      color: colors.textSecondary,
      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
      marginBottom: 10,
    },
    opMeta: { flexDirection: "row", gap: 16, marginBottom: 10 },
    opMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    opMetaText: { fontSize: 12, color: colors.textSecondary },
    opModels: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
    modelTag: {
      backgroundColor: colors.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    modelTagText: { fontSize: 11, color: colors.text },
    moreModels: { fontSize: 11, color: colors.textSecondary, alignSelf: "center" },
    pinButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.primary + "12",
      borderWidth: 1,
      borderColor: colors.primary + "30",
    },
    pinButtonActive: {
      backgroundColor: colors.success + "15",
      borderColor: colors.success + "40",
    },
    pinButtonText: {
      fontSize: 13,
      fontWeight: "600",
    },
    modelCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modelCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    modelCardName: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 6 },
    modelCardMeta: { flexDirection: "row", gap: 16 },
    // Economics styles
    econCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    econCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
    },
    econCardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    econRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    econLabel: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    econValue: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.text,
    },
    econText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    formulaBox: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
    },
    formulaText: {
      fontSize: 12,
      color: colors.primary,
      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
      textAlign: "center",
    },
    calcInput: {
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 16,
      color: colors.text,
      fontWeight: "600",
      marginBottom: 12,
    },
    calcResult: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.primary + "12",
      borderRadius: 10,
      padding: 14,
    },
    calcResultLabel: {
      fontSize: 14,
      color: colors.text,
    },
    calcResultValue: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primary,
    },
  });
