export type ThemeType = {
  id: string;
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textMuted: string;
  textSecondary: string;
  border: string;
  bubbleUser: string;
  bubbleAi: string;
  success: string;
  warning: string;
  error: string;
};

export const THEMES = {
  HACKER_GREEN: {
    id: "green",
    background: "#020a05",
    surface: "#05140a",
    primary: "#00ff41",
    secondary: "#008F11",
    accent: "#003b00",
    text: "#ccffcc",
    textMuted: "#008F11",
    textSecondary: "#008F11",
    border: "#0d3314",
    bubbleUser: "#0a2912",
    bubbleAi: "transparent",
    success: "#00ff41",
    warning: "#ffc107",
    error: "#ff4444"
  },
  CYBER_RED: {
    id: "red",
    background: "#0a0202",
    surface: "#140505",
    primary: "#ff3333",
    secondary: "#8f0000",
    accent: "#3b0000",
    text: "#ffcccc",
    textMuted: "#8f0000",
    textSecondary: "#8f0000",
    border: "#330d0d",
    bubbleUser: "#290a0a",
    bubbleAi: "transparent",
    success: "#4ade80",
    warning: "#ffc107",
    error: "#ff4444"
  },
  READER_MODE: {
    id: "reader",
    background: "#fffff8",
    surface: "#f7f7f0",
    primary: "#111111",
    secondary: "#666666",
    accent: "#e5e5e5",
    text: "#222222",
    textMuted: "#888888",
    textSecondary: "#666666",
    border: "#dddddd",
    bubbleUser: "#eef0f2",
    bubbleAi: "transparent",
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444"
  },
  DARK_DEFAULT: {
     id: "dark",
     background: "#09090b",
     surface: "#18181b",
     primary: "#fafafa",
     secondary: "#a1a1aa",
     accent: "#27272a",
     text: "#e4e4e7",
     textMuted: "#52525b",
     textSecondary: "#a1a1aa",
     border: "#27272a",
     bubbleUser: "#27272a",
     bubbleAi: "transparent",
     success: "#4ade80",
     warning: "#fbbf24",
     error: "#f87171"
  }
};
