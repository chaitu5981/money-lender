import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Appearance } from "react-native";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { View } from "react-native";
import "../global.css";

function RootLayoutContent() {
  const { colorScheme } = useTheme();

  useEffect(() => {
    // Apply the selected theme
    Appearance.setColorScheme(colorScheme);
  }, [colorScheme]);

  return (
    <View style={{ flex: 1 }} className={colorScheme === "dark" ? "dark" : ""}>
      <Stack screenOptions={{ headerShown: false }} />
      <PortalHost />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}
