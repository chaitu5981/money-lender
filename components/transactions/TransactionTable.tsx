import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Transaction } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { MaterialIcons } from "@expo/vector-icons";
import { View } from "react-native";

interface TransactionTableProps {
  transactions: Transaction[];
  onEditPayment: (transaction: Transaction) => void;
  onDeletePayment: (id: string) => void;
  onEditReceipt: (transaction: Transaction) => void;
  onDeleteReceipt: (id: string) => void;
}

export function TransactionTable({
  transactions,
  onEditPayment,
  onDeletePayment,
  onEditReceipt,
  onDeleteReceipt,
}: TransactionTableProps) {
  if (transactions.length === 0) return null;

  return (
    <View className="mb-4 p-3 bg-muted rounded-lg">
      <Text variant="h3" className="mb-2">
        Transactions
      </Text>
      {/* Header */}
      <View className="flex-row pb-1 border-b border-border mb-2">
        <Text className="text-xs font-semibold w-[20%]">Date</Text>
        <Text className="text-xs font-semibold w-[18%] text-center">Type</Text>
        <Text className="text-xs font-semibold flex-1 text-right px-2">
          Amount (₹)
        </Text>
        <View className="w-[32%]">
          <Text className="text-xs font-semibold text-center">Actions</Text>
        </View>
      </View>
      {/* Rows */}
      {transactions.map((t) => (
        <View
          key={`table-${t.id}`}
          className="flex-row py-1 items-center"
        >
          <Text className="text-xs w-[20%]">
            {new Date(t.date).toLocaleDateString()}
          </Text>
          <Text className="text-xs w-[18%] text-center">
            {t.type === "receipt" ? "Borrowal" : "Repayment"}
          </Text>
          <Text className="text-xs flex-1 text-right px-2">
            {formatCurrency(t.amount)}
          </Text>
          <View className="flex-row justify-center items-center w-[32%]">
            {t.type === "payment" ? (
              <>
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-full p-0 mr-3 bg-white dark:bg-gray-800 border-blue-600 dark:border-blue-400 items-center justify-center"
                  onPress={() => onEditPayment(t)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="edit" size={18} color="#2563eb" />
                </Button>
                <Button
                  variant="destructive"
                  className="h-10 w-10 rounded-full p-0 bg-red-600 items-center justify-center"
                  onPress={() => onDeletePayment(t.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="delete" size={18} color="#ffffff" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-full p-0 mr-3 bg-white dark:bg-gray-800 border-blue-600 dark:border-blue-400 items-center justify-center"
                  onPress={() => onEditReceipt(t)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="edit" size={18} color="#2563eb" />
                </Button>
                <Button
                  variant="destructive"
                  className="h-10 w-10 rounded-full p-0 bg-red-600 items-center justify-center"
                  onPress={() => onDeleteReceipt(t.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="delete" size={18} color="#ffffff" />
                </Button>
              </>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

