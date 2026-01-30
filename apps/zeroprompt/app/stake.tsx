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
  Award,
  Lock,
  Unlock,
  Clock,
  CheckCircle,
  XCircle,
  Wallet,
  Plus,
} from "lucide-react-native";
import {
  ZEROP_TOKEN_ADDRESS,
  OPERATOR_REGISTRY_ADDRESS,
  ERC20_ABI,
  OPERATOR_REGISTRY_ABI,
  SUBNET_CHAIN_ID,
  parseZerop,
  formatZerop,
  getOperatorRegistry,
} from "../lib/subnetContracts";

const UNSTAKE_DELAY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export default function StakeScreen() {
  const router = useRouter();
  const { theme: colors } = useTheme();
  const { isConnected, address } = useAccount();
  const { refreshMyOperator, refreshBalance, zeropBalance } = useSubnet();
  const { writeContractAsync } = useWriteContract();

  const [stakeAmount, setStakeAmount] = useState("1000");
  const [currentStake, setCurrentStake] = useState<bigint>(BigInt(0));
  const [unstakeRequestedAt, setUnstakeRequestedAt] = useState<number>(0);
  const [isLoadingStake, setIsLoadingStake] = useState(false);
  const [txState, setTxState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txAction, setTxAction] = useState<string>("");
  const [txError, setTxError] = useState<string | null>(null);

  const styles = createStyles(colors);

  const hasStake = currentStake > BigInt(0);
  const hasUnstakeRequest = unstakeRequestedAt > 0;
  const now = Math.floor(Date.now() / 1000);
  const canCompleteUnstake = hasUnstakeRequest && now >= unstakeRequestedAt + UNSTAKE_DELAY_SECONDS;
  const unstakeCountdown = hasUnstakeRequest
    ? Math.max(0, unstakeRequestedAt + UNSTAKE_DELAY_SECONDS - now)
    : 0;

  const formatCountdown = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h remaining`;
    if (h > 0) return `${h}h ${m}m remaining`;
    return `${m}m remaining`;
  };

  const fetchStakeData = useCallback(async () => {
    if (!address) return;
    setIsLoadingStake(true);
    try {
      const registry = getOperatorRegistry();
      const data = await registry.stakes(address);
      setCurrentStake(data[0]); // amount
      setUnstakeRequestedAt(Number(data[4])); // unstakeRequestedAt
    } catch (err) {
      console.error("[Stake] Failed to load stake data:", err);
    } finally {
      setIsLoadingStake(false);
    }
  }, [address]);

  useEffect(() => {
    fetchStakeData();
  }, [fetchStakeData]);

  const handleStake = async () => {
    if (!writeContractAsync || !address) return;
    setTxState("pending");
    setTxAction("Staking");
    setTxError(null);

    try {
      const amount = parseZerop(stakeAmount);

      // Approve
      setTxAction("Approving ZEROP");
      await writeContractAsync({
        address: ZEROP_TOKEN_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [OPERATOR_REGISTRY_ADDRESS as `0x${string}`, amount],
        chainId: SUBNET_CHAIN_ID,
      });

      // Stake or increaseStake
      const fn = hasStake ? "increaseStake" : "stake";
      setTxAction(hasStake ? "Adding to stake" : "Staking ZEROP");
      await writeContractAsync({
        address: OPERATOR_REGISTRY_ADDRESS as `0x${string}`,
        abi: OPERATOR_REGISTRY_ABI,
        functionName: fn,
        args: [amount],
        chainId: SUBNET_CHAIN_ID,
      });

      setTxState("success");
      await Promise.all([fetchStakeData(), refreshMyOperator(), refreshBalance()]);
    } catch (err: any) {
      console.error("[Stake] Error:", err);
      setTxError(err.message || "Transaction failed");
      setTxState("error");
    }
  };

  const handleRequestUnstake = async () => {
    if (!writeContractAsync || !address) return;
    setTxState("pending");
    setTxAction("Requesting unstake");
    setTxError(null);

    try {
      await writeContractAsync({
        address: OPERATOR_REGISTRY_ADDRESS as `0x${string}`,
        abi: OPERATOR_REGISTRY_ABI,
        functionName: "requestUnstake",
        args: [],
        chainId: SUBNET_CHAIN_ID,
      });
      setTxState("success");
      await fetchStakeData();
    } catch (err: any) {
      setTxError(err.message || "Transaction failed");
      setTxState("error");
    }
  };

  const handleCompleteUnstake = async () => {
    if (!writeContractAsync || !address) return;
    setTxState("pending");
    setTxAction("Completing unstake");
    setTxError(null);

    try {
      await writeContractAsync({
        address: OPERATOR_REGISTRY_ADDRESS as `0x${string}`,
        abi: OPERATOR_REGISTRY_ABI,
        functionName: "unstake",
        args: [],
        chainId: SUBNET_CHAIN_ID,
      });
      setTxState("success");
      await Promise.all([fetchStakeData(), refreshMyOperator(), refreshBalance()]);
    } catch (err: any) {
      setTxError(err.message || "Transaction failed");
      setTxState("error");
    }
  };

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Stake ZEROP</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Wallet size={64} color={colors.primary} />
          <Text style={styles.centerTitle}>Connect Your Wallet</Text>
          <Text style={styles.centerSubtitle}>
            Connect your wallet to stake ZEROP tokens.
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
        <Text style={styles.title}>Stake ZEROP</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Stake */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Award size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Current Stake</Text>
          </View>

          {isLoadingStake ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={styles.stakeDisplay}>
              <Text style={styles.stakeValue}>
                {parseFloat(formatZerop(currentStake)).toFixed(2)} ZEROP
              </Text>
              <Text style={styles.stakeSubtext}>
                Balance: {parseFloat(zeropBalance).toFixed(2)} ZEROP
              </Text>
            </View>
          )}
        </View>

        {/* Stake / Add More */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            {hasStake ? <Plus size={20} color={colors.primary} /> : <Lock size={20} color={colors.primary} />}
            <Text style={styles.cardTitle}>{hasStake ? "Add More Stake" : "Stake ZEROP"}</Text>
          </View>
          <Text style={styles.cardDescription}>
            {hasStake
              ? "Increase your stake to improve your node's weight in request routing."
              : "Minimum stake: 1,000 ZEROP. Staking activates your node for request routing."}
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.amountInput}
              placeholder="1000"
              placeholderTextColor={colors.textSecondary}
              value={stakeAmount}
              onChangeText={setStakeAmount}
              keyboardType="numeric"
            />
            <Text style={styles.amountLabel}>ZEROP</Text>
          </View>

          <View style={styles.quickAmounts}>
            {["1000", "5000", "10000"].map((amt) => (
              <TouchableOpacity
                key={amt}
                style={[styles.quickAmount, stakeAmount === amt && styles.quickAmountActive]}
                onPress={() => setStakeAmount(amt)}
              >
                <Text
                  style={[
                    styles.quickAmountText,
                    stakeAmount === amt && { color: colors.primary },
                  ]}
                >
                  {parseInt(amt).toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, txState === "pending" && styles.buttonDisabled]}
            onPress={handleStake}
            disabled={txState === "pending"}
          >
            {txState === "pending" ? (
              <View style={styles.pendingRow}>
                <ActivityIndicator color={colors.background} size="small" />
                <Text style={styles.primaryButtonText}>{txAction}...</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>
                {hasStake ? "Add Stake" : "Approve & Stake"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Unstake */}
        {hasStake && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Unlock size={20} color={colors.warning} />
              <Text style={styles.cardTitle}>Unstake</Text>
            </View>

            {hasUnstakeRequest ? (
              <>
                <View style={styles.unstakeInfo}>
                  <Clock size={18} color={colors.warning} />
                  <View>
                    <Text style={styles.unstakeInfoTitle}>Unstake Requested</Text>
                    <Text style={styles.unstakeInfoText}>
                      {canCompleteUnstake
                        ? "Cooldown complete. You can now withdraw."
                        : formatCountdown(unstakeCountdown)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    !canCompleteUnstake && styles.buttonDisabled,
                    { backgroundColor: colors.warning },
                  ]}
                  onPress={handleCompleteUnstake}
                  disabled={!canCompleteUnstake || txState === "pending"}
                >
                  <Text style={styles.primaryButtonText}>Complete Unstake</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.cardDescription}>
                  Request unstaking to begin the 7-day cooldown period. After the cooldown, you can withdraw your staked ZEROP.
                </Text>
                <TouchableOpacity
                  style={[styles.outlineButton, txState === "pending" && styles.buttonDisabled]}
                  onPress={handleRequestUnstake}
                  disabled={txState === "pending"}
                >
                  <Text style={[styles.outlineButtonText, { color: colors.warning }]}>
                    Request Unstake
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Transaction Feedback */}
        {txState === "success" && (
          <View style={styles.successBox}>
            <CheckCircle size={20} color={colors.success} />
            <Text style={styles.successText}>Transaction successful!</Text>
          </View>
        )}
        {txState === "error" && txError && (
          <View style={styles.errorBox}>
            <XCircle size={16} color={colors.error} />
            <Text style={styles.errorText}>{txError}</Text>
          </View>
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
    cardDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 16,
    },
    stakeDisplay: { alignItems: "center", paddingVertical: 12 },
    stakeValue: { fontSize: 32, fontWeight: "700", color: colors.text },
    stakeSubtext: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    amountInput: {
      flex: 1,
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      paddingVertical: 14,
    },
    amountLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    quickAmounts: { flexDirection: "row", gap: 8, marginBottom: 16 },
    quickAmount: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickAmountActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "10",
    },
    quickAmountText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
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
    primaryButtonText: { color: colors.background, fontSize: 16, fontWeight: "600" },
    buttonDisabled: { opacity: 0.5 },
    pendingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    outlineButton: {
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.warning,
      alignItems: "center",
    },
    outlineButtonText: { fontSize: 16, fontWeight: "600" },
    unstakeInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.warning + "15",
      padding: 14,
      borderRadius: 12,
      marginBottom: 16,
    },
    unstakeInfoTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
    unstakeInfoText: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
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
    errorText: { flex: 1, fontSize: 13, color: colors.error },
  });
