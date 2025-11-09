import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

const THEME_STORAGE_KEY = "@money_lender:theme";

export type ColorScheme = "light" | "dark";

interface ThemeContextType {
  colorScheme: ColorScheme;
  toggleTheme: () => Promise<void>;
  setTheme: (theme: ColorScheme) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [colorScheme, setColorScheme] = useState<ColorScheme>("light");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === "light" || savedTheme === "dark") {
        setColorScheme(savedTheme);
      } else {
        // Default to system theme if no preference saved
        setColorScheme(systemColorScheme === "dark" ? "dark" : "light");
      }
    } catch (error) {
      console.error("Error loading theme:", error);
      setColorScheme("light");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    const newTheme: ColorScheme = colorScheme === "light" ? "dark" : "light";
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
      setColorScheme(newTheme);
      // Force re-render by updating Appearance
      const { Appearance } = require("react-native");
      Appearance.setColorScheme(newTheme);
    } catch (error) {
      console.error("Error saving theme:", error);
    }
  };

  const setTheme = async (theme: ColorScheme) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
      setColorScheme(theme);
      // Force re-render by updating Appearance
      const { Appearance } = require("react-native");
      Appearance.setColorScheme(theme);
    } catch (error) {
      console.error("Error saving theme:", error);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        toggleTheme,
        setTheme,
        isLoading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

