// WalletConnect Service for React Native
// Handles wallet connection flow: generate URI -> open wallet -> get signature -> return to app

import { Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SignClient } from "@walletconnect/sign-client";

// Polyfills
import "react-native-get-random-values";
import "@walletconnect/react-native-compat";

// Text Encoding Polyfill
const TextEncodingPolyfill = require("text-encoding");
Object.assign(global, {
  TextEncoder: TextEncodingPolyfill.TextEncoder,
  TextDecoder: TextEncodingPolyfill.TextDecoder,
});

// Buffer Polyfill
if (typeof global.Buffer === "undefined") {
  global.Buffer = require("buffer").Buffer;
}

const PROJECT_ID = "20ebf23c3bb262ce86b1746e9fffd567";
const WC_SERVICE_VERSION = "1.3.3-buffer-polyfill";

let signClient: any = null;
let currentSession: any = null;
let initPromise: Promise<any> | null = null;

// Helper to cleanup client instance
async function cleanupClient() {
  if (signClient) {
    try {
       console.log("[WC] Cleaning up old client instance...");
       // Try to close the socket connection
       if (signClient.core?.relayer?.transport) {
         await signClient.core.relayer.transport.disconnect();
       }
    } catch (e) {
       console.warn("[WC] Cleanup warning:", e);
    }
    signClient = null;
  }
  initPromise = null;
}

// Helper to clear corrupted WC state
async function clearWalletConnectStorage() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const wcKeys = keys.filter(k => k.startsWith("wc@2"));
    if (wcKeys.length > 0) {
      console.log("[WC] Clearing corrupted storage keys:", wcKeys.length);
      await AsyncStorage.multiRemove(wcKeys);
    }
  } catch (e) {
    console.error("[WC] Failed to clear storage", e);
  }
}

// Initialize WalletConnect SignClient
async function getSignClient(): Promise<any> {
  if (signClient) return signClient;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log(`[WC] Service Version: ${WC_SERVICE_VERSION}`);
      console.log(`[WC] Platform: ${Platform.OS}`);
      console.log("[WC] Initializing SignClient...");
      
      const client = await SignClient.init({
        projectId: PROJECT_ID,
        metadata: {
          name: "ZeroPrompt",
          description: "AI Chat with Crypto Payments",
          url: "https://zeroprompt.app",
          icons: ["https://zeroprompt.app/icon.png"],
          redirect: {
            native: "zeroprompt://",
            universal: "https://zeroprompt.app",
          },
        },
      });

      console.log("[WC] SignClient initialized successfully");
      signClient = client;

      // Remove existing listeners to prevent duplicates
      client.removeAllListeners("session_event");
      client.removeAllListeners("session_update");
      client.removeAllListeners("session_delete");

      // Listen for session events
      client.on("session_event", (event: any) => {
        console.log("[WC] Session event:", event);
      });

      client.on("session_update", ({ topic, params }: any) => {
        console.log("[WC] Session update:", topic, params);
      });

      client.on("session_delete", () => {
        console.log("[WC] Session deleted");
        currentSession = null;
      });
      
      return client;
    } catch (error) {
      console.error("[WC] Init error:", error);
      initPromise = null; // Reset promise on failure
      throw error;
    }
  })();

  return initPromise;
}

// Connect to wallet - returns address after user approves
export async function connectWallet(): Promise<{ address: string; chainId: number } | null> {
  // First attempt
  try {
    return await _connect(false);
  } catch (firstError: any) {
    console.warn("[WC] First connection attempt failed. resetting state...", firstError.message);
    
    // Hard reset
    await cleanupClient(); // Proper cleanup
    await clearWalletConnectStorage();
    
    // Second attempt (auto-retry)
    try {
      console.log("[WC] Retrying connection with fresh state...");
      return await _connect(true);
    } catch (secondError: any) {
      console.error("[WC] Second connection attempt failed:", secondError);
      throw secondError;
    }
  }
}

// Internal connect helper
async function _connect(isRetry: boolean): Promise<{ address: string; chainId: number } | null> {
  try {
    console.log(`[WC] Starting wallet connection... (retry: ${isRetry})`);
    const client = await getSignClient();

    // Create connection request
    let uri, approval;
    try {
        // Log active pairings to debug zombie sessions
        try {
           const pairings = client.pairing.getAll({ active: true });
           console.log("[WC] Active pairings:", pairings.length);
           // If we have too many pairings on a retry, it might be clogging.
           if (isRetry && pairings.length > 0) {
               console.log("[WC] Pruning old pairings...");
               pairings.forEach((p: any) => client.pairing.delete(p.topic, { code: 1000, message: "Cleanup" }).catch(() => {}));
           }
        } catch (e) { console.warn("Could not check pairings", e); }

        console.log("[WC] Calling client.connect...");
        
        const connectPromise = client.connect({
          optionalNamespaces: {
            eip155: {
              methods: ["eth_sendTransaction", "personal_sign", "eth_signTypedData_v4"],
              chains: ["eip155:43114"], // Avalanche
              events: ["chainChanged", "accountsChanged"],
            },
          },
        });

        // 10s timeout - increased from 5s to allow for slower networks/emulators
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Connection timed out (10s)")), 10000)
        );

        const result: any = await Promise.race([connectPromise, timeoutPromise]);
        
        uri = result.uri;
        approval = result.approval;
    } catch (e: any) {
        throw e;
    }

    if (!uri) {
      throw new Error("No URI generated");
    }

    console.log("[WC] URI generated:", uri);

    // Open MetaMask with WalletConnect URI
    const metamaskUri = `metamask://wc?uri=${encodeURIComponent(uri)}`;
    const metamaskUniversalUri = `https://metamask.app.link/wc?uri=${encodeURIComponent(uri)}`;

    console.log("[WC] Opening MetaMask...");
    let canOpen = false;
    try {
        canOpen = await Linking.canOpenURL(metamaskUri);
    } catch (e) {
        console.warn("[WC] Error checking canOpenURL:", e);
    }
    
    console.log(`[WC] Can open metamask:// scheme: ${canOpen}`);

    if (canOpen) {
      await Linking.openURL(metamaskUri);
    } else {
      console.log("[WC] Falling back to Universal Link...");
      try {
          await Linking.openURL(metamaskUniversalUri);
      } catch (e) {
         console.error("[WC] Universal link failed:", e);
         console.log("[WC] Falling back to generic wc: link...");
         const wcUri = `wc:${uri.split("wc:")[1]}`;
         await Linking.openURL(wcUri);
      }
    }

    // Wait for user approval in wallet
    console.log("[WC] Waiting for approval...");
    const session = await approval();
    currentSession = session;

    console.log("[WC] Session approved:", session);

    // Extract address from session
    const accounts = session.namespaces.eip155?.accounts || [];
    if (accounts.length === 0) {
      throw new Error("No accounts in session");
    }

    // Account format: "eip155:43114:0x..."
    const [namespace, chainId, address] = accounts[0].split(":");

    console.log("[WC] Connected:", address, "Chain:", chainId);

    return {
      address,
      chainId: parseInt(chainId),
    };
  } catch (error: any) {
    throw error;
  }
}

// Sign a message with connected wallet
export async function signMessage(message: string): Promise<string> {
  if (!signClient || !currentSession) {
    throw new Error("Not connected");
  }

  const accounts = currentSession.namespaces.eip155?.accounts || [];
  if (accounts.length === 0) {
    throw new Error("No accounts");
  }

  const [, chainId, address] = accounts[0].split(":");

  console.log("[WC] Requesting signature...");

  // Open wallet for signing
  const metamaskUri = "metamask://";
  await Linking.openURL(metamaskUri);

  const signature = await signClient.request({
    topic: currentSession.topic,
    chainId: `eip155:${chainId}`,
    request: {
      method: "personal_sign",
      params: [message, address],
    },
  });

  console.log("[WC] Signature received");
  return signature as string;
}

// Disconnect wallet
export async function disconnectWallet(): Promise<void> {
  if (!signClient || !currentSession) return;

  try {
    await signClient.disconnect({
      topic: currentSession.topic,
      reason: { code: 6000, message: "User disconnected" },
    });
  } catch (e) {
    console.warn("[WC] Disconnect error:", e);
  }

  currentSession = null;
}

// Check if connected
export function isConnected(): boolean {
  return !!currentSession;
}

// Get current address
export function getAddress(): string | null {
  if (!currentSession) return null;
  const accounts = currentSession.namespaces.eip155?.accounts || [];
  if (accounts.length === 0) return null;
  const [, , address] = accounts[0].split(":");
  return address;
}
