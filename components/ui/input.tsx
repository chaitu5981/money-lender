import { cn } from "@/lib/utils";
import React from "react";
import { Platform, TextInput, View } from "react-native";
import { Text } from "./text";

export interface InputProps extends React.ComponentProps<typeof TextInput> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <View className="w-full">
        {label ? <Text className="mb-2 text-sm font-medium">{label}</Text> : null}
        <TextInput
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            error && "border-destructive",
            Platform.select({
              web: "outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            }),
            className
          )}
          placeholderTextColor="#9CA3AF"
          {...props}
        />
        {error ? (
          <Text className="mt-1 text-sm text-destructive">{error}</Text>
        ) : null}
      </View>
    );
  }
);

Input.displayName = "Input";

export { Input };
