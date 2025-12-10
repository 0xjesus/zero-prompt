// AppKit Native Configuration for React Native (Android/iOS)
// This module provides configuration and utilities for Reown AppKit
// The actual initialization happens in Web3Provider to ensure proper React context

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const PROJECT_ID = "20ebf23c3bb262ce86b1746e9fffd567";

// Metadata for the dApp
export const APP_METADATA = {
  name: "ZeroPrompt",
  description: "AI Chat with Crypto Payments",
  url: "https://zeroprompt.app",
  icons: ["https://zeroprompt.app/icon.png"],
  redirect: {
    native: "zeroprompt://",
    universal: "https://zeroprompt.app",
  },
};

// Storage adapter for AppKit using AsyncStorage
export const asyncStorageAdapter = {
  getItem: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      console.warn("[AppKit] Failed to save to storage:", key);
    }
  },
  removeItem: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      console.warn("[AppKit] Failed to remove from storage:", key);
    }
  },
};

// Check if we're on a native platform
export function isNativePlatform() {
  return Platform.OS === "android" || Platform.OS === "ios";
}
