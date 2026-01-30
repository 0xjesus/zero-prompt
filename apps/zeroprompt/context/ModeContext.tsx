import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL, SUBNET_API_URL } from "../config/api";

/**
 * Inference Mode Context
 * Manages the toggle between centralized (OpenRouter) and decentralized (Ollama) modes
 */

export type InferenceMode = "centralized" | "decentralized";

export interface OllamaModel {
  id: string;
  name: string;
  nodeCount: number;
  avgLatencyMs: number;
  available: boolean;
}

export interface NetworkHealth {
  totalNodes: number;
  healthyNodes: number;
  unhealthyNodes: number;
  availableModels: string[];
  avgLatencyMs: number;
}

type ModeContextType = {
  // State
  mode: InferenceMode;
  availableOllamaModels: OllamaModel[];
  networkHealth: NetworkHealth | null;
  isLoadingModels: boolean;
  subnetApiUrl: string;
  selectedNodeAddress: string | null;

  // Actions
  setMode: (mode: InferenceMode) => void;
  toggleMode: () => void;
  refreshOllamaModels: () => Promise<void>;
  refreshNetworkHealth: () => Promise<void>;
  setSelectedNodeAddress: (address: string | null) => void;

  // Helpers
  isDecentralized: boolean;
  isCentralized: boolean;
  isOllamaModelAvailable: (modelId: string) => boolean;
  getOllamaModelInfo: (modelId: string) => OllamaModel | undefined;
};

const STORAGE_KEY = "@zeroprompt/inference_mode";
const NODE_ADDRESS_STORAGE_KEY = "@zeroprompt/selected_node_address";

const ModeContext = createContext<ModeContextType>({} as ModeContextType);

export const ModeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setModeState] = useState<InferenceMode>("centralized");
  const [availableOllamaModels, setAvailableOllamaModels] = useState<OllamaModel[]>([]);
  const [networkHealth, setNetworkHealth] = useState<NetworkHealth | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [selectedNodeAddress, setSelectedNodeAddressState] = useState<string | null>(null);

  // Derived values
  const isDecentralized = mode === "decentralized";
  const isCentralized = mode === "centralized";

  // Load saved mode and selected node on mount
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        const [savedMode, savedNode] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(NODE_ADDRESS_STORAGE_KEY),
        ]);
        if (savedMode === "centralized" || savedMode === "decentralized") {
          setModeState(savedMode);
        }
        if (savedNode) {
          setSelectedNodeAddressState(savedNode);
        }
      } catch (err) {
        console.error("[Mode] Failed to load saved state:", err);
      }
    };
    loadSavedState();
  }, []);

  // Save mode when changed
  const setMode = useCallback(async (newMode: InferenceMode) => {
    setModeState(newMode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newMode);
    } catch (err) {
      console.error("[Mode] Failed to save mode:", err);
    }
  }, []);

  // Toggle between modes
  const toggleMode = useCallback(() => {
    setMode(mode === "centralized" ? "decentralized" : "centralized");
  }, [mode, setMode]);

  // Persist selected node address
  const setSelectedNodeAddress = useCallback(async (address: string | null) => {
    setSelectedNodeAddressState(address);
    try {
      if (address) {
        await AsyncStorage.setItem(NODE_ADDRESS_STORAGE_KEY, address);
      } else {
        await AsyncStorage.removeItem(NODE_ADDRESS_STORAGE_KEY);
      }
    } catch (err) {
      console.error("[Mode] Failed to save selected node:", err);
    }
  }, []);

  // Fetch available Ollama models
  const refreshOllamaModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const res = await fetch(`${API_URL}/operators/models`);
      if (res.ok) {
        const data = await res.json();
        setAvailableOllamaModels(data.models || []);
      }
    } catch (err) {
      console.error("[Mode] Failed to fetch Ollama models:", err);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  // Fetch network health
  const refreshNetworkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/operators/health`);
      if (res.ok) {
        const data = await res.json();
        setNetworkHealth(data);
      }
    } catch (err) {
      console.error("[Mode] Failed to fetch network health:", err);
    }
  }, []);

  // Check if a model is available on the Ollama network
  const isOllamaModelAvailable = useCallback((modelId: string): boolean => {
    return availableOllamaModels.some(m => m.id === modelId && m.available);
  }, [availableOllamaModels]);

  // Get info for an Ollama model
  const getOllamaModelInfo = useCallback((modelId: string): OllamaModel | undefined => {
    return availableOllamaModels.find(m => m.id === modelId);
  }, [availableOllamaModels]);

  // Refresh models when switching to decentralized mode
  useEffect(() => {
    if (isDecentralized) {
      refreshOllamaModels();
      refreshNetworkHealth();
    }
  }, [isDecentralized, refreshOllamaModels, refreshNetworkHealth]);

  // Periodic refresh of network health when in decentralized mode
  useEffect(() => {
    if (!isDecentralized) return;

    const interval = setInterval(() => {
      refreshNetworkHealth();
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [isDecentralized, refreshNetworkHealth]);

  return (
    <ModeContext.Provider
      value={{
        mode,
        availableOllamaModels,
        networkHealth,
        isLoadingModels,
        subnetApiUrl: SUBNET_API_URL,
        selectedNodeAddress,
        setMode,
        toggleMode,
        refreshOllamaModels,
        refreshNetworkHealth,
        setSelectedNodeAddress,
        isDecentralized,
        isCentralized,
        isOllamaModelAvailable,
        getOllamaModelInfo,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => useContext(ModeContext);
