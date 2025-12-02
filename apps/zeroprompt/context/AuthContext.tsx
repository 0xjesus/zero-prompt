import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { API_URL } from "../config/api";

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

// Inner component that uses wagmi hooks (must be inside WagmiProvider)
const AuthProviderInner = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [migratedChats, setMigratedChats] = useState<number | null>(null);
  const authInProgress = useRef(false);
  const lastAuthAttempt = useRef<string | null>(null);
  const signatureRequested = useRef(false);

  // Wagmi hooks
  const { address, isConnected, isConnecting: wagmiConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { open: openAppKit } = useAppKit();

  // Initialize guest ID on mount
  useEffect(() => {
    if (Platform.OS !== "web") return;

    let gid = localStorage.getItem("guest_id");
    if (!gid) {
      gid = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("guest_id", gid);
    }
    setGuestId(gid);

    // Try to restore session
    const savedToken = localStorage.getItem("session_token");
    const savedWallet = localStorage.getItem("wallet_address");
    if (savedToken && savedWallet) {
      setToken(savedToken);
      setUser({
        walletAddress: savedWallet,
        messageCount: 0,
        isPremium: false
      });
      // Verify session with backend
      verifySession(savedToken);
    }
  }, []);

  // Verify existing session
  const verifySession = async (sessionToken: string) => {
    try {
      const res = await fetch(`${API_URL}/wallet/me`, {
        headers: { "x-session-token": sessionToken }
      });
      if (res.ok) {
        const data = await res.json();
        setUser({
          walletAddress: data.wallet,
          messageCount: data.messageCount,
          isPremium: data.isPremium,
          conversationCount: data.conversationCount
        });
      } else {
        // Session expired, clear it
        localStorage.removeItem("session_token");
        localStorage.removeItem("wallet_address");
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error("[Auth] Session verification failed:", err);
    }
  };

  // Authenticate with backend when wallet connects
  const authenticateWithBackend = useCallback(async (walletAddress: string) => {
    // Prevent duplicate auth attempts (React Strict Mode protection)
    const authKey = `${walletAddress}-${Date.now()}`;
    if (authInProgress.current) {
      console.log("[Auth] ⚠️ Auth already in progress, skipping");
      return;
    }

    // Check if we recently tried to auth this wallet (within 5 seconds)
    if (lastAuthAttempt.current) {
      const [lastWallet, lastTime] = lastAuthAttempt.current.split('-');
      if (lastWallet === walletAddress && Date.now() - parseInt(lastTime) < 5000) {
        console.log("[Auth] ⚠️ Recent auth attempt for this wallet, skipping duplicate");
        return;
      }
    }

    authInProgress.current = true;
    lastAuthAttempt.current = `${walletAddress}-${Date.now()}`;
    setIsAuthenticating(true);
    setConnectionError(null);

    try {
      console.log("[Auth] 🚀 Starting authentication for:", walletAddress);
      console.log("[Auth] API_URL:", API_URL);

      // Step 1: Get nonce from backend
      console.log("[Auth] 📤 Fetching nonce from:", `${API_URL}/wallet/nonce`);
      const nonceRes = await fetch(`${API_URL}/wallet/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress })
      });

      console.log("[Auth] 📥 Nonce response status:", nonceRes.status, nonceRes.statusText);

      if (!nonceRes.ok) {
        const errorText = await nonceRes.text();
        console.log("[Auth] ❌ Nonce fetch failed:", errorText);
        throw new Error("Failed to get nonce");
      }

      const nonceData = await nonceRes.json();
      const { message } = nonceData;
      console.log("[Auth] ✅ Got nonce data:", nonceData);
      console.log("[Auth] 📝 Message to sign:", message);

      // Step 2: Sign the message with wallet
      // Check if signature already requested (prevent double popup)
      if (signatureRequested.current) {
        console.log("[Auth] ⚠️ Signature already requested, skipping duplicate");
        return;
      }
      signatureRequested.current = true;
      console.log("[Auth] 🔏 Requesting signature from wallet...");
      const signature = await signMessageAsync({ message });
      console.log("[Auth] ✅ Signature obtained:", signature.substring(0, 20) + "...");

      // Step 3: Verify with backend (include guestId for migration)
      const currentGuestId = localStorage.getItem("guest_id");
      console.log("[Auth] 📤 Sending verify request to:", `${API_URL}/wallet/verify`);
      console.log("[Auth] Verify payload:", { wallet: walletAddress, signatureLength: signature.length, guestId: currentGuestId });

      const verifyRes = await fetch(`${API_URL}/wallet/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          signature,
          guestId: currentGuestId
        })
      });

      console.log("[Auth] 📥 Verify response status:", verifyRes.status, verifyRes.statusText);

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        console.log("[Auth] ❌ Verify failed:", err);
        throw new Error(err.error || "Verification failed");
      }

      const verifyData = await verifyRes.json();
      console.log("[Auth] ✅ Verification successful:", verifyData);

      // Store session
      console.log("[Auth] 💾 Storing session token:", verifyData.sessionToken?.substring(0, 10) + "...");
      localStorage.setItem("session_token", verifyData.sessionToken);
      localStorage.setItem("wallet_address", walletAddress);

      // Clear guest ID after successful migration
      if (verifyData.migratedConversations > 0) {
        console.log(`[Auth] 🔄 Migrated ${verifyData.migratedConversations} conversations!`);
        setMigratedChats(verifyData.migratedConversations);
        localStorage.removeItem("guest_id");
        setGuestId(null);
      }

      console.log("[Auth] 👤 Setting user state...");
      setToken(verifyData.sessionToken);
      setUser({
        walletAddress,
        messageCount: verifyData.messageCount || 0,
        isPremium: false,
        conversationCount: verifyData.totalConversations
      });
      console.log("[Auth] ✅ Authentication complete! User logged in.");

    } catch (err: any) {
      console.error("[Auth] ❌ Authentication failed:", err);
      console.error("[Auth] Error details:", err.message, err.stack);
      setConnectionError(err.message || "Authentication failed");
      // Disconnect wallet on auth failure
      console.log("[Auth] 🔌 Disconnecting wallet due to auth failure");
      disconnect();
    } finally {
      setIsAuthenticating(false);
      authInProgress.current = false;
      signatureRequested.current = false;
      console.log("[Auth] 🏁 Auth process finished");
    }
  }, [signMessageAsync, disconnect]);

  // Watch for wallet connection changes
  useEffect(() => {
    if (Platform.OS !== "web") return;

    console.log("[Auth] 👀 Wallet state changed:", {
      isConnected,
      address,
      hasUser: !!user,
      hasToken: !!token,
      authInProgress: authInProgress.current
    });

    if (isConnected && address && !user && !authInProgress.current) {
      // Wallet just connected, authenticate with backend
      // Add small delay to prevent React Strict Mode double-firing
      const timeoutId = setTimeout(() => {
        if (!authInProgress.current && !user) {
          console.log("[Auth] 🔗 Wallet connected, starting auth for:", address);
          authenticateWithBackend(address);
        } else {
          console.log("[Auth] ⏭️ Skipping auth - already in progress or user exists");
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    } else if (!isConnected && user) {
      // Wallet disconnected - but DON'T auto logout if we have a valid session
      // The user explicitly connected and authenticated, so keep them logged in
      // They can manually logout if they want
      const savedToken = localStorage.getItem("session_token");
      if (savedToken) {
        console.log("[Auth] ⚠️ Wallet appears disconnected but session exists - staying logged in");
        console.log("[Auth] ℹ️ User can manually logout if desired");
        // Don't logout - keep the session active
        // The user authenticated successfully, no reason to kick them out
      } else {
        console.log("[Auth] 🔌 Wallet disconnected (no session), logging out");
        handleLogout();
      }
    } else {
      console.log("[Auth] ℹ️ No action needed for current state");
    }
  }, [isConnected, address, user, token, authenticateWithBackend]);

  const handleLogout = useCallback(() => {
    // Call backend logout
    const currentToken = localStorage.getItem("session_token");
    if (currentToken) {
      fetch(`${API_URL}/wallet/logout`, {
        method: "POST",
        headers: { "x-session-token": currentToken }
      }).catch(() => {});
    }

    setUser(null);
    setToken(null);
    setConnectionError(null);
    localStorage.removeItem("session_token");
    localStorage.removeItem("wallet_address");

    // Regenerate guest ID
    const newGuestId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("guest_id", newGuestId);
    setGuestId(newGuestId);
  }, []);

  const refreshUser = useCallback(() => {
    setUser((prev) => (prev ? { ...prev, messageCount: prev.messageCount + 1 } : null));
  }, []);

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

// Fallback provider for non-web platforms
const AuthProviderFallback = ({ children }: { children: React.ReactNode }) => {
  const [guestId, setGuestId] = useState<string | null>(null);

  useEffect(() => {
    const gid = Math.random().toString(36).substring(2) + Date.now().toString(36);
    setGuestId(gid);
  }, []);

  const getHeaders = useCallback(() => {
    const headers: any = { "Content-Type": "application/json" };
    if (guestId) headers["x-guest-id"] = guestId;
    return headers;
  }, [guestId]);

  return (
    <AuthContext.Provider
      value={{
        user: null,
        token: null,
        guestId,
        isConnecting: false,
        isAuthenticating: false,
        connectionError: null,
        migratedChats: null,
        getHeaders,
        openWalletModal: () => {},
        connectWallet: async () => {},
        logout: () => {},
        refreshUser: () => {},
        clearMigratedChats: () => {}
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Main AuthProvider
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  if (Platform.OS !== "web") {
    return <AuthProviderFallback>{children}</AuthProviderFallback>;
  }
  return <AuthProviderInner>{children}</AuthProviderInner>;
};

export const useAuth = () => useContext(AuthContext);
