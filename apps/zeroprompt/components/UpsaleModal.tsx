import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
  Platform,
  Animated,
  Image
} from "react-native";
import {
  X,
  Wallet,
  DollarSign,
  TrendingUp,
  Shield,
  CheckCircle,
  AlertTriangle
} from "lucide-react-native";

const ZEROPROMPT_LOGO = require('../assets/logos/zero-prompt-logo.png');

interface UpsaleModalProps {
  visible: boolean;
  onClose: () => void;
  onConnectWallet: () => void;
  onDeposit: (amount: string) => Promise<void>;
  theme: any;
  isWalletConnected: boolean;
  currentBalance: string;
  nativePrice: number | null;
  currencySymbol: string;
  isDepositing: boolean;
  requiredAmount?: string;
}

const QUICK_AMOUNTS = [
  { usd: "5", label: "$5" },
  { usd: "10", label: "$10" },
  { usd: "25", label: "$25" },
  { usd: "50", label: "$50" }
];

export const UpsaleModal = ({
  visible,
  onClose,
  onConnectWallet,
  onDeposit,
  theme,
  isWalletConnected,
  currentBalance,
  nativePrice,
  currencySymbol,
  isDepositing,
  requiredAmount
}: UpsaleModalProps) => {
  const [selectedAmount, setSelectedAmount] = useState<string>("10");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [nativeAmount, setNativeAmount] = useState<string>("");
  const [scaleAnim] = useState(new Animated.Value(0.9));
  const [opacityAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 10
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  // Calculate native amount when USD amount changes
  useEffect(() => {
    const usdAmount = customAmount || selectedAmount;
    if (nativePrice && parseFloat(usdAmount) > 0) {
      const native = parseFloat(usdAmount) / nativePrice;
      setNativeAmount(native.toFixed(6));
    } else {
      setNativeAmount("");
    }
  }, [selectedAmount, customAmount, nativePrice]);

  const handleDeposit = async () => {
    if (!nativeAmount) return;
    await onDeposit(nativeAmount);
  };

  const currentUsdAmount = customAmount || selectedAmount;
  const balanceNum = parseFloat(currentBalance || "0");

  const styles = createStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim
            }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Image source={ZEROPROMPT_LOGO} style={{width: 32, height: 32}} resizeMode="contain" />
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {balanceNum <= 0 ? "Credits Depleted" : "Low Credits"}
          </Text>
          <Text style={styles.subtitle}>
            {requiredAmount
              ? `You need ${requiredAmount} USD credits to continue`
              : "Add credits to continue using ZeroPrompt"}
          </Text>

          {/* Current Balance */}
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Current Balance</Text>
            <Text style={[styles.balanceAmount, balanceNum <= 0 && styles.balanceEmpty]}>
              ${balanceNum.toFixed(4)}
            </Text>
          </View>

          {/* Not Connected State */}
          {!isWalletConnected ? (
            <View style={styles.connectSection}>
              <AlertTriangle size={20} color={theme.warning} />
              <Text style={styles.connectText}>
                Connect your wallet to add credits
              </Text>
              <TouchableOpacity style={styles.connectButton} onPress={onConnectWallet}>
                <Wallet size={18} color="#fff" />
                <Text style={styles.connectButtonText}>Connect Wallet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Quick Amount Selection */}
              <Text style={styles.sectionLabel}>Select Amount</Text>
              <View style={styles.quickAmounts}>
                {QUICK_AMOUNTS.map((item) => (
                  <TouchableOpacity
                    key={item.usd}
                    style={[
                      styles.quickAmountBtn,
                      selectedAmount === item.usd && !customAmount && styles.quickAmountBtnActive
                    ]}
                    onPress={() => {
                      setSelectedAmount(item.usd);
                      setCustomAmount("");
                    }}
                  >
                    <Text
                      style={[
                        styles.quickAmountText,
                        selectedAmount === item.usd && !customAmount && styles.quickAmountTextActive
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Amount */}
              <View style={styles.customAmountContainer}>
                <Text style={styles.customLabel}>Or enter custom amount:</Text>
                <View style={styles.customInputRow}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    style={styles.customInput}
                    placeholder="0.00"
                    placeholderTextColor={theme.textSecondary}
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Conversion Display */}
              {nativeAmount && nativePrice && (
                <View style={styles.conversionBox}>
                  <View style={styles.conversionRow}>
                    <Text style={styles.conversionLabel}>You pay:</Text>
                    <Text style={styles.conversionValue}>
                      {nativeAmount} {currencySymbol}
                    </Text>
                  </View>
                  <View style={styles.conversionRow}>
                    <Text style={styles.conversionLabel}>You receive:</Text>
                    <Text style={[styles.conversionValue, { color: theme.success }]}>
                      ${currentUsdAmount} credits
                    </Text>
                  </View>
                  <View style={styles.conversionRow}>
                    <Text style={styles.conversionLabel}>Rate:</Text>
                    <Text style={styles.conversionRate}>
                      1 {currencySymbol} = ${nativePrice.toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Deposit Button */}
              <TouchableOpacity
                style={[styles.depositButton, isDepositing && styles.depositButtonDisabled]}
                onPress={handleDeposit}
                disabled={isDepositing || !nativeAmount}
              >
                {isDepositing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <DollarSign size={20} color="#fff" />
                    <Text style={styles.depositButtonText}>
                      Add ${currentUsdAmount} Credits
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Features */}
          <View style={styles.features}>
            <View style={styles.featureItem}>
              <CheckCircle size={14} color={theme.success} />
              <Text style={styles.featureText}>Instant activation</Text>
            </View>
            <View style={styles.featureItem}>
              <Shield size={14} color={theme.primary} />
              <Text style={styles.featureText}>Secure on-chain</Text>
            </View>
            <View style={styles.featureItem}>
              <TrendingUp size={14} color={theme.accent} />
              <Text style={styles.featureText}>No expiration</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.8)"
    },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    },
    modalContainer: {
      backgroundColor: theme.surface,
      borderRadius: 24,
      width: Platform.OS === "web" ? 440 : "92%",
      maxWidth: 440,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 24
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16
    },
    iconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.warning + "20",
      justifyContent: "center",
      alignItems: "center"
    },
    closeButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.background
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 8
    },
    subtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      marginBottom: 20,
      lineHeight: 22
    },
    balanceBox: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.background,
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.border
    },
    balanceLabel: {
      fontSize: 14,
      color: theme.textSecondary
    },
    balanceAmount: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text
    },
    balanceEmpty: {
      color: theme.error
    },
    connectSection: {
      alignItems: "center",
      padding: 24,
      backgroundColor: theme.warning + "10",
      borderRadius: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.warning + "30"
    },
    connectText: {
      fontSize: 14,
      color: theme.text,
      marginVertical: 12,
      textAlign: "center"
    },
    connectButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12
    },
    connectButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600"
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
      marginBottom: 10,
      textTransform: "uppercase",
      letterSpacing: 0.5
    },
    quickAmounts: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16
    },
    quickAmountBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: theme.background,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border
    },
    quickAmountBtnActive: {
      backgroundColor: theme.primary + "20",
      borderColor: theme.primary
    },
    quickAmountText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text
    },
    quickAmountTextActive: {
      color: theme.primary
    },
    customAmountContainer: {
      marginBottom: 16
    },
    customLabel: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 8
    },
    customInputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12
    },
    dollarSign: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.textSecondary
    },
    customInput: {
      flex: 1,
      padding: 14,
      fontSize: 18,
      color: theme.text
    },
    conversionBox: {
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 14,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.border
    },
    conversionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6
    },
    conversionLabel: {
      fontSize: 13,
      color: theme.textSecondary
    },
    conversionValue: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text
    },
    conversionRate: {
      fontSize: 12,
      color: theme.textSecondary
    },
    depositButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: theme.success,
      paddingVertical: 16,
      borderRadius: 12,
      marginBottom: 20
    },
    depositButtonDisabled: {
      opacity: 0.5
    },
    depositButtonText: {
      color: "#fff",
      fontSize: 17,
      fontWeight: "700"
    },
    features: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 20,
      flexWrap: "wrap"
    },
    featureItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6
    },
    featureText: {
      fontSize: 12,
      color: theme.textSecondary
    }
  });

export default UpsaleModal;
