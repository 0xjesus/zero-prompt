"use client";
import React from "react";
import { Platform } from "react-native";
import { ThirdwebProvider as ThirdwebSDKProvider } from "thirdweb/react";

interface ThirdwebWrapperProps {
  children: React.ReactNode;
}

/**
 * ThirdwebProvider - Wraps the app with thirdweb SDK context
 *
 * This enables:
 * - Gas sponsorship via account abstraction
 * - CheckoutWidget for easy crypto purchases
 * - BuyWidget for onramp (card to crypto)
 * - Multi-chain USDC support
 */
export function ThirdwebWrapper({ children }: ThirdwebWrapperProps) {
  // Skip on non-web platforms for now
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <ThirdwebSDKProvider>
      {children}
    </ThirdwebSDKProvider>
  );
}

export default ThirdwebWrapper;
