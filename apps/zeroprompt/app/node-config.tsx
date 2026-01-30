import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useWriteContract, useAccount } from "wagmi";
import { useSubnet } from "../context/SubnetContext";
import {
  ArrowLeft,
  Globe,
  Cpu,
  CheckCircle,
  XCircle,
  Power,
  Wallet,
  Plus,
  X,
} from "lucide-react-native";
import {
  OPERATOR_REGISTRY_ADDRESS,
  OPERATOR_REGISTRY_ABI,
  SUBNET_CHAIN_ID,
  getOperatorRegistry,
} from "../lib/subnetContracts";

export default function NodeConfigScreen() {
  const router = useRouter();
  const { theme: colors } = useTheme();
  const { isConnected, address } = useAccount();
  const { refreshMyOperator } = useSubnet();
  const { writeContractAsync } = useWriteContract();

  const [endpoint, setEndpoint] = useState("");
  const [newEndpoint, setNewEndpoint] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [newModel, setNewModel] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [txState, setTxState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txAction, setTxAction] = useState("");
  const [txError, setTxError] = useState<string | null>(null);
  const [endpointValidation, setEndpointValidation] = useState<"idle" | "validating" | "valid" | "invalid">("idle");

  const styles = createStyles(colors);

  const loadOperatorData = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const registry = getOperatorRegistry();
      const data = await registry.getOperator(address);
      setEndpoint(data[0]);
      setNewEndpoint(data[0]);
      setModels([...data[1]]);
      setIsActive(data[2]); // isRegistered
    } catch (err) {
      console.error("[NodeConfig] Load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadOperatorData();
  }, [loadOperatorData]);

  const validateNewEndpoint = async () => {
    if (!newEndpoint.trim()) return;
    setEndpointValidation("validating");
    try {
      const url = newEndpoint.trim().replace(/\/$/, "");
      const res = await fetch(`${url}/api/tags`, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEndpointValidation("valid");
    } catch {
      setEndpointValidation("invalid");
    }
  };

  const handleUpdateEndpoint = async () => {
    if (!writeContractAsync) return;
    setTxState("pending");
    setTxAction("Updating endpoint");
    setTxError(null);

    try {
      await writeContractAsync({
        address: OPERATOR_REGISTRY_ADDRESS as `0x${string}`,
        abi: OPERATOR_REGISTRY_ABI,
        functionName: "updateEndpoint",
        args: [newEndpoint.trim().replace(/\/$/, "")],
        chainId: SUBNET_CHAIN_ID,
      });
      setTxState("success");
      setEndpoint(newEndpoint.trim().replace(/\/$/, ""));
      await refreshMyOperator();
    } catch (err: any) {
      setTxError(err.message || "Transaction failed");
      setTxState("error");
    }
  };

  const handleUpdateModels = async () => {
    if (!writeContractAsync) return;
    setTxState("pending");
    setTxAction("Updating models");
    setTxError(null);

    try {
      await writeContractAsync({
        address: OPERATOR_REGISTRY_ADDRESS as `0x${string}`,
        abi: OPERATOR_REGISTRY_ABI,
        functionName: "setSupportedModels",
        args: [models],
        chainId: SUBNET_CHAIN_ID,
      });
      setTxState("success");
      await refreshMyOperator();
    } catch (err: any) {
      setTxError(err.message || "Transaction failed");
      setTxState("error");
    }
  };

  const addModel = () => {
    const trimmed = newModel.trim();
    if (trimmed && !models.includes(trimmed)) {
      setModels([...models, trimmed]);
      setNewModel("");
    }
  };

  const removeModel = (model: string) => {
    setModels(models.filter((m) => m !== model));
  };

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Node Config</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Wallet size={64} color={colors.primary} />
          <Text style={styles.centerTitle}>Connect Your Wallet</Text>
          <Text style={styles.centerSubtitle}>
            Connect your wallet to configure your node.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>
          Node Config
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading configuration...</Text>
          </View>
        ) : (
          <>
            {/* Node Status */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Power size={20} color={isActive ? colors.success : colors.error} />
                <Text style={styles.cardTitle}>Node Status</Text>
              </View>
              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.toggleLabel}>
                    {isActive ? "Registered" : "Not Registered"}
                  </Text>
                  <Text style={styles.toggleDescription}>
                    {isActive
                      ? "Your node is registered and receiving inference requests."
                      : "Your node is not registered on the network."}
                  </Text>
                </View>
                <View style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: isActive ? colors.success : colors.error,
                }} />
              </View>
            </View>

            {/* Endpoint */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Globe size={20} color={colors.primary} />
                <Text style={styles.cardTitle}>Endpoint</Text>
              </View>
              <Text style={styles.currentValue} numberOfLines={1}>
                Current: {endpoint}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="https://your-node.example.com"
                placeholderTextColor={colors.textSecondary}
                value={newEndpoint}
                onChangeText={(text) => {
                  setNewEndpoint(text);
                  setEndpointValidation("idle");
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={validateNewEndpoint}
                  disabled={endpointValidation === "validating"}
                >
                  {endpointValidation === "validating" ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <Text style={styles.secondaryButtonText}>Validate</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    { flex: 1 },
                    (newEndpoint === endpoint || txState === "pending") && styles.buttonDisabled,
                  ]}
                  onPress={handleUpdateEndpoint}
                  disabled={newEndpoint === endpoint || txState === "pending"}
                >
                  <Text style={styles.primaryButtonText}>Update Endpoint</Text>
                </TouchableOpacity>
              </View>
              {endpointValidation === "valid" && (
                <View style={styles.validationSuccess}>
                  <CheckCircle size={14} color={colors.success} />
                  <Text style={[styles.validationText, { color: colors.success }]}>
                    Endpoint reachable
                  </Text>
                </View>
              )}
              {endpointValidation === "invalid" && (
                <View style={styles.validationError}>
                  <XCircle size={14} color={colors.error} />
                  <Text style={[styles.validationText, { color: colors.error }]}>
                    Endpoint unreachable
                  </Text>
                </View>
              )}
            </View>

            {/* Models */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Cpu size={20} color={colors.primary} />
                <Text style={styles.cardTitle}>Supported Models</Text>
              </View>
              <View style={styles.modelChips}>
                {models.map((model) => (
                  <View key={model} style={styles.modelChip}>
                    <Text style={styles.modelChipText}>{model}</Text>
                    <TouchableOpacity onPress={() => removeModel(model)}>
                      <X size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={styles.addModelRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="Model name (e.g. tinyllama)"
                  placeholderTextColor={colors.textSecondary}
                  value={newModel}
                  onChangeText={setNewModel}
                  autoCapitalize="none"
                  onSubmitEditing={addModel}
                />
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addModel}
                  disabled={!newModel.trim()}
                >
                  <Plus size={20} color={colors.background} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.primaryButton, txState === "pending" && styles.buttonDisabled]}
                onPress={handleUpdateModels}
                disabled={txState === "pending"}
              >
                <Text style={styles.primaryButtonText}>Save Models On-Chain</Text>
              </TouchableOpacity>
            </View>

            {/* Transaction Feedback */}
            {txState === "pending" && (
              <View style={styles.progressBox}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.progressText}>{txAction}...</Text>
              </View>
            )}
            {txState === "success" && (
              <View style={styles.successBox}>
                <CheckCircle size={20} color={colors.success} />
                <Text style={styles.successText}>Transaction successful!</Text>
              </View>
            )}
            {txState === "error" && txError && (
              <View style={styles.errorBox}>
                <XCircle size={16} color={colors.error} />
                <Text style={styles.errorTextStyle}>{txError}</Text>
              </View>
            )}
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
    content: { flex: 1, padding: 16 },
    centerContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
    },
    centerTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
      marginTop: 24,
      marginBottom: 12,
    },
    centerSubtitle: { fontSize: 16, color: colors.textSecondary, textAlign: "center" },
    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
      gap: 12,
    },
    loadingText: { fontSize: 14, color: colors.textSecondary },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    cardTitle: { fontSize: 16, fontWeight: "600", color: colors.text },
    currentValue: {
      fontSize: 13,
      color: colors.textSecondary,
      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
      marginBottom: 12,
    },
    textInput: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 14,
      fontSize: 14,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    toggleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    toggleLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    toggleDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    buttonRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 14,
      gap: 6,
    },
    primaryButtonText: { color: colors.background, fontSize: 16, fontWeight: "600" },
    secondaryButton: {
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 90,
    },
    secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: "600" },
    buttonDisabled: { opacity: 0.5 },
    validationSuccess: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
    },
    validationError: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
    },
    validationText: { fontSize: 13, fontWeight: "500" },
    modelChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    modelChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modelChipText: { fontSize: 13, color: colors.text },
    addModelRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 16,
    },
    addButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    progressBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.primary + "15",
      padding: 14,
      borderRadius: 12,
      marginBottom: 12,
    },
    progressText: { fontSize: 14, color: colors.text },
    successBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.success + "15",
      padding: 14,
      borderRadius: 12,
      marginBottom: 12,
    },
    successText: { fontSize: 14, fontWeight: "600", color: colors.success },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.error + "15",
      padding: 12,
      borderRadius: 10,
      marginBottom: 12,
    },
    errorTextStyle: { flex: 1, fontSize: 13, color: colors.error },
  });
