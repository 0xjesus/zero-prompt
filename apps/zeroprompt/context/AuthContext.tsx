import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../config/api";

// Conditionally import wagmi hooks - they work on all platforms now via Web3Provider
let useAccount: any = () => ({ address: undefined, isConnected: false, isConnecting: false });
let useDisconnect: any = () => ({ disconnect: () => {} });
let useSignMessage: any = () => ({ signMessageAsync: async () => "" });
let useAppKit: any = () => ({ open: () => {} });

try {
  const wagmi = require("wagmi");
  useAccount = wagmi.useAccount;
  useDisconnect = wagmi.useDisconnect;
  useSignMessage = wagmi.useSignMessage;

  // Import AppKit hook based on platform
  if (Platform.OS === "web") {
    const appkit = require("@reown/appkit/react");
    useAppKit = appkit.useAppKit;
  } else {
    // For React Native, use the RN-specific hook
    try {
      const appkitRN = require("@reown/appkit-wagmi-react-native");
      useAppKit = appkitRN.useAppKit || (() => ({ open: () => {} }));
    } catch {
      // Fallback if RN AppKit not available
      useAppKit = () => ({ open: () => console.log("[Auth] AppKit RN not available") });
    }
  }
} catch (e) {
  console.warn("[Auth] Wagmi hooks not available:", e);
}

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
  connectionError: string | null;
  migratedChats: number | null;
  getHeaders: () => any;
  openWalletModal: () => void;
  connectWallet: () => Promise<void>;
  logout: () => void;
  refreshUser: () => void;
  clearMigratedChats: () => void;
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

// Inner component that uses wagmi hooks (must be inside WagmiProvider)
const AuthProviderInner = ({ children }: { children: React.ReactNode }) => {
  const [storageReady, setStorageReady] = useState(Platform.OS === "web");

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
  const [migratedChats, setMigratedChats] = useState<number | null>(null);
  const authInProgress = useRef(false);
  const lastAuthAttempt = useRef<string | null>(null);
  const signatureRequested = useRef(false);
  const sessionVerified = useRef(false);
  const verifyInterval = useRef<NodeJS.Timeout | null>(null);

  // Wagmi hooks
  const { address, isConnected, isConnecting: wagmiConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { open: openAppKit } = useAppKit();

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

      // Step 2: Sign the message with wallet
      const signature = await signMessageAsync({ message });
      console.log("[Auth] ✅ Signature obtained");

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
  }, [signMessageAsync, disconnect, verifySession]);

  // Track last authenticated address to prevent duplicate auth attempts
  const lastAuthenticatedAddress = useRef<string | null>(null);

  // Watch for wallet connection changes
  useEffect(() => {
    if (!storageReady) return;

    // Don't do anything if auth is already in progress or signature was requested
    if (authInProgress.current || signatureRequested.current) {
      console.log("[Auth] ⏳ Skipping - auth in progress or signature pending");
      return;
    }

    if (isConnected && address && !user) {
      // Check if we already authenticated this address in this session
      if (lastAuthenticatedAddress.current?.toLowerCase() === address.toLowerCase()) {
        console.log("[Auth] ⚠️ Already attempted auth for this address, skipping");
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
        if (!hasSession) {
          // Wallet just connected, authenticate with backend
          const timeoutId = setTimeout(() => {
            if (!authInProgress.current && !signatureRequested.current && !user) {
              console.log("[Auth] 🔗 Wallet connected, starting auth for:", address);
              lastAuthenticatedAddress.current = address;
              authenticateWithBackend(address);
            }
          }, 500); // Increased delay to prevent race conditions
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
    }
  }, [isConnected, address, user, authenticateWithBackend, verifySession, storageReady]);

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

  const openWalletModal = useCallback(() => {
    setConnectionError(null);
    openAppKit();
  }, [openAppKit]);

  const connectWallet = useCallback(async () => {
    setConnectionError(null);
    openAppKit();
  }, [openAppKit]);

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
        isConnecting: wagmiConnecting,
        isAuthenticating,
        connectionError,
        migratedChats,
        getHeaders,
        openWalletModal,
        connectWallet,
        logout,
        refreshUser,
        clearMigratedChats
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Main AuthProvider - Now supports web and native (Android/iOS)
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Use full auth provider for web and native with wallet support
  // AuthProviderInner uses wagmi hooks which now work on all platforms via Web3Provider
  return <AuthProviderInner>{children}</AuthProviderInner>;
};

export const useAuth = () => useContext(AuthContext);
