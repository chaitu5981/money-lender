import { Text } from "@/components/ui/text";
import { formatCurrency } from "@/lib/utils/currency";
import { View } from "react-native";

interface CalculatedResultsProps {
  loanAmount: number;
  calculatedResultsInterest: number;
  calculatedAmount: number;
}

export function CalculatedResults({
  loanAmount,
  calculatedResultsInterest,
  calculatedAmount,
}: CalculatedResultsProps) {
  if (calculatedResultsInterest === 0 && loanAmount === 0) return null;

  return (
    <View className="mb-6 p-4 bg-muted rounded-lg">
      <Text variant="h3" className="mb-2">
        Calculated Results
      </Text>
      <Text className="mb-1">
        {`Outstanding Principal: ₹${formatCurrency(loanAmount)}`}
      </Text>
      <Text className="mb-1">
        {`Interest: ₹${formatCurrency(calculatedResultsInterest)}`}
      </Text>
      <Text variant="h4" className="mt-2">
        {`Total Amount Due: ₹${formatCurrency(calculatedAmount)}`}
      </Text>
    </View>
  );
}

