import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { Terminal, ArrowRight } from "lucide-react-native";

export default function LandingScreen() {
  const router = useRouter();
  const { user, guestId, isConnecting } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !isConnecting) {
        // Small delay to ensure navigation container is ready
        const timer = setTimeout(() => {
            router.replace("/chat/new");
        }, 100);
        return () => clearTimeout(timer);
    }
  }, [isMounted, isConnecting]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Terminal size={64} color="#4aa9ff" />
        <Text style={styles.title}>ZERO_PROMPT</Text>
        <Text style={styles.subtitle}>INITIALIZING SECURE SHELL...</Text>
        
        <ActivityIndicator size="large" color="#4aa9ff" style={{marginTop: 20}} />

        <Text style={styles.footer}>v4.1 // INITIALIZING...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05060a", justifyContent: "center", alignItems: "center" },
  content: { alignItems: "center", gap: 20 },
  title: { fontSize: 40, fontWeight: "900", color: "#f8fafc", letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  subtitle: { fontSize: 14, color: "#94a3b8", letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  footer: { position: "absolute", bottom: 20, color: "#334155", fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }
});