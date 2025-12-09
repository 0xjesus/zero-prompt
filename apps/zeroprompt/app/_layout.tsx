import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";
import { Web3Provider } from "../context/Web3Provider";
import { AuthProvider } from "../context/AuthContext";
import { BillingProvider } from "../context/BillingContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Web3Provider>
          <AuthProvider>
            <BillingProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="home" />
                <Stack.Screen name="models" />
                <Stack.Screen name="docs" />
                <Stack.Screen name="protocol" />
                <Stack.Screen name="dashboard" />
                <Stack.Screen name="x402" />
              </Stack>
              <StatusBar style="light" translucent={false} backgroundColor="#000000" />
            </BillingProvider>
          </AuthProvider>
        </Web3Provider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
