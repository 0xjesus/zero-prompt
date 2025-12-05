"use client";
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { VAULT_ADDRESS } from "../lib/constants";
import { CreditCard, Coins, Check, ArrowRight, AlertCircle, ChevronRight, RefreshCw } from "lucide-react-native";
import { API_URL } from "../config/api";

// ============================================================================
// CONSTANTS - Avalanche Only
// ============================================================================

// Chainlink AVAX/USD Price Feed on Avalanche C-Chain
const CHAINLINK_AVAX_USD = "0x0A77230d17318075983913bC2145DB16C7366156";
const AVALANCHE_RPC = "https://api.avax.network/ext/bc/C/rpc";

const AVALANCHE_CHAIN_ID = 43114;

// ============================================================================
// PRICE & QUOTE FUNCTIONS
// ============================================================================

/**
 * Fetch AVAX price from Chainlink oracle on Avalanche
 */
async function getAvaxPriceFromChainlink(): Promise<number> {
  try {
    const functionSelector = "0xfeaf968c"; // latestRoundData()

    const response = await fetch(AVALANCHE_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: CHAINLINK_AVAX_USD, data: functionSelector }, "latest"],
      }),
    });

    const data = await response.json();
    if (data.result) {
      const answerHex = "0x" + data.result.slice(66, 130);
      const price = BigInt(answerHex);
      return Number(price) / 1e8;
    }
    throw new Error("Invalid Chainlink response");
  } catch (err) {
    console.error("Chainlink price fetch failed:", err);
    // Fallback to CoinGecko
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=avalanche-2&vs_currencies=usd");
      const cgData = await res.json();
      return cgData["avalanche-2"]?.usd || 35;
    } catch {
      return 35;
    }
  }
}


// ============================================================================
// TYPES
// ============================================================================

interface DepositWidgetProps {
  method: "avax";
  amountUSD: string;
  userAddress?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

type Step = "select" | "confirm" | "approve" | "execute" | "success" | "error";

const AMOUNT_PRESETS = ["5", "10", "25", "50", "100"];

// ============================================================================
// DEPOSIT WIDGET COMPONENT
// ============================================================================

export function DepositWidget({
  method,
  amountUSD,
  userAddress,
  onSuccess,
  onError,
  onCancel,
}: DepositWidgetProps) {
  const [step, setStep] = useState<Step>("select");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [editableAmount, setEditableAmount] = useState(amountUSD);
  const [pendingAction, setPendingAction] = useState<"avax" | null>(null);
  const [avaxPrice, setAvaxPrice] = useState<number>(0);
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);
  const [actualAvaxAmount, setActualAvaxAmount] = useState<string>("0"); // Track actual AVAX deposited
  const [newBalanceUSD, setNewBalanceUSD] = useState<string | null>(null); // Track new balance after deposit
  const [isVerifying, setIsVerifying] = useState(false); // Track backend verification

  const { address, isConnected } = useAccount();

  // For sending native AVAX (direct deposit or swap)
  const {
    sendTransaction,
    data: nativeTxHash,
    isPending: isNativePending,
    isSuccess: isNativeSent, // Renamed: this is when tx is SENT, not confirmed
    error: nativeError,
    reset: resetNative
  } = useSendTransaction();

  // Wait for transaction confirmation
  const {
    isLoading: isWaitingConfirmation,
    isSuccess: isNativeConfirmed, // This is when tx is CONFIRMED on-chain
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: nativeTxHash,
    confirmations: 1,
  });


  // Track when we started a transaction - only process events after this time
  const [txStartTime, setTxStartTime] = useState<number | null>(null);

  // Track if component is ready (after initial mount stabilization)
  const [isReady, setIsReady] = useState(false);

  // Ref to track which transaction hashes we've already processed
  // This prevents stale wagmi state from triggering success handlers
  const processedHashes = useRef<Set<string>>(new Set());

  // On mount: Mark any existing hash as already processed, then reset wagmi state
  useEffect(() => {
    // If wagmi has a stale hash from a previous session, mark it as processed
    // so we don't trigger success handlers for old transactions
    if (nativeTxHash) {
      console.log("[Mount] Marking stale native hash as processed:", nativeTxHash);
      processedHashes.current.add(nativeTxHash);
    }

    // Reset wagmi hooks state
    resetNative();

    // Mark as ready after a brief delay
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch AVAX price from Chainlink on mount
  useEffect(() => {
    const fetchPrice = async () => {
      setIsLoadingPrice(true);
      const price = await getAvaxPriceFromChainlink();
      setAvaxPrice(price);
      setIsLoadingPrice(false);
      console.log(`[Chainlink] AVAX/USD: $${price.toFixed(2)}`);
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);


  const handleAmountChange = (value: string) => {
    const cleanValue = value.replace(/[^0-9.]/g, '');
    const parts = cleanValue.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setEditableAmount(cleanValue);
  };

  // Show "waiting for confirmation" step when tx is sent but not yet confirmed
  useEffect(() => {
    if (isNativeSent && nativeTxHash && isWaitingConfirmation && pendingAction) {
      console.log("[Deposit] Tx sent, waiting for confirmation:", nativeTxHash);
      setTxHash(nativeTxHash);
      // Keep showing execute step with "Confirming..." message
    }
  }, [isNativeSent, nativeTxHash, isWaitingConfirmation, pendingAction]);

  // Handle native transaction CONFIRMED (not just sent)
  useEffect(() => {
    // Only handle when tx is actually CONFIRMED on-chain
    if (isReady && isNativeConfirmed && nativeTxHash && pendingAction && txStartTime) {
      // Check if we've already processed this hash (stale state)
      if (processedHashes.current.has(nativeTxHash)) {
        console.log("[Ignored] Stale native hash:", nativeTxHash);
        return;
      }

      // Mark this hash as processed so we don't fire again
      processedHashes.current.add(nativeTxHash);

      console.log("[Deposit] ✓ Tx CONFIRMED on-chain:", nativeTxHash);
      setTxHash(nativeTxHash);
      setIsVerifying(true);

      // Verify deposit with backend and WAIT for it to complete before calling onSuccess
      const verifyAndComplete = async () => {
        try {
          console.log("[Deposit] Verifying with backend:", nativeTxHash);
          const res = await fetch(`${API_URL}/billing/verify-deposit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              txHash: nativeTxHash,
              userAddress: address
            }),
          });

          const data = await res.json();
          console.log("[Deposit] Backend verification result:", data);

          if (data.success) {
            setNewBalanceUSD(data.newBalanceUSD);
            console.log(`[Deposit] ✓ Verified! New balance: $${data.newBalanceUSD}`);
          } else {
            console.warn("[Deposit] Backend verification failed:", data.error);
          }

          // NOW call onSuccess after backend has saved the deposit
          setStep("success");
          setPendingAction(null);
          setTxStartTime(null);
          onSuccess?.({ txHash: nativeTxHash, action: pendingAction, newBalanceUSD: data.newBalanceUSD });

        } catch (err) {
          console.error("[Deposit] Backend verification error:", err);
          // Still show success since tx confirmed, just balance might not update
          setStep("success");
          setPendingAction(null);
          setTxStartTime(null);
          onSuccess?.({ txHash: nativeTxHash, action: pendingAction });
        } finally {
          setIsVerifying(false);
        }
      };

      verifyAndComplete();
    }
  }, [isReady, isNativeConfirmed, nativeTxHash, pendingAction, txStartTime, onSuccess, address]);


  // Handle errors - only when we're actually in an executing state
  useEffect(() => {
    const err = nativeError || confirmError;
    // Only process errors if component is ready and we're actively executing
    if (isReady && err && pendingAction && txStartTime) {
      console.error("Transaction error:", err);
      let errorMsg = "Transaction failed";
      if (err.message?.includes("insufficient funds")) {
        errorMsg = "Insufficient AVAX balance";
      } else if (err.message?.includes("rejected") || err.message?.includes("denied")) {
        errorMsg = "Transaction was rejected in wallet";
      } else if (err.message?.includes("slippage")) {
        errorMsg = "Price changed too much. Please try again.";
      } else if (err.message?.includes("reverted")) {
        errorMsg = "Transaction reverted on blockchain";
      } else if (err.message) {
        errorMsg = err.message.slice(0, 100);
      }
      setError(errorMsg);
      setStep("error");
      setPendingAction(null);
      setTxStartTime(null);
      onError?.(err);
    }
  }, [isReady, nativeError, confirmError, pendingAction, txStartTime, onError]);


  const handleConfirm = () => {
    const amount = parseFloat(editableAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (amount < 1) {
      setError("Minimum deposit is $1");
      return;
    }
    setError(null);
    setStep("confirm");
  };

  const isAmountValid = (() => {
    const amount = parseFloat(editableAmount);
    return !isNaN(amount) && amount >= 1;
  })();

  const handleExecute = async () => {
    if (!address) {
      setError("Please connect your wallet first");
      return;
    }

    setStep("execute");
    setError(null);
    setTxStartTime(Date.now()); // Mark when we started the transaction

    try {
      // Direct AVAX transfer to vault
      setPendingAction("avax");
      resetNative();

      const usdAmount = parseFloat(editableAmount);
      const avaxAmount = usdAmount / (avaxPrice || 35);
      const avaxWei = parseEther(avaxAmount.toFixed(8));

      // Store the actual AVAX amount being deposited
      setActualAvaxAmount(avaxAmount.toFixed(4));

      console.log(`[Deposit] Sending ${avaxAmount.toFixed(4)} AVAX (≈$${usdAmount}) to vault`);

      sendTransaction({
        to: VAULT_ADDRESS as `0x${string}`,
        value: avaxWei,
        chainId: AVALANCHE_CHAIN_ID,
      });

    } catch (err: any) {
      console.error("Execute error:", err);
      setError(err.message || "Transaction failed");
      setStep("error");
      setPendingAction(null);
      onError?.(err);
    }
  };

  const getMethodInfo = () => {
    const avaxNeeded = avaxPrice > 0
      ? (parseFloat(editableAmount || "0") / avaxPrice).toFixed(4)
      : "...";

    return {
      title: "Deposit AVAX",
      description: `Send ~${avaxNeeded} AVAX (≈ $${editableAmount})`,
      icon: Coins,
      color: "#E84142",
      disabled: false,
    };
  };

  const methodInfo = getMethodInfo();
  const Icon = methodInfo.icon;

  // Render stepper
  const renderStepper = () => {
    const steps = ["Confirm", "Execute", "Done"];
    const currentStepIndex =
      step === "confirm" ? 0 :
      step === "execute" ? 1 :
      step === "success" ? 2 : 0;

    return (
      <View style={styles.stepper}>
        {steps.map((s, i) => (
          <View key={s} style={styles.stepContainer}>
            <View style={[
              styles.stepCircle,
              i <= currentStepIndex && styles.stepCircleActive,
              i < currentStepIndex && styles.stepCircleCompleted,
            ]}>
              {i < currentStepIndex ? (
                <Check color="#fff" size={14} />
              ) : (
                <Text style={[
                  styles.stepNumber,
                  i <= currentStepIndex && styles.stepNumberActive,
                ]}>{i + 1}</Text>
              )}
            </View>
            <Text style={[
              styles.stepLabel,
              i <= currentStepIndex && styles.stepLabelActive,
            ]}>{s}</Text>
            {i < steps.length - 1 && (
              <View style={[
                styles.stepLine,
                i < currentStepIndex && styles.stepLineActive,
              ]} />
            )}
          </View>
        ))}
      </View>
    );
  };

  // Success screen
  if (step === "success") {
    return (
      <View style={styles.container}>
        {renderStepper()}
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Check color="#10B981" size={40} />
          </View>
          <Text style={styles.successTitle}>Deposit Successful!</Text>
          <Text style={styles.successDescription}>
            {actualAvaxAmount} AVAX (≈ ${editableAmount}) has been deposited to your vault
          </Text>

          {/* Show new balance - instant update from backend verification */}
          {isVerifying ? (
            <View style={styles.balanceVerifying}>
              <ActivityIndicator size="small" color="#8B5CF6" />
              <Text style={styles.balanceVerifyingText}>Updating balance...</Text>
            </View>
          ) : newBalanceUSD ? (
            <View style={styles.newBalanceBox}>
              <Text style={styles.newBalanceLabel}>New Balance</Text>
              <Text style={styles.newBalanceValue}>${parseFloat(newBalanceUSD).toFixed(2)}</Text>
            </View>
          ) : null}

          {txHash && (
            <TouchableOpacity
              style={styles.txLink}
              onPress={() => {
                if (typeof window !== "undefined") {
                  window.open(`https://snowtrace.io/tx/${txHash}`, "_blank");
                }
              }}
            >
              <Text style={styles.txLinkText}>View on Snowtrace</Text>
              <ChevronRight color="#8B5CF6" size={16} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Error screen
  if (step === "error") {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <AlertCircle color="#EF4444" size={40} />
          </View>
          <Text style={styles.errorTitle}>Transaction Failed</Text>
          <Text style={styles.errorDescription}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setStep("select");
              setError(null);
              setPendingAction(null);
              setTxStartTime(null);
              resetNative();
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading/Execute screen
  if (step === "execute") {
    // Determine current state
    const isWaitingWallet = isNativePending;
    const isWaitingChain = isNativeSent && isWaitingConfirmation;

    const getLoadingTitle = () => {
      if (isWaitingWallet) return "Confirm in Wallet";
      if (isWaitingChain) return "Confirming on Blockchain...";
      return "Processing...";
    };

    const getLoadingDescription = () => {
      if (isWaitingWallet) return "Please confirm the transaction in your wallet";
      if (isWaitingChain) return `Transaction sent! Waiting for confirmation...\n${nativeTxHash?.slice(0, 10)}...${nativeTxHash?.slice(-8)}`;
      return "Please wait...";
    };

    return (
      <View style={styles.container}>
        {renderStepper()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingTitle}>{getLoadingTitle()}</Text>
          <Text style={styles.loadingDescription}>{getLoadingDescription()}</Text>
          {isWaitingChain && (
            <Text style={styles.loadingHint}>This usually takes 2-5 seconds</Text>
          )}
        </View>
      </View>
    );
  }

  // Confirm screen
  if (step === "confirm") {
    const avaxNeeded = avaxPrice > 0
      ? (parseFloat(editableAmount || "0") / avaxPrice).toFixed(4)
      : "...";

    return (
      <View style={styles.container}>
        {renderStepper()}

        <View style={styles.confirmBox}>
          <Text style={styles.confirmLabel}>You're depositing</Text>
          <Text style={styles.confirmAmount}>~{avaxNeeded} AVAX</Text>
          <Text style={styles.confirmToken}>≈ $${editableAmount} USD</Text>
        </View>

        <View style={styles.detailsBox}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Destination</Text>
            <Text style={styles.detailValue}>
              {VAULT_ADDRESS.slice(0, 8)}...{VAULT_ADDRESS.slice(-6)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Network</Text>
            <Text style={styles.detailValue}>Avalanche C-Chain</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>AVAX Price</Text>
            <Text style={styles.detailValue}>${avaxPrice.toFixed(2)} (Chainlink)</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, { backgroundColor: methodInfo.color }]}
          onPress={handleExecute}
          disabled={isNativePending}
        >
          <Text style={styles.confirmButtonText}>Confirm Deposit</Text>
          <ArrowRight color="#fff" size={18} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            setStep("select");
            onCancel?.();
          }}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Initial select screen
  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: `${methodInfo.color}20` }]}>
        <Icon color={methodInfo.color} size={32} />
      </View>

      <Text style={styles.title}>{methodInfo.title}</Text>
      <Text style={styles.description}>{methodInfo.description}</Text>

      {/* Price info from Chainlink */}
      <View style={styles.priceInfo}>
        <Text style={styles.priceInfoText}>
          AVAX: ${isLoadingPrice ? "..." : avaxPrice.toFixed(2)}
        </Text>
        <Text style={styles.priceSource}>via Chainlink</Text>
      </View>

      <View style={styles.amountBox}>
        <Text style={styles.amountLabel}>Amount (tap to edit)</Text>
        <View style={styles.amountInputContainer}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={styles.amountInput}
            value={editableAmount}
            onChangeText={handleAmountChange}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#6B7280"
            selectTextOnFocus
          />
          <Text style={styles.currencyLabel}>USD</Text>
        </View>

        {/* Quick amount presets */}
        <View style={styles.presetContainer}>
          {AMOUNT_PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset}
              style={[
                styles.presetButton,
                editableAmount === preset && styles.presetButtonActive,
              ]}
              onPress={() => setEditableAmount(preset)}
            >
              <Text
                style={[
                  styles.presetButtonText,
                  editableAmount === preset && styles.presetButtonTextActive,
                ]}
              >
                ${preset}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {!isConnected && (
        <View style={styles.warningBox}>
          <AlertCircle color="#F59E0B" size={16} />
          <Text style={styles.warningText}>Connect your wallet to continue</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <AlertCircle color="#EF4444" size={14} />
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.payButton,
          { backgroundColor: methodInfo.color },
          (methodInfo.disabled || !isConnected || !isAmountValid) && styles.payButtonDisabled,
        ]}
        onPress={handleConfirm}
        disabled={methodInfo.disabled || !isConnected || !isAmountValid}
      >
        <Text style={styles.payButtonText}>
          {methodInfo.disabled ? "Coming Soon" : !isAmountValid ? "Enter Amount" : "Continue"}
        </Text>
        {!methodInfo.disabled && isAmountValid && <ArrowRight color="#fff" size={18} />}
      </TouchableOpacity>
    </View>
  );
}

/**
 * QuickBuyButton - Simple deposit button
 */
export function QuickBuyButton({
  amountUSD,
  onSuccess,
}: {
  amountUSD: string;
  onSuccess?: (data: any) => void;
}) {
  return (
    <TouchableOpacity style={styles.quickBuyButton}>
      <Text style={styles.quickBuyText}>Add ${amountUSD}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    width: "100%",
  },
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  stepNumberActive: {
    color: "#8B5CF6",
  },
  stepLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginLeft: 6,
    marginRight: 8,
  },
  stepLabelActive: {
    color: "#fff",
  },
  stepLine: {
    width: 20,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginRight: 8,
  },
  stepLineActive: {
    backgroundColor: "#8B5CF6",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 16,
    textAlign: "center",
  },
  priceInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(232, 65, 66, 0.1)",
    borderRadius: 20,
  },
  priceInfoText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E84142",
  },
  priceSource: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  amountBox: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: "700",
    color: "#8B5CF6",
    marginRight: 4,
  },
  amountInput: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
    padding: 0,
    minWidth: 80,
    // @ts-ignore - web only
    outlineStyle: "none",
  },
  currencyLabel: {
    fontSize: 16,
    color: "#9CA3AF",
    marginLeft: 8,
  },
  presetContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  presetButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  presetButtonActive: {
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    borderColor: "#8B5CF6",
  },
  presetButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  presetButtonTextActive: {
    color: "#8B5CF6",
  },
  quoteBox: {
    backgroundColor: "rgba(39, 117, 202, 0.1)",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(39, 117, 202, 0.2)",
  },
  quoteLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  quoteLoadingText: {
    fontSize: 14,
    color: "#2775CA",
  },
  quoteContent: {
    alignItems: "center",
  },
  quoteLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  quoteValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2775CA",
  },
  quoteRoute: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },
  quoteError: {
    fontSize: 14,
    color: "#EF4444",
    textAlign: "center",
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: "100%",
  },
  warningText: {
    color: "#F59E0B",
    fontSize: 13,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    width: "100%",
  },
  errorBannerText: {
    color: "#EF4444",
    fontSize: 13,
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  confirmBox: {
    alignItems: "center",
    marginBottom: 20,
  },
  confirmLabel: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 8,
  },
  confirmAmount: {
    fontSize: 48,
    fontWeight: "700",
    color: "#fff",
  },
  confirmToken: {
    fontSize: 16,
    color: "#9CA3AF",
    marginTop: 4,
  },
  detailsBox: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  detailValue: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    marginBottom: 12,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  cancelButton: {
    padding: 12,
  },
  cancelButtonText: {
    color: "#6B7280",
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  loadingDescription: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  loadingHint: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  successDescription: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 12,
  },
  balanceVerifying: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  balanceVerifyingText: {
    fontSize: 14,
    color: "#8B5CF6",
  },
  newBalanceBox: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  newBalanceLabel: {
    fontSize: 12,
    color: "#10B981",
    marginBottom: 4,
  },
  newBalanceValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#10B981",
  },
  txLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  txLinkText: {
    color: "#8B5CF6",
    fontSize: 14,
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 14,
    color: "#EF4444",
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  quickBuyButton: {
    backgroundColor: "#8B5CF6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  quickBuyText: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default DepositWidget;
