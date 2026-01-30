import React, { useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { ThumbsUp, ThumbsDown } from "lucide-react-native";
import { API_URL } from "../config/api";

interface NodeFeedbackProps {
  operatorAddress: string;
  conversationId?: string;
  theme: any;
}

export default function NodeFeedback({ operatorAddress, conversationId, theme }: NodeFeedbackProps) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const submitFeedback = async (type: "up" | "down") => {
    if (feedback) return; // Already submitted
    setFeedback(type);
    try {
      await fetch(`${API_URL}/operators/${operatorAddress}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, conversationId }),
      });
    } catch (err) {
      console.error("[NodeFeedback] Error:", err);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => submitFeedback("up")}
        disabled={feedback !== null}
        style={[
          styles.button,
          feedback === "up" && { backgroundColor: theme.success + "20" },
        ]}
      >
        <ThumbsUp
          size={14}
          color={feedback === "up" ? theme.success : "rgba(255,255,255,0.3)"}
          fill={feedback === "up" ? theme.success : "transparent"}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => submitFeedback("down")}
        disabled={feedback !== null}
        style={[
          styles.button,
          feedback === "down" && { backgroundColor: theme.error + "20" },
        ]}
      >
        <ThumbsDown
          size={14}
          color={feedback === "down" ? theme.error : "rgba(255,255,255,0.3)"}
          fill={feedback === "down" ? theme.error : "transparent"}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  button: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
});
