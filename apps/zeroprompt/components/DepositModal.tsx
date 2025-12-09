"use client";
import React, { useState, useCallback, useEffect, lazy, Suspense } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { X, Coins, Zap } from "lucide-react-native";

// Lazy load deposit widget for web only
const DepositWidgetComponent = Platform.OS === "web"
  ? lazy(() => import("./DepositWidget.web").then(m => ({ default: m.DepositWidget })))
  : null;

// Types
interface DepositModalProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
  onSuccess?: (txHash: string) => void;
  requiredAmount?: string;
  vaultAddress: string;
  userAddress?: string;
  onRefreshBalance?: () => Promise<void>;
}

interface PaymentOption {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  badge?: string;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: "avax",
    name: "AVAX",
    description: "Deposit native Avalanche tokens directly",
    icon: Coins,
    color: "#E84142",
    badge: "Recommended",
  },
];

const DEPOSIT_PRESETS = [
  { amount: "5", label: "$5" },
  { amount: "10", label: "$10" },
  { amount: "25", label: "$25" },
  { amount: "50", label: "$50" },
];

export default function DepositModal({
  visible,
  onClose,
  theme,
  onSuccess,
  requiredAmount,
  vaultAddress,
  userAddress,
  onRefreshBalance,
}: DepositModalProps) {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 500;
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<string>("1"); // Default to $1
  const [isProcessing, setIsProcessing] = useState(false);
  const [showWidget, setShowWidget] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);

  // Track if modal was previously visible to detect open/close transitions
  const [wasVisible, setWasVisible] = useState(false);

  // Reset state ONLY when modal opens (transition from closed to open)
  useEffect(() => {
    if (visible && !wasVisible) {
      // Modal just opened - reset everything and auto-select AVAX
      setSelectedMethod("avax"); // Auto-select AVAX
      setShowWidget(true); // Show widget immediately
      setError(null);
      setIsProcessing(false);
      setDepositSuccess(false);
      setIsVerifying(false);
      setSuccessTxHash(null);
      if (requiredAmount) {
        // Round up to nearest preset
        const required = parseFloat(requiredAmount);
        const preset = DEPOSIT_PRESETS.find(p => parseFloat(p.amount) >= required);
        if (preset) setSelectedAmount(preset.amount);
      }
    }
    setWasVisible(visible);
  }, [visible, wasVisible, requiredAmount]);

  const handleMethodSelect = useCallback((methodId: string) => {
    setSelectedMethod(methodId);
    setShowWidget(true);
  }, []);

  const handleDepositComplete = useCallback(async (txHash: string) => {
    setIsProcessing(false);
    setIsVerifying(true);
    setSuccessTxHash(txHash);

    // Call success callback immediately
    onSuccess?.(txHash);

    // Backend has already verified & updated the balance via verify-deposit endpoint
    // Just refresh the local state once
    if (onRefreshBalance) {
      console.log('[DepositModal] Refreshing balance after backend verification...');
      try {
        await onRefreshBalance();
        console.log('[DepositModal] Balance refresh complete');
      } catch (err) {
        console.error('[DepositModal] Balance refresh failed:', err);
      }
    }

    setIsVerifying(false);
    setDepositSuccess(true);
  }, [onSuccess, onRefreshBalance]);

  if (Platform.OS !== "web") {
    return null;
  }

  // Stepper Component
  const DepositStepper = () => {
    const steps = ["Confirm", "Execute", "Verify", "Done"];
    // Determine current step index
    let currentStepIndex = 0;
    if (isProcessing) currentStepIndex = 1;
    else if (isVerifying) currentStepIndex = 2;
    else if (depositSuccess) currentStepIndex = 3;
    else if (showWidget) currentStepIndex = 0;

    return (
      <View style={styles.stepperContainer}>
        {steps.map((step, index) => (
          <View key={index} style={styles.stepWrapper}>
            <View style={[
              styles.stepCircle,
              index <= currentStepIndex && styles.stepCircleActive,
              index < currentStepIndex && styles.stepCircleCompleted
            ]}>
              {index < currentStepIndex ? (
                <Text style={styles.stepCheck}>✓</Text>
              ) : (
                <Text style={[styles.stepNumber, index <= currentStepIndex && styles.stepNumberActive]}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text style={[
              styles.stepLabel,
              index <= currentStepIndex && styles.stepLabelActive
            ]}>{step}</Text>
            {index < steps.length - 1 && (
              <View style={[
                styles.stepLine,
                index < currentStepIndex && styles.stepLineCompleted
              ]} />
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isMobile ? "slide" : "fade"}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, isMobile && { justifyContent: 'flex-end', padding: 0 }]}>
        <View style={[
          styles.container,
          { backgroundColor: theme.surface },
          isMobile && {
            width: '100%',
            maxWidth: '100%',
            maxHeight: height * 0.9,
            borderRadius: 0,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 16,
          }
        ]}>
          {/* Mobile drag handle */}
          {isMobile && (
            <View style={{ alignItems: 'center', paddingBottom: 12 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
            </View>
          )}

          {/* Header */}
          <View style={[styles.header, isMobile && { marginBottom: 12 }]}>
            <View style={styles.headerLeft}>
              <Image
                source={require('../assets/logos/avax-logo.png')}
                style={[styles.headerLogo, isMobile && { width: 24, height: 24 }]}
              />
              <Text style={[styles.title, { color: theme.text }, isMobile && { fontSize: 18 }]}>
                Add Credits
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, isMobile && { padding: 6 }]}>
              <X color={theme.textMuted} size={isMobile ? 20 : 24} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {requiredAmount && !depositSuccess && !isVerifying && (
              <View style={[styles.requiredBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }, isMobile && { padding: 10, marginBottom: 12 }]}>
                <Text style={{ color: '#EF4444', fontSize: isMobile ? 12 : 13 }}>
                  Minimum required: ${parseFloat(requiredAmount).toFixed(2)} USD
                </Text>
              </View>
            )}

            {/* Verifying Screen */}
            {isVerifying ? (
              <View style={[styles.processingContainer, isMobile && { padding: 30 }]}>
                <ActivityIndicator size="large" color="#8B5CF6" />
                <Text style={[styles.processingTitle, { color: theme.text }, isMobile && { fontSize: 18 }]}>
                  Verifying Deposit...
                </Text>
                <Text style={[styles.processingText, { color: theme.textMuted }, isMobile && { fontSize: 14 }]}>
                  Waiting for your balance to update.
                </Text>
                {successTxHash && (
                  <TouchableOpacity
                    style={styles.explorerLink}
                    onPress={() => {
                      if (typeof window !== "undefined") {
                        window.open(`https://snowtrace.io/tx/${successTxHash}`, "_blank");
                      }
                    }}
                  >
                    <Text style={[styles.explorerLinkText, isMobile && { fontSize: 13 }]}>View on Snowtrace ↗</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : depositSuccess ? (
              /* Success Screen */
              <View style={[styles.successSection, isMobile && { paddingVertical: 30, paddingHorizontal: 16 }]}>
                <View style={styles.successIconContainer}>
                  <View style={[styles.successCheckCircle, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }, isMobile && { width: 60, height: 60 }]}>
                    <Text style={[styles.successCheckmark, isMobile && { fontSize: 36 }]}>✓</Text>
                  </View>
                </View>

                <Text style={[styles.successTitle, { color: theme.text }, isMobile && { fontSize: 20 }]}>
                  Deposit Successful!
                </Text>

                <Text style={[styles.successMessage, { color: theme.textMuted }, isMobile && { fontSize: 14 }]}>
                  ${selectedAmount} has been added to your account
                </Text>

                {successTxHash && (
                  <TouchableOpacity
                    style={styles.explorerLink}
                    onPress={() => {
                      if (typeof window !== "undefined") {
                        window.open(`https://snowtrace.io/tx/${successTxHash}`, "_blank");
                      }
                    }}
                  >
                    <Text style={[styles.explorerLinkText, isMobile && { fontSize: 13 }]}>View transaction ↗</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.doneButton, { backgroundColor: '#10B981' }, isMobile && { paddingVertical: 12, minWidth: 160 }]}
                  onPress={() => {
                    onClose();
                  }}
                >
                  <Text style={[styles.doneButtonText, isMobile && { fontSize: 14 }]}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Payment Widget Area */
              <View style={[styles.widgetContainer, isMobile && { marginTop: 0 }]}>
                {isProcessing ? (
                  <View style={[styles.processingContainer, isMobile && { padding: 30 }]}>
                    <ActivityIndicator size="large" color="#8B5CF6" />
                    <Text style={[styles.processingText, { color: theme.text }, isMobile && { fontSize: 14 }]}>
                      Processing your deposit...
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.widgetPlaceholder, isMobile && { minHeight: 250 }]}>
                    {/* Deposit Widget */}
                    {DepositWidgetComponent && (
                      <Suspense fallback={
                        <View style={{ padding: isMobile ? 30 : 40, alignItems: 'center' }}>
                          <ActivityIndicator size="large" color="#8B5CF6" />
                          <Text style={{ color: theme.textMuted, marginTop: 10, fontSize: isMobile ? 13 : 14 }}>
                            Loading payment widget...
                          </Text>
                        </View>
                      }>
                        <DepositWidgetComponent
                          method="avax"
                          amountUSD={selectedAmount}
                          userAddress={userAddress}
                          onSuccess={(data) => handleDepositComplete(data?.txHash || "success")}
                          onError={(err) => setError(err.message)}
                          onCancel={() => setShowWidget(false)}
                        />
                      </Suspense>
                    )}
                  </View>
                )}

                {!isProcessing && (
                  <TouchableOpacity
                    style={[styles.backBtn, isMobile && { marginTop: 12, padding: 10 }]}
                    onPress={() => setShowWidget(false)}
                  >
                    <Text style={{ color: theme.textMuted, fontSize: isMobile ? 13 : 14 }}>
                      ← Back to payment methods
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {error && (
              <View style={[styles.errorBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }, isMobile && { padding: 10, marginTop: 12 }]}>
                <Text style={{ color: '#EF4444', fontSize: isMobile ? 12 : 13 }}>{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, isMobile && { marginTop: 12, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 20 : 0 }]}>
            <Text style={[styles.footerText, { color: theme.textMuted }, isMobile && { fontSize: 10 }]}>
              Secure & Non-custodial - Avalanche C-Chain
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 16,
    padding: 24,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 8,
  },
  requiredBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  presetGrid: {
    flexDirection: "row",
    gap: 10,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  presetBtnActive: {
    backgroundColor: "#8B5CF6",
    borderColor: "#8B5CF6",
  },
  presetText: {
    fontSize: 16,
    fontWeight: "600",
  },
  methodsList: {
    gap: 10,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  methodInfo: {
    flex: 1,
  },
  methodNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  methodName: {
    fontSize: 15,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  methodDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  widgetContainer: {
    marginTop: 10,
  },
  processingContainer: {
    padding: 60,
    alignItems: "center",
    gap: 16,
  },
  processingText: {
    fontSize: 16,
  },
  widgetPlaceholder: {
    minHeight: 300,
    borderRadius: 12,
    backgroundColor: "rgba(139, 92, 246, 0.05)",
  },
  backBtn: {
    marginTop: 16,
    padding: 12,
    alignItems: "center",
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  footer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
  },
  successSection: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successCheckCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  successCheckmark: {
    fontSize: 48,
    color: "#10B981",
    fontWeight: "700",
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
  },
  explorerLink: {
    marginBottom: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  explorerLinkText: {
    color: "#8B5CF6",
    fontSize: 14,
    fontWeight: "600",
  },
  doneButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 10,
    minWidth: 200,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    marginTop: 8,
  },
  stepWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  stepCircleActive: {
    borderColor: "#8B5CF6",
    backgroundColor: "rgba(139, 92, 246, 0.2)",
  },
  stepCircleCompleted: {
    backgroundColor: "#8B5CF6",
    borderColor: "#8B5CF6",
  },
  stepNumber: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
  },
  stepNumberActive: {
    color: "#8B5CF6",
  },
  stepCheck: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  stepLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginLeft: 6,
    marginRight: 8,
    fontWeight: "600",
  },
  stepLabelActive: {
    color: "#fff",
  },
  stepLine: {
    width: 16,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginRight: 8,
  },
  stepLineCompleted: {
    backgroundColor: "#8B5CF6",
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
  },
  cardPaymentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0, 255, 65, 0.1)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 255, 65, 0.3)",
  },
  cardPaymentText: {
    color: "#00FF41",
    fontSize: 13,
    fontWeight: "600",
  },
});
