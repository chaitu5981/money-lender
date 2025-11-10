import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, Appearance, View } from "react-native";
import "../global.css";
import { ThemeProvider, useTheme } from "../lib/theme-context";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { colorScheme, isLoading } = useTheme();

  useEffect(() => {
    // Apply the selected theme
    Appearance.setColorScheme(colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    const prepare = async () => {
      try {
        // Wait a bit for everything to initialize
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (e) {
        console.warn(e);
      } finally {
        // Hide the splash screen
        await SplashScreen.hideAsync();
      }
    };

    if (!isLoading) {
      prepare();
    }
  }, [isLoading]);

  // Show loading indicator while theme is loading
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View
      style={{ flex: 1 }}
      // @ts-ignore - NativeWind className prop
      className={colorScheme === "dark" ? "dark" : undefined}
    >
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
