import { Platform } from "react-native";

// WalletConnect polyfills are loaded in index.js
// keyvaluestorage is patched via Metro resolver to handle null values properly

import { useState, useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";
import { Web3Provider } from "../context/Web3Provider";
import { AuthProvider } from "../context/AuthContext";
import { BillingProvider } from "../context/BillingContext";
import { ModeProvider } from "../context/ModeContext";
import { SubnetProvider } from "../context/SubnetContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Web3Provider>
          <AuthProvider>
            <ModeProvider>
              <SubnetProvider>
                <BillingProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="home" />
                    <Stack.Screen name="models" />
                    <Stack.Screen name="docs" />
                    <Stack.Screen name="dashboard" />
                    <Stack.Screen name="x402" />
                    <Stack.Screen name="settings" />
                    <Stack.Screen name="operator" />
                    <Stack.Screen name="register-operator" />
                    <Stack.Screen name="stake" />
                    <Stack.Screen name="node-config" />
                    <Stack.Screen name="network" />
                    <Stack.Screen name="explorer" />
                  </Stack>
                  <StatusBar style="light" translucent={false} backgroundColor="#000000" />
                </BillingProvider>
              </SubnetProvider>
            </ModeProvider>
          </AuthProvider>
        </Web3Provider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
