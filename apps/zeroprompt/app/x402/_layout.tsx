import { Stack } from "expo-router";

export default function X402Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="logs" />
    </Stack>
  );
}
