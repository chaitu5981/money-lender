import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/lib/theme-context";
import { Transaction } from "@/lib/types";
import { validateAmountInput } from "@/lib/utils/validation";
import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Platform, View } from "react-native";

interface TransactionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (amount: string, date: Date) => void;
  editingTransaction: Transaction | null;
  type: "payment" | "receipt";
}

export function TransactionModal({
  visible,
  onClose,
  onSubmit,
  editingTransaction,
  type,
}: TransactionModalProps) {
  const { colorScheme } = useTheme();
  
  const [localAmount, setLocalAmount] = useState<string>("");
  const [localDate, setLocalDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [userHasEdited, setUserHasEdited] = useState(false);
  const prevEditingIdRef = useRef<string | null>(null);

  // Get values - prefer prop when available and user hasn't edited, otherwise use local state
  const displayAmount = (editingTransaction && visible && !userHasEdited)
    ? String(editingTransaction.amount || "")
    : localAmount;
  
  const displayDate = (editingTransaction && visible && !userHasEdited)
    ? (() => {
        const transactionDate = new Date(editingTransaction.date);
        if (!isNaN(transactionDate.getTime())) {
          transactionDate.setHours(0, 0, 0, 0);
          return transactionDate;
        }
        return localDate;
      })()
    : localDate;

  // Sync local state with props when modal opens or editingTransaction changes
  useLayoutEffect(() => {
    if (visible) {
      const currentEditingId = editingTransaction?.id || null;
      const editingIdChanged = currentEditingId !== prevEditingIdRef.current;
      
      // Reset userHasEdited when switching transactions or opening modal
      if (editingIdChanged || (currentEditingId === null && prevEditingIdRef.current !== null)) {
        setUserHasEdited(false);
      }
      
      if (editingTransaction) {
        // Editing a transaction - sync state from prop
        const amountValue = String(editingTransaction.amount || "");
        setLocalAmount(amountValue);
        
        const transactionDate = new Date(editingTransaction.date);
        if (!isNaN(transactionDate.getTime())) {
          transactionDate.setHours(0, 0, 0, 0);
          setLocalDate(transactionDate);
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          setLocalDate(today);
        }
        prevEditingIdRef.current = currentEditingId;
      } else {
        // New transaction - reset
        setLocalAmount("");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setLocalDate(today);
        prevEditingIdRef.current = null;
      }
      setShowDatePicker(false);
    } else {
      // Reset when modal closes
      setLocalAmount("");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setLocalDate(today);
      setShowDatePicker(false);
      setUserHasEdited(false);
      prevEditingIdRef.current = null;
    }
  }, [visible, editingTransaction]);

  const handleClose = () => {
    setLocalAmount("");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setLocalDate(today);
    setShowDatePicker(false);
    onClose();
  };

  const handleSubmit = () => {
    const submitAmount = displayAmount;
    const submitDate = displayDate;
    if (!submitAmount || parseFloat(submitAmount) <= 0) return;
    onSubmit(submitAmount, submitDate);
    handleClose();
  };

  const title =
    type === "payment"
      ? editingTransaction
        ? "Edit repayment"
        : "Add repayment"
      : editingTransaction
        ? "Edit borrowal"
        : "Add borrowal";

  const label = type === "payment" ? "Repayment Amount (₹)" : "Borrowal Amount (₹)";
  const dateLabel = type === "payment" ? "Repayment Date" : "Borrowal Date";
  const buttonText =
    type === "payment"
      ? editingTransaction
        ? "Update repayment"
        : "Add repayment"
      : editingTransaction
        ? "Update borrowal"
        : "Add borrowal";
  const buttonColor = type === "payment" ? "bg-green-600" : "bg-red-600";

  return (
    <Modal visible={visible} onClose={handleClose} title={title}>
      <View className="pb-4">
        <Input
          key={`amount-input-${editingTransaction?.id || "new"}-${visible}`}
          label={label}
          value={displayAmount}
          onChangeText={(text) => {
            const validated = validateAmountInput(text);
            setLocalAmount(validated);
            setUserHasEdited(true);
          }}
          keyboardType="number-pad"
          placeholder="0"
        />
        <View className="mt-4">
          <Text className="mb-2 text-sm font-medium">{dateLabel}</Text>
          <Button
            variant="outline"
            onPress={() => setShowDatePicker(true)}
            className="flex-row items-center gap-2"
          >
            <MaterialIcons
              name="calendar-today"
              size={18}
              color={colorScheme === "dark" ? "#fff" : "#000"}
            />
            <Text>
              {displayDate ? new Date(displayDate).toLocaleDateString() : "Select date"}
            </Text>
          </Button>
          {showDatePicker && (
            <DateTimePicker
              value={displayDate || new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === "ios");
                if (selectedDate) {
                  const d = new Date(selectedDate);
                  d.setHours(0, 0, 0, 0);
                  setLocalDate(d);
                  setUserHasEdited(true);
                }
              }}
            />
          )}
        </View>
        <Button
          className={`${buttonColor} mt-6`}
          onPress={handleSubmit}
          disabled={!displayAmount || parseFloat(displayAmount) <= 0}
        >
          <Text className="text-white">{buttonText}</Text>
        </Button>
      </View>
    </Modal>
  );
}


