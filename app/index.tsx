import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Text } from "@/components/ui/text";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Transaction {
  id: string;
  amount: number;
  date: string; // ISO date string
  type: "payment" | "receipt";
}

const STORAGE_KEYS = {
  INTEREST_RATE: "@money_lender:interest_rate",
  PAYMENTS: "@money_lender:payments",
  RECEIPTS: "@money_lender:receipts",
};

// Helper function to format currency safely
const formatCurrency = (amount: number | string | undefined): string => {
  if (typeof amount === "number") {
    return amount.toFixed(2);
  }
  if (typeof amount === "string") {
    const num = parseFloat(amount);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  }
  return "0.00";
};

export default function Index() {
  const [interestRate, setInterestRate] = useState<string>("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [payments, setPayments] = useState<Transaction[]>([]);
  const [receipts, setReceipts] = useState<Transaction[]>([]);

  // Payment modal state
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  // Receipt modal state
  const [receiptAmount, setReceiptAmount] = useState<string>("");
  const [receiptDate, setReceiptDate] = useState(new Date());
  const [showReceiptDatePicker, setShowReceiptDatePicker] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);

  // Results
  const [calculatedInterest, setCalculatedInterest] = useState<number>(0);
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [calculationDetails, setCalculationDetails] = useState<string>("");
  const [transactionPeriods, setTransactionPeriods] = useState<
    {
      transactionId: string;
      days: number;
      interest: number;
      principalBefore: number;
      finalPeriodDays: number;
      finalPeriodInterest: number;
      finalPrincipalBefore: number;
    }[]
  >([]);

  // Load data from storage
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [storedRate, storedPayments, storedReceipts] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.INTEREST_RATE),
        AsyncStorage.getItem(STORAGE_KEYS.PAYMENTS),
        AsyncStorage.getItem(STORAGE_KEYS.RECEIPTS),
      ]);

      if (storedRate) setInterestRate(storedRate);
      if (storedPayments) setPayments(JSON.parse(storedPayments));
      if (storedReceipts) setReceipts(JSON.parse(storedReceipts));
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const saveInterestRate = async (rate: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.INTEREST_RATE, rate);
      setInterestRate(rate);
    } catch (error) {
      console.error("Error saving interest rate:", error);
    }
  };

  const handleClearData = async () => {
    Alert.alert(
      "Clear all data",
      "This will remove interest rate, payments, and receipts. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                STORAGE_KEYS.INTEREST_RATE,
                STORAGE_KEYS.PAYMENTS,
                STORAGE_KEYS.RECEIPTS,
              ]);
              setInterestRate("");
              setPayments([]);
              setReceipts([]);
              setCalculatedInterest(0);
              setCalculatedAmount(0);
              setLoanAmount(0);
            } catch (error) {
              console.error("Error clearing data:", error);
            }
          },
        },
      ]
    );
  };

  const sortTransactionsByDate = (
    transactions: Transaction[]
  ): Transaction[] => {
    return [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  const handlePaymentSubmit = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) return;

    let updatedPayments: Transaction[];

    if (editingPaymentId) {
      // Update existing payment
      updatedPayments = payments.map((payment) =>
        payment.id === editingPaymentId
          ? {
              ...payment,
              amount: parseFloat(paymentAmount),
              date: paymentDate.toISOString(),
            }
          : payment
      );
    } else {
      // Create new payment
      const newPayment: Transaction = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        amount: parseFloat(paymentAmount),
        date: paymentDate.toISOString(),
        type: "payment",
      };
      updatedPayments = [...payments, newPayment];
    }

    updatedPayments = sortTransactionsByDate(updatedPayments);
    setPayments(updatedPayments);

    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PAYMENTS,
        JSON.stringify(updatedPayments)
      );
    } catch (error) {
      console.error("Error saving payment:", error);
    }

    // Reset form
    setPaymentAmount("");
    setPaymentDate(new Date());
    setShowPaymentModal(false);
    setEditingPaymentId(null);

    // Recalculate
    calculateResults(updatedPayments, receipts);
  };

  const handleEditPayment = (payment: Transaction) => {
    setEditingPaymentId(payment.id);
    setPaymentAmount(payment.amount.toString());
    setPaymentDate(new Date(payment.date));
    setShowPaymentModal(true);
  };

  const handleDeletePayment = async (paymentId: string) => {
    Alert.alert(
      "Delete Payment",
      "Are you sure you want to delete this payment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updatedPayments = payments.filter((p) => p.id !== paymentId);
            setPayments(updatedPayments);
            try {
              await AsyncStorage.setItem(
                STORAGE_KEYS.PAYMENTS,
                JSON.stringify(updatedPayments)
              );
              calculateResults(updatedPayments, receipts);
            } catch (error) {
              console.error("Error deleting payment:", error);
            }
          },
        },
      ]
    );
  };

  const handleReceiptSubmit = async () => {
    if (!receiptAmount || parseFloat(receiptAmount) <= 0) return;

    let updatedReceipts: Transaction[];

    if (editingReceiptId) {
      // Update existing receipt
      updatedReceipts = receipts.map((receipt) =>
        receipt.id === editingReceiptId
          ? {
              ...receipt,
              amount: parseFloat(receiptAmount),
              date: receiptDate.toISOString(),
            }
          : receipt
      );
    } else {
      // Create new receipt
      const newReceipt: Transaction = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        amount: parseFloat(receiptAmount),
        date: receiptDate.toISOString(),
        type: "receipt",
      };
      updatedReceipts = [...receipts, newReceipt];
    }

    updatedReceipts = sortTransactionsByDate(updatedReceipts);
    setReceipts(updatedReceipts);

    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.RECEIPTS,
        JSON.stringify(updatedReceipts)
      );
    } catch (error) {
      console.error("Error saving receipt:", error);
    }

    // Reset form
    setReceiptAmount("");
    setReceiptDate(new Date());
    setShowReceiptModal(false);
    setEditingReceiptId(null);

    // Recalculate
    calculateResults(payments, updatedReceipts);
  };

  const handleEditReceipt = (receipt: Transaction) => {
    setEditingReceiptId(receipt.id);
    setReceiptAmount(receipt.amount.toString());
    setReceiptDate(new Date(receipt.date));
    setShowReceiptModal(true);
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    Alert.alert(
      "Delete Receipt",
      "Are you sure you want to delete this receipt?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updatedReceipts = receipts.filter((r) => r.id !== receiptId);
            setReceipts(updatedReceipts);
            try {
              await AsyncStorage.setItem(
                STORAGE_KEYS.RECEIPTS,
                JSON.stringify(updatedReceipts)
              );
              calculateResults(payments, updatedReceipts);
            } catch (error) {
              console.error("Error deleting receipt:", error);
            }
          },
        },
      ]
    );
  };

  const calculateInterestWithAnnualCompounding = (
    principal: number,
    rate: number,
    startDate: Date,
    endDate: Date
  ): { interest: number; finalPrincipal: number } => {
    if (principal <= 0) return { interest: 0, finalPrincipal: principal };

    // Normalize dates to start of day for accurate calculation
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    // Calculate total days (exclusive: June 29 to Oct 27 = 120 days)
    const totalDays = Math.floor(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (totalDays <= 0) return { interest: 0, finalPrincipal: principal };

    let currentPrincipal = principal;
    let totalInterest = 0;
    let currentDate = new Date(start);
    const originalStart = new Date(start);

    // Process year by year, compounding at anniversaries
    while (currentDate < end) {
      // Calculate next year anniversary
      const yearsElapsed = Math.floor(
        (currentDate.getTime() - originalStart.getTime()) /
          (1000 * 60 * 60 * 24 * 365)
      );
      const nextAnniversary = new Date(originalStart);
      nextAnniversary.setFullYear(
        originalStart.getFullYear() + yearsElapsed + 1
      );
      nextAnniversary.setHours(0, 0, 0, 0);

      // Period ends at anniversary or final date, whichever comes first
      const periodEnd = nextAnniversary <= end ? nextAnniversary : end;

      // Calculate days in this period
      const daysInPeriod = Math.floor(
        (periodEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysInPeriod <= 0) break;

      // Calculate simple interest: (Principal × Rate × Days) / (100 × 360) - using 360 day year
      const periodInterest =
        (currentPrincipal * rate * daysInPeriod) / (100 * 360);
      totalInterest += periodInterest;

      // If we hit a year anniversary, compound (add interest to principal)
      if (periodEnd.getTime() === nextAnniversary.getTime()) {
        currentPrincipal += periodInterest;
        // Start next year from day after anniversary
        currentDate = new Date(nextAnniversary);
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
      } else {
        // Period ended before anniversary (reached final date)
        break;
      }
    }

    return { interest: totalInterest, finalPrincipal: currentPrincipal };
  };

  const calculateResults = useCallback(
    (currentPayments: Transaction[], currentReceipts: Transaction[]) => {
      if (!interestRate || parseFloat(interestRate) <= 0) {
        setCalculatedInterest(0);
        setCalculatedAmount(0);
        setLoanAmount(0);
        return;
      }

      const rate = parseFloat(interestRate) / 100;
      const today = new Date();

      // Combine and sort all transactions by date
      const allTransactions = [
        ...currentPayments.map((t) => ({ ...t, type: "payment" as const })),
        ...currentReceipts.map((t) => ({ ...t, type: "receipt" as const })),
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let principal = 0;
      let totalInterest = 0;
      let lastCalculationDate: Date | null = null;
      const periods: {
        transactionId: string;
        days: number;
        interest: number;
        principalBefore: number;
        finalPeriodDays: number;
        finalPeriodInterest: number;
        finalPrincipalBefore: number;
      }[] = [];

      // Process each transaction chronologically
      for (const transaction of allTransactions) {
        const transactionDate = new Date(transaction.date);

        // Calculate interest up to this transaction date
        if (lastCalculationDate && principal > 0) {
          const principalBeforePeriod = principal;
          const result = calculateInterestWithAnnualCompounding(
            principalBeforePeriod,
            rate * 100,
            lastCalculationDate,
            transactionDate
          );
          totalInterest += result.interest;
          principal = result.finalPrincipal;

          // Store period details
          const days = Math.floor(
            (transactionDate.getTime() - lastCalculationDate.getTime()) /
              (1000 * 60 * 60 * 24)
          );
          periods.push({
            transactionId: transaction.id,
            days,
            interest: result.interest,
            principalBefore: principalBeforePeriod,
            finalPeriodDays: 0,
            finalPeriodInterest: 0,
            finalPrincipalBefore: 0,
          });
        } else {
          // First transaction - no interest period
          periods.push({
            transactionId: transaction.id,
            days: 0,
            interest: 0,
            principalBefore: 0,
            finalPeriodDays: 0,
            finalPeriodInterest: 0,
            finalPrincipalBefore: 0,
          });
        }

        // Update principal based on transaction type
        if (transaction.type === "payment") {
          principal -= transaction.amount; // Payments reduce the loan
        } else {
          principal += transaction.amount; // Receipts increase the loan
        }

        lastCalculationDate = transactionDate;
      }

      // Calculate interest from last transaction to today
      let finalPeriodDays = 0;
      let finalPeriodInterest = 0;
      let finalPrincipalBeforeForDisplay = 0;
      if (lastCalculationDate && principal > 0) {
        const principalBeforeFinal = principal;
        const result = calculateInterestWithAnnualCompounding(
          principalBeforeFinal,
          rate * 100,
          lastCalculationDate,
          today
        );
        totalInterest += result.interest;
        principal = result.finalPrincipal;
        finalPeriodDays = Math.floor(
          (today.getTime() - lastCalculationDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        finalPeriodInterest = result.interest;
        finalPrincipalBeforeForDisplay = principalBeforeFinal;
      }

      // Store period info - include final period for last transaction
      const periodInfo = periods.map((p, idx) => {
        if (idx === periods.length - 1 && finalPeriodDays > 0) {
          // For last transaction, also store final period info separately
          return {
            ...p,
            finalPeriodDays: finalPeriodDays,
            finalPeriodInterest: finalPeriodInterest,
            finalPrincipalBefore: finalPrincipalBeforeForDisplay,
          };
        }
        return {
          ...p,
          finalPeriodDays: 0,
          finalPeriodInterest: 0,
          finalPrincipalBefore: 0,
        };
      });

      setTransactionPeriods(periodInfo);

      // If no transactions, principal is 0
      if (allTransactions.length === 0) {
        principal = 0;
      }

      // Calculate details for debugging
      let details = "";
      if (allTransactions.length > 0) {
        const firstTransaction = allTransactions[0];
        const firstDate = new Date(firstTransaction.date);
        const today = new Date();
        const daysFromFirst = Math.floor(
          (today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        details = `From ${firstDate.toLocaleDateString()} to ${today.toLocaleDateString()}: ${daysFromFirst} days`;
      }

      setLoanAmount(principal);
      setCalculatedInterest(totalInterest);
      setCalculatedAmount(principal);
      setCalculationDetails(details);
    },
    [interestRate]
  );

  // Recalculate when interest rate, payments, or receipts change
  useEffect(() => {
    calculateResults(payments, receipts);
  }, [interestRate, payments, receipts, calculateResults]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-4">
        <View className="mb-6">
          <Text variant="h2" className="mb-4">
            Money Lender App
          </Text>

          <Input
            label="Loan Interest Rate per Year (%) - 360 Day Year"
            value={interestRate}
            onChangeText={(text) => {
              setInterestRate(text);
              saveInterestRate(text);
            }}
            keyboardType="numeric"
            placeholder="Enter interest rate (e.g., 10)"
            className="mb-4"
          />
        </View>

        {/* Results Display */}
        {calculatedInterest > 0 || loanAmount !== 0 ? (
          <View className="mb-6 p-4 bg-muted rounded-lg">
            <Text variant="h3" className="mb-2">
              Calculated Results
            </Text>
            <Text className="mb-1">
              {`Loan Amount: ₹${formatCurrency(loanAmount)}`}
            </Text>
            <Text className="mb-1">
              {`Interest (360 day year, compounded annually): ₹${formatCurrency(calculatedInterest)}`}
            </Text>
            <Text variant="h4" className="mt-2">
              {`Total Amount Due: ₹${formatCurrency(calculatedAmount)}`}
            </Text>
            {calculationDetails ? (
              <Text className="mt-2 text-xs text-muted-foreground">
                {calculationDetails}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Transactions Summary (Combined) */}
        {payments.length > 0 || receipts.length > 0 ? (
          <View className="mb-6">
            <Text variant="h3" className="mb-2">
              Transactions ({String(payments.length + receipts.length)})
            </Text>

            <View>
              {[
                ...payments.map((t) => ({ ...t, type: "payment" as const })),
                ...receipts.map((t) => ({ ...t, type: "receipt" as const })),
              ]
                .sort(
                  (a, b) =>
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                )
                .map((tx, index) => {
                  const period = transactionPeriods.find(
                    (p) => p.transactionId === tx.id
                  );
                  const prevTx =
                    index > 0
                      ? [
                          ...payments.map((t) => ({
                            ...t,
                            type: "payment" as const,
                          })),
                          ...receipts.map((t) => ({
                            ...t,
                            type: "receipt" as const,
                          })),
                        ].sort(
                          (a, b) =>
                            new Date(a.date).getTime() -
                            new Date(b.date).getTime()
                        )[index - 1]
                      : null;

                  return (
                    <View
                      key={`${tx.id}-${tx.date}`}
                      className={`mb-2 p-2 rounded ${tx.type === "payment" ? "bg-red-50" : "bg-green-50"}`}
                    >
                      <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-1">
                          <Text className="text-sm font-semibold">
                            {`${tx.type === "payment" ? "-" : "+"} ₹${formatCurrency(tx.amount)}`}
                          </Text>
                          <Text className="text-xs text-muted-foreground">
                            {tx.date
                              ? new Date(tx.date).toLocaleDateString()
                              : "N/A"}
                          </Text>
                        </View>
                        <View className="flex-row gap-2">
                          {tx.type === "payment" ? (
                            <>
                              <Button
                                variant="outline"
                                className="px-3 py-1"
                                onPress={() => handleEditPayment(tx)}
                              >
                                <Text className="text-xs">Edit</Text>
                              </Button>
                              <Button
                                variant="destructive"
                                className="px-3 py-1"
                                onPress={() => handleDeletePayment(tx.id)}
                              >
                                <Text className="text-xs text-white">
                                  Delete
                                </Text>
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                className="px-3 py-1"
                                onPress={() => handleEditReceipt(tx)}
                              >
                                <Text className="text-xs">Edit</Text>
                              </Button>
                              <Button
                                variant="destructive"
                                className="px-3 py-1"
                                onPress={() => handleDeleteReceipt(tx.id)}
                              >
                                <Text className="text-xs text-white">
                                  Delete
                                </Text>
                              </Button>
                            </>
                          )}
                        </View>
                      </View>

                      {period &&
                      (period.days > 0 || period.finalPeriodDays > 0) ? (
                        <View className="mt-2 pt-2 border-t border-gray-200">
                          {period.days > 0 ? (
                            <>
                              <Text className="text-xs text-muted-foreground">
                                Principal before: ₹
                                {formatCurrency(period.principalBefore)}
                              </Text>
                              <Text className="text-xs text-muted-foreground">
                                Days: {period.days} | Interest: ₹
                                {formatCurrency(period.interest)}
                              </Text>
                            </>
                          ) : null}
                          {period.finalPeriodDays > 0 ? (
                            <>
                              <Text className="text-xs text-muted-foreground">
                                Principal before: ₹
                                {formatCurrency(period.finalPrincipalBefore)}
                              </Text>
                              <Text className="text-xs text-muted-foreground">
                                Days: {period.finalPeriodDays} | Interest: ₹
                                {formatCurrency(period.finalPeriodInterest)}
                              </Text>
                            </>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Action Buttons */}
      <View className="flex-row justify-between w-full px-4 py-4 border-t border-border">
        <Button
          className="bg-red-600 flex-1 mr-2"
          onPress={() => setShowPaymentModal(true)}
        >
          <Text className="text-white">Payment</Text>
        </Button>
        <Button
          className="bg-green-600 flex-1 mx-2"
          onPress={() => setShowReceiptModal(true)}
        >
          <Text className="text-white">Receipt</Text>
        </Button>
        <Button
          variant="destructive"
          className="flex-1 ml-2"
          onPress={handleClearData}
        >
          <Text className="text-white">Clear</Text>
        </Button>
      </View>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setShowPaymentDatePicker(false);
          setEditingPaymentId(null);
          setPaymentAmount("");
          setPaymentDate(new Date());
        }}
        title={editingPaymentId ? "Edit Payment" : "Add Payment"}
      >
        <View className="pb-4">
          <Input
            label="Payment Amount (₹)"
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            keyboardType="numeric"
            placeholder="Enter amount"
            className="mb-4"
          />

          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium">Payment Date</Text>
            <Button
              variant="outline"
              onPress={() => setShowPaymentDatePicker(true)}
            >
              <Text>
                {paymentDate
                  ? paymentDate.toLocaleDateString()
                  : new Date().toLocaleDateString()}
              </Text>
            </Button>
            {showPaymentDatePicker ? (
              <DateTimePicker
                value={paymentDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, selectedDate) => {
                  setShowPaymentDatePicker(Platform.OS === "ios");
                  if (selectedDate) {
                    setPaymentDate(selectedDate);
                  }
                }}
              />
            ) : null}
          </View>

          <Button
            className="bg-red-600 mt-4"
            onPress={handlePaymentSubmit}
            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
          >
            <Text className="text-white">
              {editingPaymentId ? "Update Payment" : "Submit Payment"}
            </Text>
          </Button>
        </View>
      </Modal>

      {/* Receipt Modal */}
      <Modal
        visible={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          setShowReceiptDatePicker(false);
          setEditingReceiptId(null);
          setReceiptAmount("");
          setReceiptDate(new Date());
        }}
        title={editingReceiptId ? "Edit Receipt" : "Add Receipt"}
      >
        <View className="pb-4">
          <Input
            label="Receipt Amount (₹)"
            value={receiptAmount}
            onChangeText={setReceiptAmount}
            keyboardType="numeric"
            placeholder="Enter amount"
            className="mb-4"
          />

          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium">Receipt Date</Text>
            <Button
              variant="outline"
              onPress={() => setShowReceiptDatePicker(true)}
            >
              <Text>
                {receiptDate
                  ? receiptDate.toLocaleDateString()
                  : new Date().toLocaleDateString()}
              </Text>
            </Button>
            {showReceiptDatePicker ? (
              <DateTimePicker
                value={receiptDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, selectedDate) => {
                  setShowReceiptDatePicker(Platform.OS === "ios");
                  if (selectedDate) {
                    setReceiptDate(selectedDate);
                  }
                }}
              />
            ) : null}
          </View>

          <Button
            className="bg-green-600 mt-4"
            onPress={handleReceiptSubmit}
            disabled={!receiptAmount || parseFloat(receiptAmount) <= 0}
          >
            <Text className="text-white">
              {editingReceiptId ? "Update Receipt" : "Submit Receipt"}
            </Text>
          </Button>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
