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
  Linking,
  TextInput,
} from "react-native";
import { X, Coins, Zap, AlertCircle, CheckCircle, ExternalLink } from "lucide-react-native";
import { API_URL } from "../config/api";

// Lazy load deposit widget for web only
const DepositWidgetComponent = Platform.OS === "web"
  ? lazy(() => import("./DepositWidget.web").then(m => ({ default: m.DepositWidget })))
  : null;

// ═══════════════════════════════════════════════════════════════════════════
// NATIVE DEPOSIT MODAL COMPONENT - Simple prop-based approach
// ═══════════════════════════════════════════════════════════════════════════

// Import wagmi hook - on native this uses our real implementation with AppKit
import { useSendTransaction } from "wagmi";
import { parseEther } from "viem";

// Import native hooks for account/provider status
let useNativeProvider: () => { provider: any; providerType?: string } = () => ({ provider: null });
let useNativeAccount: () => { address?: string; isConnected?: boolean } = () => ({ address: undefined, isConnected: false });
if (Platform.OS !== "web") {
  try {
    const appKitRN = require("@reown/appkit-react-native");
    useNativeProvider = appKitRN.useProvider;
    useNativeAccount = appKitRN.useAccount;
  } catch (e: any) {
    console.error("[DepositModal] Failed to import AppKit:", e?.message);
  }
}

// Import useAppKitReady to check if provider context is available
import { useAppKitReady } from "../context/Web3Provider";

// Native Deposit Modal that receives wallet data as props
function NativeDepositModalComponent({
  visible,
  onClose,
  theme,
  vaultAddress,
  onSuccess,
  onRefreshBalance,
  // Wallet data passed from parent
  walletAddress,
  isWalletConnected,
  onConnectWallet,
  connectionError,
  isWaitingForConnection,
}: {
  visible: boolean;
  onClose: () => void;
  theme: any;
  vaultAddress: string;
  onSuccess?: (txHash: string) => void;
  onRefreshBalance?: () => Promise<void>;
  walletAddress?: string;
  isWalletConnected: boolean;
  onConnectWallet?: (clearCache?: boolean) => void;
  connectionError?: string | null;
  isWaitingForConnection?: boolean;
}) {
  // Check if AppKit context is ready
  const appKitReady = useAppKitReady();

  // Get provider and account status from AppKit hooks
  const providerHookResult = useNativeProvider();
  const nativeProvider = providerHookResult?.provider;
  const accountHookResult = useNativeAccount();

  // Use wagmi hook for sending transactions (has real implementation on native now)
  const { sendTransactionAsync, isPending: isSendingTx } = useSendTransaction();

  // Debug: Log when modal opens
  useEffect(() => {
    if (visible) {
      console.log("[DepositModal] Modal opened - provider:", !!nativeProvider, "connected:", accountHookResult?.isConnected);
    }
  }, [visible, nativeProvider, accountHookResult?.isConnected]);

  const { height } = useWindowDimensions();
  const FONT_MONO = 'monospace';
  const DEPOSIT_PRESETS = [
    { amount: "5", label: "$5" },
    { amount: "10", label: "$10" },
    { amount: "25", label: "$25" },
    { amount: "50", label: "$50" },
  ];

  const [selectedAmount, setSelectedAmount] = useState("10");
  const [avaxPrice, setAvaxPrice] = useState(35);
  const [avaxNeeded, setAvaxNeeded] = useState("0.286");
  const [step, setStep] = useState<'select' | 'processing' | 'verifying' | 'success'>('select');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Fetch AVAX price
  useEffect(() => {
    if (visible) {
      fetch(`${API_URL}/billing/price`)
        .then(r => r.json())
        .then(data => {
          if (data.price) {
            setAvaxPrice(data.price);
          }
        })
        .catch(() => {});
    }
  }, [visible]);

  // Calculate AVAX needed
  useEffect(() => {
    if (avaxPrice > 0) {
      const needed = (parseFloat(selectedAmount) / avaxPrice).toFixed(6);
      console.log("[DepositModal] Calculating AVAX: $", selectedAmount, "/ $", avaxPrice, "=", needed, "AVAX");
      setAvaxNeeded(needed);
    }
  }, [selectedAmount, avaxPrice]);

  // Reset on open
  useEffect(() => {
    if (visible) {
      setStep('select');
      setError(null);
      setTxHash(null);
    }
  }, [visible]);

  const handleDeposit = async () => {
    console.log("[NativeDeposit] ========== DEPOSIT CLICKED ==========");
    console.log("[NativeDeposit] walletAddress:", walletAddress);
    console.log("[NativeDeposit] hasProvider:", !!nativeProvider);
    console.log("[NativeDeposit] accountConnected:", accountHookResult?.isConnected);

    if (!walletAddress) {
      setError("Please connect your wallet first");
      return;
    }

    if (!nativeProvider || !accountHookResult?.isConnected) {
      if (!appKitReady) {
        setError("Wallet is still initializing. Please wait a moment and try again.");
      } else {
        setError("Wallet session expired. Please reconnect your wallet.");
      }
      return;
    }

    console.log("[NativeDeposit] ✅ Proceeding with deposit...");
    setStep('processing');
    setError(null);

    try {
      console.log("[NativeDeposit] Amount:", selectedAmount, "USD =", avaxNeeded, "AVAX");
      console.log("[NativeDeposit] Vault:", vaultAddress);

      // Convert AVAX to wei using viem's parseEther
      const avaxWei = parseEther(avaxNeeded);
      console.log("[NativeDeposit] Value in wei:", avaxWei.toString());

      // Try to open MetaMask via deep link
      try {
        const { Linking } = require('react-native');
        Linking.openURL('metamask://').catch(() => {});
      } catch (e) {}

      // Send transaction using wagmi hook (which now has real implementation on native)
      console.log("[NativeDeposit] 📤 Calling sendTransactionAsync...");

      // Add timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 45000)
      );

      let hash: string;
      try {
        hash = await Promise.race([
          sendTransactionAsync({
            to: vaultAddress as `0x${string}`,
            value: avaxWei,
            data: '0xd0e30db0' as `0x${string}`, // deposit() function selector
          }),
          timeoutPromise
        ]);
        console.log("[NativeDeposit] 📤 Got transaction hash:", hash);
      } catch (timeoutErr: any) {
        if (timeoutErr.message === 'TIMEOUT') {
          console.log("[NativeDeposit] ⏰ Request timed out - checking balance...");
          if (onRefreshBalance) await onRefreshBalance();
          setError("Transaction may have been sent. Please check your wallet and refresh your balance.");
          setStep('select');
          return;
        }
        throw timeoutErr;
      }

      console.log("[NativeDeposit] Transaction sent:", hash);
      setTxHash(hash);
      setStep('verifying');

      // Verify with backend
      const verifyRes = await fetch(`${API_URL}/billing/verify-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: hash, userAddress: walletAddress })
      });

      const verifyData = await verifyRes.json();
      console.log("[NativeDeposit] Verify response:", verifyData);

      if (onRefreshBalance) await onRefreshBalance();
      onSuccess?.(hash);
      setStep('success');

    } catch (err: any) {
      console.error("[NativeDeposit] Error:", err);
      setError(err.message || "Transaction failed. Please try again.");
      setStep('select');
    }
  };

  return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: theme?.surface || '#1a1a2e',
            width: '100%',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 20,
          }}>
            {/* Drag handle */}
            <View style={{ alignItems: 'center', paddingBottom: 12 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
            </View>

            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Image
                  source={require('../assets/logos/avax-logo.png')}
                  style={{ width: 28, height: 28, borderRadius: 14 }}
                />
                <Text style={{ color: theme?.text || '#fff', fontSize: 20, fontWeight: '700' }}>Add Credits</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
                <X color={theme?.textMuted || '#888'} size={22} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={{ maxHeight: height * 0.55 }} showsVerticalScrollIndicator={false}>
              {!isWalletConnected ? (
                /* Wallet Not Connected */
                <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                  <View style={{
                    width: 60, height: 60, borderRadius: 30,
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    alignItems: 'center', justifyContent: 'center', marginBottom: 16
                  }}>
                    <AlertCircle size={28} color="#EF4444" />
                  </View>
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
                    Wallet Not Connected
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 }}>
                    Connect your wallet to deposit AVAX and add credits
                  </Text>
                  <TouchableOpacity
                    onPress={() => { onClose(); onConnectWallet?.(); }}
                    style={{ backgroundColor: '#8B5CF6', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 }}
                  >
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Connect Wallet</Text>
                  </TouchableOpacity>
                </View>
              ) : !nativeProvider || !accountHookResult?.isConnected ? (
                /* Session Expired - Need to Reconnect */
                <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                  {isWaitingForConnection ? (
                    /* Waiting for connection */
                    <>
                      <ActivityIndicator size="large" color="#FBBF24" style={{ marginBottom: 16 }} />
                      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
                        Connecting...
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 }}>
                        Please confirm the connection in your wallet app.
                      </Text>
                    </>
                  ) : connectionError ? (
                    /* Connection failed */
                    <>
                      <View style={{
                        width: 60, height: 60, borderRadius: 30,
                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                        alignItems: 'center', justifyContent: 'center', marginBottom: 16
                      }}>
                        <AlertCircle size={28} color="#EF4444" />
                      </View>
                      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
                        Connection Failed
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 12, paddingHorizontal: 20 }}>
                        {connectionError}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 }}>
                        Tip: Try disconnecting ZeroPrompt from your wallet settings first.
                      </Text>
                      <TouchableOpacity
                        onPress={() => onConnectWallet?.(true)}
                        style={{ backgroundColor: '#8B5CF6', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, marginBottom: 12 }}
                      >
                        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Try Again (Clear Cache)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={onClose}
                        style={{ paddingVertical: 10 }}
                      >
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Cancel</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    /* Normal session expired state */
                    <>
                      <View style={{
                        width: 60, height: 60, borderRadius: 30,
                        backgroundColor: 'rgba(251, 191, 36, 0.15)',
                        alignItems: 'center', justifyContent: 'center', marginBottom: 16
                      }}>
                        <AlertCircle size={28} color="#FBBF24" />
                      </View>
                      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
                        Session Expired
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 }}>
                        Your wallet session has expired. Please reconnect to continue.
                      </Text>
                      <TouchableOpacity
                        onPress={() => onConnectWallet?.(true)}
                        style={{ backgroundColor: '#FBBF24', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 }}
                      >
                        <Text style={{ color: '#000', fontSize: 15, fontWeight: '700' }}>Reconnect Wallet</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ) : step === 'success' ? (
                /* Success */
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <View style={{
                    width: 70, height: 70, borderRadius: 35,
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    alignItems: 'center', justifyContent: 'center', marginBottom: 16
                  }}>
                    <CheckCircle size={36} color="#10B981" />
                  </View>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 }}>
                    Deposit Successful!
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginBottom: 16 }}>
                    ${selectedAmount} added to your account
                  </Text>
                  {txHash && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`https://snowtrace.io/tx/${txHash}`)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 }}
                    >
                      <ExternalLink size={14} color="#8B5CF6" />
                      <Text style={{ color: '#8B5CF6', fontSize: 13, fontFamily: FONT_MONO }}>
                        {txHash.slice(0, 10)}...{txHash.slice(-8)}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={onClose}
                    style={{ backgroundColor: '#10B981', paddingVertical: 14, paddingHorizontal: 48, borderRadius: 12 }}
                  >
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Done</Text>
                  </TouchableOpacity>
                </View>
              ) : step === 'processing' || step === 'verifying' ? (
                /* Processing */
                <View style={{ alignItems: 'center', paddingVertical: 50 }}>
                  <ActivityIndicator size="large" color="#8B5CF6" />
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 20 }}>
                    {step === 'processing' ? 'Sending Transaction...' : 'Verifying Deposit...'}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                    {step === 'processing' ? 'Please confirm in your wallet app' : 'Waiting for confirmation'}
                  </Text>
                </View>
              ) : (
                /* Amount Selection */
                <View>
                  {/* Connected wallet */}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: 12, borderRadius: 10, marginBottom: 20
                  }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Connected:</Text>
                    <Text style={{ color: '#8B5CF6', fontSize: 12, fontFamily: FONT_MONO }}>
                      {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                    </Text>
                  </View>

                  {/* Quick Presets */}
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 10 }}>
                    Quick select:
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    {DEPOSIT_PRESETS.map((preset) => (
                      <TouchableOpacity
                        key={preset.amount}
                        onPress={() => setSelectedAmount(preset.amount)}
                        style={{
                          flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1,
                          borderColor: selectedAmount === preset.amount ? '#8B5CF6' : 'rgba(255,255,255,0.15)',
                          backgroundColor: selectedAmount === preset.amount ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{
                          color: selectedAmount === preset.amount ? '#8B5CF6' : '#fff',
                          fontSize: 14, fontWeight: '600'
                        }}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Custom Amount Input */}
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                    Amount (USD)
                  </Text>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: 'rgba(139, 92, 246, 0.3)',
                    paddingHorizontal: 16,
                    marginBottom: 16
                  }}>
                    <Text style={{ color: '#8B5CF6', fontSize: 24, fontWeight: '700', marginRight: 4 }}>$</Text>
                    <TextInput
                      value={selectedAmount}
                      onChangeText={(text) => {
                        // Only allow numbers and decimal point
                        const cleaned = text.replace(/[^0-9.]/g, '');
                        const newValue = cleaned || '0';
                        console.log("[DepositModal] Amount changed:", text, "->", newValue);
                        setSelectedAmount(newValue);
                      }}
                      keyboardType="decimal-pad"
                      style={{
                        flex: 1,
                        color: '#fff',
                        fontSize: 28,
                        fontWeight: '700',
                        paddingVertical: 14,
                        fontFamily: FONT_MONO
                      }}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      placeholder="0.00"
                      selectTextOnFocus
                    />
                  </View>

                  {/* AVAX Conversion */}
                  <View style={{ backgroundColor: 'rgba(232, 65, 66, 0.08)', padding: 14, borderRadius: 12, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>You'll pay:</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Image source={require('../assets/logos/avax-logo.png')} style={{ width: 18, height: 18, borderRadius: 9 }} />
                        <Text style={{ color: '#E84142', fontSize: 18, fontWeight: '700', fontFamily: FONT_MONO }}>
                          {avaxNeeded} AVAX
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 6 }}>
                      1 AVAX ≈ ${avaxPrice.toFixed(2)} USD
                    </Text>
                  </View>

                  {/* Error */}
                  {error && (
                    <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 10, marginBottom: 16 }}>
                      <Text style={{ color: '#EF4444', fontSize: 13 }}>{error}</Text>
                    </View>
                  )}

                  {/* Deposit Button */}
                  <TouchableOpacity
                    onPress={handleDeposit}
                    style={{
                      backgroundColor: '#8B5CF6', paddingVertical: 16, borderRadius: 12,
                      alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10
                    }}
                  >
                    <Coins size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Deposit ${selectedAmount}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', alignItems: 'center' }}>
              <Text style={{ color: theme?.textMuted || 'rgba(255,255,255,0.5)', fontSize: 10 }}>Secure & Non-custodial • Avalanche C-Chain</Text>
            </View>
          </View>
        </View>
      </Modal>
  );
}

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
  // Native wallet data (passed from parent)
  walletAddress?: string;
  isWalletConnected?: boolean;
  onConnectWallet?: (clearCache?: boolean) => void;
  nativeProvider?: any; // DEPRECATED - provider now comes from hook directly
  connectionError?: string | null;
  isWaitingForConnection?: boolean;
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
  walletAddress,
  isWalletConnected = false,
  onConnectWallet,
  nativeProvider,
  connectionError,
  isWaitingForConnection,
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


  // ═══════════════════════════════════════════════════════════════════════════
  // NATIVE DEPOSIT MODAL (Android/iOS) - Uses prop-based wallet data
  // ═══════════════════════════════════════════════════════════════════════════
  if (Platform.OS !== "web") {
    return (
      <NativeDepositModalComponent
        visible={visible}
        onClose={onClose}
        theme={theme}
        vaultAddress={vaultAddress}
        onSuccess={onSuccess}
        onRefreshBalance={onRefreshBalance}
        walletAddress={walletAddress}
        isWalletConnected={isWalletConnected}
        onConnectWallet={onConnectWallet}
        connectionError={connectionError}
        isWaitingForConnection={isWaitingForConnection}
      />
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEB DEPOSIT FLOW (original)
  // ═══════════════════════════════════════════════════════════════════════════

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
