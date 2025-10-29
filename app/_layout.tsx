import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Appearance } from "react-native";
import "../global.css";

export default function RootLayout() {
  // Force light theme for the entire app
  useEffect(() => {
    // Override system appearance to always use light mode
    Appearance.setColorScheme("light");
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <PortalHost />
    </>
  );
}
