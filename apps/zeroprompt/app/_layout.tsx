import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider } from "../context/ThemeContext";
import { Web3Provider } from "../context/Web3Provider";
import { AuthProvider } from "../context/AuthContext";
import { BillingProvider } from "../context/BillingContext";
import { ThirdwebWrapper } from "../context/ThirdwebProvider";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThirdwebWrapper>
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
              </Stack>
              <StatusBar style="auto" />
            </BillingProvider>
          </AuthProvider>
        </Web3Provider>
      </ThirdwebWrapper>
    </ThemeProvider>
  );
}
