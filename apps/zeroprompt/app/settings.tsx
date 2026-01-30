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
import { useMode } from "../context/ModeContext";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config/api";
import {
  ZEROP_TOKEN_ADDRESS,
  OPERATOR_REGISTRY_ADDRESS,
  SUBNET_REWARDS_ADDRESS,
  SUBNET_CHAIN_ID,
} from "../lib/subnetContracts";
import {
  ArrowLeft,
  Cpu,
  Cloud,
  Zap,
  Server,
  Activity,
  Shield,
  DollarSign,
  RefreshCw,
  ChevronRight,
  Info,
  Globe,
  Clock,
  XCircle,
  CheckCircle,
  Link2,
  Search,
  AlertTriangle,
} from "lucide-react-native";

interface ConnectedNodeData {
  address: string;
  endpoint: string;
  supportedModels: string[];
  isHealthy: boolean;
  latencyMs: number;
  performanceScore: number;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { theme: colors } = useTheme();
  const { user } = useAuth();
  const {
    mode,
    setMode,
    networkHealth,
    availableOllamaModels,
    isLoadingModels,
    refreshOllamaModels,
    refreshNetworkHealth,
    isDecentralized,
    selectedNodeAddress,
    setSelectedNodeAddress,
  } = useMode();

  const [connectedNode, setConnectedNode] = useState<ConnectedNodeData | null>(null);
  const [isLoadingNode, setIsLoadingNode] = useState(false);
  const [epochCountdown, setEpochCountdown] = useState("");
  const [currentEpoch, setCurrentEpoch] = useState<number | null>(null);

  const styles = createStyles(colors);

  // Fetch connected node data
  const fetchConnectedNode = useCallback(async () => {
    if (selectedNodeAddress == null) {
      setConnectedNode(null);
      return;
    }
    setIsLoadingNode(true);
    try {
      const res = await fetch(`${API_URL}/operators/${selectedNodeAddress}`);
      if (res.ok) {
        const data = await res.json();
        setConnectedNode(data);
      }
    } catch (err) {
      console.error("[Settings] Failed to fetch node:", err);
    } finally {
      setIsLoadingNode(false);
    }
  }, [selectedNodeAddress]);

  useEffect(() => {
    fetchConnectedNode();
  }, [fetchConnectedNode]);

  // Fetch epoch info
  useEffect(() => {
    const fetchEpoch = async () => {
      try {
        const res = await fetch(`${API_URL}/operators/health`);
        if (res.ok) {
          const data = await res.json();
          if (data.currentEpoch != null) {
            setCurrentEpoch(data.currentEpoch);
          }
        }
      } catch (err) {
        // silent
      }
    };
    if (isDecentralized) fetchEpoch();
  }, [isDecentralized]);

  // Epoch countdown timer
  useEffect(() => {
    if (!isDecentralized) return;
    const updateCountdown = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
      nextMidnight.setUTCHours(0, 0, 0, 0);
      const diff = nextMidnight.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setEpochCountdown(`${hours}h ${minutes}m`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [isDecentralized]);

  const truncateEndpoint = (ep: string) =>
    ep.length > 30 ? ep.substring(0, 30) + "..." : ep;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 1. Inference Mode Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inference Mode</Text>
          <Text style={styles.sectionSubtitle}>
            Choose how your AI requests are processed
          </Text>

          {/* Centralized Mode Card */}
          <TouchableOpacity
            style={[
              styles.modeCard,
              mode === "centralized" && styles.modeCardActive
            ]}
            onPress={() => setMode("centralized")}
          >
            <View style={styles.modeCardHeader}>
              <View style={styles.modeIconContainer}>
                <Cloud size={24} color={mode === "centralized" ? colors.primary : colors.textSecondary} />
              </View>
              <View style={styles.modeInfo}>
                <Text style={[
                  styles.modeTitle,
                  mode === "centralized" && styles.modeTitleActive
                ]}>
                  Centralized (OpenRouter)
                </Text>
                <Text style={styles.modeDescription}>
                  Access 330+ models via OpenRouter
                </Text>
              </View>
              <View style={[
                styles.modeRadio,
                mode === "centralized" && styles.modeRadioActive
              ]}>
                {mode === "centralized" && <View style={styles.modeRadioInner} />}
              </View>
            </View>

            <View style={styles.modeFeatures}>
              <View style={styles.modeFeature}>
                <Zap size={14} color={colors.success} />
                <Text style={styles.modeFeatureText}>Fast & reliable</Text>
              </View>
              <View style={styles.modeFeature}>
                <DollarSign size={14} color={colors.warning} />
                <Text style={styles.modeFeatureText}>Pay per use</Text>
              </View>
              <View style={styles.modeFeature}>
                <Shield size={14} color={colors.primary} />
                <Text style={styles.modeFeatureText}>Premium models</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Decentralized Mode Card */}
          <TouchableOpacity
            style={[
              styles.modeCard,
              mode === "decentralized" && styles.modeCardActive
            ]}
            onPress={() => setMode("decentralized")}
          >
            <View style={styles.modeCardHeader}>
              <View style={styles.modeIconContainer}>
                <Cpu size={24} color={mode === "decentralized" ? colors.primary : colors.textSecondary} />
              </View>
              <View style={styles.modeInfo}>
                <Text style={[
                  styles.modeTitle,
                  mode === "decentralized" && styles.modeTitleActive
                ]}>
                  Decentralized (Ollama)
                </Text>
                <Text style={styles.modeDescription}>
                  Community-powered AI inference
                </Text>
              </View>
              <View style={[
                styles.modeRadio,
                mode === "decentralized" && styles.modeRadioActive
              ]}>
                {mode === "decentralized" && <View style={styles.modeRadioInner} />}
              </View>
            </View>

            <View style={styles.modeFeatures}>
              <View style={styles.modeFeature}>
                <DollarSign size={14} color={colors.success} />
                <Text style={styles.modeFeatureText}>Free to use</Text>
              </View>
              <View style={styles.modeFeature}>
                <Server size={14} color={colors.primary} />
                <Text style={styles.modeFeatureText}>Decentralized</Text>
              </View>
              <View style={styles.modeFeature}>
                <Shield size={14} color={colors.success} />
                <Text style={styles.modeFeatureText}>Privacy focused</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* 2. Explore Network Link */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => router.push("/network")}
          >
            <View style={styles.linkCardContent}>
              <Globe size={20} color={colors.primary} />
              <View style={styles.linkCardInfo}>
                <Text style={styles.linkCardTitle}>Explore Network</Text>
                <Text style={styles.linkCardDescription}>
                  Browse operators, models, and network economics
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* 3. Operator Dashboard Link */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Node Operators</Text>
          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => router.push("/operator")}
          >
            <View style={styles.linkCardContent}>
              <Server size={20} color={colors.primary} />
              <View style={styles.linkCardInfo}>
                <Text style={styles.linkCardTitle}>Operator Dashboard</Text>
                <Text style={styles.linkCardDescription}>
                  {user?.walletAddress
                    ? "Manage your Ollama nodes and claim rewards"
                    : "Connect wallet to manage nodes and earn rewards"}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* 4. Connected Node (if pinned) */}
        {selectedNodeAddress != null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connected Node</Text>
            {isLoadingNode ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Loading node info...</Text>
              </View>
            ) : connectedNode ? (
              <View style={styles.connectedNodeCard}>
                <View style={styles.connectedNodeHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Link2 size={18} color={colors.primary} />
                    <Text style={styles.connectedNodeTitle}>
                      {connectedNode.address.slice(0, 6)}...{connectedNode.address.slice(-4)}
                    </Text>
                  </View>
                  <View style={[
                    styles.healthBadgeSmall,
                    { backgroundColor: connectedNode.isHealthy ? colors.success + "20" : colors.error + "20" }
                  ]}>
                    {connectedNode.isHealthy ? (
                      <CheckCircle size={12} color={colors.success} />
                    ) : (
                      <XCircle size={12} color={colors.error} />
                    )}
                    <Text style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: connectedNode.isHealthy ? colors.success : colors.error
                    }}>
                      {connectedNode.isHealthy ? "Online" : "Offline"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.connectedNodeEndpoint} numberOfLines={1}>
                  {truncateEndpoint(connectedNode.endpoint)}
                </Text>

                <View style={{ flexDirection: "row", gap: 16, marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Clock size={12} color={colors.textSecondary} />
                    <Text style={styles.connectedNodeMeta}>{connectedNode.latencyMs}ms</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Activity size={12} color={colors.textSecondary} />
                    <Text style={styles.connectedNodeMeta}>Score: {connectedNode.performanceScore}/100</Text>
                  </View>
                </View>

                {/* Supported models */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {connectedNode.supportedModels.slice(0, 4).map((m, i) => (
                    <View key={i} style={{
                      backgroundColor: colors.background,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                    }}>
                      <Text style={{ fontSize: 11, color: colors.text }}>{m}</Text>
                    </View>
                  ))}
                  {connectedNode.supportedModels.length > 4 && (
                    <Text style={{ fontSize: 11, color: colors.textSecondary, alignSelf: "center" }}>
                      +{connectedNode.supportedModels.length - 4}
                    </Text>
                  )}
                </View>

                {/* Actions */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.connectedNodeBtn, { backgroundColor: colors.error + "15", flex: 1 }]}
                    onPress={() => setSelectedNodeAddress(null)}
                  >
                    <XCircle size={14} color={colors.error} />
                    <Text style={[styles.connectedNodeBtnText, { color: colors.error }]}>Disconnect</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.connectedNodeBtn, { backgroundColor: colors.primary + "15", flex: 1 }]}
                    onPress={() => router.push("/network")}
                  >
                    <Globe size={14} color={colors.primary} />
                    <Text style={[styles.connectedNodeBtnText, { color: colors.primary }]}>Change Node</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.networkCard}>
                <Text style={styles.emptyText}>Unable to fetch node data</Text>
              </View>
            )}
          </View>
        )}

        {/* 5. Network Status (only show when decentralized) */}
        {isDecentralized && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Network Status</Text>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={() => {
                  refreshNetworkHealth();
                  refreshOllamaModels();
                }}
              >
                <RefreshCw size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {isLoadingModels ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Fetching network status...</Text>
              </View>
            ) : networkHealth ? (
              <View style={styles.networkCard}>
                <View style={styles.networkStats}>
                  <View style={styles.networkStat}>
                    <Text style={styles.networkStatValue}>
                      {networkHealth.healthyNodes}
                    </Text>
                    <Text style={styles.networkStatLabel}>Healthy Nodes</Text>
                  </View>
                  <View style={styles.networkStatDivider} />
                  <View style={styles.networkStat}>
                    <Text style={styles.networkStatValue}>
                      {availableOllamaModels.length}
                    </Text>
                    <Text style={styles.networkStatLabel}>Available Models</Text>
                  </View>
                  <View style={styles.networkStatDivider} />
                  <View style={styles.networkStat}>
                    <Text style={styles.networkStatValue}>
                      {networkHealth.avgLatencyMs}ms
                    </Text>
                    <Text style={styles.networkStatLabel}>Avg Latency</Text>
                  </View>
                </View>

                {/* Health indicator */}
                <View style={styles.healthIndicator}>
                  <View style={[
                    styles.healthDot,
                    { backgroundColor: networkHealth.healthyNodes > 0 ? colors.success : colors.error }
                  ]} />
                  <Text style={styles.healthText}>
                    {networkHealth.healthyNodes > 0
                      ? `Network operational (${networkHealth.healthyNodes}/${networkHealth.totalNodes} nodes online)`
                      : "No nodes available"}
                  </Text>
                </View>

                {/* Epoch countdown */}
                {(currentEpoch != null || epochCountdown) && (
                  <View style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 12,
                    marginTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}>
                    {currentEpoch != null && (
                      <Text style={styles.healthText}>
                        Current Epoch: #{currentEpoch}
                      </Text>
                    )}
                    {epochCountdown && (
                      <Text style={[styles.healthText, { color: colors.primary, fontWeight: "600" }]}>
                        Resets in: {epochCountdown}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.networkCard}>
                <Text style={styles.emptyText}>
                  Unable to fetch network status
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Available Ollama Models (only show when decentralized) */}
        {isDecentralized && availableOllamaModels.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Ollama Models</Text>
            <View style={styles.modelsCard}>
              {availableOllamaModels.map((model) => (
                <View key={model.id} style={styles.modelItem}>
                  <View style={styles.modelInfo}>
                    <Text style={styles.modelName}>{model.name}</Text>
                    <Text style={styles.modelMeta}>
                      {model.nodeCount} node{model.nodeCount !== 1 ? "s" : ""} | {model.avgLatencyMs}ms avg
                    </Text>
                  </View>
                  <View style={[
                    styles.modelStatus,
                    { backgroundColor: model.available ? colors.success + "20" : colors.error + "20" }
                  ]}>
                    <Text style={[
                      styles.modelStatusText,
                      { color: model.available ? colors.success : colors.error }
                    ]}>
                      {model.available ? "Available" : "Offline"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Subnet Block Explorer */}
        <View style={styles.section}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Text style={styles.sectionTitle}>Subnet Explorer</Text>
            <View style={styles.testnetBadge}>
              <AlertTriangle size={10} color="#FF9800" />
              <Text style={styles.testnetBadgeText}>TESTNET</Text>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>
            Verify on-chain contracts on ZeroPrompt Subnet (Chain {SUBNET_CHAIN_ID})
          </Text>

          <View style={styles.explorerCard}>
            {/* ZEROP Token */}
            <TouchableOpacity
              style={styles.explorerRow}
              onPress={() => router.push("/explorer")}
            >
              <View style={styles.explorerRowLeft}>
                <View style={[styles.explorerDot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.explorerLabel}>ZEROP Token (ERC-20)</Text>
                  <Text style={styles.explorerAddress} numberOfLines={1}>
                    {ZEROP_TOKEN_ADDRESS.slice(0, 6)}...{ZEROP_TOKEN_ADDRESS.slice(-4)}
                  </Text>
                </View>
              </View>
              <ChevronRight size={14} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Operator Registry */}
            <TouchableOpacity
              style={styles.explorerRow}
              onPress={() => router.push("/explorer")}
            >
              <View style={styles.explorerRowLeft}>
                <View style={[styles.explorerDot, { backgroundColor: "#2196F3" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.explorerLabel}>Operator Registry (Staking)</Text>
                  <Text style={styles.explorerAddress} numberOfLines={1}>
                    {OPERATOR_REGISTRY_ADDRESS.slice(0, 6)}...{OPERATOR_REGISTRY_ADDRESS.slice(-4)}
                  </Text>
                </View>
              </View>
              <ChevronRight size={14} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Subnet Rewards */}
            <TouchableOpacity
              style={[styles.explorerRow, { borderBottomWidth: 0 }]}
              onPress={() => router.push("/explorer")}
            >
              <View style={styles.explorerRowLeft}>
                <View style={[styles.explorerDot, { backgroundColor: "#4CAF50" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.explorerLabel}>Subnet Rewards (Epochs)</Text>
                  <Text style={styles.explorerAddress} numberOfLines={1}>
                    {SUBNET_REWARDS_ADDRESS.slice(0, 6)}...{SUBNET_REWARDS_ADDRESS.slice(-4)}
                  </Text>
                </View>
              </View>
              <ChevronRight size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Built-in Explorer button */}
          <TouchableOpacity
            style={[styles.explorerButton, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "50" }]}
            onPress={() => router.push("/explorer")}
          >
            <Search size={16} color={colors.primary} />
            <Text style={styles.explorerButtonText}>Open Subnet Explorer</Text>
            <ChevronRight size={14} color={colors.primary} />
          </TouchableOpacity>

        </View>

        {/* Info Card */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Info size={20} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>About Decentralized Mode</Text>
              <Text style={styles.infoText}>
                In decentralized mode, your requests are processed by community-operated
                Ollama nodes. Operators stake ZEROP tokens and earn rewards for serving requests.
                This mode is free for users!
              </Text>
            </View>
          </View>
        </View>

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
    content: {
      flex: 1,
      padding: 16
    },
    section: {
      marginBottom: 24
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4
    },
    sectionSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16
    },
    refreshButton: {
      padding: 8
    },
    modeCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: colors.border
    },
    modeCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "10"
    },
    modeCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12
    },
    modeIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12
    },
    modeInfo: {
      flex: 1
    },
    modeTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 2
    },
    modeTitleActive: {
      color: colors.primary
    },
    modeDescription: {
      fontSize: 13,
      color: colors.textSecondary
    },
    modeRadio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center"
    },
    modeRadioActive: {
      borderColor: colors.primary
    },
    modeRadioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary
    },
    modeFeatures: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    modeFeature: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8
    },
    modeFeatureText: {
      fontSize: 12,
      color: colors.textSecondary
    },
    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      gap: 12
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary
    },
    networkCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border
    },
    networkStats: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      marginBottom: 16
    },
    networkStat: {
      alignItems: "center"
    },
    networkStatValue: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text
    },
    networkStatLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4
    },
    networkStatDivider: {
      width: 1,
      height: 40,
      backgroundColor: colors.border
    },
    healthIndicator: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    healthDot: {
      width: 8,
      height: 8,
      borderRadius: 4
    },
    healthText: {
      fontSize: 13,
      color: colors.textSecondary
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      paddingVertical: 20
    },
    modelsCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden"
    },
    modelItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    modelInfo: {
      flex: 1
    },
    modelName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text
    },
    modelMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2
    },
    modelStatus: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8
    },
    modelStatusText: {
      fontSize: 12,
      fontWeight: "500"
    },
    linkCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border
    },
    linkCardContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1
    },
    linkCardInfo: {
      flex: 1
    },
    linkCardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text
    },
    linkCardDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2
    },
    infoCard: {
      flexDirection: "row",
      backgroundColor: colors.primary + "15",
      borderRadius: 16,
      padding: 16,
      gap: 12
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
    // Connected Node styles
    connectedNodeCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.primary + "40",
    },
    connectedNodeHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    connectedNodeTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    healthBadgeSmall: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    connectedNodeEndpoint: {
      fontSize: 12,
      color: colors.textSecondary,
      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
      marginBottom: 10,
    },
    connectedNodeMeta: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    connectedNodeBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    connectedNodeBtnText: {
      fontSize: 13,
      fontWeight: "600",
    },
    // Subnet Explorer styles
    testnetBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#FF9800" + "20",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "#FF9800" + "40",
    },
    testnetBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#FF9800",
      letterSpacing: 0.5,
    },
    explorerCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    explorerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    explorerRowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    explorerDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    explorerLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    explorerAddress: {
      fontSize: 12,
      color: colors.textSecondary,
      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
      marginTop: 2,
    },
    explorerButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary + "12",
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary + "30",
      marginTop: 12,
    },
    explorerButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.primary,
    },
  });
