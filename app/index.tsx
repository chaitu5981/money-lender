import { CalculatedResults } from "@/components/calculations/CalculatedResults";
import { TransactionModal } from "@/components/transactions/TransactionModal";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useStorage } from "@/lib/hooks/useStorage";
import { useTheme } from "@/lib/theme-context";
import { Transaction } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import {
  addCalendarYears,
  diffDaysExclusive,
  startOfDay,
} from "@/lib/utils/date";
import {
  combineTransactionsByDate,
  sortCombinedTransactions,
  sortTransactionsByDate,
} from "@/lib/utils/transactions";
import { validateInterestRateInput } from "@/lib/utils/validation";
import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, ScrollView, StatusBar, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  const { colorScheme, toggleTheme } = useTheme();
  const {
    interestRate,
    payments,
    receipts,
    calculationEndDate,
    isLoading,
    setInterestRate,
    setPayments,
    setReceipts,
    setCalculationEndDate,
    saveInterestRate,
    saveCalculationEndDate,
    savePayments,
    saveReceipts,
    clearAllData,
  } = useStorage();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Editing transaction state - keep in sync with modal visibility
  const [editingPayment, setEditingPayment] = useState<Transaction | null>(
    null
  );
  const [editingReceipt, setEditingReceipt] = useState<Transaction | null>(
    null
  );

  // Results
  const [calculatedInterest, setCalculatedInterest] = useState<number>(0); // Interest for "Total Amount Due" section
  const [calculatedResultsInterest, setCalculatedResultsInterest] =
    useState<number>(0); // Interest for "Calculated Results" section (Total Amount Due - Outstanding Principal)
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);
  const [loanAmount, setLoanAmount] = useState<number>(0); // Outstanding principal (total borrowals - total repayments) for "Calculated Results"
  const [currentPrincipalForTotal, setCurrentPrincipalForTotal] =
    useState<number>(0); // Principal from last cell for "Total Amount Due"
  const [calculationDetails, setCalculationDetails] = useState<string>("");
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [calculationSuccessful, setCalculationSuccessful] =
    useState<boolean>(false);
  const [yearSummaries, setYearSummaries] = useState<
    {
      yearNumber: number;
      fromDate: string;
      toDate: string;
      interest: number;
      newPrincipal: number;
    }[]
  >([]);
  const [transactionPeriods, setTransactionPeriods] = useState<
    {
      transactionId: string;
      days: number;
      interest: number;
      principalBefore: number;
      fromDate?: string;
      toDate?: string;
      finalPeriodDays: number;
      finalPeriodInterest: number;
      finalPrincipalBefore: number;
      finalFromDate?: string;
      finalToDate?: string;
    }[]
  >([]);

  // Data is loaded via useStorage hook

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
            await clearAllData();
            setTransactionPeriods([]);
            setYearSummaries([]);
            setCalculatedInterest(0);
            setCalculatedResultsInterest(0);
            setCalculatedAmount(0);
            setLoanAmount(0);
            setCurrentPrincipalForTotal(0);
            setCalculationDetails("");
            setHasCalculated(false);
          },
        },
      ]
    );
  };

  // Helper functions are imported from lib/utils

  const handlePaymentSubmit = async (
    amount: string,
    date: Date,
    editingId: string | null
  ) => {
    if (!amount || parseFloat(amount) <= 0) return;

    // Validate: Transaction date cannot be after "calculate interest upto" date
    if (calculationEndDate) {
      const txDate = startOfDay(date);
      const calcDate = startOfDay(calculationEndDate);
      if (txDate.getTime() > calcDate.getTime()) {
        Alert.alert(
          "Invalid Date",
          `Transaction date cannot be after the "Calculate interest up to" date (${calculationEndDate.toLocaleDateString()})`
        );
        return;
      }
    }

    // Validate: First transaction (chronologically) must be a borrowal, not a repayment
    const allTransactions = [
      ...payments.map((t) => ({ ...t, type: "payment" as const })),
      ...receipts.map((t) => ({ ...t, type: "receipt" as const })),
    ];

    // Create a temporary transaction for the new/updated payment
    const tempPayment: Transaction = editingId
      ? {
          id: editingId,
          amount: parseFloat(amount),
          date: date.toISOString(),
          type: "payment",
        }
      : {
          id: "temp",
          amount: parseFloat(amount),
          date: date.toISOString(),
          type: "payment",
        };

    // Remove the payment being edited from the list (if editing)
    const transactionsWithoutCurrent = editingId
      ? allTransactions.filter((t) => t.id !== editingId)
      : allTransactions;

    // Add the new/updated payment
    const allTransactionsWithNew = [...transactionsWithoutCurrent, tempPayment];

    // Sort chronologically
    const sortedTransactions = sortTransactionsByDate(allTransactionsWithNew);

    // Check if the first transaction is a payment (repayment)
    if (
      sortedTransactions.length > 0 &&
      sortedTransactions[0].type === "payment"
    ) {
      Alert.alert(
        "Invalid Transaction",
        "The first transaction (chronologically) must be a borrowal, not a repayment. Please add a borrowal first or change the date of this repayment."
      );
      return;
    }

    let updatedPayments: Transaction[];

    if (editingId) {
      // Update existing payment
      updatedPayments = payments.map((payment) =>
        payment.id === editingId
          ? {
              ...payment,
              amount: parseFloat(amount),
              date: date.toISOString(),
            }
          : payment
      );
    } else {
      // Create new payment
      const newPayment: Transaction = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        amount: parseFloat(amount),
        date: date.toISOString(),
        type: "payment",
      };
      updatedPayments = [...payments, newPayment];
    }

    updatedPayments = sortTransactionsByDate(updatedPayments);
    await savePayments(updatedPayments);

    // Recalculate
    calculateResults(updatedPayments, receipts);
  };

  const handleEditPayment = (payment: Transaction) => {
    // Set editing payment first, then open modal
    setEditingPayment(payment);
    setShowPaymentModal(true);
  };

  const handleDeletePayment = async (paymentId: string) => {
    Alert.alert(
      "Delete Repayment",
      "Are you sure you want to delete this repayment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updatedPayments = payments.filter((p) => p.id !== paymentId);
            await savePayments(updatedPayments);
            if (
              calculationEndDate &&
              interestRate &&
              parseFloat(interestRate) > 0
            ) {
              calculateResults(updatedPayments, receipts);
            }
          },
        },
      ]
    );
  };

  const handleReceiptSubmit = async (
    amount: string,
    date: Date,
    editingId: string | null
  ) => {
    if (!amount || parseFloat(amount) <= 0) return;

    // Validate: Transaction date cannot be after "calculate interest upto" date
    if (calculationEndDate) {
      const txDate = startOfDay(date);
      const calcDate = startOfDay(calculationEndDate);
      if (txDate.getTime() > calcDate.getTime()) {
        Alert.alert(
          "Invalid Date",
          `Transaction date cannot be after the "Calculate interest up to" date (${calculationEndDate.toLocaleDateString()})`
        );
        return;
      }
    }

    // Validate: If editing a receipt and changing its date, ensure first transaction is still a borrowal
    if (editingId) {
      const allTransactions = [
        ...payments.map((t) => ({ ...t, type: "payment" as const })),
        ...receipts.map((t) => ({ ...t, type: "receipt" as const })),
      ];

      // Create a temporary receipt for the updated receipt
      const tempReceipt: Transaction = {
        id: editingId,
        amount: parseFloat(amount),
        date: date.toISOString(),
        type: "receipt",
      };

      // Remove the receipt being edited from the list
      const transactionsWithoutCurrent = allTransactions.filter(
        (t) => t.id !== editingId
      );

      // Add the updated receipt
      const allTransactionsWithUpdated = [
        ...transactionsWithoutCurrent,
        tempReceipt,
      ];

      // Sort chronologically
      const sortedTransactions = sortTransactionsByDate(
        allTransactionsWithUpdated
      );

      // Check if the first transaction is a payment (repayment)
      if (
        sortedTransactions.length > 0 &&
        sortedTransactions[0].type === "payment"
      ) {
        Alert.alert(
          "Invalid Transaction",
          "The first transaction (chronologically) must be a borrowal, not a repayment. Please change the date of this borrowal or ensure there's a borrowal before the first repayment."
        );
        return;
      }
    }

    let updatedReceipts: Transaction[];

    if (editingId) {
      // Update existing receipt
      updatedReceipts = receipts.map((receipt) =>
        receipt.id === editingId
          ? {
              ...receipt,
              amount: parseFloat(amount),
              date: date.toISOString(),
            }
          : receipt
      );
    } else {
      // Create new receipt
      const newReceipt: Transaction = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        amount: parseFloat(amount),
        date: date.toISOString(),
        type: "receipt",
      };
      updatedReceipts = [...receipts, newReceipt];
    }

    updatedReceipts = sortTransactionsByDate(updatedReceipts);
    await saveReceipts(updatedReceipts);

    // Recalculate
    calculateResults(payments, updatedReceipts);
  };

  const handleEditReceipt = (receipt: Transaction) => {
    // Set editing receipt first, then open modal
    setEditingReceipt(receipt);
    setShowReceiptModal(true);
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    // Validate: Check if deleting this receipt would leave a payment as the first transaction
    const receiptToDelete = receipts.find((r) => r.id === receiptId);
    if (receiptToDelete) {
      const allTransactions = [
        ...payments.map((t) => ({ ...t, type: "payment" as const })),
        ...receipts.map((t) => ({ ...t, type: "receipt" as const })),
      ];

      // Remove the receipt being deleted
      const transactionsAfterDelete = allTransactions.filter(
        (t) => t.id !== receiptId
      );

      // Sort chronologically
      const sortedTransactions = sortTransactionsByDate(
        transactionsAfterDelete
      );

      // Check if the first transaction would be a payment (repayment)
      if (
        sortedTransactions.length > 0 &&
        sortedTransactions[0].type === "payment"
      ) {
        Alert.alert(
          "Cannot Delete",
          "Cannot delete this borrowal because it would leave a repayment as the first transaction. The first transaction (chronologically) must be a borrowal."
        );
        return;
      }
    }

    Alert.alert(
      "Delete Borrowal",
      "Are you sure you want to delete this borrowal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updatedReceipts = receipts.filter((r) => r.id !== receiptId);
            await saveReceipts(updatedReceipts);
            if (
              calculationEndDate &&
              interestRate &&
              parseFloat(interestRate) > 0
            ) {
              calculateResults(payments, updatedReceipts);
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
        setCalculatedResultsInterest(0);
        setCalculatedAmount(0);
        setLoanAmount(0);
        setCurrentPrincipalForTotal(0);
        return;
      }

      const rate = parseFloat(interestRate) / 100;
      const today = calculationEndDate
        ? startOfDay(new Date(calculationEndDate))
        : startOfDay(new Date());

      // For calculation/report: Combine transactions on the same day into a single net transaction
      // This ensures that multiple transactions on the same day are treated as one transaction
      // Net amount = sum of borrowals - sum of repayments
      // If net <= 0, it's a repayment; if net > 0, it's a borrowal
      const allTransactionsForCalculation = combineTransactionsByDate([
        ...currentPayments.map((t) => ({ ...t, type: "payment" as const })),
        ...currentReceipts.map((t) => ({ ...t, type: "receipt" as const })),
      ]);

      // Use combined transactions for calculation
      const allTransactions = allTransactionsForCalculation;

      let principal = 0;
      let totalInterest = 0;
      let lastCalculationDate: Date | null = null;
      const periods: {
        transactionId: string;
        days: number;
        interest: number;
        principalBefore: number;
        fromDate?: string;
        toDate?: string;
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
            startOfDay(lastCalculationDate),
            startOfDay(transactionDate)
          );
          totalInterest += result.interest;
          principal = result.finalPrincipal;

          // Store period details
          const days = diffDaysExclusive(lastCalculationDate, transactionDate);
          periods.push({
            transactionId: transaction.id,
            days,
            interest: result.interest,
            principalBefore: principalBeforePeriod,
            fromDate: startOfDay(lastCalculationDate).toISOString(),
            toDate: startOfDay(transactionDate).toISOString(),
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
            fromDate: undefined,
            toDate: undefined,
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

      // Defer final-period computation until after yearly summaries
      let finalPeriodDays = 0;
      let finalPeriodInterest = 0;
      let finalPrincipalBeforeForDisplay = 0;

      // Store period info - include final period for last transaction
      const periodInfo = periods.map((p) => ({
        ...p,
        finalPeriodDays: 0,
        finalPeriodInterest: 0,
        finalPrincipalBefore: 0,
        finalFromDate: undefined,
        finalToDate: undefined,
      }));

      setTransactionPeriods(periodInfo);

      // Build yearly summaries on calendar-year anniversaries from first transaction
      const summaries: {
        yearNumber: number;
        fromDate: string;
        toDate: string;
        interest: number;
        newPrincipal: number;
      }[] = [];

      if (allTransactions.length > 0) {
        const firstDate = startOfDay(new Date(allTransactions[0].date));
        const endDate = calculationEndDate
          ? startOfDay(new Date(calculationEndDate))
          : startOfDay(new Date());

        // Generate anniversary checkpoints every 1 calendar year
        const anniversaries: Date[] = [];
        let next = addCalendarYears(firstDate, 1);
        while (next <= endDate) {
          anniversaries.push(startOfDay(next));
          next = addCalendarYears(next, 1);
        }

        if (anniversaries.length > 0) {
          // Build unified event list: anniversaries and transactions
          type Event =
            | { type: "anniv"; date: Date }
            | { type: "tx"; date: Date; tx: (typeof allTransactions)[number] };
          const events: Event[] = [
            ...anniversaries.map((d) => ({ type: "anniv" as const, date: d })),
            ...allTransactions.map((t) => ({
              type: "tx" as const,
              date: startOfDay(new Date(t.date)),
              tx: t,
            })),
          ].sort((a, b) => {
            const dateA = a.date.getTime();
            const dateB = b.date.getTime();
            if (dateA !== dateB) {
              return dateA - dateB;
            }
            // Same date: anniversaries come first, then receipts (borrowals) before payments (repayments)
            if (a.type === "anniv" && b.type === "tx") return -1;
            if (a.type === "tx" && b.type === "anniv") return 1;
            if (a.type === "tx" && b.type === "tx") {
              const typeA = a.tx.type === "receipt" ? 0 : 1;
              const typeB = b.tx.type === "receipt" ? 0 : 1;
              return typeA - typeB;
            }
            return 0;
          });

          let currentPrincipalForYearSim = 0;
          let lastDate = firstDate;
          let currentYearStart = firstDate;
          let yearAccrued = 0;
          let yearNumber = 1;

          for (const event of events) {
            let segmentInterest = 0;
            let segmentFrom: Date | null = null;
            if (
              lastDate &&
              event.date > lastDate &&
              currentPrincipalForYearSim > 0
            ) {
              const before = currentPrincipalForYearSim;
              const res = calculateInterestWithAnnualCompounding(
                before,
                rate * 100,
                startOfDay(lastDate),
                startOfDay(event.date)
              );
              segmentInterest = res.interest;
              segmentFrom = lastDate;
              yearAccrued += res.interest;
              currentPrincipalForYearSim = res.finalPrincipal;
            }

            if (event.type === "anniv") {
              // Compute principal before the final segment in this year by applying in-year txs
              // For Year 1: Include transactions from year start (inclusive) up to and including the anniversary date
              // For Year 2+: Include transactions AFTER year start (exclusive) up to and including the anniversary date
              // Transactions on the year start date (previous year's anniversary) belong to the previous year, not the current year
              const prevSummary =
                summaries.length > 0 ? summaries[summaries.length - 1] : null;
              const isYear1 = !prevSummary;
              const yearTxsForPrincipal = allTransactions
                .filter((t) => {
                  const txDate = startOfDay(new Date(t.date));
                  const txTime = txDate.getTime();
                  const yearStartTime = currentYearStart.getTime();
                  const anniversaryTime = startOfDay(event.date).getTime();
                  // For Year 1: include transactions on or after year start
                  // For Year 2+: exclude transactions on year start (they belong to previous year)
                  if (isYear1) {
                    return txTime >= yearStartTime && txTime <= anniversaryTime;
                  } else {
                    return txTime > yearStartTime && txTime <= anniversaryTime;
                  }
                })
                .sort(
                  (a, b) =>
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                );
              // Start from previous year's new principal (prevSummary already declared above)

              // Year summary interest should be the sum of ALL interest periods in this year
              // Recalculate to ensure it matches what's displayed in cells
              // Start from previous year's new principal and calculate all interest periods in this year
              let recalculatedTotalInterest = 0;
              const initialPrincipal = prevSummary
                ? prevSummary.newPrincipal
                : 0; // Store original principal
              let calcPrincipal = initialPrincipal;
              let lastCalcDate = currentYearStart;

              // Process all transactions and calculate interest for each period
              // Calculate interest between transactions, EXCEPT when repayment is on anniversary date
              // The special handling (no interest) only applies to repayments on anniversary date
              // Track the principal displayed in the last interest cell (for repayments on anniversary)
              // Track principal after each transaction (before interest) for the last cell
              let lastDisplayedPrincipalForCalc = calcPrincipal;
              let principalAfterTxForCalc = calcPrincipal; // Track principal after each transaction (before interest)
              let principalBeforeLastInterestCalc = calcPrincipal; // Track principal before the last interest calculation
              let principalAfterLastTxOnAnniversary: number | null = null; // Track principal after last transaction if it's on anniversary (0-day cell)
              let transactionIndex = 0; // Track transaction index to identify first transaction
              for (const t of yearTxsForPrincipal) {
                const txDate = startOfDay(new Date(t.date));

                // Check if current transaction is a REPAYMENT on the anniversary date
                // If repayment is on anniversary date, don't calculate interest from previous tx to repayment date
                const isRepaymentOnAnniversary =
                  t.type === "payment" &&
                  txDate.getTime() === startOfDay(event.date).getTime();

                // Calculate interest even if calcPrincipal is 0 (will result in 0 interest, but matches displayed cells)
                // Also calculate interest even if dates are the same (0 days, 0 interest) to match displayed cells)
                // If principal is 0 or negative, interest will be 0, but we still calculate to match displayed cells
                // IMPORTANT: For the first transaction, we ALWAYS calculate interest from year start to that transaction
                // (matching the rendering loop which shows interest from year start to first transaction, even if it's a repayment on anniversary)
                // For subsequent transactions, we skip interest calculation if repayment is on anniversary
                const isFirstTransaction = transactionIndex === 0;

                // Always calculate interest for first transaction (even if repayment on anniversary)
                // For other transactions, calculate interest unless it's a repayment on anniversary
                // CRITICAL: For first transaction, we MUST calculate interest from year start, regardless of whether it's a repayment on anniversary
                if (isFirstTransaction) {
                  // First transaction: ALWAYS calculate interest from year start to this transaction
                  // Use calcPrincipal (principal at year start) for interest calculation
                  const principalForInterest = Math.max(0, calcPrincipal);
                  let res;

                  // Always calculate interest from year start (lastCalcDate) to first transaction date
                  // This matches the rendering loop which always shows interest from year start to first transaction
                  if (lastCalcDate.getTime() < txDate.getTime()) {
                    // There's a gap - calculate interest
                    res = calculateInterestWithAnnualCompounding(
                      principalForInterest,
                      rate * 100,
                      lastCalcDate,
                      txDate
                    );
                  } else {
                    // Same date - 0 interest
                    res = { interest: 0, finalPrincipal: principalForInterest };
                  }

                  // CRITICAL: Always add interest for first transaction to recalculatedTotalInterest
                  // This ensures the interest from year start to first transaction is included in the year summary
                  recalculatedTotalInterest += res.interest;
                  // Track the principal displayed in this interest cell
                  lastDisplayedPrincipalForCalc = principalForInterest;
                  // Track principal before this interest calculation (for year summary)
                  principalBeforeLastInterestCalc = principalForInterest;
                  // Update calcPrincipal with interest for next period
                  const principalToCheck = principalForInterest;
                  if (
                    principalToCheck > 0 &&
                    lastCalcDate.getTime() < txDate.getTime()
                  ) {
                    calcPrincipal = res.finalPrincipal;
                  } else {
                    calcPrincipal = principalForInterest;
                  }

                  // SPECIAL CASE: If this is the ONLY transaction and it's on year start,
                  // we need to calculate interest from year start to anniversary
                  // This handles the case where there's only 1 transaction in the year
                  if (
                    yearTxsForPrincipal.length === 1 &&
                    txDate.getTime() === currentYearStart.getTime()
                  ) {
                    // Only one transaction on year start - calculate interest from year start to anniversary
                    // Use principal AFTER the first transaction for this calculation
                    // Apply the transaction to get the principal after it
                    const principalAfterFirstTx =
                      t.type === "payment"
                        ? Math.max(0, principalForInterest - t.amount)
                        : principalForInterest + t.amount;
                    const fullYearRes = calculateInterestWithAnnualCompounding(
                      principalAfterFirstTx,
                      rate * 100,
                      currentYearStart,
                      startOfDay(event.date)
                    );
                    // Replace the 0 interest with the full year interest
                    recalculatedTotalInterest = fullYearRes.interest;
                    calcPrincipal = fullYearRes.finalPrincipal;
                    lastDisplayedPrincipalForCalc = principalAfterFirstTx;
                    // Track principal before this interest calculation (for year summary)
                    principalBeforeLastInterestCalc = principalAfterFirstTx;
                    // Update principalAfterTxForCalc to reflect the transaction
                    principalAfterTxForCalc = principalAfterFirstTx;
                  }
                } else if (!isRepaymentOnAnniversary) {
                  // Not first transaction AND not a repayment on anniversary: calculate interest
                  // SPECIAL CASE: If first transaction was on year start and this transaction is on anniversary,
                  // calculate interest from year start to anniversary using initial principal
                  const firstTx = yearTxsForPrincipal[0];
                  const firstTxDate = firstTx
                    ? startOfDay(new Date(firstTx.date))
                    : null;
                  const firstTxOnYearStart =
                    firstTxDate &&
                    firstTxDate.getTime() === currentYearStart.getTime();
                  const isSecondTxOnAnniversary =
                    transactionIndex === 1 &&
                    txDate.getTime() === startOfDay(event.date).getTime();

                  let principalForInterest: number;
                  let interestFromDate: Date;

                  if (
                    firstTxOnYearStart &&
                    isSecondTxOnAnniversary &&
                    initialPrincipal > 0
                  ) {
                    // First transaction on year start, second on anniversary, and we have initial principal
                    // Calculate interest from year start to anniversary using initial principal
                    // This ensures we calculate interest for the full year period
                    principalForInterest = Math.max(0, initialPrincipal);
                    interestFromDate = currentYearStart;
                  } else {
                    // Normal case: use principal after previous transaction
                    principalForInterest = Math.max(0, principalAfterTxForCalc);
                    interestFromDate = lastCalcDate;
                  }

                  let res;

                  if (interestFromDate.getTime() < txDate.getTime()) {
                    // There's a gap - calculate interest
                    res = calculateInterestWithAnnualCompounding(
                      principalForInterest,
                      rate * 100,
                      interestFromDate,
                      txDate
                    );
                  } else {
                    // Same date - 0 interest
                    res = { interest: 0, finalPrincipal: principalForInterest };
                  }

                  recalculatedTotalInterest += res.interest;
                  // Track the principal displayed in this interest cell
                  lastDisplayedPrincipalForCalc = principalForInterest;
                  // Track principal before this interest calculation (for year summary)
                  principalBeforeLastInterestCalc = principalForInterest;
                  // Update calcPrincipal with interest for next period
                  // Use principalAfterTxForCalc (principal after previous transaction, before interest)
                  // But if we calculated from year start using initial principal, use that for updating
                  if (
                    firstTxOnYearStart &&
                    isSecondTxOnAnniversary &&
                    initialPrincipal > 0
                  ) {
                    // We calculated from year start using initial principal
                    // Update calcPrincipal based on the interest calculation result
                    if (
                      principalForInterest > 0 &&
                      interestFromDate.getTime() < txDate.getTime()
                    ) {
                      calcPrincipal = res.finalPrincipal;
                    } else {
                      calcPrincipal = principalForInterest;
                    }
                  } else if (
                    principalAfterTxForCalc > 0 &&
                    interestFromDate.getTime() < txDate.getTime()
                  ) {
                    calcPrincipal = res.finalPrincipal;
                  } else {
                    calcPrincipal = principalAfterTxForCalc;
                  }
                } else {
                  // Repayment is on anniversary date (and NOT the first transaction)
                  // CRITICAL FIX: We still need to calculate interest from previous transaction to anniversary
                  // The interest should be included in the year summary even if the repayment is on the anniversary
                  // SPECIAL CASE: If first transaction was on year start date, calculate interest from year start
                  // using initial principal, not from first transaction using principal after first transaction

                  // Check if first transaction was on year start date
                  const firstTx = yearTxsForPrincipal[0];
                  const firstTxDate = firstTx
                    ? startOfDay(new Date(firstTx.date))
                    : null;
                  const firstTxOnYearStart =
                    firstTxDate &&
                    firstTxDate.getTime() === currentYearStart.getTime();

                  let principalForInterest: number;
                  let interestStartDate: Date;

                  if (firstTxOnYearStart && transactionIndex === 1) {
                    // First transaction was on year start, and this is the second transaction (on anniversary)
                    // CRITICAL: Calculate interest from first transaction date to anniversary
                    // The principal to use is the one AFTER the first transaction has been applied
                    // This is stored in principalAfterTxForCalc, which was updated after processing the first transaction
                    // But we need to get it BEFORE we process the second transaction
                    // Actually, principalAfterTxForCalc at this point is the principal after the FIRST transaction
                    // which is exactly what we need for calculating interest from first tx to anniversary
                    principalForInterest = Math.max(0, principalAfterTxForCalc);
                    interestStartDate = firstTxDate!; // Use first transaction date (same as year start, but semantically correct)
                  } else {
                    // Normal case: calculate from previous transaction using principal after previous transaction
                    principalForInterest = Math.max(0, principalAfterTxForCalc);
                    interestStartDate = lastCalcDate;
                  }

                  let res;
                  if (interestStartDate.getTime() < txDate.getTime()) {
                    // Calculate interest from start date to anniversary date
                    res = calculateInterestWithAnnualCompounding(
                      principalForInterest,
                      rate * 100,
                      interestStartDate,
                      txDate
                    );
                  } else {
                    res = { interest: 0, finalPrincipal: principalForInterest };
                  }

                  recalculatedTotalInterest += res.interest;
                  lastDisplayedPrincipalForCalc = principalForInterest;
                  // Track principal before this interest calculation (for year summary)
                  principalBeforeLastInterestCalc = principalForInterest;

                  // For repayment on anniversary, calcPrincipal should be the principal AFTER the interest calculation
                  // This represents the principal from the last calculation cell (after interest)
                  // The transaction will be applied to this principal
                  calcPrincipal = res.finalPrincipal; // Principal after interest calculation
                }
                // Apply transaction (even if on the same date as lastCalcDate or on anniversary)
                // Apply transaction to the correct principal:
                // - If repayment on anniversary: use calcPrincipal (which is principal after the interest calculation)
                // - Otherwise: use principalAfterTxForCalc (principal after previous transaction, before interest)
                // This ensures we apply the transaction to the principal from the last calculation cell
                const principalBeforeTxForCalc =
                  t.type === "payment" &&
                  txDate.getTime() === startOfDay(event.date).getTime()
                    ? calcPrincipal // Repayment on anniversary: use principal after the interest calculation
                    : principalAfterTxForCalc; // Otherwise: use principal after previous transaction (before interest)

                // Calculate principal after transaction (BEFORE interest) - this is what we need for principalAfterTxForCalc
                const principalAfterTxOnly =
                  t.type === "payment"
                    ? Math.max(0, principalBeforeTxForCalc - t.amount)
                    : principalBeforeTxForCalc + t.amount;

                // CRITICAL: If this transaction is on the anniversary date, it creates a calculation cell (even if 0 days)
                // We need to track the principal before this transaction for the calculation cell
                // This ensures 0-day calculation cells are properly considered
                const txOnAnniversary =
                  txDate.getTime() === startOfDay(event.date).getTime();
                if (txOnAnniversary) {
                  if (isRepaymentOnAnniversary) {
                    // Repayment on anniversary - the "current principal" shown in the 0-day cell is principalAfterTxOnly
                    // But principalAfterTxOnly = calcPrincipal - repayment, and calcPrincipal = principalBeforeLastInterestCalc + interest
                    // So principalAfterTxOnly = principalBeforeLastInterestCalc + interest - repayment
                    // To avoid double-counting (interest is already in totalYearInterest), we subtract the interest:
                    // current principal = principalAfterTxOnly - interest = principalBeforeLastInterestCalc - repayment
                    // At this point, calcPrincipal is still res.finalPrincipal (principal after interest)
                    const interestJustCalculated =
                      calcPrincipal - principalBeforeLastInterestCalc;
                    const principalWithoutInterest =
                      principalAfterTxOnly - interestJustCalculated;
                    principalAfterLastTxOnAnniversary =
                      principalWithoutInterest;
                  } else {
                    // Borrowal on anniversary (not a repayment) - creates a calculation cell
                    // The principal before this transaction is what we need for the calculation cell
                    // For borrowals, if we didn't calculate interest (same date as previous),
                    // principalBeforeTxForCalc is the principal before this transaction
                    // Update principalBeforeLastInterestCalc to track this 0-day calculation cell
                    principalBeforeLastInterestCalc = principalBeforeTxForCalc;

                    // For borrowals on anniversary, store the principal after the transaction
                    // This is the "current principal" shown in the 0-day calculation cell
                    principalAfterLastTxOnAnniversary = principalAfterTxOnly;
                  }
                }

                // Update calcPrincipal to reflect principal after transaction
                // For anniversary repayments, this will be: (principal after interest) - payment amount
                // For other cases, this will be: principal after transaction (before next interest)
                calcPrincipal = principalAfterTxOnly;

                // Track principal after this transaction (before interest for next period)
                // CRITICAL: Use principalAfterTxOnly, not calcPrincipal, to ensure we never include interest
                principalAfterTxForCalc = principalAfterTxOnly;

                // Update lastCalcDate to transaction date
                lastCalcDate = txDate;
                // Increment transaction index for next iteration
                transactionIndex++;
              }

              // Store principal before final segment interest (for display purposes)
              // This should be the principal after the last transaction, before any interest calculations
              // Use principalAfterTxForCalc which tracks principal after each transaction (before interest)
              // This represents the "latest current principal" after all transactions in the year
              const principalBeforeFinalSegment = principalAfterTxForCalc;

              // Calculate final segment interest if there's a gap after the last transaction (or year start if no transactions)
              // and before the anniversary date. If the last transaction is ON the anniversary date,
              // lastCalcDate will equal event.date, so this condition will be false and no final
              // segment interest will be calculated (which is correct).
              // CRITICAL: If there are no transactions in the year, we MUST calculate interest from year start to anniversary
              const hasNoTransactions = yearTxsForPrincipal.length === 0;
              const hasGapBeforeAnniversary =
                lastCalcDate.getTime() < startOfDay(event.date).getTime();

              // PRIORITY 1: If there are no transactions in the year, calculate interest for the entire year period
              // This is the critical case: a year with no transactions should still accrue interest
              const yearStartDate = startOfDay(currentYearStart);
              const yearEndDate = startOfDay(event.date);
              const isValidDateRange =
                yearStartDate.getTime() < yearEndDate.getTime();

              if (
                hasNoTransactions &&
                initialPrincipal > 0 &&
                isValidDateRange
              ) {
                // No transactions in this year - calculate interest from year start to anniversary date
                const finalRes = calculateInterestWithAnnualCompounding(
                  initialPrincipal,
                  rate * 100,
                  yearStartDate,
                  yearEndDate
                );
                recalculatedTotalInterest += finalRes.interest;
                // Track principal before this interest calculation (for year summary)
                principalBeforeLastInterestCalc = initialPrincipal;
                calcPrincipal = finalRes.finalPrincipal;
                segmentInterest = finalRes.interest;
              }
              // PRIORITY 2: If there are transactions but there's a gap after the last transaction before anniversary
              // CRITICAL: Only calculate final segment if the last transaction is NOT on the anniversary date
              // and we haven't already calculated interest for this period in the transaction loop
              else if (calcPrincipal > 0 && hasGapBeforeAnniversary) {
                // Check if we already calculated interest for this period
                // If the last transaction was on year start and we only have 1 transaction,
                // we should have calculated interest in the transaction loop, so skip final segment
                const lastTx =
                  yearTxsForPrincipal[yearTxsForPrincipal.length - 1];
                const lastTxDate = lastTx
                  ? startOfDay(new Date(lastTx.date))
                  : null;
                const lastTxOnYearStart =
                  lastTxDate &&
                  lastTxDate.getTime() === currentYearStart.getTime();
                const onlyOneTransaction = yearTxsForPrincipal.length === 1;

                // If we have only one transaction on year start, interest should have been calculated in the loop
                // (either as first transaction interest or in the special case handling)
                // So we should NOT calculate final segment in this case
                if (onlyOneTransaction && lastTxOnYearStart) {
                  // Skip final segment - interest already calculated in transaction loop
                } else {
                  // There are transactions before anniversary, and there's a gap after the last transaction before anniversary
                  const finalRes = calculateInterestWithAnnualCompounding(
                    calcPrincipal,
                    rate * 100,
                    lastCalcDate,
                    startOfDay(event.date)
                  );
                  recalculatedTotalInterest += finalRes.interest;
                  // Track principal before this interest calculation (for year summary)
                  principalBeforeLastInterestCalc = calcPrincipal;
                  calcPrincipal = finalRes.finalPrincipal; // Update calcPrincipal with final segment interest
                  // Update segmentInterest to match the recalculated value
                  segmentInterest = finalRes.interest;
                }
              } else {
                // No final segment interest (transaction is on anniversary date, or no principal, or dates are equal)
                // Don't add any additional interest here - recalculatedTotalInterest already contains
                // all the interest periods calculated in the loop above, which matches what's displayed
                // The segmentInterest calculated before the anniversary might not match if there are
                // transactions in the year, so we only use recalculatedTotalInterest
              }

              // FALLBACK: If no interest was calculated but we have principal and no transactions,
              // force calculation (this handles edge cases where the first condition wasn't met)
              // This is critical for years with no transactions - they MUST accrue interest
              // We check this AFTER all other logic to ensure we don't miss this case
              if (
                recalculatedTotalInterest === 0 &&
                hasNoTransactions &&
                initialPrincipal > 0
              ) {
                // Double-check date range
                if (isValidDateRange) {
                  const fallbackRes = calculateInterestWithAnnualCompounding(
                    initialPrincipal,
                    rate * 100,
                    yearStartDate,
                    yearEndDate
                  );
                  recalculatedTotalInterest = fallbackRes.interest;
                  // Track principal before this interest calculation (for year summary)
                  principalBeforeLastInterestCalc = initialPrincipal;
                  calcPrincipal = fallbackRes.finalPrincipal;
                  segmentInterest = fallbackRes.interest;
                }
              }

              const totalYearInterest = recalculatedTotalInterest;

              // New Principal = Current Principal (from last calculation cell) + Current Year Interest
              // The current principal should be the principal from the last calculation cell
              // A 0-day interest calculation cell (transaction on same date) IS still a calculation cell
              // If the last transaction is on the anniversary date, it creates a calculation cell (even if 0 days)
              // In that case, we should use the principal AFTER that transaction (which is calcPrincipal)
              // Otherwise, we use the principal BEFORE the last interest calculation
              const lastTx =
                yearTxsForPrincipal[yearTxsForPrincipal.length - 1];
              const lastTxDate = lastTx
                ? startOfDay(new Date(lastTx.date))
                : null;
              const lastTxOnAnniversary =
                lastTxDate &&
                lastTxDate.getTime() === startOfDay(event.date).getTime();

              // Check if there's a final segment calculation (gap before anniversary)
              // If there's a final segment, it's the last calculation cell
              // Otherwise, if last transaction is on anniversary, that transaction's calculation cell is the last one
              const hasFinalSegment =
                calcPrincipal > 0 &&
                lastCalcDate.getTime() < startOfDay(event.date).getTime() &&
                !(
                  yearTxsForPrincipal.length === 1 &&
                  lastTxDate &&
                  lastTxDate.getTime() === currentYearStart.getTime()
                );

              // Determine the current principal from the last calculation cell:
              // 1. If there's a final segment, use principal before that final segment (principalBeforeLastInterestCalc was updated)
              // 2. If last transaction is on anniversary (creates a 0-day calculation cell), use principal after that transaction
              //    This is the "current principal" shown in the 0-day calculation cell (e.g., 75000)
              // 3. Otherwise, use principal before last interest calculation
              let latestCurrentPrincipal: number;
              if (hasFinalSegment) {
                // Final segment is the last calculation cell - use principal before that calculation
                latestCurrentPrincipal = principalBeforeLastInterestCalc;
              } else if (
                lastTxOnAnniversary &&
                principalAfterLastTxOnAnniversary !== null
              ) {
                // Last transaction is on anniversary - creates a 0-day calculation cell
                // Use the principal after that transaction (current principal of that 0-day cell, e.g., 75000)
                latestCurrentPrincipal = principalAfterLastTxOnAnniversary;
              } else {
                // Use principal before last interest calculation
                latestCurrentPrincipal = principalBeforeLastInterestCalc;
              }

              const newPrincipalManual =
                latestCurrentPrincipal + totalYearInterest;

              summaries.push({
                yearNumber,
                fromDate: currentYearStart.toISOString(),
                toDate: event.date.toISOString(),
                interest: totalYearInterest, // Sum of all interest cells in this year
                newPrincipal: newPrincipalManual,
                // extra fields for rendering final segment cell
                finalFromDate: (segmentFrom ?? currentYearStart).toISOString(),
                finalToDate: event.date.toISOString(),
                finalPeriodInterest: segmentInterest,
                finalPrincipalBefore: principalBeforeFinalSegment,
              } as any);
              currentYearStart = event.date;
              yearAccrued = 0;
              yearNumber += 1;
            } else if (event.type === "tx") {
              // Apply transaction at this event date
              if (event.tx.type === "payment") {
                currentPrincipalForYearSim -= event.tx.amount;
                if (currentPrincipalForYearSim < 0)
                  currentPrincipalForYearSim = 0;
              } else {
                currentPrincipalForYearSim += event.tx.amount;
              }
            }

            lastDate = event.date;
          }
        }
      }

      setYearSummaries(summaries);

      // Now compute final-period using last anniversary, using summary newPrincipal as principal-before
      const lastSummaryForFinal =
        summaries.length > 0 ? summaries[summaries.length - 1] : null;
      if (lastSummaryForFinal) {
        const finalStart = startOfDay(new Date(lastSummaryForFinal.toDate));
        const principalBeforeFinal = Math.max(
          0,
          lastSummaryForFinal.newPrincipal
        );
        if (
          finalStart.getTime() < startOfDay(today).getTime() &&
          principalBeforeFinal > 0
        ) {
          const result = calculateInterestWithAnnualCompounding(
            principalBeforeFinal,
            rate * 100,
            finalStart,
            startOfDay(today)
          );
          finalPeriodDays = diffDaysExclusive(finalStart, today);
          finalPeriodInterest = result.interest;
          finalPrincipalBeforeForDisplay = principalBeforeFinal;
        }
      } else if (lastCalculationDate && principal > 0) {
        const principalBeforeFinal = principal;
        const result = calculateInterestWithAnnualCompounding(
          principalBeforeFinal,
          rate * 100,
          startOfDay(lastCalculationDate),
          startOfDay(today)
        );
        finalPeriodDays = diffDaysExclusive(lastCalculationDate, today);
        finalPeriodInterest = result.interest;
        finalPrincipalBeforeForDisplay = principalBeforeFinal;
      }

      // If no transactions, principal is 0
      if (allTransactions.length === 0) {
        principal = 0;
      }

      // Calculate details for debugging
      let details = "";
      if (allTransactions.length > 0) {
        const firstTransaction = allTransactions[0];
        const firstDate = startOfDay(new Date(firstTransaction.date));
        const today = calculationEndDate
          ? startOfDay(new Date(calculationEndDate))
          : startOfDay(new Date());
        const daysFromFirst = diffDaysExclusive(firstDate, today);
        details = `From ${firstDate.toLocaleDateString()} to ${today.toLocaleDateString()}: ${daysFromFirst} days`;
      }

      // Compute Outstanding principal = sum(borrowals) - sum(repayments)
      const totalBorrowed = currentReceipts.reduce(
        (sum, r) => sum + r.amount,
        0
      );
      const totalRepaid = currentPayments.reduce((sum, p) => sum + p.amount, 0);
      const outstandingPrincipal = totalBorrowed - totalRepaid;

      // Get the last year summary for interest calculation
      const lastSummaryForTotal =
        summaries.length > 0 ? summaries[summaries.length - 1] : null;

      // Calculate total interest:
      // - If there's a year summary, only use final period interest (since year summaries include previous interests)
      // - If no year summary, sum ALL interest periods in Year 1 + final period interest
      let finalYearInterestSum = 0;
      if (lastSummaryForTotal) {
        // Year summary exists - only add final period interest after the summary
        finalYearInterestSum = Math.max(0, finalPeriodInterest || 0);
      } else {
        // No year summary yet - sum ALL interest periods in Year 1
        // This includes all interest periods from transactions + final period interest
        const allYear1Interest = periods.reduce(
          (sum, p) => sum + (p.interest || 0),
          0
        );
        finalYearInterestSum =
          allYear1Interest + Math.max(0, finalPeriodInterest || 0);
      }

      // Determine the current principal from the last displayed cell
      // If last cell is a year summary (and no transactions after it), use summary's newPrincipal
      // Otherwise, calculate principal after last transaction (without interest)
      let currentPrincipalForDisplay = outstandingPrincipal;
      let recalculatedFinalYearInterest = finalYearInterestSum;

      if (lastSummaryForTotal) {
        const lastSummaryDate = startOfDay(
          new Date(lastSummaryForTotal.toDate)
        );
        const endDate = calculationEndDate
          ? startOfDay(new Date(calculationEndDate))
          : startOfDay(new Date());

        // Check if there are transactions after the last summary
        const transactionsAfterSummary = allTransactions.filter((t) => {
          const txDate = startOfDay(new Date(t.date));
          return (
            txDate.getTime() > lastSummaryDate.getTime() &&
            txDate.getTime() <= endDate.getTime()
          );
        });

        if (transactionsAfterSummary.length === 0) {
          // No transactions after summary - last cell is the summary
          // Use the newPrincipal from the summary as current principal
          currentPrincipalForDisplay = lastSummaryForTotal.newPrincipal;
          // Interest is already calculated in finalYearInterestSum (finalPeriodInterest)
        } else {
          // There are transactions after summary - last cell is a transaction
          // Calculate principal and interest step by step (transactions apply AFTER interest)
          let currentPrincipal = lastSummaryForTotal.newPrincipal;
          let totalInterestAfterSummary = 0;

          // Process transactions after the summary
          for (const tx of transactionsAfterSummary) {
            const prevDate =
              transactionsAfterSummary.indexOf(tx) === 0
                ? lastSummaryDate
                : startOfDay(
                    new Date(
                      transactionsAfterSummary[
                        transactionsAfterSummary.indexOf(tx) - 1
                      ].date
                    )
                  );
            const txDate = startOfDay(new Date(tx.date));

            // Calculate interest from previous date to this transaction
            if (currentPrincipal > 0 && prevDate.getTime() < txDate.getTime()) {
              const res = calculateInterestWithAnnualCompounding(
                currentPrincipal,
                rate * 100,
                prevDate,
                txDate
              );
              totalInterestAfterSummary += res.interest;
              currentPrincipal = res.finalPrincipal; // Principal now includes interest
            }

            // Apply transaction to principal (after interest has been added)
            if (tx.type === "payment") {
              currentPrincipal = Math.max(0, currentPrincipal - tx.amount);
            } else {
              currentPrincipal += tx.amount;
            }
          }

          // Calculate interest from last transaction to end date
          const lastTxDate = startOfDay(
            new Date(
              transactionsAfterSummary[transactionsAfterSummary.length - 1].date
            )
          );
          let finalPeriodInterest = 0;
          if (
            currentPrincipal > 0 &&
            lastTxDate.getTime() < endDate.getTime()
          ) {
            const res = calculateInterestWithAnnualCompounding(
              currentPrincipal,
              rate * 100,
              lastTxDate,
              endDate
            );
            finalPeriodInterest = res.interest;
            totalInterestAfterSummary += finalPeriodInterest;
            // For display, we want principal BEFORE this final interest
            // res.finalPrincipal = currentPrincipal + finalPeriodInterest
            // So currentPrincipalForDisplay = currentPrincipal (before final interest)
          }

          currentPrincipalForDisplay = currentPrincipal;
          recalculatedFinalYearInterest = totalInterestAfterSummary;
        }
      } else if (allTransactions.length > 0) {
        // No summaries - last cell is a transaction
        // Principal is already calculated after all transactions (includes interest up to last transaction)
        // We need the principal BEFORE the final interest period
        const lastTx = allTransactions[allTransactions.length - 1];
        const lastTxDate = startOfDay(new Date(lastTx.date));
        const endDate = calculationEndDate
          ? startOfDay(new Date(calculationEndDate))
          : startOfDay(new Date());

        // principal already includes interest up to last transaction
        // For display, we want principal before final interest period
        currentPrincipalForDisplay = principal;
        // finalYearInterestSum already includes final period interest, so use it
        recalculatedFinalYearInterest = finalYearInterestSum;
      }

      // Calculate total amount due: Current Principal (from last cell) + Final Year Interest
      const totalAmountDue =
        currentPrincipalForDisplay + recalculatedFinalYearInterest;

      // Check if total amount due would be negative
      if (totalAmountDue < 0) {
        Alert.alert(
          "Invalid Calculation",
          "The total amount due is negative. This means repayments exceed borrowals plus interest. Please adjust your transactions.",
          [{ text: "OK" }]
        );
        // Reset calculated values
        setLoanAmount(0);
        setCurrentPrincipalForTotal(0);
        setCalculatedInterest(0);
        setCalculatedResultsInterest(0);
        setCalculatedAmount(0);
        setCalculationDetails("");
        setCalculationSuccessful(false);
        return; // Don't proceed with setting results
      }

      // Set values for display
      // loanAmount is used in "Calculated Results" section - should be outstandingPrincipal (total borrowals - total repayments)
      setLoanAmount(outstandingPrincipal);
      // currentPrincipalForTotal is used in "Total Amount Due" section - principal from last displayed cell
      setCurrentPrincipalForTotal(currentPrincipalForDisplay);
      // calculatedAmount is the total amount due (totalAmountDue was already calculated above)
      setCalculatedAmount(totalAmountDue);
      // calculatedInterest is for "Total Amount Due" section
      setCalculatedInterest(recalculatedFinalYearInterest);
      // calculatedResultsInterest is for "Calculated Results" section = Total Amount Due - Outstanding Principal
      setCalculatedResultsInterest(totalAmountDue - outstandingPrincipal);
      setCalculationDetails(details);
      setCalculationSuccessful(true);
    },
    [interestRate, calculationEndDate]
  );

  // Sync hasCalculated with calculationSuccessful
  useEffect(() => {
    if (hasCalculated && !calculationSuccessful) {
      // If user clicked Calculate but calculation failed, reset hasCalculated
      setHasCalculated(false);
    }
  }, [hasCalculated, calculationSuccessful]);

  // Recalculate when interest rate, payments, or receipts change
  useEffect(() => {
    if (calculationEndDate && interestRate && parseFloat(interestRate) > 0) {
      calculateResults(payments, receipts);
      // Keep hasCalculated true if we're recalculating (user has already clicked Calculate)
      if (hasCalculated) {
        setHasCalculated(true);
      }
    }
  }, [
    interestRate,
    payments,
    receipts,
    calculationEndDate,
    calculateResults,
    hasCalculated,
  ]);

  // Build combined sorted transactions for rendering
  // When dates are the same, borrowals (receipts) come before repayments (payments)
  const combinedTransactions = sortCombinedTransactions([
    ...payments.map((t) => ({ ...t, type: "payment" as const })),
    ...receipts.map((t) => ({ ...t, type: "receipt" as const })),
  ]);

  // Get the latest transaction date for validation
  const latestTransactionDate =
    combinedTransactions.length > 0
      ? startOfDay(
          new Date(combinedTransactions[combinedTransactions.length - 1].date)
        )
      : null;

  // Clear calculations if a new transaction is added after the calculation end date
  useEffect(() => {
    if (hasCalculated && calculationEndDate && latestTransactionDate) {
      const calcDate = startOfDay(calculationEndDate);
      const latestTxDate = latestTransactionDate;

      // If latest transaction is after calculation end date, clear results
      // User needs to update the "Calculate interest upto" date
      if (latestTxDate.getTime() > calcDate.getTime()) {
        setHasCalculated(false);
      }
    }
  }, [
    payments,
    receipts,
    calculationEndDate,
    latestTransactionDate,
    hasCalculated,
  ]);

  // Validate calculation end date
  // If no transactions, any date is valid. Otherwise, date must be >= latest transaction date
  const isCalculationDateValid = calculationEndDate
    ? latestTransactionDate
      ? startOfDay(calculationEndDate).getTime() >=
        latestTransactionDate.getTime()
      : true // No transactions, any date is valid
    : false; // No date selected

  // PDF Export function
  const exportToPDF = async () => {
    try {
      // Guard: expo-print requires a native module (not available in Expo Go/web)
      if (Platform.OS === "web") {
        Alert.alert(
          "Not supported on web",
          "PDF export requires a native build. Please run on Android/iOS device."
        );
        return;
      }

      // Check if printToFileAsync is available
      if (!Print.printToFileAsync) {
        Alert.alert(
          "Module Error",
          "PDF export module not available. Please restart Metro bundler and rebuild the app."
        );
        return;
      }

      if (combinedTransactions.length === 0 && calculatedAmount === 0) {
        Alert.alert("No Data", "No transactions or calculations to export.");
        return;
      }

      // For report: Combine transactions on the same day into a single net transaction
      // This matches the calculation logic where same-day transactions are combined
      const combinedTransactionsForReport = combineTransactionsByDate([
        ...combinedTransactions,
      ]);
      const sortedTransactions = combinedTransactionsForReport;
      const sortedSummaries = [...yearSummaries].sort(
        (a, b) => new Date(a.toDate).getTime() - new Date(b.toDate).getTime()
      );

      // Generate HTML content
      let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      font-size: 12px;
    }
    h1 {
      color: #333;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    h2 {
      color: #555;
      margin-top: 20px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    .transaction-row {
      background-color: #f9f9f9;
    }
    .summary-box {
      background-color: #fffacd;
      border: 1px solid #ddd;
      padding: 10px;
      margin: 10px 0;
      border-radius: 5px;
    }
    .interest-cell {
      background-color: #e6f3ff;
      border: 1px solid #b3d9ff;
      padding: 8px;
      margin: 5px 0;
      border-radius: 3px;
    }
    .transaction-cell {
      background-color: #f0f0f0;
      border: 1px solid #ddd;
      padding: 8px;
      margin: 5px 0;
      border-radius: 3px;
    }
    .payment-cell {
      background-color: #ffe6e6;
    }
    .receipt-cell {
      background-color: #e6ffe6;
    }
    .amount {
      font-weight: bold;
    }
    .label {
      font-weight: bold;
      color: #555;
    }
  </style>
</head>
<body>
  <h1>Money Lender - Transaction Report</h1>
  <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
  <p><strong>Interest Rate:</strong> ${interestRate || "N/A"}% for 360 days</p>
  ${calculationEndDate ? `<p><strong>Calculate Interest Up To:</strong> ${calculationEndDate.toLocaleDateString()}</p>` : ""}
  
  <h2>Transactions Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
`;

      // Add transaction rows
      sortedTransactions.forEach((tx) => {
        htmlContent += `
      <tr class="transaction-row">
        <td>${new Date(tx.date).toLocaleDateString()}</td>
        <td>${tx.type === "receipt" ? "Borrowal" : "Repayment"}</td>
        <td class="amount">${formatCurrency(tx.amount)}</td>
      </tr>`;
      });

      htmlContent += `
    </tbody>
  </table>

  <h2>Calculated Results</h2>
  <div class="summary-box">
    <p><span class="label">Outstanding Principal:</span> ₹${formatCurrency(loanAmount)}</p>
    <p><span class="label">Interest:</span> ₹${formatCurrency(calculatedResultsInterest)}</p>
    <p><span class="label">Total Amount Due:</span> ₹${formatCurrency(calculatedAmount)}</p>
  </div>
`;

      // Add year summaries and transaction details
      if (sortedSummaries.length > 0 || sortedTransactions.length > 0) {
        htmlContent += `<h2>Detailed Calculations</h2>`;

        // Reconstruct the same rendering logic for PDF (matching app rendering)
        const endDate = calculationEndDate
          ? startOfDay(new Date(calculationEndDate))
          : null;
        const rate = parseFloat(interestRate || "0") / 100;
        let currentPrincipal = 0;
        const processedTxIds = new Set<string | number>();
        let finalPrincipalAfterLastTx = 0; // Track principal after last transaction in final year
        let finalYearInterestForTotal = 0;
        const lastSummaryForTotal =
          sortedSummaries.length > 0
            ? sortedSummaries[sortedSummaries.length - 1]
            : null;

        // Determine if we're in the final year (after last summary or no summaries)
        const finalYearStart = lastSummaryForTotal
          ? startOfDay(new Date(lastSummaryForTotal.toDate))
          : sortedTransactions.length > 0
            ? startOfDay(new Date(sortedTransactions[0].date))
            : null;

        // Group transactions by year cycles (matching app logic)
        for (let yearNum = 1; ; yearNum++) {
          const yearSummary = sortedSummaries.find(
            (s) => s.yearNumber === yearNum
          );

          // Determine year start date (matching app logic)
          let yearStart: Date | null = null;
          if (yearSummary) {
            yearStart = startOfDay(new Date(yearSummary.fromDate));
          } else if (yearNum === 1 && sortedTransactions.length > 0) {
            yearStart = startOfDay(new Date(sortedTransactions[0].date));
          } else if (yearNum > 1) {
            // For Year 2+ without summary, use the day after previous year's end
            const prevYearSummary = sortedSummaries.find(
              (s) => s.yearNumber === yearNum - 1
            );
            if (prevYearSummary) {
              const prevYearEnd = startOfDay(new Date(prevYearSummary.toDate));
              yearStart = new Date(prevYearEnd);
              yearStart.setDate(yearStart.getDate() + 1);
              yearStart = startOfDay(yearStart);
            } else {
              // No previous summary either, check if there are unprocessed transactions
              const unprocessedTxs = sortedTransactions.filter(
                (t) => !processedTxIds.has(t.id)
              );
              if (unprocessedTxs.length > 0) {
                yearStart = startOfDay(new Date(unprocessedTxs[0].date));
              }
            }
          }

          const yearEnd = yearSummary
            ? startOfDay(new Date(yearSummary.toDate))
            : null;

          // If no yearStart and no unprocessed transactions, break
          if (!yearStart) {
            const unprocessedTxs = sortedTransactions.filter(
              (t) => !processedTxIds.has(t.id)
            );
            if (unprocessedTxs.length === 0) break;
            break;
          }

          // Collect all transactions in this year that haven't been processed yet
          const prevYearSummary =
            yearNum > 1
              ? sortedSummaries.find((s) => s.yearNumber === yearNum - 1)
              : null;
          const effectiveYearStart = prevYearSummary
            ? startOfDay(new Date(prevYearSummary.toDate)).getTime() + 86400000
            : yearStart.getTime();

          const yearTxs = sortedTransactions.filter((t) => {
            const txDate = startOfDay(new Date(t.date));
            const txTime = txDate.getTime();
            if (!yearEnd) {
              return (
                !processedTxIds.has(t.id) &&
                txTime >= effectiveYearStart &&
                (!endDate || txTime <= endDate.getTime())
              );
            }
            return (
              !processedTxIds.has(t.id) &&
              txTime >= effectiveYearStart &&
              txTime <= yearEnd.getTime()
            );
          });

          // Add Year heading at the top of each year's section
          const yearHeading = yearSummary
            ? `Year ${yearSummary.yearNumber}`
            : `Year ${yearNum}`;
          htmlContent += `<h2 class="text-xl font-bold mb-4 mt-6">${yearHeading}</h2>`;

          // Use previous year's newPrincipal as starting principal for this year
          if (yearSummary) {
            const prevSummary = sortedSummaries.find(
              (s) => s.yearNumber === yearNum - 1
            );
            currentPrincipal = prevSummary ? prevSummary.newPrincipal : 0;
          }

          // If there's a year summary but no transactions, show interest calculation for the entire year
          if (yearSummary && yearTxs.length === 0 && yearEnd) {
            if (currentPrincipal > 0) {
              const finalSegmentEnd =
                endDate && endDate.getTime() < yearEnd.getTime()
                  ? endDate
                  : yearEnd;

              if (finalSegmentEnd.getTime() > yearStart.getTime()) {
                const res = calculateInterestWithAnnualCompounding(
                  currentPrincipal,
                  rate * 100,
                  yearStart,
                  finalSegmentEnd
                );
                const days = diffDaysExclusive(yearStart, finalSegmentEnd);
                htmlContent += `
  <div class="interest-cell">
    <p><strong>Current Principal:</strong> ₹${formatCurrency(currentPrincipal)}</p>
    <p><strong>From:</strong> ${yearStart.toLocaleDateString()} → <strong>To:</strong> ${finalSegmentEnd.toLocaleDateString()}</p>
    <p><strong>Period:</strong> ${days} days</p>
    <p><strong>Interest:</strong> ₹${formatCurrency(res.interest)}</p>
  </div>`;
                currentPrincipal = res.finalPrincipal;
                // Track interest for final year
                if (
                  finalYearStart &&
                  yearStart.getTime() >= finalYearStart.getTime()
                ) {
                  finalYearInterestForTotal += res.interest;
                }
              }
            }
          }

          // Render interest cells and transactions for this year
          // Track the principal displayed in the last interest cell (for repayments on anniversary)
          // Track principal after each transaction (before interest) for the last cell
          let lastDisplayedPrincipal = currentPrincipal;
          let principalAfterTx = currentPrincipal; // Track principal after each transaction (before interest)
          for (let i = 0; i < yearTxs.length; i++) {
            const tx = yearTxs[i];
            const txDate = startOfDay(new Date(tx.date));

            // Interest from previous tx (or year start) to current tx
            // Calculate interest even if currentPrincipal is 0 (will result in 0 interest, but shows the period)
            if (i === 0) {
              const from = yearStart!;
              const to = txDate;
              if (to.getTime() > from.getTime()) {
                // If principal is 0 or negative, interest will be 0, but we still calculate to show the period
                const principalForInterest = Math.max(0, currentPrincipal);
                const res = calculateInterestWithAnnualCompounding(
                  principalForInterest,
                  rate * 100,
                  from,
                  to
                );
                const days = diffDaysExclusive(from, to);
                htmlContent += `
  <div class="interest-cell">
    <p><strong>Current Principal:</strong> ₹${formatCurrency(principalForInterest)}</p>
    <p><strong>From:</strong> ${from.toLocaleDateString()} → <strong>To:</strong> ${to.toLocaleDateString()}</p>
    <p><strong>Period:</strong> ${days} days</p>
    <p><strong>Interest:</strong> ₹${formatCurrency(res.interest)}</p>
  </div>`;
                // Track the principal displayed in this interest cell
                lastDisplayedPrincipal = principalForInterest;
                // Only update currentPrincipal if it was positive (to avoid going negative)
                if (currentPrincipal > 0) {
                  currentPrincipal = res.finalPrincipal;
                }
                // Track interest for final year
                if (
                  finalYearStart &&
                  from.getTime() >= finalYearStart.getTime()
                ) {
                  finalYearInterestForTotal += res.interest;
                }
              }
            } else if (i > 0) {
              const prevTx = yearTxs[i - 1];
              const from = startOfDay(new Date(prevTx.date));
              const to = txDate;

              // Check if current transaction is a REPAYMENT on the anniversary date
              // If repayment is on anniversary date, don't calculate interest from previous tx to repayment date
              // (We apply repayment directly to previous cell's principal)
              // For borrowals on anniversary date, we DO calculate interest (to show period before borrowal)
              const isRepaymentOnAnniversary =
                tx.type === "payment" &&
                yearEnd &&
                txDate.getTime() === yearEnd.getTime();

              // Calculate interest between transactions
              // CRITICAL FIX: Even when repayment is on anniversary date, we still need to show the interest cell
              // The interest from previous transaction (or year start) to anniversary should be displayed
              // Calculate interest even if currentPrincipal is 0 (will result in 0 interest, but shows the period)
              // Also show interest cell even if dates are the same (0 days, 0 interest)

              // Determine the principal and start date for interest calculation
              let principalForInterest: number;
              let interestFrom: Date;

              if (isRepaymentOnAnniversary && i === 1) {
                // Payment on anniversary, and this is the second transaction
                // Check if first transaction was on year start date
                const firstTx = yearTxs[0];
                const firstTxDate = firstTx
                  ? startOfDay(new Date(firstTx.date))
                  : null;
                const firstTxOnYearStart =
                  firstTxDate && firstTxDate.getTime() === yearStart!.getTime();

                if (firstTxOnYearStart) {
                  // First transaction was on year start - calculate from year start
                  // For Year 1: use principal after first transaction
                  // For Year 2+: use initial principal from previous year
                  const prevYearSummary = sortedSummaries.find(
                    (s) => s.yearNumber === yearNum - 1
                  );
                  if (prevYearSummary) {
                    // Year 2+: use initial principal
                    principalForInterest = Math.max(
                      0,
                      prevYearSummary.newPrincipal
                    );
                  } else {
                    // Year 1: use principal after first transaction
                    principalForInterest = Math.max(0, principalAfterTx);
                  }
                  interestFrom = yearStart!;
                } else {
                  // Normal case: use principal after previous transaction
                  principalForInterest = Math.max(0, principalAfterTx);
                  interestFrom = from;
                }
              } else {
                // Normal case: use principal after previous transaction
                principalForInterest = Math.max(0, principalAfterTx);
                interestFrom = from;
              }

              let res;
              let days = 0;

              if (to.getTime() > interestFrom.getTime()) {
                // There's a gap - calculate interest
                res = calculateInterestWithAnnualCompounding(
                  principalForInterest,
                  rate * 100,
                  interestFrom,
                  to
                );
                days = diffDaysExclusive(interestFrom, to);
              } else {
                // Same date - show 0 days and 0 interest
                res = { interest: 0, finalPrincipal: principalForInterest };
              }

              htmlContent += `
  <div class="interest-cell">
    <p><strong>Current Principal:</strong> ₹${formatCurrency(principalForInterest)}</p>
    <p><strong>From:</strong> ${interestFrom.toLocaleDateString()} → <strong>To:</strong> ${to.toLocaleDateString()}</p>
    <p><strong>Period:</strong> ${days} days</p>
    <p><strong>Interest:</strong> ₹${formatCurrency(res.interest)}</p>
  </div>`;
              // Track the principal displayed in this interest cell
              lastDisplayedPrincipal = principalForInterest;
              // Update currentPrincipal with interest for next period
              if (
                principalForInterest > 0 &&
                to.getTime() > interestFrom.getTime()
              ) {
                currentPrincipal = res.finalPrincipal;
              } else {
                currentPrincipal = principalForInterest;
              }
              // Track interest for final year
              if (
                finalYearStart &&
                interestFrom.getTime() >= finalYearStart.getTime()
              ) {
                finalYearInterestForTotal += res.interest;
              }

              // If repayment is on anniversary, we still update currentPrincipal for the repayment
              if (isRepaymentOnAnniversary) {
                // The repayment will be applied to lastDisplayedPrincipal (previous cell's principal)
                // But we've already updated currentPrincipal above, so we need to adjust
                currentPrincipal = lastDisplayedPrincipal;
              }
            }

            // Render transaction cell (without Principal before)
            // Apply transaction to the correct principal:
            // - If repayment on anniversary: use lastDisplayedPrincipal (previous cell's principal)
            // - Otherwise: use principalAfterTx (principal after previous transaction, before interest)
            // This ensures we don't add interest before applying the transaction
            const principalBeforeTx =
              tx.type === "payment" &&
              yearEnd &&
              txDate.getTime() === yearEnd.getTime()
                ? lastDisplayedPrincipal // Repayment on anniversary: use previous cell's principal
                : principalAfterTx; // Otherwise: use principal after previous transaction (before interest)

            currentPrincipal =
              tx.type === "payment"
                ? Math.max(0, principalBeforeTx - tx.amount)
                : principalBeforeTx + tx.amount;

            // Track principal after this transaction (before interest for next period)
            // This is the value that should be shown in the last cell
            principalAfterTx = currentPrincipal;

            // Track principal after last transaction in final year
            if (
              finalYearStart &&
              txDate.getTime() >= finalYearStart.getTime()
            ) {
              finalPrincipalAfterLastTx = currentPrincipal;
            }

            // Mark transaction as processed
            processedTxIds.add(tx.id);

            htmlContent += `
  <div class="transaction-cell ${tx.type === "payment" ? "payment-cell" : "receipt-cell"}">
    <p><strong>${tx.type === "receipt" ? "Borrowal" : "Repayment"}:</strong> ${tx.type === "payment" ? "-" : "+"}₹${formatCurrency(tx.amount)}</p>
    <p><strong>Date:</strong> ${new Date(tx.date).toLocaleDateString()}</p>
  </div>`;
          }

          // Render final segment from last transaction to min(year-end, Calculate-upto)
          // Always render this cell if last transaction is on anniversary date (even if 0 days)
          // This works for both borrowals (receipts) and repayments (payments) on the anniversary date
          if (yearSummary && yearTxs.length > 0 && yearEnd) {
            const lastTx = yearTxs[yearTxs.length - 1];
            const lastTxDate = startOfDay(new Date(lastTx.date));
            const finalSegmentEnd =
              endDate && endDate.getTime() < yearEnd.getTime()
                ? endDate
                : yearEnd;

            // Get principal after last transaction (without interest)
            // This should be the principal after the last transaction, before any interest calculations
            // Use principalAfterTx which tracks principal after each transaction (before interest)
            const principalAfterLastTx = principalAfterTx;

            if (finalSegmentEnd.getTime() > lastTxDate.getTime()) {
              // There's a gap - calculate interest
              if (principalAfterLastTx > 0) {
                const res = calculateInterestWithAnnualCompounding(
                  principalAfterLastTx,
                  rate * 100,
                  lastTxDate,
                  finalSegmentEnd
                );
                const days = diffDaysExclusive(lastTxDate, finalSegmentEnd);
                htmlContent += `
  <div class="interest-cell">
    <p><strong>Current Principal:</strong> ₹${formatCurrency(principalAfterLastTx)}</p>
    <p><strong>From:</strong> ${lastTxDate.toLocaleDateString()} → <strong>To:</strong> ${finalSegmentEnd.toLocaleDateString()}</p>
    <p><strong>Period:</strong> ${days} days</p>
    <p><strong>Interest:</strong> ₹${formatCurrency(res.interest)}</p>
  </div>`;
                // Track interest for final year
                if (
                  finalYearStart &&
                  lastTxDate.getTime() >= finalYearStart.getTime()
                ) {
                  finalYearInterestForTotal += res.interest;
                }
              }
            } else if (finalSegmentEnd.getTime() === lastTxDate.getTime()) {
              // Same date - show 0 days and ₹0 interest
              // Always show this cell regardless of principal amount (works for both borrowals and repayments)
              const days = 0;
              htmlContent += `
  <div class="interest-cell">
    <p><strong>Current Principal:</strong> ₹${formatCurrency(principalAfterLastTx)}</p>
    <p><strong>From:</strong> ${lastTxDate.toLocaleDateString()} → <strong>To:</strong> ${finalSegmentEnd.toLocaleDateString()}</p>
    <p><strong>Period:</strong> ${days} days</p>
    <p><strong>Interest:</strong> ₹${formatCurrency(0)}</p>
  </div>`;
            }
          }

          // Render year summary
          if (yearSummary) {
            htmlContent += `
  <div class="summary-box">
    <h3>Year ${yearSummary.yearNumber} Summary</h3>
    <p><strong>From:</strong> ${new Date(yearSummary.fromDate).toLocaleDateString()} → <strong>To:</strong> ${new Date(yearSummary.toDate).toLocaleDateString()}</p>
    <p><strong>Current Year's Interest:</strong> ₹${formatCurrency(yearSummary.interest)}</p>
    <p><strong>New Principal:</strong> ₹${formatCurrency(yearSummary.newPrincipal)}</p>
  </div>`;
            currentPrincipal = yearSummary.newPrincipal;
          }

          const shouldStop =
            !yearSummary ||
            !endDate ||
            (yearEnd && yearEnd.getTime() >= endDate.getTime());

          // If no year summary but we have transactions and endDate is after last transaction
          if (!yearSummary && yearTxs.length > 0 && endDate) {
            const lastTxInYear = yearTxs[yearTxs.length - 1];
            const lastTxDateInYear = startOfDay(new Date(lastTxInYear.date));
            if (endDate.getTime() > lastTxDateInYear.getTime()) {
              const principalAfterLastTxInYear =
                lastTxInYear.type === "payment"
                  ? Math.max(0, currentPrincipal)
                  : currentPrincipal;

              if (principalAfterLastTxInYear > 0) {
                const res = calculateInterestWithAnnualCompounding(
                  principalAfterLastTxInYear,
                  rate * 100,
                  lastTxDateInYear,
                  endDate
                );
                const days = diffDaysExclusive(lastTxDateInYear, endDate);
                htmlContent += `
  <div class="interest-cell">
    <p><strong>Current Principal:</strong> ₹${formatCurrency(principalAfterLastTxInYear)}</p>
    <p><strong>From:</strong> ${lastTxDateInYear.toLocaleDateString()} → <strong>To:</strong> ${endDate.toLocaleDateString()}</p>
    <p><strong>Period:</strong> ${days} days</p>
    <p><strong>Interest:</strong> ₹${formatCurrency(res.interest)}</p>
  </div>`;
                // Track interest for final year
                if (
                  finalYearStart &&
                  lastTxDateInYear.getTime() >= finalYearStart.getTime()
                ) {
                  finalYearInterestForTotal += res.interest;
                }
              }
              break;
            }
          }

          if (shouldStop) break;
        }

        // Render final partial period after last year summary
        const lastSummary =
          sortedSummaries.length > 0
            ? sortedSummaries[sortedSummaries.length - 1]
            : null;
        if (lastSummary && endDate) {
          const finalStart = startOfDay(new Date(lastSummary.toDate));
          if (endDate.getTime() > finalStart.getTime()) {
            // Check if there are any transactions between finalStart and endDate
            const transactionsAfterSummary = sortedTransactions.filter((t) => {
              const txDate = startOfDay(new Date(t.date));
              return (
                txDate.getTime() > finalStart.getTime() &&
                txDate.getTime() <= endDate.getTime()
              );
            });

            // Only render final period if there are NO transactions after the summary
            if (transactionsAfterSummary.length === 0) {
              const principalBeforeFinal = Math.max(
                0,
                lastSummary.newPrincipal
              );
              if (principalBeforeFinal > 0) {
                const res = calculateInterestWithAnnualCompounding(
                  principalBeforeFinal,
                  rate * 100,
                  finalStart,
                  endDate
                );
                const days = diffDaysExclusive(finalStart, endDate);
                htmlContent += `
  <div class="interest-cell">
    <p><strong>Current Principal:</strong> ₹${formatCurrency(principalBeforeFinal)}</p>
    <p><strong>From:</strong> ${finalStart.toLocaleDateString()} → <strong>To:</strong> ${endDate.toLocaleDateString()}</p>
    <p><strong>Period:</strong> ${days} days</p>
    <p><strong>Interest:</strong> ₹${formatCurrency(res.interest)}</p>
  </div>`;
                // Track interest for final year
                if (
                  finalYearStart &&
                  finalStart.getTime() >= finalYearStart.getTime()
                ) {
                  finalYearInterestForTotal += res.interest;
                  // If no transactions after summary, principal after last transaction is the principal before final
                  if (finalPrincipalAfterLastTx === 0) {
                    finalPrincipalAfterLastTx = principalBeforeFinal;
                  }
                }
              }
            }
          }
        }

        // Add Total Amount Due cell at the bottom
        // Use currentPrincipalForTotal (principal from last cell) for "Total Amount Due" section
        if (calculatedAmount > 0) {
          htmlContent += `
  <div class="summary-box" style="background-color: #e6d5f7; border: 2px solid #9b59b6; margin-top: 20px;">
    <h3>Total Amount Due</h3>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
      <div>
        <p style="font-size: 11px; color: #666;">Current Principal</p>
        <p style="font-weight: bold; font-size: 13px;">₹${formatCurrency(currentPrincipalForTotal)}</p>
      </div>
      <p style="font-size: 18px; font-weight: bold;">+</p>
      <div>
        <p style="font-size: 11px; color: #666;">Final Year&apos;s Interest</p>
        <p style="font-weight: bold; font-size: 13px;">₹${formatCurrency(calculatedInterest)}</p>
      </div>
      <p style="font-size: 18px; font-weight: bold;">=</p>
      <div style="text-align: right;">
        <p style="font-size: 11px; color: #666;">Total</p>
        <p style="font-weight: bold; font-size: 16px;">₹${formatCurrency(calculatedAmount)}</p>
      </div>
    </div>
  </div>`;
        }
      }

      htmlContent += `
</body>
</html>`;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({ html: htmlContent });

      // Share/Download the PDF
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Save Money Lender Report",
        });
      } else {
        Alert.alert("PDF Generated", `PDF saved at: ${uri}`, [{ text: "OK" }]);
      }
    } catch (error) {
      // Error generating PDF
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
    }
  };

  return (
    <SafeAreaView
      className={`flex-1 bg-background ${colorScheme === "dark" ? "dark" : ""}`}
    >
      <StatusBar
        hidden={false}
        translucent={false}
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
      />
      <View className="flex-1">
        <ScrollView className="flex-1 px-4 pt-4">
          <View className="mb-6 flex-row justify-between items-center">
            <Text variant="h2" className="mb-4 flex-1">
              Money lenders calculator
            </Text>
            <Button
              variant="outline"
              onPress={toggleTheme}
              className="ml-2 border-border"
              size="icon"
            >
              <MaterialIcons
                name={colorScheme === "dark" ? "wb-sunny" : "nightlight"}
                size={24}
                color={colorScheme === "dark" ? "#fbbf24" : "#000000"}
              />
            </Button>
          </View>

          {/* Action Buttons moved to top */}
          <View className="flex-row w-full mb-4" style={{ gap: 8 }}>
            <Button
              className="bg-red-600 flex-1"
              onPress={() => {
                setEditingReceipt(null);
                setShowReceiptModal(true);
              }}
              style={{
                minHeight: 48,
                paddingVertical: 8,
                paddingHorizontal: 8,
              }}
            >
              <Text
                className="text-white text-center text-sm font-semibold"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Add Borrowal
              </Text>
            </Button>
            <Button
              className="bg-green-600 flex-1"
              onPress={() => {
                setEditingPayment(null);
                setShowPaymentModal(true);
              }}
              style={{
                minHeight: 48,
                paddingVertical: 8,
                paddingHorizontal: 8,
              }}
            >
              <Text
                className="text-white text-center text-sm font-semibold"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Add Repayment
              </Text>
            </Button>
          </View>

          <View className="mb-4">
            <View className="mb-2 flex-row items-center">
              <Text className="text-sm font-medium">
                Loan Interest Rate for 360 Days(%){" "}
                <Text className="text-red-500">*</Text>
              </Text>
            </View>
            <Input
              value={interestRate}
              onChangeText={(text) => {
                const validated = validateInterestRateInput(text);
                setInterestRate(validated);
                saveInterestRate(validated);
              }}
              keyboardType="decimal-pad"
              placeholder="Enter interest rate (e.g., 10, 10.5, or 120)"
            />
          </View>
          <View className="mt-2">
            <Text className="mb-2 text-sm font-medium">
              Calculate interest up to <Text className="text-red-500">*</Text>
            </Text>
            <View className="flex-row items-center">
              <Button
                variant="outline"
                onPress={() => setShowEndDatePicker(true)}
                className="mr-2 flex-row items-center gap-2"
              >
                <MaterialIcons
                  name="calendar-today"
                  size={18}
                  color={colorScheme === "dark" ? "#fff" : "#000"}
                />
                <Text>
                  {calculationEndDate
                    ? calculationEndDate.toLocaleDateString()
                    : "Select date"}
                </Text>
              </Button>
              <Button
                className="bg-blue-600"
                onPress={() => {
                  // Validate required fields
                  if (combinedTransactions.length === 0) {
                    Alert.alert(
                      "Missing Transactions",
                      "Please add at least one borrowal or repayment before calculating interest."
                    );
                    return;
                  }
                  if (!interestRate || interestRate.trim() === "") {
                    Alert.alert(
                      "Missing Interest Rate",
                      "Please enter the loan interest rate before calculating interest."
                    );
                    return;
                  }
                  if (
                    parseFloat(interestRate) <= 0 ||
                    isNaN(parseFloat(interestRate))
                  ) {
                    Alert.alert(
                      "Invalid Interest Rate",
                      "Please enter a valid interest rate greater than 0. Rates of 100% or higher are allowed."
                    );
                    return;
                  }
                  if (!calculationEndDate) {
                    Alert.alert(
                      "Missing Date",
                      'Please select the "Calculate interest up to" date before calculating interest.'
                    );
                    return;
                  }
                  if (!isCalculationDateValid) {
                    Alert.alert(
                      "Invalid Date",
                      `The "Calculate interest up to" date must be on or after the latest transaction date (${latestTransactionDate?.toLocaleDateString()}).`
                    );
                    return;
                  }
                  // Calculate results - it will validate and set calculationSuccessful
                  calculateResults(payments, receipts);
                  // Set hasCalculated to true - useEffect will sync it with calculationSuccessful
                  setHasCalculated(true);
                }}
              >
                <Text className="text-white">Calculate Interest</Text>
              </Button>
            </View>
            {calculationEndDate &&
              latestTransactionDate &&
              !isCalculationDateValid && (
                <Text className="mt-1 text-xs text-red-500">
                  Date must be on or after the latest transaction date (
                  {latestTransactionDate.toLocaleDateString()})
                </Text>
              )}
            <Button
              variant="destructive"
              className="mt-4 mb-4"
              onPress={handleClearData}
            >
              <Text className="text-white">Clear</Text>
            </Button>
            {showEndDatePicker ? (
              <DateTimePicker
                value={
                  calculationEndDate ?? (latestTransactionDate || new Date())
                }
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, selectedDate) => {
                  setShowEndDatePicker(Platform.OS === "ios");
                  if (selectedDate) {
                    const d = new Date(selectedDate);
                    d.setHours(0, 0, 0, 0);
                    // Validate the date before setting
                    if (
                      latestTransactionDate &&
                      d.getTime() < latestTransactionDate.getTime()
                    ) {
                      Alert.alert(
                        "Invalid Date",
                        `Date must be on or after the latest transaction date (${latestTransactionDate.toLocaleDateString()})`
                      );
                      return;
                    }
                    saveCalculationEndDate(d);
                  }
                }}
              />
            ) : null}
          </View>

          {/* Simple table of all borrowals and repayments */}
          <TransactionTable
            transactions={combinedTransactions}
            onEditPayment={handleEditPayment}
            onDeletePayment={handleDeletePayment}
            onEditReceipt={handleEditReceipt}
            onDeleteReceipt={handleDeleteReceipt}
          />

          {/* Results Display */}
          {hasCalculated && calculationSuccessful && (
            <CalculatedResults
              loanAmount={loanAmount}
              calculatedResultsInterest={calculatedResultsInterest}
              calculatedAmount={calculatedAmount}
            />
          )}

          {/* Yearly compounding summaries (every 1 calendar year since first transaction) */}
          {/* Yearly summaries are interleaved with transactions below */}

          {/* Transactions Summary (Combined) */}
          {hasCalculated &&
          calculationSuccessful &&
          (payments.length > 0 || receipts.length > 0) ? (
            <View className="mb-6">
              <Text variant="h3" className="mb-2">
                Interest Report
              </Text>

              <View>
                {(() => {
                  // For report: Combine transactions on the same day into a single net transaction
                  // This matches the calculation logic where same-day transactions are combined
                  const combined = combineTransactionsByDate([
                    ...payments.map((t) => ({
                      ...t,
                      type: "payment" as const,
                    })),
                    ...receipts.map((t) => ({
                      ...t,
                      type: "receipt" as const,
                    })),
                  ]);
                  const summaries = [...yearSummaries].sort(
                    (a, b) =>
                      new Date(a.toDate).getTime() -
                      new Date(b.toDate).getTime()
                  );
                  const endDate = calculationEndDate
                    ? startOfDay(new Date(calculationEndDate))
                    : null;
                  const rate = parseFloat(interestRate || "0") / 100;

                  const rendered = [] as any[];
                  let currentPrincipal = 0;
                  const processedTxIds = new Set<string | number>();

                  // Track final principal and final year interest for total amount due cell
                  let finalPrincipalAfterLastTx = 0; // Track principal after last transaction in final year
                  let finalYearInterestForTotal = 0;
                  const lastSummaryForTotal =
                    summaries.length > 0
                      ? summaries[summaries.length - 1]
                      : null;

                  // Determine if we're in the final year (after last summary or no summaries)
                  const finalYearStart = lastSummaryForTotal
                    ? startOfDay(new Date(lastSummaryForTotal.toDate))
                    : combined.length > 0
                      ? startOfDay(new Date(combined[0].date))
                      : null;

                  // Group transactions by year cycles
                  for (let yearNum = 1; ; yearNum++) {
                    const yearSummary = summaries.find(
                      (s) => s.yearNumber === yearNum
                    );

                    // Determine year start date
                    let yearStart: Date | null = null;
                    if (yearSummary) {
                      yearStart = startOfDay(new Date(yearSummary.fromDate));
                    } else if (yearNum === 1 && combined.length > 0) {
                      yearStart = startOfDay(new Date(combined[0].date));
                    } else if (yearNum > 1) {
                      // For Year 2+ without summary, use the day after previous year's end
                      const prevYearSummary = summaries.find(
                        (s) => s.yearNumber === yearNum - 1
                      );
                      if (prevYearSummary) {
                        const prevYearEnd = startOfDay(
                          new Date(prevYearSummary.toDate)
                        );
                        yearStart = new Date(prevYearEnd);
                        yearStart.setDate(yearStart.getDate() + 1);
                        yearStart = startOfDay(yearStart);
                      } else {
                        // No previous summary either, check if there are unprocessed transactions
                        const unprocessedTxs = combined.filter(
                          (t) => !processedTxIds.has(t.id)
                        );
                        if (unprocessedTxs.length > 0) {
                          // Use the earliest unprocessed transaction date
                          yearStart = startOfDay(
                            new Date(unprocessedTxs[0].date)
                          );
                        }
                      }
                    }

                    const yearEnd = yearSummary
                      ? startOfDay(new Date(yearSummary.toDate))
                      : null;

                    // If no yearStart and no unprocessed transactions, break
                    if (!yearStart) {
                      const unprocessedTxs = combined.filter(
                        (t) => !processedTxIds.has(t.id)
                      );
                      if (unprocessedTxs.length === 0) break;
                      // If there are unprocessed transactions but no yearStart, something is wrong
                      break;
                    }

                    // Collect all transactions in this year that haven't been processed yet
                    // Include transactions on or before the year end date (inclusive)
                    // For Year 2+, transactions on the previous year's end date should be excluded
                    // (they were already processed in the previous year)
                    const prevYearSummary =
                      yearNum > 1
                        ? summaries.find((s) => s.yearNumber === yearNum - 1)
                        : null;
                    const effectiveYearStart = prevYearSummary
                      ? startOfDay(new Date(prevYearSummary.toDate)).getTime() +
                        86400000 // Next day after previous year end
                      : yearStart.getTime();

                    const yearTxs = combined.filter((t) => {
                      const txDate = startOfDay(new Date(t.date));
                      const txTime = txDate.getTime();
                      // If no yearEnd (no year summary), include all transactions >= effectiveYearStart
                      // up to the calculation end date (if it exists)
                      if (!yearEnd) {
                        return (
                          !processedTxIds.has(t.id) &&
                          txTime >= effectiveYearStart &&
                          (!endDate || txTime <= endDate.getTime())
                        );
                      }
                      // If yearEnd exists, include transactions in the range [effectiveYearStart, yearEnd]
                      return (
                        !processedTxIds.has(t.id) &&
                        txTime >= effectiveYearStart &&
                        txTime <= yearEnd.getTime()
                      );
                    });

                    // Add Year heading at the top of each year's section
                    const yearHeading = yearSummary
                      ? `Year ${yearSummary.yearNumber}`
                      : `Year ${yearNum}`;
                    rendered.push(
                      <View
                        key={`year-heading-${yearNum}`}
                        className="mb-4 mt-6"
                      >
                        <Text className="text-xl font-bold">{yearHeading}</Text>
                      </View>
                    );

                    // Use previous year's newPrincipal as starting principal for this year
                    if (yearSummary) {
                      const prevSummary = summaries.find(
                        (s) => s.yearNumber === yearNum - 1
                      );
                      currentPrincipal = prevSummary
                        ? prevSummary.newPrincipal
                        : 0;
                    }

                    // If there's a year summary but no transactions, show interest calculation for the entire year
                    if (yearSummary && yearTxs.length === 0 && yearEnd) {
                      if (currentPrincipal > 0) {
                        const finalSegmentEnd =
                          endDate && endDate.getTime() < yearEnd.getTime()
                            ? endDate
                            : yearEnd;

                        if (finalSegmentEnd.getTime() > yearStart.getTime()) {
                          const res = calculateInterestWithAnnualCompounding(
                            currentPrincipal,
                            rate * 100,
                            yearStart,
                            finalSegmentEnd
                          );
                          const days = diffDaysExclusive(
                            yearStart,
                            finalSegmentEnd
                          );
                          rendered.push(
                            <View
                              key={`int-${yearNum}-no-tx`}
                              className="mb-2 p-2 rounded bg-blue-50 dark:bg-blue-900/30"
                            >
                              <Text className="text-[11px] font-semibold mb-1">
                                {`Current Principal: ₹${formatCurrency(currentPrincipal)}`}
                              </Text>
                              <Text className="text-[10px] text-muted-foreground">
                                {`From: ${yearStart.toLocaleDateString()} → To: ${finalSegmentEnd.toLocaleDateString()}`}
                              </Text>
                              <View className="mt-2 flex-row justify-between items-end">
                                <View>
                                  <Text className="text-xs text-muted-foreground">{`Period: ${days} days`}</Text>
                                </View>
                                <View className="items-end">
                                  <Text className="text-[10px] text-muted-foreground">
                                    Interest
                                  </Text>
                                  <Text className="text-xs font-bold">{`₹${formatCurrency(res.interest)}`}</Text>
                                </View>
                              </View>
                            </View>
                          );
                          currentPrincipal = res.finalPrincipal;
                          // Track interest for final year
                          if (
                            finalYearStart &&
                            yearStart.getTime() >= finalYearStart.getTime()
                          ) {
                            finalYearInterestForTotal += res.interest;
                          }
                        }
                      }
                    }

                    // Render interest cells between consecutive transactions in this year
                    // Track the principal displayed in the last interest cell (for repayments on anniversary)
                    // Track principal after each transaction (before interest) for the last cell
                    let lastDisplayedPrincipalRN = currentPrincipal;
                    let principalAfterTxRN = currentPrincipal; // Track principal after each transaction (before interest)
                    for (let i = 0; i < yearTxs.length; i++) {
                      const tx = yearTxs[i];
                      const txDate = startOfDay(new Date(tx.date));

                      // Interest from previous tx (or year start) to current tx
                      // Calculate interest even if currentPrincipal is 0 (will result in 0 interest, but shows the period)
                      if (i === 0) {
                        const from = yearStart;
                        const to = txDate;
                        if (to.getTime() > from.getTime()) {
                          // If principal is 0 or negative, interest will be 0, but we still calculate to show the period
                          const principalForInterest = Math.max(
                            0,
                            currentPrincipal
                          );
                          const res = calculateInterestWithAnnualCompounding(
                            principalForInterest,
                            rate * 100,
                            from,
                            to
                          );
                          const days = diffDaysExclusive(from, to);
                          rendered.push(
                            <View
                              key={`int-${yearNum}-start-${tx.id}`}
                              className="mb-2 p-2 rounded bg-blue-50 dark:bg-blue-900/30"
                            >
                              <Text className="text-[11px] font-semibold mb-1">
                                {`Current Principal: ₹${formatCurrency(principalForInterest)}`}
                              </Text>
                              <Text className="text-[10px] text-muted-foreground">
                                {`From: ${from.toLocaleDateString()} → To: ${to.toLocaleDateString()}`}
                              </Text>
                              <View className="mt-2 flex-row justify-between items-end">
                                <View>
                                  <Text className="text-xs text-muted-foreground">{`Period: ${days} days`}</Text>
                                </View>
                                <View className="items-end">
                                  <Text className="text-[10px] text-muted-foreground">
                                    Interest
                                  </Text>
                                  <Text className="text-xs font-bold">{`₹${formatCurrency(res.interest)}`}</Text>
                                </View>
                              </View>
                            </View>
                          );
                          // Track the principal displayed in this interest cell
                          lastDisplayedPrincipalRN = principalForInterest;
                          // Only update currentPrincipal if it was positive (to avoid going negative)
                          if (currentPrincipal > 0) {
                            currentPrincipal = res.finalPrincipal;
                          }
                          // Track interest for final year
                          if (
                            finalYearStart &&
                            from.getTime() >= finalYearStart.getTime()
                          ) {
                            finalYearInterestForTotal += res.interest;
                          }
                        }
                      } else if (i > 0) {
                        const prevTx = yearTxs[i - 1];
                        const from = startOfDay(new Date(prevTx.date));
                        const to = txDate;

                        // Check if current transaction is a REPAYMENT on the anniversary date
                        // If repayment is on anniversary date, don't calculate interest from previous tx to repayment date
                        // (We apply repayment directly to previous cell's principal)
                        // For borrowals on anniversary date, we DO calculate interest (to show period before borrowal)
                        const isRepaymentOnAnniversary =
                          tx.type === "payment" &&
                          yearEnd &&
                          txDate.getTime() === yearEnd.getTime();

                        // Calculate interest between transactions
                        // CRITICAL FIX: Even when repayment is on anniversary date, we still need to show the interest cell
                        // The interest from previous transaction (or year start) to anniversary should be displayed
                        // Calculate interest even if currentPrincipal is 0 (will result in 0 interest, but shows the period)
                        // Also show interest cell even if dates are the same (0 days, 0 interest)

                        // Determine the principal and start date for interest calculation
                        let principalForInterestRN: number;
                        let interestFromRN: Date;

                        if (isRepaymentOnAnniversary && i === 1) {
                          // Payment on anniversary, and this is the second transaction
                          // Check if first transaction was on year start date
                          const firstTx = yearTxs[0];
                          const firstTxDate = firstTx
                            ? startOfDay(new Date(firstTx.date))
                            : null;
                          const firstTxOnYearStart =
                            firstTxDate &&
                            firstTxDate.getTime() === yearStart!.getTime();

                          if (firstTxOnYearStart) {
                            // First transaction was on year start - calculate from year start
                            // For Year 1: use principal after first transaction
                            // For Year 2+: use initial principal from previous year
                            const prevYearSummary = summaries.find(
                              (s) => s.yearNumber === yearNum - 1
                            );
                            if (prevYearSummary) {
                              // Year 2+: use initial principal
                              principalForInterestRN = Math.max(
                                0,
                                prevYearSummary.newPrincipal
                              );
                            } else {
                              // Year 1: use principal after first transaction
                              principalForInterestRN = Math.max(
                                0,
                                principalAfterTxRN
                              );
                            }
                            interestFromRN = yearStart!;
                          } else {
                            // Normal case: use principal after previous transaction
                            principalForInterestRN = Math.max(
                              0,
                              principalAfterTxRN
                            );
                            interestFromRN = from;
                          }
                        } else {
                          // Normal case: use principal after previous transaction
                          principalForInterestRN = Math.max(
                            0,
                            principalAfterTxRN
                          );
                          interestFromRN = from;
                        }

                        // Always render the interest cell (even for repayment on anniversary)
                        let res;
                        let days = 0;

                        if (to.getTime() > interestFromRN.getTime()) {
                          // There's a gap - calculate interest
                          res = calculateInterestWithAnnualCompounding(
                            principalForInterestRN,
                            rate * 100,
                            interestFromRN,
                            to
                          );
                          days = diffDaysExclusive(interestFromRN, to);
                        } else {
                          // Same date - show 0 days and 0 interest
                          res = {
                            interest: 0,
                            finalPrincipal: principalForInterestRN,
                          };
                        }

                        rendered.push(
                          <View
                            key={`int-${yearNum}-${i}-${tx.id}`}
                            className="mb-2 p-2 rounded bg-blue-50 dark:bg-blue-900/30"
                          >
                            <Text className="text-[11px] font-semibold mb-1">
                              {`Current Principal: ₹${formatCurrency(principalForInterestRN)}`}
                            </Text>
                            <Text className="text-[10px] text-muted-foreground">
                              {`From: ${interestFromRN.toLocaleDateString()} → To: ${to.toLocaleDateString()}`}
                            </Text>
                            <View className="mt-2 flex-row justify-between items-end">
                              <View>
                                <Text className="text-xs text-muted-foreground">{`Period: ${days} days`}</Text>
                              </View>
                              <View className="items-end">
                                <Text className="text-[10px] text-muted-foreground">
                                  Interest
                                </Text>
                                <Text className="text-xs font-bold">{`₹${formatCurrency(res.interest)}`}</Text>
                              </View>
                            </View>
                          </View>
                        );
                        // Track the principal displayed in this interest cell
                        lastDisplayedPrincipalRN = principalForInterestRN;
                        // Update currentPrincipal with interest for next period
                        if (
                          principalForInterestRN > 0 &&
                          to.getTime() > interestFromRN.getTime()
                        ) {
                          currentPrincipal = res.finalPrincipal;
                        } else {
                          currentPrincipal = principalForInterestRN;
                        }
                        // Track interest for final year
                        if (
                          finalYearStart &&
                          interestFromRN.getTime() >= finalYearStart.getTime()
                        ) {
                          finalYearInterestForTotal += res.interest;
                        }

                        // If repayment is on anniversary, we still update currentPrincipal for the repayment
                        if (isRepaymentOnAnniversary) {
                          // The repayment will be applied to lastDisplayedPrincipalRN (previous cell's principal)
                          // But we've already updated currentPrincipal above, so we need to adjust
                          currentPrincipal = lastDisplayedPrincipalRN;
                        }
                      }

                      // Render transaction cell
                      // Apply transaction to the correct principal:
                      // - If repayment on anniversary: use lastDisplayedPrincipalRN (previous cell's principal)
                      // - Otherwise: use principalAfterTxRN (principal after previous transaction, before interest)
                      // This ensures we don't add interest before applying the transaction
                      const principalBeforeTxRN =
                        tx.type === "payment" &&
                        yearEnd &&
                        txDate.getTime() === yearEnd.getTime()
                          ? lastDisplayedPrincipalRN // Repayment on anniversary: use previous cell's principal
                          : principalAfterTxRN; // Otherwise: use principal after previous transaction (before interest)

                      currentPrincipal =
                        tx.type === "payment"
                          ? Math.max(0, principalBeforeTxRN - tx.amount)
                          : principalBeforeTxRN + tx.amount;

                      // Track principal after this transaction (before interest for next period)
                      // This is the value that should be shown in the last cell
                      principalAfterTxRN = currentPrincipal;

                      // Track principal after last transaction in final year
                      if (
                        finalYearStart &&
                        txDate.getTime() >= finalYearStart.getTime()
                      ) {
                        finalPrincipalAfterLastTx = currentPrincipal;
                      }

                      // Mark transaction as processed
                      processedTxIds.add(tx.id);

                      rendered.push(
                        <View
                          key={`${tx.id}-${tx.date}`}
                          className={`mb-2 p-2 rounded ${tx.type === "payment" ? "bg-red-50 dark:bg-red-900/30" : "bg-green-50 dark:bg-green-900/30"}`}
                        >
                          <View className="flex-1">
                            <Text className="text-sm font-medium">
                              {`${tx.type === "payment" ? "-" : "+"} ₹${formatCurrency(tx.amount)}`}
                            </Text>
                            <Text className="text-xs text-muted-foreground">
                              {tx.date
                                ? new Date(tx.date).toLocaleDateString()
                                : "N/A"}
                            </Text>
                          </View>
                        </View>
                      );
                    }

                    // Render final segment from last transaction to min(year-end, Calculate-upto)
                    // Always render this cell if last transaction is on anniversary date (even if 0 days)
                    // This works for both borrowals (receipts) and repayments (payments) on the anniversary date
                    if (yearSummary && yearTxs.length > 0 && yearEnd) {
                      const lastTx = yearTxs[yearTxs.length - 1];
                      const lastTxDate = startOfDay(new Date(lastTx.date));
                      const finalSegmentEnd =
                        endDate && endDate.getTime() < yearEnd.getTime()
                          ? endDate
                          : yearEnd;

                      // SPECIAL CASE: If there's only one transaction and it's on year start,
                      // calculate interest from year start to anniversary using principal after transaction
                      // This matches the summary calculation logic
                      const isSingleTxOnYearStart =
                        yearTxs.length === 1 &&
                        lastTxDate.getTime() === yearStart!.getTime();

                      // Get principal after last transaction (without interest)
                      // This should be the principal after the last transaction, before any interest calculations
                      // Use principalAfterTxRN which tracks principal after each transaction (before interest)
                      const principalAfterLastTx = principalAfterTxRN;

                      if (
                        isSingleTxOnYearStart &&
                        finalSegmentEnd.getTime() > lastTxDate.getTime()
                      ) {
                        // Only one transaction on year start - calculate interest from year start to anniversary
                        // using principal after the transaction (matches summary calculation)
                        if (principalAfterLastTx > 0) {
                          const res = calculateInterestWithAnnualCompounding(
                            principalAfterLastTx,
                            rate * 100,
                            yearStart!,
                            finalSegmentEnd
                          );
                          const days = diffDaysExclusive(
                            yearStart!,
                            finalSegmentEnd
                          );
                          rendered.push(
                            <View
                              key={`int-${yearNum}-final`}
                              className="mb-2 p-2 rounded bg-blue-50 dark:bg-blue-900/30"
                            >
                              <Text className="text-[11px] font-semibold mb-1">
                                {`Current Principal: ₹${formatCurrency(principalAfterLastTx)}`}
                              </Text>
                              <Text className="text-[10px] text-muted-foreground">
                                {`From: ${yearStart!.toLocaleDateString()} → To: ${finalSegmentEnd.toLocaleDateString()}`}
                              </Text>
                              <View className="mt-2 flex-row justify-between items-end">
                                <View>
                                  <Text className="text-xs text-muted-foreground">{`Period: ${days} days`}</Text>
                                </View>
                                <View className="items-end">
                                  <Text className="text-[10px] text-muted-foreground">
                                    Interest
                                  </Text>
                                  <Text className="text-xs font-bold">{`₹${formatCurrency(res.interest)}`}</Text>
                                </View>
                              </View>
                            </View>
                          );
                          // Track interest for final year
                          if (
                            finalYearStart &&
                            yearStart!.getTime() >= finalYearStart.getTime()
                          ) {
                            finalYearInterestForTotal += res.interest;
                          }
                        }
                      } else if (
                        finalSegmentEnd.getTime() > lastTxDate.getTime()
                      ) {
                        // There's a gap - calculate interest
                        if (principalAfterLastTx > 0) {
                          const res = calculateInterestWithAnnualCompounding(
                            principalAfterLastTx,
                            rate * 100,
                            lastTxDate,
                            finalSegmentEnd
                          );
                          const days = diffDaysExclusive(
                            lastTxDate,
                            finalSegmentEnd
                          );
                          rendered.push(
                            <View
                              key={`int-${yearNum}-final`}
                              className="mb-2 p-2 rounded bg-blue-50 dark:bg-blue-900/30"
                            >
                              <Text className="text-[11px] font-semibold mb-1">
                                {`Current Principal: ₹${formatCurrency(principalAfterLastTx)}`}
                              </Text>
                              <Text className="text-[10px] text-muted-foreground">
                                {`From: ${lastTxDate.toLocaleDateString()} → To: ${finalSegmentEnd.toLocaleDateString()}`}
                              </Text>
                              <View className="mt-2 flex-row justify-between items-end">
                                <View>
                                  <Text className="text-xs text-muted-foreground">{`Period: ${days} days`}</Text>
                                </View>
                                <View className="items-end">
                                  <Text className="text-[10px] text-muted-foreground">
                                    Interest
                                  </Text>
                                  <Text className="text-xs font-bold">{`₹${formatCurrency(res.interest)}`}</Text>
                                </View>
                              </View>
                            </View>
                          );
                          // Track interest for final year
                          if (
                            finalYearStart &&
                            lastTxDate.getTime() >= finalYearStart.getTime()
                          ) {
                            finalYearInterestForTotal += res.interest;
                          }
                        }
                      } else if (
                        finalSegmentEnd.getTime() === lastTxDate.getTime()
                      ) {
                        // Same date - show 0 days and ₹0 interest
                        // Always show this cell regardless of principal amount (works for both borrowals and repayments)
                        const days = 0;
                        rendered.push(
                          <View
                            key={`int-${yearNum}-final`}
                            className="mb-2 p-2 rounded bg-blue-50 dark:bg-blue-900/30"
                          >
                            <Text className="text-[11px] font-semibold mb-1">
                              {`Current Principal: ₹${formatCurrency(principalAfterLastTx)}`}
                            </Text>
                            <Text className="text-[10px] text-muted-foreground">
                              {`From: ${lastTxDate.toLocaleDateString()} → To: ${finalSegmentEnd.toLocaleDateString()}`}
                            </Text>
                            <View className="mt-2 flex-row justify-between items-end">
                              <View>
                                <Text className="text-xs text-muted-foreground">{`Period: ${days} days`}</Text>
                              </View>
                              <View className="items-end">
                                <Text className="text-[10px] text-muted-foreground">
                                  Interest
                                </Text>
                                <Text className="text-xs font-bold">{`₹${formatCurrency(0)}`}</Text>
                              </View>
                            </View>
                          </View>
                        );
                      }
                    }
                    if (yearSummary) {
                      rendered.push(
                        <View
                          key={`ys-${yearSummary.yearNumber}-${yearSummary.toDate}`}
                          className="mb-3 p-2 rounded bg-yellow-50 dark:bg-yellow-900/30"
                        >
                          <Text className="text-xs font-bold">{`Year ${yearSummary.yearNumber} Summary`}</Text>
                          <View className="mt-2 pt-2 border-t border-yellow-200 dark:border-yellow-800">
                            <View className="flex-row justify-between items-end">
                              <View>
                                <Text className="text-[10px] text-muted-foreground">
                                  {`From: ${new Date(yearSummary.fromDate).toLocaleDateString()} → To: ${new Date(yearSummary.toDate).toLocaleDateString()}`}
                                </Text>
                                <Text className="text-xs text-muted-foreground">
                                  {`Current Year's Interest: ₹${formatCurrency(yearSummary.interest)}`}
                                </Text>
                              </View>
                              <View className="items-end">
                                <Text className="text-[10px] text-muted-foreground">
                                  New Principal
                                </Text>
                                <Text className="text-xs font-bold">{`₹${formatCurrency(yearSummary.newPrincipal)}`}</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                      currentPrincipal = yearSummary.newPrincipal;
                    }

                    // Check if we should stop (no more summaries or reached end date)
                    const shouldStop =
                      !yearSummary ||
                      !endDate ||
                      (yearEnd && yearEnd.getTime() >= endDate.getTime());

                    // If no year summary but we have transactions and endDate is after last transaction
                    if (!yearSummary && yearTxs.length > 0 && endDate) {
                      const lastTxInYear = yearTxs[yearTxs.length - 1];
                      const lastTxDateInYear = startOfDay(
                        new Date(lastTxInYear.date)
                      );
                      if (endDate.getTime() > lastTxDateInYear.getTime()) {
                        // Calculate final segment from last transaction to endDate
                        const principalAfterLastTxInYear =
                          lastTxInYear.type === "payment"
                            ? Math.max(0, currentPrincipal)
                            : currentPrincipal;

                        if (principalAfterLastTxInYear > 0) {
                          const res = calculateInterestWithAnnualCompounding(
                            principalAfterLastTxInYear,
                            rate * 100,
                            lastTxDateInYear,
                            endDate
                          );
                          const days = diffDaysExclusive(
                            lastTxDateInYear,
                            endDate
                          );
                          rendered.push(
                            <View
                              key={`final-no-summary-${yearNum}`}
                              className="mb-2 p-2 rounded bg-blue-50 dark:bg-blue-900/30"
                            >
                              <Text className="text-[11px] font-semibold mb-1">
                                {`Current Principal: ₹${formatCurrency(principalAfterLastTxInYear)}`}
                              </Text>
                              <Text className="text-[10px] text-muted-foreground">
                                {`From: ${lastTxDateInYear.toLocaleDateString()} → To: ${endDate.toLocaleDateString()}`}
                              </Text>
                              <View className="mt-2 flex-row justify-between items-end">
                                <View>
                                  <Text className="text-xs text-muted-foreground">{`Period: ${days} days`}</Text>
                                </View>
                                <View className="items-end">
                                  <Text className="text-[10px] text-muted-foreground">
                                    Interest
                                  </Text>
                                  <Text className="text-xs font-bold">{`₹${formatCurrency(res.interest)}`}</Text>
                                </View>
                              </View>
                            </View>
                          );
                          // Track interest for final year
                          if (
                            finalYearStart &&
                            lastTxDateInYear.getTime() >=
                              finalYearStart.getTime()
                          ) {
                            finalYearInterestForTotal += res.interest;
                          }
                        }
                        // Stop after this since we've reached endDate
                        break;
                      }
                    }

                    if (shouldStop) break;
                  }

                  // Render final partial period after last year summary
                  // ONLY if there are NO transactions between the last summary's toDate and endDate
                  // If there are transactions, they should have already been processed in the year loop
                  const lastSummary =
                    summaries.length > 0
                      ? summaries[summaries.length - 1]
                      : null;
                  if (lastSummary && endDate) {
                    const finalStart = startOfDay(new Date(lastSummary.toDate));
                    if (endDate.getTime() > finalStart.getTime()) {
                      // Check if there are any transactions between finalStart and endDate
                      const transactionsAfterSummary = combined.filter((t) => {
                        const txDate = startOfDay(new Date(t.date));
                        return (
                          txDate.getTime() > finalStart.getTime() &&
                          txDate.getTime() <= endDate.getTime()
                        );
                      });

                      // Only render final period if there are NO transactions after the summary
                      // AND the endDate is after the finalStart
                      if (transactionsAfterSummary.length === 0) {
                        const principalBeforeFinal = Math.max(
                          0,
                          lastSummary.newPrincipal
                        );
                        if (principalBeforeFinal > 0) {
                          const res = calculateInterestWithAnnualCompounding(
                            principalBeforeFinal,
                            rate * 100,
                            finalStart,
                            endDate
                          );
                          const days = diffDaysExclusive(finalStart, endDate);
                          rendered.push(
                            <View
                              key={`final-partial-${lastSummary.yearNumber}`}
                              className="mb-2 p-2 rounded bg-blue-50 dark:bg-blue-900/30"
                            >
                              <Text className="text-[11px] font-semibold mb-1">
                                {`Current Principal: ₹${formatCurrency(principalBeforeFinal)}`}
                              </Text>
                              <Text className="text-[10px] text-muted-foreground">
                                {`From: ${finalStart.toLocaleDateString()} → To: ${endDate.toLocaleDateString()}`}
                              </Text>
                              <View className="mt-2 flex-row justify-between items-end">
                                <View>
                                  <Text className="text-xs text-muted-foreground">{`Period: ${days} days`}</Text>
                                </View>
                                <View className="items-end">
                                  <Text className="text-[10px] text-muted-foreground">
                                    Interest
                                  </Text>
                                  <Text className="text-xs font-bold">{`₹${formatCurrency(res.interest)}`}</Text>
                                </View>
                              </View>
                            </View>
                          );
                          // Track interest for final year
                          if (
                            finalYearStart &&
                            finalStart.getTime() >= finalYearStart.getTime()
                          ) {
                            finalYearInterestForTotal += res.interest;
                            // If no transactions after summary, principal after last transaction is the principal before final
                            if (finalPrincipalAfterLastTx === 0) {
                              finalPrincipalAfterLastTx = principalBeforeFinal;
                            }
                          }
                        }
                      }
                    }
                  }

                  // Add Total Amount Due cell at the bottom
                  // Use the actual calculated values (loanAmount and calculatedInterest)
                  // to ensure the math adds up correctly
                  if (
                    hasCalculated &&
                    calculationSuccessful &&
                    calculatedAmount > 0
                  ) {
                    rendered.push(
                      <View
                        key="total-amount-due"
                        className="mb-2 rounded bg-purple-50 dark:bg-purple-900/30 border-2 border-purple-200 dark:border-purple-800"
                        style={{ padding: 12 }}
                      >
                        <Text className="text-sm font-bold mb-3">
                          Total Amount Due
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 4,
                          }}
                        >
                          <View
                            style={{ flex: 1, minWidth: 65, maxWidth: "30%" }}
                          >
                            <Text className="text-[10px] text-muted-foreground">
                              Current Principal
                            </Text>
                            <Text
                              className="text-xs font-semibold"
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {`₹${formatCurrency(currentPrincipalForTotal)}`}
                            </Text>
                          </View>
                          <Text
                            className="text-sm font-bold"
                            style={{ marginHorizontal: 2 }}
                          >
                            +
                          </Text>
                          <View
                            style={{ flex: 1, minWidth: 65, maxWidth: "30%" }}
                          >
                            <Text className="text-[10px] text-muted-foreground">
                              Final Year&apos;s Interest
                            </Text>
                            <Text
                              className="text-xs font-semibold"
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {`₹${formatCurrency(calculatedInterest)}`}
                            </Text>
                          </View>
                          <Text
                            className="text-sm font-bold"
                            style={{ marginHorizontal: 2 }}
                          >
                            =
                          </Text>
                          <View
                            style={{
                              flex: 1,
                              minWidth: 65,
                              maxWidth: "30%",
                              alignItems: "flex-end",
                            }}
                          >
                            <Text className="text-[10px] text-muted-foreground">
                              Total
                            </Text>
                            <Text
                              className="text-xs font-bold"
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {`₹${formatCurrency(calculatedAmount)}`}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  }

                  return rendered;
                })()}
              </View>
            </View>
          ) : null}

          {/* Last transaction in separate cell removed; all transactions render in the combined list */}
          {/* Final partial period calculation is now handled in the main rendering loop above */}

          {/* Final period separate transaction-like cell is rendered in the Annual and final segments section above */}

          {/* Export to PDF Button at bottom */}
          {hasCalculated &&
            calculationSuccessful &&
            (combinedTransactions.length > 0 || calculatedAmount > 0) && (
              <View className="mb-6">
                <Button className="bg-purple-600 mt-3" onPress={exportToPDF}>
                  <View className="flex-row items-center justify-center">
                    <MaterialIcons
                      name="picture-as-pdf"
                      size={18}
                      color="#ffffff"
                      style={{ marginRight: 8 }}
                    />
                    <Text className="text-white">Export to PDF</Text>
                  </View>
                </Button>
              </View>
            )}
        </ScrollView>
      </View>

      {/* Payment Modal */}
      <TransactionModal
        key={`payment-${editingPayment?.id || "new"}-${showPaymentModal}`}
        visible={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setEditingPayment(null);
        }}
        onSubmit={(amount, date) =>
          handlePaymentSubmit(amount, date, editingPayment?.id || null)
        }
        editingTransaction={editingPayment}
        type="payment"
      />

      {/* Receipt Modal */}
      <TransactionModal
        key={`receipt-${editingReceipt?.id || "new"}-${showReceiptModal}`}
        visible={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          setEditingReceipt(null);
        }}
        onSubmit={(amount, date) =>
          handleReceiptSubmit(amount, date, editingReceipt?.id || null)
        }
        editingTransaction={editingReceipt}
        type="receipt"
      />
    </SafeAreaView>
  );
}
