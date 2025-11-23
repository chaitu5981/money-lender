import { THEME } from "@/lib/theme";
import { useTheme } from "@/lib/theme-context";
import React from "react";
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Button } from "./button";
import { Text } from "./text";

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const ModalComponent = ({ visible, onClose, title, children }: ModalProps) => {
  const { colorScheme } = useTheme();
  const theme = colorScheme === "dark" ? THEME.dark : THEME.light;
  const screenWidth = Dimensions.get("window").width;

  const handleBackdropPress = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={{ 
          flex: 1, 
          backgroundColor: colorScheme === "dark" ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.5)" 
        }}
        onPress={handleBackdropPress}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <Pressable
            className={colorScheme === "dark" ? "dark" : ""}
            style={{
              backgroundColor: theme.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderTopColor: theme.border,
              maxHeight: Platform.OS === "ios" ? "90%" : "85%",
              marginHorizontal: screenWidth * 0.05, // 5% margin on each side = 90% width
              alignSelf: "center",
              width: screenWidth * 0.9,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 24,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <Text variant="h3">{title}</Text>
                <Button variant="ghost" onPress={onClose}>
                  <Text>Close</Text>
                </Button>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{
                  paddingBottom: Platform.OS === "ios" ? 100 : 200,
                  flexGrow: 1,
                }}
                nestedScrollEnabled={true}
                bounces={false}
              >
                {children}
              </ScrollView>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

export { ModalComponent as Modal };
