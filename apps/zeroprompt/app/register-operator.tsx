import React, { useState } from "react";
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
  CheckCircle,
  XCircle,
  Server,
  Cpu,
  ChevronRight,
  Wallet,
} from "lucide-react-native";
import {
  OPERATOR_REGISTRY_ADDRESS,
  OPERATOR_REGISTRY_ABI,
  SUBNET_CHAIN_ID,
} from "../lib/subnetContracts";

type Step = "endpoint" | "models" | "register";
type RegisterState = "idle" | "registering" | "success" | "error";

export default function RegisterOperatorScreen() {
  const router = useRouter();
  const { theme: colors } = useTheme();
  const { isConnected } = useAccount();
  const { refreshMyOperator, refreshBalance } = useSubnet();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<Step>("endpoint");
  const [endpoint, setEndpoint] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [registerState, setRegisterState] = useState<RegisterState>("idle");
  const [registerError, setRegisterError] = useState<string | null>(null);

  const styles = createStyles(colors);

  const validateEndpoint = async () => {
    if (!endpoint.trim()) return;
    setIsValidating(true);
    setValidationError(null);
    setDiscoveredModels([]);

    try {
      const url = endpoint.trim().replace(/\/$/, "");
      const res = await fetch(`${url}/api/tags`, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const models = (data.models || []).map((m: any) => m.name || m.model);
      if (models.length === 0) throw new Error("No models found on this endpoint");
      setDiscoveredModels(models);
      setSelectedModels(models); // Select all by default
      setStep("models");
    } catch (err: any) {
      setValidationError(err.message || "Failed to validate endpoint");
    } finally {
      setIsValidating(false);
    }
  };

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  };

  const handleRegister = async () => {
    if (!writeContractAsync || selectedModels.length === 0) return;
    setRegisterState("registering");
    setRegisterError(null);

    try {
      const trimmedEndpoint = endpoint.trim().replace(/\/$/, "");
      await writeContractAsync({
        address: OPERATOR_REGISTRY_ADDRESS as `0x${string}`,
        abi: OPERATOR_REGISTRY_ABI,
        functionName: "registerOperator",
        args: [trimmedEndpoint, selectedModels],
        chainId: SUBNET_CHAIN_ID,
      });

      setRegisterState("success");
      await Promise.all([refreshMyOperator(), refreshBalance()]);
    } catch (err: any) {
      console.error("[RegisterOperator] Register error:", err);
      setRegisterError(err.message || "Transaction failed");
      setRegisterState("error");
    }
  };

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Register Operator</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Wallet size={64} color={colors.primary} />
          <Text style={styles.centerTitle}>Connect Your Wallet</Text>
          <Text style={styles.centerSubtitle}>
            Connect your wallet to register as an operator node.
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
        <Text style={styles.title}>Register Operator</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step Indicators */}
        <View style={styles.stepIndicators}>
          {["Endpoint", "Models", "Register"].map((label, idx) => {
            const stepNames: Step[] = ["endpoint", "models", "register"];
            const isActive = step === stepNames[idx];
            const isPast =
              stepNames.indexOf(step) > idx || registerState === "success";
            return (
              <View key={label} style={styles.stepRow}>
                <View
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor: isPast
                        ? colors.success
                        : isActive
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                >
                  {isPast ? (
                    <CheckCircle size={14} color={colors.background} />
                  ) : (
                    <Text style={styles.stepDotText}>{idx + 1}</Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    { color: isActive || isPast ? colors.text : colors.textSecondary },
                  ]}
                >
                  {label}
                </Text>
                {idx < 2 && (
                  <View
                    style={[
                      styles.stepLine,
                      { backgroundColor: isPast ? colors.success : colors.border },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Step 1: Endpoint */}
        {step === "endpoint" && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Globe size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Ollama Endpoint</Text>
            </View>
            <Text style={styles.cardDescription}>
              Enter the HTTPS URL of your Ollama node. We'll validate it and discover available models.
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="https://your-node.example.com"
              placeholderTextColor={colors.textSecondary}
              value={endpoint}
              onChangeText={setEndpoint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {validationError && (
              <View style={styles.errorBox}>
                <XCircle size={16} color={colors.error} />
                <Text style={styles.errorText}>{validationError}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.primaryButton, !endpoint.trim() && styles.buttonDisabled]}
              onPress={validateEndpoint}
              disabled={!endpoint.trim() || isValidating}
            >
              {isValidating ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Validate Endpoint</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Models */}
        {step === "models" && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Cpu size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Select Models</Text>
            </View>
            <Text style={styles.cardDescription}>
              {discoveredModels.length} model{discoveredModels.length !== 1 ? "s" : ""} discovered.
              Select which to register on-chain.
            </Text>
            {discoveredModels.map((model) => {
              const isSelected = selectedModels.includes(model);
              return (
                <TouchableOpacity
                  key={model}
                  style={[styles.modelItem, isSelected && styles.modelItemSelected]}
                  onPress={() => toggleModel(model)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    {isSelected && <CheckCircle size={14} color={colors.background} />}
                  </View>
                  <Text style={styles.modelItemText}>{model}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setStep("endpoint")}
              >
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1 }, selectedModels.length === 0 && styles.buttonDisabled]}
                onPress={() => setStep("register")}
                disabled={selectedModels.length === 0}
              >
                <Text style={styles.primaryButtonText}>Next</Text>
                <ChevronRight size={18} color={colors.background} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 3: Register */}
        {step === "register" && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Server size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Register Operator</Text>
            </View>

            {/* Summary */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Endpoint</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {endpoint}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Models</Text>
              <Text style={styles.summaryValue}>{selectedModels.length} selected</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Cost</Text>
              <Text style={styles.summaryValue}>Free (gas only)</Text>
            </View>

            {registerState === "success" ? (
              <View style={styles.successBox}>
                <CheckCircle size={32} color={colors.success} />
                <Text style={styles.successTitle}>Operator Registered!</Text>
                <Text style={styles.successSubtitle}>
                  Your node is registered on-chain. Next, stake ZEROP to activate it.
                </Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => router.push("/stake")}
                >
                  <Text style={styles.primaryButtonText}>Stake ZEROP</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {registerState === "error" && registerError && (
                  <View style={styles.errorBox}>
                    <XCircle size={16} color={colors.error} />
                    <Text style={styles.errorText}>{registerError}</Text>
                  </View>
                )}

                {registerState === "registering" && (
                  <View style={styles.progressBox}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.progressText}>
                      Registering operator on-chain...
                    </Text>
                  </View>
                )}

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => setStep("models")}
                    disabled={registerState === "registering"}
                  >
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      { flex: 1 },
                      registerState === "registering" && styles.buttonDisabled,
                    ]}
                    onPress={handleRegister}
                    disabled={registerState === "registering"}
                  >
                    <Text style={styles.primaryButtonText}>
                      {registerState === "error" ? "Retry" : "Register Operator"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
      backgroundColor: colors.background,
    },
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
    centerSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
    },
    stepIndicators: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
      gap: 4,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    stepDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    stepDotText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.background,
    },
    stepLabel: {
      fontSize: 13,
      fontWeight: "600",
    },
    stepLine: {
      width: 24,
      height: 2,
      borderRadius: 1,
      marginHorizontal: 4,
    },
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
    cardTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    cardDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 16,
    },
    textInput: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 14,
      fontSize: 14,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 14,
      gap: 6,
    },
    primaryButtonText: {
      color: colors.background,
      fontSize: 16,
      fontWeight: "600",
    },
    secondaryButton: {
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 16,
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.error + "15",
      padding: 12,
      borderRadius: 10,
      marginBottom: 12,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: colors.error,
    },
    successBox: {
      alignItems: "center",
      padding: 24,
      gap: 12,
    },
    successTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.success,
    },
    successSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 12,
    },
    progressBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.primary + "15",
      padding: 14,
      borderRadius: 10,
      marginBottom: 12,
    },
    progressText: {
      fontSize: 14,
      color: colors.text,
    },
    modelItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 10,
      marginBottom: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modelItemSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "10",
    },
    modelItemText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    summaryLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
      maxWidth: "60%",
    },
  });
