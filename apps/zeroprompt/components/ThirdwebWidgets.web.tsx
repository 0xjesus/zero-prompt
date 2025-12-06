/**
 * ThirdwebWidgets - Web-only component for USDC purchases
 *
 * Enables non-web3 users to:
 * - Buy USDC with credit card
 * - Swap tokens to USDC
 * - Fund their ZeroPrompt account
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from "react-native";
import { X, CreditCard, ArrowLeftRight, AlertCircle } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import {
  thirdwebClient,
  AVALANCHE_USDC,
  DEFAULT_CHAIN,
  MERCHANT_ADDRESS,
  SUPPORTED_TOKENS,
  isThirdwebConfigured,
} from "../lib/thirdweb";

// Conditionally import Thirdweb components
let BuyWidget: any = null;
let SwapWidget: any = null;
let darkTheme: any = null;

try {
  const thirdwebReact = require("thirdweb/react");
  BuyWidget = thirdwebReact.BuyWidget;
  SwapWidget = thirdwebReact.SwapWidget;
  darkTheme = thirdwebReact.darkTheme;
} catch (e) {
  console.log("[Thirdweb] React components not available");
}

interface ThirdwebWidgetsProps {
  visible: boolean;
  onClose: () => void;
  defaultAmount?: string;
  onSuccess?: (data: any) => void;
  receiverAddress?: string;
}

type TabType = "buy" | "swap";

export default function ThirdwebWidgets({
  visible,
  onClose,
  defaultAmount = "10",
  onSuccess,
  receiverAddress,
}: ThirdwebWidgetsProps) {
  const { theme: colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>("buy");
  const [error, setError] = useState<string | null>(null);

  // Check if Thirdweb is properly configured
  if (!isThirdwebConfigured() || !thirdwebClient) {
    return (
      <Modal visible={visible} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Add Credits
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.notConfiguredContainer}>
              <AlertCircle size={48} color="#FFC107" />
              <Text style={[styles.notConfiguredTitle, { color: colors.text }]}>
                Thirdweb Not Configured
              </Text>
              <Text style={[styles.notConfiguredText, { color: colors.textSecondary }]}>
                Credit card payments are not yet available. Please use the standard
                AVAX/USDC deposit methods or contact support.
              </Text>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: colors.primary }]}
                onPress={onClose}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Check if widgets are available
  if (!BuyWidget || !SwapWidget) {
    return (
      <Modal visible={visible} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Add Credits
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading payment widget...
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  const customTheme = darkTheme
    ? darkTheme({
        colors: {
          modalBg: colors.surface,
          primaryButtonBg: "#00FF41",
          primaryButtonText: "#000000",
          accentText: "#00FF41",
        },
      })
    : "dark";

  const handleSuccess = (data: any) => {
    console.log("[Thirdweb] Transaction successful:", data);
    setError(null);
    onSuccess?.(data);
    onClose();
  };

  const handleError = (err: Error) => {
    console.error("[Thirdweb] Transaction error:", err);
    setError(err.message || "Transaction failed");
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Add Credits with Card
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Tab Selector */}
          <View style={[styles.tabContainer, { borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "buy" && styles.tabActive,
                activeTab === "buy" && { backgroundColor: "rgba(0, 255, 65, 0.15)" },
              ]}
              onPress={() => setActiveTab("buy")}
            >
              <CreditCard
                size={18}
                color={activeTab === "buy" ? "#00FF41" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === "buy" ? "#00FF41" : colors.textSecondary },
                ]}
              >
                Buy with Card
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "swap" && styles.tabActive,
                activeTab === "swap" && { backgroundColor: "rgba(0, 255, 65, 0.15)" },
              ]}
              onPress={() => setActiveTab("swap")}
            >
              <ArrowLeftRight
                size={18}
                color={activeTab === "swap" ? "#00FF41" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === "swap" ? "#00FF41" : colors.textSecondary },
                ]}
              >
                Swap Tokens
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <AlertCircle size={16} color="#FF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Widget Container */}
          <View style={styles.widgetContainer}>
            {activeTab === "buy" ? (
              <BuyWidget
                client={thirdwebClient}
                chain={DEFAULT_CHAIN}
                amount={defaultAmount}
                tokenAddress={AVALANCHE_USDC}
                receiverAddress={receiverAddress || MERCHANT_ADDRESS}
                title="Buy USDC"
                description="Purchase USDC with credit card to fund your ZeroPrompt account"
                theme={customTheme}
                paymentMethods={["card", "crypto"]}
                supportedTokens={SUPPORTED_TOKENS}
                onSuccess={handleSuccess}
                onError={handleError}
                onCancel={onClose}
                connectOptions={{
                  connectModal: {
                    size: "compact",
                    title: "Connect Wallet",
                  },
                }}
              />
            ) : (
              <SwapWidget
                client={thirdwebClient}
                theme={customTheme}
                prefill={{
                  buyToken: {
                    chainId: DEFAULT_CHAIN.id,
                    tokenAddress: AVALANCHE_USDC,
                    amount: defaultAmount,
                  },
                }}
                onSuccess={handleSuccess}
                onError={handleError}
                onCancel={onClose}
              />
            )}
          </View>

          {/* Info Footer */}
          <View style={[styles.infoFooter, { borderColor: colors.border }]}>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {activeTab === "buy"
                ? "Securely purchase USDC using your credit card. Funds will be sent directly to your account."
                : "Swap any token from any chain to USDC on Avalanche."}
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
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 18,
  },
  tabContainer: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  tabActive: {
    borderWidth: 1,
    borderColor: "#00FF41",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  widgetContainer: {
    padding: 16,
    minHeight: 400,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 12,
    padding: 12,
    backgroundColor: "rgba(255, 68, 68, 0.1)",
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    color: "#FF4444",
    fontSize: 13,
  },
  infoFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  infoText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  loadingContainer: {
    padding: 60,
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  notConfiguredContainer: {
    padding: 40,
    alignItems: "center",
    gap: 16,
  },
  notConfiguredTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  notConfiguredText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  closeBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  closeBtnText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },
});
