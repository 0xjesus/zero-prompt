import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../config/api";
import { appKitNative, isNativeReady, useAppKitReady } from "./Web3Provider";

// Default values when hooks aren't available
const defaultAccountData = { address: undefined, isConnected: false, isConnecting: false };
const defaultDisconnectData = { disconnect: () => {} };
const defaultSignMessageData = { signMessageAsync: async () => "" };
const defaultAppKitData = { open: () => {}, disconnect: () => {} };
const defaultProviderData = { provider: null, providerType: undefined };

type User = {
  walletAddress: string;
  messageCount: number;
  isPremium: boolean;
  conversationCount?: number;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  guestId: string | null;
  isConnecting: boolean;
  isAuthenticating: boolean;
  isWaitingForConnection: boolean; // True while waiting for WalletConnect response
  connectionError: string | null;
  migratedChats: number | null;
  getHeaders: () => any;
  openWalletModal: (clearCache?: boolean) => void;
  connectWallet: () => Promise<void>;
  logout: () => void;
  refreshUser: () => void;
  clearMigratedChats: () => void;
  nativeProvider?: any; // Provider for native wallet transactions
  appKitReady: boolean; // Whether AppKit/wallet system is initialized
  storageReady: boolean; // Whether async storage is ready (native only)
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Helper to safely access storage (localStorage on web, AsyncStorage on native)
// For synchronous operations (initial state), we use an in-memory cache
const storageCache: { [key: string]: string | null } = {};
let storageCacheInitialized = false;

const safeStorage = {
  // Async get - always use this for actual storage reads
  getItemAsync: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      if (typeof window === 'undefined') return null;
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    } else {
      try {
        const value = await AsyncStorage.getItem(key);
        storageCache[key] = value;
        return value;
      } catch {
        return null;
      }
    }
  },

  // Sync get from cache (for initial state)
  getItemSync: (key: string): string | null => {
    if (Platform.OS === "web") {
      if (typeof window === 'undefined') return null;
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    } else {
      return storageCache[key] || null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    storageCache[key] = value;
    if (Platform.OS === "web") {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(key, value);
      } catch {
        console.error('[Auth] Failed to save to localStorage');
      }
    } else {
      try {
        await AsyncStorage.setItem(key, value);
      } catch {
        console.error('[Auth] Failed to save to AsyncStorage');
      }
    }
  },

  removeItem: async (key: string): Promise<void> => {
    delete storageCache[key];
    if (Platform.OS === "web") {
      if (typeof window === 'undefined') return;
      try {
        localStorage.removeItem(key);
      } catch {}
    } else {
      try {
        await AsyncStorage.removeItem(key);
      } catch {}
    }
  },

  // Initialize cache from AsyncStorage (call once on app start)
  initCache: async (): Promise<void> => {
    if (storageCacheInitialized || Platform.OS === "web") return;
    try {
      const keys = ["session_token", "wallet_address", "guest_id"];
      const results = await AsyncStorage.multiGet(keys);
      results.forEach(([key, value]) => {
        storageCache[key] = value;
      });
      storageCacheInitialized = true;
      console.log("[Auth] Storage cache initialized");
    } catch (e) {
      console.error("[Auth] Failed to initialize storage cache:", e);
    }
  }
};

// Component that uses WEB wallet hooks (wagmi)
const WebWalletConsumer = ({ onWalletData, children }: { onWalletData: (data: any) => void, children: React.ReactNode }) => {
  const { useAccount, useDisconnect, useSignMessage } = require("wagmi");
  const { useAppKit } = require("@reown/appkit/react");

  const account = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { open } = useAppKit();

  useEffect(() => {
    onWalletData({
      address: account.address,
      isConnected: account.isConnected || false,
      isConnecting: account.isConnecting || false,
      disconnect,
      signMessageAsync,
      open,
      provider: null,
    });
  }, [account.address, account.isConnected, account.isConnecting, disconnect, signMessageAsync, open, onWalletData]);

  return <>{children}</>;
};

// Component that uses NATIVE wallet hooks (@reown/appkit-react-native)
const NativeWalletConsumer = ({ onWalletData, children }: { onWalletData: (data: any) => void, children: React.ReactNode }) => {
  const appKitRN = require("@reown/appkit-react-native");

  const account = appKitRN.useAccount();
  const { open, disconnect } = appKitRN.useAppKit();
  const { provider } = appKitRN.useProvider();

  // Also get AppKit state for more visibility
  let appKitState = { selectedNetworkId: undefined, open: false };
  try {
    appKitState = appKitRN.useAppKitState();
  } catch (e) {
    // useAppKitState might not exist
  }

  // Log every time hooks update (reduced verbosity)
  useEffect(() => {
    console.log("[NativeWalletConsumer] Hook update:", {
      address: account?.address?.slice(0, 10),
      isConnected: account?.isConnected,
      hasProvider: !!provider,
      modalOpen: appKitState.open,
    });
  }, [account?.address, account?.isConnected, provider, appKitState.open]);

  useEffect(() => {
    onWalletData({
      address: account?.address,
      isConnected: account?.isConnected || false,
      isConnecting: false,
      disconnect,
      signMessageAsync: null,
      open,
      provider,
      modalOpen: appKitState.open, // Pass modal state for timing
    });
  }, [account?.address, account?.isConnected, disconnect, open, provider, appKitState.open, onWalletData]);

  return <>{children}</>;
};

// Inner component that uses wallet hooks (must be inside WagmiProvider/AppKitProvider)
const AuthProviderInner = ({ children }: { children: React.ReactNode }) => {
  const [storageReady, setStorageReady] = useState(Platform.OS === "web");

  // Check if AppKit provider is ready
  const appKitReady = useAppKitReady();

  // Wallet state - updated by platform-specific consumers
  const [walletData, setWalletData] = useState({
    address: undefined as string | undefined,
    isConnected: false,
    isConnecting: false,
    disconnect: () => {},
    signMessageAsync: null as any,
    open: () => {},
    provider: null as any,
    modalOpen: false, // Track if AppKit modal is open
  });

  // Memoize the callback to prevent infinite loops - only update if values actually changed
  const handleWalletData = useCallback((data: any) => {
    setWalletData(prev => {
      // Compare key values to avoid unnecessary updates
      if (
        prev.address === data.address &&
        prev.isConnected === data.isConnected &&
        prev.isConnecting === data.isConnecting &&
        prev.modalOpen === data.modalOpen
      ) {
        return prev; // No change, return same reference
      }
      return data;
    });
  }, []);

  // Extract values
  const address = walletData.address;
  const isConnected = walletData.isConnected;
  const wagmiConnecting = walletData.isConnecting;
  const disconnect = walletData.disconnect;
  const signMessageAsync = walletData.signMessageAsync;
  const openAppKit = walletData.open;
  const nativeProvider = walletData.provider;
  const modalOpen = walletData.modalOpen;

  // Initialize ALL state synchronously from cache/localStorage
  const [user, setUser] = useState<User | null>(() => {
    const savedWallet = safeStorage.getItemSync("wallet_address");
    const savedToken = safeStorage.getItemSync("session_token");
    if (savedWallet && savedToken) {
      return {
        walletAddress: savedWallet,
        messageCount: 0,
        isPremium: false
      };
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return safeStorage.getItemSync("session_token");
  });

  // Initialize guestId
  const [guestId, setGuestId] = useState<string | null>(() => {
    if (Platform.OS === "web") {
      let gid = safeStorage.getItemSync("guest_id");
      if (!gid) {
        gid = Math.random().toString(36).substring(2) + Date.now().toString(36);
        safeStorage.setItem("guest_id", gid);
      }
      return gid;
    }
    return null; // Will be set after async init for native
  });

  // Initialize storage cache for native platforms
  useEffect(() => {
    if (Platform.OS !== "web") {
      safeStorage.initCache().then(async () => {
        // Load saved state from AsyncStorage
        const savedToken = await safeStorage.getItemAsync("session_token");
        const savedWallet = await safeStorage.getItemAsync("wallet_address");
        let savedGuestId = await safeStorage.getItemAsync("guest_id");

        if (savedToken && savedWallet) {
          setToken(savedToken);
          setUser({
            walletAddress: savedWallet,
            messageCount: 0,
            isPremium: false
          });
        }

        if (!savedGuestId) {
          savedGuestId = Math.random().toString(36).substring(2) + Date.now().toString(36);
          await safeStorage.setItem("guest_id", savedGuestId);
        }
        setGuestId(savedGuestId);
        setStorageReady(true);
        console.log("[Auth] Native storage initialized");
      });
    }
  }, []);

  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isNativeConnecting, setIsNativeConnecting] = useState(false);
  const [migratedChats, setMigratedChats] = useState<number | null>(null);
  const authInProgress = useRef(false);
  const lastAuthAttempt = useRef<string | null>(null);
  const signatureRequested = useRef(false);
  const sessionVerified = useRef(false);
  const verifyInterval = useRef<NodeJS.Timeout | null>(null);

  // Verify existing session with retry
  const verifySession = useCallback(async (sessionToken: string, retryCount = 0): Promise<boolean> => {
    const maxRetries = 3;
    try {
      console.log(`[Auth] 🔍 Verifying session... (attempt ${retryCount + 1}/${maxRetries + 1})`);
      const res = await fetch(`${API_URL}/wallet/me`, {
        headers: { "x-session-token": sessionToken }
      });

      if (res.ok) {
        const data = await res.json();
        console.log("[Auth] ✅ Session valid:", data.wallet);
        setUser({
          walletAddress: data.wallet,
          messageCount: data.messageCount,
          isPremium: data.isPremium,
          conversationCount: data.conversationCount
        });
        sessionVerified.current = true;
        return true;
      } else if (res.status === 401) {
        // Session expired, clear it
        console.log("[Auth] ⚠️ Session expired, clearing...");
        safeStorage.removeItem("session_token");
        safeStorage.removeItem("wallet_address");
        setToken(null);
        setUser(null);
        sessionVerified.current = false;
        return false;
      } else {
        throw new Error(`Unexpected status: ${res.status}`);
      }
    } catch (err) {
      console.error("[Auth] Session verification error:", err);
      if (retryCount < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1))); // Exponential backoff
        return verifySession(sessionToken, retryCount + 1);
      }
      // After all retries, keep the session but mark as unverified
      console.log("[Auth] ⚠️ Could not verify session, keeping it active");
      return true; // Don't logout on network errors
    }
  }, []);

  // Verify session on mount and periodically
  useEffect(() => {
    if (!storageReady) return;

    const initVerify = async () => {
      const savedToken = await safeStorage.getItemAsync("session_token");
      if (savedToken && !sessionVerified.current) {
        verifySession(savedToken);
      }
    };
    initVerify();

    // Verify session every 5 minutes
    verifyInterval.current = setInterval(async () => {
      const currentToken = await safeStorage.getItemAsync("session_token");
      if (currentToken) {
        verifySession(currentToken);
      }
    }, 5 * 60 * 1000);

    return () => {
      if (verifyInterval.current) {
        clearInterval(verifyInterval.current);
      }
    };
  }, [verifySession, storageReady]);

  // Authenticate with backend when wallet connects
  const authenticateWithBackend = useCallback(async (walletAddress: string, retryCount = 0) => {
    const maxRetries = 2;

    // Prevent duplicate auth attempts (React Strict Mode protection)
    if (authInProgress.current) {
      console.log("[Auth] ⚠️ Auth already in progress, skipping");
      return;
    }

    // Prevent duplicate signature requests
    if (signatureRequested.current) {
      console.log("[Auth] ⚠️ Signature already requested, skipping duplicate");
      return;
    }

    // Check if we recently tried to auth this wallet (within 10 seconds)
    if (lastAuthAttempt.current && retryCount === 0) {
      const [lastWallet, lastTime] = lastAuthAttempt.current.split('-');
      const timeSinceLastAttempt = Date.now() - parseInt(lastTime);
      if (lastWallet === walletAddress && timeSinceLastAttempt < 10000) {
        console.log("[Auth] ⚠️ Recent auth attempt for this wallet, skipping duplicate");
        return;
      }
    }

    // Check if we already have a valid session for this wallet
    const savedToken = await safeStorage.getItemAsync("session_token");
    const savedWallet = await safeStorage.getItemAsync("wallet_address");
    if (savedToken && savedWallet?.toLowerCase() === walletAddress.toLowerCase()) {
      console.log("[Auth] ✅ Already have session for this wallet, verifying...");
      const isValid = await verifySession(savedToken);
      if (isValid) {
        setToken(savedToken);
        return; // Session is valid, no need to re-auth
      }
    }

    // Clear any mismatched session before authenticating
    if (savedWallet && savedWallet.toLowerCase() !== walletAddress.toLowerCase()) {
      console.log("[Auth] 🧹 Clearing mismatched session:", savedWallet, "→", walletAddress);
      await safeStorage.removeItem("session_token");
      await safeStorage.removeItem("wallet_address");
      setToken(null);
      setUser(null);
    }

    authInProgress.current = true;
    signatureRequested.current = true;
    lastAuthAttempt.current = `${walletAddress}-${Date.now()}`;
    setIsAuthenticating(true);
    setConnectionError(null);

    try {
      console.log("[Auth] 🚀 Starting authentication for:", walletAddress);

      // Step 1: Get nonce from backend with retry
      let nonceData;
      for (let i = 0; i <= maxRetries; i++) {
        try {
          const nonceRes = await fetch(`${API_URL}/wallet/nonce`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: walletAddress })
          });

          if (!nonceRes.ok) {
            throw new Error(`Nonce request failed: ${nonceRes.status}`);
          }

          nonceData = await nonceRes.json();
          break;
        } catch (err) {
          if (i === maxRetries) throw err;
          console.log(`[Auth] Nonce retry ${i + 1}/${maxRetries}`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      const { message } = nonceData;
      console.log("[Auth] ✅ Got nonce, requesting signature...");
      console.log("[Auth] Message to sign:", message);

      // Step 2: Sign the message with wallet
      let signature: string;
      if (Platform.OS === "web") {
        // Web: use wagmi signMessageAsync
        signature = await signMessageAsync({ message });
      } else {
        // Native: use AppKit provider with personal_sign
        if (!nativeProvider) {
          console.error("[Auth] ❌ Native provider is null/undefined!");
          throw new Error("Native provider not available");
        }

        console.log("[Auth] Using native provider for signature...");
        console.log("[Auth] Provider type:", typeof nativeProvider);
        console.log("[Auth] Provider has request:", typeof nativeProvider.request);

        try {
          // For personal_sign, params should be [message, address]
          // Convert message to hex (without Buffer dependency)
          const toHex = (str: string) => {
            let hex = '';
            for (let i = 0; i < str.length; i++) {
              hex += str.charCodeAt(i).toString(16).padStart(2, '0');
            }
            return '0x' + hex;
          };
          const hexMessage = toHex(message);
          console.log("[Auth] Hex message:", hexMessage.slice(0, 50) + "...");
          console.log("[Auth] Wallet address:", walletAddress);

          // WalletConnect requires the user to go back to their wallet app to sign
          // We need to open the wallet app via deep link
          const { Linking } = require("react-native");

          console.log("[Auth] 📝 Calling provider.request for personal_sign...");
          console.log("[Auth] ⚠️ User needs to switch to MetaMask to sign!");

          // Create a promise that will resolve when the signature is received
          const signPromise = nativeProvider.request({
            method: "personal_sign",
            params: [hexMessage, walletAddress],
          });

          // Try to open MetaMask app to prompt the user
          // This helps on Android where the wallet doesn't auto-open
          setTimeout(async () => {
            try {
              // Try to open MetaMask using its deep link scheme
              const canOpen = await Linking.canOpenURL("metamask://");
              if (canOpen) {
                console.log("[Auth] Opening MetaMask app for signature...");
                await Linking.openURL("metamask://");
              } else {
                // Try WalletConnect deep link
                const wcLink = await Linking.canOpenURL("wc://");
                if (wcLink) {
                  console.log("[Auth] Opening WalletConnect...");
                  await Linking.openURL("wc://");
                }
              }
            } catch (linkError) {
              console.log("[Auth] Could not open wallet app:", linkError);
            }
          }, 500);

          signature = await signPromise;
          console.log("[Auth] ✅ personal_sign returned!");
        } catch (signError: any) {
          console.error("[Auth] ❌ personal_sign error:", signError);
          console.error("[Auth] Error message:", signError?.message);
          console.error("[Auth] Error code:", signError?.code);
          throw signError;
        }
      }
      console.log("[Auth] ✅ Signature obtained:", signature?.slice(0, 20) + "...");

      // Step 3: Verify with backend (include guestId for migration)
      const currentGuestId = await safeStorage.getItemAsync("guest_id");

      let verifyData;
      for (let i = 0; i <= maxRetries; i++) {
        try {
          const verifyRes = await fetch(`${API_URL}/wallet/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              wallet: walletAddress,
              signature,
              guestId: currentGuestId
            })
          });

          if (!verifyRes.ok) {
            const err = await verifyRes.json();
            throw new Error(err.error || "Verification failed");
          }

          verifyData = await verifyRes.json();
          break;
        } catch (err) {
          if (i === maxRetries) throw err;
          console.log(`[Auth] Verify retry ${i + 1}/${maxRetries}`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      console.log("[Auth] ✅ Verification successful!");

      // Store session
      await safeStorage.setItem("session_token", verifyData.sessionToken);
      await safeStorage.setItem("wallet_address", walletAddress);

      // Clear guest ID after successful migration
      if (verifyData.migratedConversations > 0) {
        console.log(`[Auth] 🔄 Migrated ${verifyData.migratedConversations} conversations!`);
        setMigratedChats(verifyData.migratedConversations);
        await safeStorage.removeItem("guest_id");
        setGuestId(null);
      }

      setToken(verifyData.sessionToken);
      setUser({
        walletAddress,
        messageCount: verifyData.messageCount || 0,
        isPremium: false,
        conversationCount: verifyData.totalConversations
      });
      sessionVerified.current = true;
      console.log("[Auth] ✅ Authentication complete!");

    } catch (err: any) {
      console.error("[Auth] ❌ Authentication failed:", err.message);
      setConnectionError(err.message || "Authentication failed. Please try again.");

      // Only disconnect on signature rejection, not on network errors
      if (err.message?.includes('rejected') || err.message?.includes('denied')) {
        console.log("[Auth] 🔌 User rejected signature, disconnecting");
        disconnect();
      }
    } finally {
      setIsAuthenticating(false);
      authInProgress.current = false;
      signatureRequested.current = false;
    }
  }, [signMessageAsync, disconnect, verifySession, nativeProvider]);

  // Track last authenticated address to prevent duplicate auth attempts
  const lastAuthenticatedAddress = useRef<string | null>(null);
  // Track if we're waiting for modal to close before starting auth
  const pendingAuthAddress = useRef<string | null>(null);

  // Watch for wallet connection changes
  useEffect(() => {
    console.log("[Auth] Connection state changed:", {
      isConnected,
      address: address?.slice(0, 10),
      user: !!user,
      storageReady,
      modalOpen,
    });

    if (!storageReady) {
      console.log("[Auth] Storage not ready yet, skipping");
      return;
    }

    // Don't do anything if auth is already in progress or signature was requested
    if (authInProgress.current || signatureRequested.current) {
      console.log("[Auth] ⏳ Skipping - auth in progress or signature pending");
      return;
    }

    if (isConnected && address && !user) {
      console.log("[Auth] 🔔 Wallet connected! Address:", address);

      // Check if we already authenticated this address in this session
      if (lastAuthenticatedAddress.current?.toLowerCase() === address.toLowerCase()) {
        console.log("[Auth] ⚠️ Already attempted auth for this address, skipping");
        return;
      }

      // On native, wait for modal to close before starting auth
      // This prevents the jarring UX of signature opening while modal is still visible
      if (Platform.OS !== "web" && modalOpen) {
        console.log("[Auth] ⏳ Modal still open, will start auth when it closes");
        pendingAuthAddress.current = address;
        return;
      }

      // Check if we have a valid saved session for this wallet
      const checkExistingSession = async () => {
        const savedToken = await safeStorage.getItemAsync("session_token");
        const savedWallet = await safeStorage.getItemAsync("wallet_address");
        if (savedToken && savedWallet?.toLowerCase() === address.toLowerCase()) {
          console.log("[Auth] ✅ Found existing session, verifying...");
          const isValid = await verifySession(savedToken);
          if (isValid) {
            setToken(savedToken);
            lastAuthenticatedAddress.current = address;
          }
          return true;
        }
        return false;
      };

      checkExistingSession().then(hasSession => {
        if (!hasSession && !authInProgress.current && !signatureRequested.current) {
          // Wallet just connected, authenticate with backend
          // Add delay to let UI settle
          const timeoutId = setTimeout(() => {
            if (!authInProgress.current && !signatureRequested.current && !user) {
              console.log("[Auth] 🔗 Starting auth for:", address);
              lastAuthenticatedAddress.current = address;
              authenticateWithBackend(address);
            }
          }, 800); // Slightly longer delay for smoother UX
          return () => clearTimeout(timeoutId);
        }
      });
    } else if (!isConnected && user) {
      // Wallet disconnected - check if we have a valid session
      safeStorage.getItemAsync("session_token").then(savedToken => {
        if (savedToken) {
          console.log("[Auth] ⚠️ Wallet disconnected but session exists - staying logged in");
        } else {
          console.log("[Auth] 🔌 Wallet disconnected (no session), logging out");
          handleLogout();
        }
      });
    } else if (!isConnected && !user) {
      // Reset the last authenticated address when fully disconnected
      lastAuthenticatedAddress.current = null;
      pendingAuthAddress.current = null;
    }
  }, [isConnected, address, user, authenticateWithBackend, verifySession, storageReady, modalOpen]);

  // Watch for modal closing to trigger pending auth
  useEffect(() => {
    // Only on native, when modal closes and we have a pending auth
    if (Platform.OS === "web") return;
    if (modalOpen) return;
    if (!pendingAuthAddress.current) return;
    if (authInProgress.current || signatureRequested.current) return;
    if (user) return;

    const addressToAuth = pendingAuthAddress.current;
    pendingAuthAddress.current = null;

    console.log("[Auth] 🔓 Modal closed, starting pending auth for:", addressToAuth.slice(0, 10));

    // Give a short delay for smooth transition
    setTimeout(() => {
      if (!authInProgress.current && !signatureRequested.current && !user) {
        lastAuthenticatedAddress.current = addressToAuth;
        authenticateWithBackend(addressToAuth);
      }
    }, 500);
  }, [modalOpen, user, authenticateWithBackend]);

  const handleLogout = useCallback(async () => {
    // Call backend logout
    const currentToken = await safeStorage.getItemAsync("session_token");
    if (currentToken) {
      fetch(`${API_URL}/wallet/logout`, {
        method: "POST",
        headers: { "x-session-token": currentToken }
      }).catch(() => {});
    }

    setUser(null);
    setToken(null);
    setConnectionError(null);
    sessionVerified.current = false;
    lastAuthenticatedAddress.current = null; // Reset to allow re-auth
    pendingAuthAddress.current = null;
    authInProgress.current = false;
    signatureRequested.current = false;
    await safeStorage.removeItem("session_token");
    await safeStorage.removeItem("wallet_address");

    // Regenerate guest ID
    const newGuestId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    await safeStorage.setItem("guest_id", newGuestId);
    setGuestId(newGuestId);
  }, []);

  const refreshUser = useCallback(async () => {
    // Re-verify session to get fresh data
    const currentToken = await safeStorage.getItemAsync("session_token");
    if (currentToken) {
      verifySession(currentToken);
    }
  }, [verifySession]);

  const getHeaders = useCallback(() => {
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["x-session-token"] = token;
    else if (guestId) headers["x-guest-id"] = guestId;
    return headers;
  }, [token, guestId]);

  // Guard to prevent double-opening modal
  const modalOpeningRef = useRef(false);
  // Track connection timeout for native
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isWaitingForConnection, setIsWaitingForConnection] = useState(false);

  // Clear WalletConnect cache (for reconnection attempts)
  const clearWalletConnectCache = useCallback(async () => {
    if (Platform.OS === "web") return;

    try {
      const AsyncStorageModule = require("@react-native-async-storage/async-storage").default;
      const allKeys = await AsyncStorageModule.getAllKeys();
      const wcKeys = allKeys.filter((key: string) =>
        key.startsWith("wc@") || key.startsWith("walletconnect") || key.startsWith("@appkit")
      );
      if (wcKeys.length > 0) {
        console.log("[Auth] 🧹 Clearing", wcKeys.length, "WalletConnect cache keys...");
        await AsyncStorageModule.multiRemove(wcKeys);
      }
    } catch (e) {
      console.warn("[Auth] Cache clear warning:", e);
    }
  }, []);

  const openWalletModal = useCallback(async (clearCache = false) => {
    // Prevent double-opening
    if (modalOpeningRef.current) {
      console.log("[Auth] ⚠️ Modal already opening, ignoring duplicate call");
      return;
    }

    console.log("[Auth] ========================================");
    console.log("[Auth] openWalletModal called (clearCache:", clearCache, ")");
    console.log("[Auth] Platform:", Platform.OS);
    console.log("[Auth] isNativeReady:", isNativeReady);
    console.log("[Auth] appKitNative available:", !!appKitNative);
    console.log("[Auth] openAppKit from hook:", typeof openAppKit);
    console.log("[Auth] ========================================");
    setConnectionError(null);

    // Clear WalletConnect cache if requested (for reconnection attempts)
    if (clearCache && Platform.OS !== "web") {
      // First disconnect to clear in-memory state
      console.log("[Auth] 🔌 Disconnecting to clear in-memory state...");
      try {
        disconnect();
        // Wait a bit for disconnect to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.log("[Auth] Disconnect warning (expected if not connected):", e);
      }

      // Then clear the storage cache
      await clearWalletConnectCache();

      // Wait a bit more for AppKit to process
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (Platform.OS === "web") {
      // Web - use AppKit web
      console.log("[Auth] Using web AppKit modal");
      openAppKit();
    } else {
      // Android/iOS - use AppKit React Native via hook
      modalOpeningRef.current = true;
      setIsWaitingForConnection(true);

      // Clear any existing timeout
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }

      // Set connection timeout (45 seconds)
      connectionTimeoutRef.current = setTimeout(() => {
        console.log("[Auth] ⏰ Connection timeout - WalletConnect relay didn't respond");
        setIsWaitingForConnection(false);
        setConnectionError("Connection timed out. The WalletConnect relay didn't respond. Please try again.");
        modalOpeningRef.current = false;
      }, 45000);

      try {
        console.log("[Auth] Attempting to open native AppKit modal...");

        // Use the openAppKit function from the useAppKit hook (from @reown/appkit-react-native)
        // This is the recommended way per Reown docs
        if (typeof openAppKit === "function") {
          console.log("[Auth] ✅ Calling open() from useAppKit hook...");
          openAppKit();
          console.log("[Auth] Modal open() called - user should see wallet selector");
        } else if (appKitNative?.open) {
          // Fallback to direct instance method
          console.log("[Auth] Using appKitNative.open() fallback...");
          appKitNative.open();
        } else {
          console.error("[Auth] ❌ No way to open AppKit modal!");
          setConnectionError("Wallet connection not available. Please try again.");
          setIsWaitingForConnection(false);
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
          }
        }
      } catch (e: any) {
        console.error("[Auth] ❌ Native wallet error:", e);
        console.error("[Auth] Error message:", e?.message);
        setIsWaitingForConnection(false);
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
        if (e.message?.includes("User rejected") || e.message?.includes("rejected")) {
          setConnectionError("Connection cancelled.");
        } else {
          setConnectionError("Could not connect wallet. Please try again.");
        }
      } finally {
        // Reset the guard after a short delay to allow modal to fully open
        setTimeout(() => {
          modalOpeningRef.current = false;
        }, 1000);
      }
    }
  }, [openAppKit, clearWalletConnectCache, disconnect]);

  // Clear connection timeout when connection succeeds
  useEffect(() => {
    if (isConnected && address && isWaitingForConnection) {
      console.log("[Auth] ✅ Connection succeeded, clearing timeout");
      setIsWaitingForConnection(false);
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    }
  }, [isConnected, address, isWaitingForConnection]);

  const connectWallet = useCallback(async () => {
    // Just call openWalletModal - same flow
    await openWalletModal();
  }, [openWalletModal]);

  const logout = useCallback(() => {
    disconnect();
    handleLogout();
  }, [disconnect, handleLogout]);

  const clearMigratedChats = useCallback(() => {
    setMigratedChats(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        guestId,
        isConnecting: wagmiConnecting || isNativeConnecting,
        isAuthenticating,
        isWaitingForConnection,
        connectionError,
        migratedChats,
        getHeaders,
        openWalletModal,
        connectWallet,
        logout,
        refreshUser,
        clearMigratedChats,
        nativeProvider, // Provider for native transactions
        appKitReady, // Expose AppKit ready state for routes that need it
        storageReady, // Expose storage ready state
      }}
    >
      {/* Conditionally render wallet consumer to get hook data only when AppKit is ready */}
      {appKitReady && Platform.OS === "web" && (
        <WebWalletConsumer onWalletData={handleWalletData}>
          {children}
        </WebWalletConsumer>
      )}
      {appKitReady && Platform.OS !== "web" && (
        <NativeWalletConsumer onWalletData={handleWalletData}>
          {children}
        </NativeWalletConsumer>
      )}
      {!appKitReady && children}
    </AuthContext.Provider>
  );
};

// Main AuthProvider - Now supports web and native (Android/iOS)
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Use full auth provider for web and native with wallet support
  // AuthProviderInner uses wagmi hooks which now work on all platforms via Web3Provider
  return <AuthProviderInner>{children}</AuthProviderInner>;
};

// Export a hook to check if wallet system is fully ready (for loading screens)
export const useWalletReady = () => {
  const appKitReady = useAppKitReady();
  const { user, guestId } = useAuth();
  // Ready when AppKit is initialized AND we have either a user or guest session
  return appKitReady && (user !== null || guestId !== null);
};

export const useAuth = () => useContext(AuthContext);