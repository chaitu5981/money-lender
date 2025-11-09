import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";

const THEME_STORAGE_KEY = "@money_lender:theme";

export type ColorScheme = "light" | "dark";

export function useTheme() {
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
      // Force a re-render by updating the state
      if (typeof window !== "undefined") {
        // For web, update the document class
        document.documentElement.classList.toggle("dark", newTheme === "dark");
      }
    } catch (error) {
      console.error("Error saving theme:", error);
    }
  };

  const setTheme = async (theme: ColorScheme) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
      setColorScheme(theme);
    } catch (error) {
      console.error("Error saving theme:", error);
    }
  };

  return {
    colorScheme,
    toggleTheme,
    setTheme,
    isLoading,
  };
}

