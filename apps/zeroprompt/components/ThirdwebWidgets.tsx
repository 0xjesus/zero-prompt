/**
 * ThirdwebWidgets - Native fallback
 *
 * Thirdweb widgets are web-only. This component provides a fallback UI
 * for native platforms directing users to use the web version.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { X, Globe } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";

interface ThirdwebWidgetsProps {
  visible: boolean;
  onClose: () => void;
  defaultAmount?: string;
  onSuccess?: (data: any) => void;
  receiverAddress?: string;
}

export default function ThirdwebWidgets({
  visible,
  onClose,
}: ThirdwebWidgetsProps) {
  const { theme: colors } = useTheme();

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Add Credits
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Globe size={48} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>
              Web Only Feature
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              Credit card purchases are currently only available on the web version
              of ZeroPrompt. Please visit zeroprompt.ai in your browser to add
              credits with your card.
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 18,
  },
  content: {
    padding: 40,
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "700",
  },
});
