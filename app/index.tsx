import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Text } from "@/components/ui/text";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, ScrollView, StatusBar, View } from "react-native";
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
  CALCULATION_END_DATE: "@money_lender:calculation_end_date",
};

// Helper function to format currency safely (₹, no decimals)
const formatCurrency = (amount: number | string | undefined): string => {
  const toNumber = (val: number | string | undefined): number => {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const num = parseFloat(val);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };
  const rounded = Math.round(toNumber(amount));
  try {
    // Indian numbering format without decimals
    return rounded.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  } catch {
    return String(rounded);
  }
};

// Normalize a date to local start of day (00:00:00.000)
const startOfDay = (d: Date): Date => {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd;
};

// Add calendar years preserving month/day when possible
// If the target month doesn't have the same day (e.g., Feb 29 → Feb end), clamp to last day of month
const addCalendarYears = (d: Date, years: number): Date => {
  const year = d.getFullYear() + years;
  const month = d.getMonth();
  const day = d.getDate();
  const candidate = new Date(year, month, day);
  if (candidate.getMonth() !== month) {
    // Day overflowed (e.g., Feb 30). Use day 0 of next month which is last day of desired month
    return new Date(year, month + 1, 0);
  }
  return candidate;
};

// Exclusive end day difference in whole days using normalized dates
// Example: 1 Jul → 31 Jul returns 30
const diffDaysExclusive = (start: Date, end: Date): number => {
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  return Math.max(0, Math.floor((e - s) / (1000 * 60 * 60 * 24)));
};

export default function Index() {
  const [interestRate, setInterestRate] = useState<string>("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [payments, setPayments] = useState<Transaction[]>([]);
  const [receipts, setReceipts] = useState<Transaction[]>([]);
  const [calculationEndDate, setCalculationEndDate] = useState<Date | null>(
    null
  );
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

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
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
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

  // Load data from storage
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [storedRate, storedPayments, storedReceipts, storedEndDate] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.INTEREST_RATE),
          AsyncStorage.getItem(STORAGE_KEYS.PAYMENTS),
          AsyncStorage.getItem(STORAGE_KEYS.RECEIPTS),
          AsyncStorage.getItem(STORAGE_KEYS.CALCULATION_END_DATE),
        ]);

      if (storedRate) setInterestRate(storedRate);
      if (storedPayments) setPayments(JSON.parse(storedPayments));
      if (storedReceipts) setReceipts(JSON.parse(storedReceipts));
      if (storedEndDate) {
        const parsedDate = new Date(storedEndDate);
        if (!isNaN(parsedDate.getTime())) {
          setCalculationEndDate(parsedDate);
        }
      }
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

  const saveCalculationEndDate = async (date: Date | null) => {
    try {
      if (date) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.CALCULATION_END_DATE,
          date.toISOString()
        );
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.CALCULATION_END_DATE);
      }
      setCalculationEndDate(date);
    } catch (error) {
      console.error("Error saving calculation end date:", error);
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
                STORAGE_KEYS.CALCULATION_END_DATE,
              ]);
              setInterestRate("");
              setPayments([]);
              setReceipts([]);
              setTransactionPeriods([]);
              setYearSummaries([]);
              setCalculatedInterest(0);
              setCalculatedAmount(0);
              setLoanAmount(0);
              setCalculationDetails("");
              setCalculationEndDate(null);
              setHasCalculated(false);
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

    // Validate: Transaction date cannot be after "calculate interest upto" date
    if (calculationEndDate) {
      const txDate = startOfDay(paymentDate);
      const calcDate = startOfDay(calculationEndDate);
      if (txDate.getTime() > calcDate.getTime()) {
        Alert.alert(
          "Invalid Date",
          `Transaction date cannot be after the "Calculate interest up to" date (${calculationEndDate.toLocaleDateString()})`
        );
        return;
      }
    }

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
              if (
                calculationEndDate &&
                interestRate &&
                parseFloat(interestRate) > 0
              ) {
                calculateResults(updatedPayments, receipts);
              }
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

    // Validate: Transaction date cannot be after "calculate interest upto" date
    if (calculationEndDate) {
      const txDate = startOfDay(receiptDate);
      const calcDate = startOfDay(calculationEndDate);
      if (txDate.getTime() > calcDate.getTime()) {
        Alert.alert(
          "Invalid Date",
          `Transaction date cannot be after the "Calculate interest up to" date (${calculationEndDate.toLocaleDateString()})`
        );
        return;
      }
    }

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
              if (
                calculationEndDate &&
                interestRate &&
                parseFloat(interestRate) > 0
              ) {
                calculateResults(payments, updatedReceipts);
              }
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
      const today = calculationEndDate
        ? startOfDay(new Date(calculationEndDate))
        : startOfDay(new Date());

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
          ].sort((a, b) => a.date.getTime() - b.date.getTime());

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
              const yearTxsForPrincipal = allTransactions
                .filter(
                  (t) =>
                    startOfDay(new Date(t.date)).getTime() >=
                      currentYearStart.getTime() &&
                    startOfDay(new Date(t.date)).getTime() <
                      startOfDay(event.date).getTime()
                )
                .sort(
                  (a, b) =>
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                );
              // Start from previous year's new principal
              const prevSummary =
                summaries.length > 0 ? summaries[summaries.length - 1] : null;
              let principalBeforeFinalSegment = prevSummary
                ? prevSummary.newPrincipal
                : 0;
              for (const t of yearTxsForPrincipal) {
                principalBeforeFinalSegment =
                  t.type === "payment"
                    ? Math.max(0, principalBeforeFinalSegment - t.amount)
                    : principalBeforeFinalSegment + t.amount;
              }
              const newPrincipalManual =
                principalBeforeFinalSegment + yearAccrued;

              summaries.push({
                yearNumber,
                fromDate: currentYearStart.toISOString(),
                toDate: event.date.toISOString(),
                interest: yearAccrued,
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

      // Compute Total Amount Due per spec (without relying on summaries order):
      // Principal-before of LAST cell should be the New Principal from the last year summary,
      // falling back to the computed final principal-before when no summary exists yet
      const lastSummaryForTotal =
        summaries.length > 0 ? summaries[summaries.length - 1] : null;
      const principalBeforeLastCell = Math.max(
        0,
        (lastSummaryForTotal
          ? lastSummaryForTotal.newPrincipal
          : finalPrincipalBeforeForDisplay) || 0
      );

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

      const totalAmountDue = principalBeforeLastCell + finalYearInterestSum;

      setLoanAmount(outstandingPrincipal);
      setCalculatedInterest(Math.max(0, totalAmountDue - outstandingPrincipal));
      setCalculatedAmount(Math.max(0, totalAmountDue));
      setCalculationDetails(details);
    },
    [interestRate, calculationEndDate]
  );

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
  const combinedTransactions = [
    ...payments.map((t) => ({ ...t, type: "payment" as const })),
    ...receipts.map((t) => ({ ...t, type: "receipt" as const })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

      const sortedTransactions = [...combinedTransactions].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
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
  <p><strong>Interest Rate:</strong> ${interestRate || "N/A"}% per year (360 day year)</p>
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
    <p><span class="label">Interest:</span> ₹${formatCurrency(calculatedInterest)}</p>
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
          for (let i = 0; i < yearTxs.length; i++) {
            const tx = yearTxs[i];
            const txDate = startOfDay(new Date(tx.date));

            // Interest from previous tx (or year start) to current tx
            if (i === 0 && currentPrincipal > 0) {
              const from = yearStart!;
              const to = txDate;
              if (to.getTime() > from.getTime()) {
                const res = calculateInterestWithAnnualCompounding(
                  currentPrincipal,
                  rate * 100,
                  from,
                  to
                );
                const days = diffDaysExclusive(from, to);
                htmlContent += `
  <div class="interest-cell">
    <p><strong>Current Principal:</strong> ₹${formatCurrency(currentPrincipal)}</p>
    <p><strong>From:</strong> ${from.toLocaleDateString()} → <strong>To:</strong> ${to.toLocaleDateString()}</p>
    <p><strong>Period:</strong> ${days} days</p>
    <p><strong>Interest:</strong> ₹${formatCurrency(res.interest)}</p>
  </div>`;
                currentPrincipal = res.finalPrincipal;
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

              if (to.getTime() > from.getTime() && currentPrincipal > 0) {
                const res = calculateInterestWithAnnualCompounding(
                  currentPrincipal,
                  rate * 100,
                  from,
                  to
                );
                const days = diffDaysExclusive(from, to);
                htmlContent += `
  <div class="interest-cell">
    <p><strong>Current Principal:</strong> ₹${formatCurrency(currentPrincipal)}</p>
    <p><strong>From:</strong> ${from.toLocaleDateString()} → <strong>To:</strong> ${to.toLocaleDateString()}</p>
    <p><strong>Period:</strong> ${days} days</p>
    <p><strong>Interest:</strong> ₹${formatCurrency(res.interest)}</p>
  </div>`;
                currentPrincipal = res.finalPrincipal;
                // Track interest for final year
                if (
                  finalYearStart &&
                  from.getTime() >= finalYearStart.getTime()
                ) {
                  finalYearInterestForTotal += res.interest;
                }
              }
            }

            // Render transaction cell (without Principal before)
            currentPrincipal =
              tx.type === "payment"
                ? Math.max(0, currentPrincipal - tx.amount)
                : currentPrincipal + tx.amount;

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
          if (yearSummary && yearTxs.length > 0 && yearEnd) {
            const lastTx = yearTxs[yearTxs.length - 1];
            const lastTxDate = startOfDay(new Date(lastTx.date));
            const finalSegmentEnd =
              endDate && endDate.getTime() < yearEnd.getTime()
                ? endDate
                : yearEnd;

            if (finalSegmentEnd.getTime() > lastTxDate.getTime()) {
              const principalAfterLastTx =
                lastTx.type === "payment"
                  ? Math.max(0, currentPrincipal)
                  : currentPrincipal;

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
        if (calculatedAmount > 0) {
          // Current Principal = Principal after last transaction in final year
          const finalPrincipalForDisplay =
            finalPrincipalAfterLastTx > 0
              ? finalPrincipalAfterLastTx
              : finalYearInterestForTotal > 0
                ? calculatedAmount - finalYearInterestForTotal
                : calculatedAmount;
          htmlContent += `
  <div class="summary-box" style="background-color: #e6d5f7; border: 2px solid #9b59b6; margin-top: 20px;">
    <h3>Total Amount Due</h3>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
      <div>
        <p style="font-size: 11px; color: #666;">Current Principal</p>
        <p style="font-weight: bold; font-size: 13px;">₹${formatCurrency(finalPrincipalForDisplay)}</p>
      </div>
      <p style="font-size: 18px; font-weight: bold;">+</p>
      <div>
        <p style="font-size: 11px; color: #666;">Final Year&apos;s Interest</p>
        <p style="font-weight: bold; font-size: 13px;">₹${formatCurrency(finalYearInterestForTotal)}</p>
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
      console.error("Error generating PDF:", error);
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar hidden={false} translucent={false} barStyle="dark-content" />
      <ScrollView className="flex-1 px-4 pt-4">
        <View className="mb-6">
          <Text variant="h2" className="mb-4">
            Money Lender App
          </Text>

          {/* Action Buttons moved to top */}
          <View
            className="flex-row justify-between w-full mb-4"
            style={{ gap: 4 }}
          >
            <Button
              className="bg-red-600 flex-1"
              onPress={() => setShowReceiptModal(true)}
              style={{ minHeight: 48, paddingVertical: 8 }}
            >
              <Text
                className="text-white text-center"
                style={{ fontSize: 14, fontWeight: "600" }}
              >
                Add Borrowal
              </Text>
            </Button>
            <Button
              className="bg-green-600 flex-1"
              onPress={() => setShowPaymentModal(true)}
              style={{ minHeight: 48, paddingVertical: 8 }}
            >
              <Text
                className="text-white text-center"
                style={{ fontSize: 14, fontWeight: "600" }}
              >
                Add Repayment
              </Text>
            </Button>
          </View>

          <View className="mb-4">
            <View className="mb-2 flex-row items-center">
              <Text className="text-sm font-medium">
                Loan Interest Rate per Year (%) - 360 Day Year{" "}
                <Text className="text-red-500">*</Text>
              </Text>
            </View>
            <Input
              value={interestRate}
              onChangeText={(text) => {
                setInterestRate(text);
                saveInterestRate(text);
              }}
              keyboardType="numeric"
              placeholder="Enter interest rate (e.g., 10)"
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
                className="mr-2"
              >
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
                      "Please enter a valid interest rate greater than 0."
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
                  calculateResults(payments, receipts);
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
        </View>

        {/* Simple table of all borrowals and repayments */}
        {combinedTransactions.length > 0 ? (
          <View className="mb-4 p-3 bg-muted rounded-lg">
            <Text variant="h3" className="mb-2">
              Transactions
            </Text>
            {/* Header */}
            <View className="flex-row justify-between pb-1 border-b border-border mb-2">
              <Text className="text-xs font-semibold" style={{ width: "35%" }}>
                Date
              </Text>
              <Text
                className="text-xs font-semibold"
                style={{ width: "35%", textAlign: "center" }}
              >
                Type
              </Text>
              <Text
                className="text-xs font-semibold"
                style={{ width: "30%", textAlign: "right" }}
              >
                Amount (₹)
              </Text>
            </View>
            {/* Rows */}
            {combinedTransactions.map((t) => (
              <View
                key={`table-${t.id}`}
                className="flex-row justify-between py-1"
              >
                <Text className="text-xs" style={{ width: "35%" }}>
                  {new Date(t.date).toLocaleDateString()}
                </Text>
                <Text
                  className="text-xs"
                  style={{ width: "35%", textAlign: "center" }}
                >
                  {t.type === "receipt" ? "Borrowal" : "Repayment"}
                </Text>
                <Text
                  className="text-xs"
                  style={{ width: "30%", textAlign: "right" }}
                >
                  {formatCurrency(t.amount)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Results Display */}
        {hasCalculated && (calculatedInterest > 0 || loanAmount !== 0) ? (
          <>
            <View className="mb-6 p-4 bg-muted rounded-lg">
              <Text variant="h3" className="mb-2">
                Calculated Results
              </Text>
              <Text className="mb-1">{`Outstanding Principal: ₹${formatCurrency(loanAmount)}`}</Text>
              <Text className="mb-1">{`Interest: ₹${formatCurrency(calculatedInterest)}`}</Text>
              <Text variant="h4" className="mt-2">
                {`Total Amount Due: ₹${formatCurrency(calculatedAmount)}`}
              </Text>
              {/* Removed overall summary range display per request */}
            </View>
          </>
        ) : null}

        {/* Yearly compounding summaries (every 1 calendar year since first transaction) */}
        {/* Yearly summaries are interleaved with transactions below */}

        {/* Transactions Summary (Combined) */}
        {hasCalculated && (payments.length > 0 || receipts.length > 0) ? (
          <View className="mb-6">
            <Text variant="h3" className="mb-2">
              Interest Report
            </Text>

            <View>
              {(() => {
                const combined = [
                  ...payments.map((t) => ({ ...t, type: "payment" as const })),
                  ...receipts.map((t) => ({ ...t, type: "receipt" as const })),
                ].sort(
                  (a, b) =>
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                );
                const summaries = [...yearSummaries].sort(
                  (a, b) =>
                    new Date(a.toDate).getTime() - new Date(b.toDate).getTime()
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
                  summaries.length > 0 ? summaries[summaries.length - 1] : null;

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
                            className="mb-2 p-2 rounded bg-blue-50"
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
                  for (let i = 0; i < yearTxs.length; i++) {
                    const tx = yearTxs[i];
                    const txDate = startOfDay(new Date(tx.date));

                    // Interest from previous tx (or year start) to current tx
                    if (i === 0 && currentPrincipal > 0) {
                      const from = yearStart;
                      const to = txDate;
                      if (to.getTime() > from.getTime()) {
                        const res = calculateInterestWithAnnualCompounding(
                          currentPrincipal,
                          rate * 100,
                          from,
                          to
                        );
                        const days = diffDaysExclusive(from, to);
                        rendered.push(
                          <View
                            key={`int-${yearNum}-start-${tx.id}`}
                            className="mb-2 p-2 rounded bg-blue-50"
                          >
                            <Text className="text-[11px] font-semibold mb-1">
                              {`Current Principal: ₹${formatCurrency(currentPrincipal)}`}
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
                        currentPrincipal = res.finalPrincipal;
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
                      // currentPrincipal already includes prevTx from previous iteration
                      // So we don't need to update it again here

                      if (
                        to.getTime() > from.getTime() &&
                        currentPrincipal > 0
                      ) {
                        const res = calculateInterestWithAnnualCompounding(
                          currentPrincipal,
                          rate * 100,
                          from,
                          to
                        );
                        const days = diffDaysExclusive(from, to);
                        rendered.push(
                          <View
                            key={`int-${yearNum}-${i}-${tx.id}`}
                            className="mb-2 p-2 rounded bg-blue-50"
                          >
                            <Text className="text-[11px] font-semibold mb-1">
                              {`Current Principal: ₹${formatCurrency(currentPrincipal)}`}
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
                        currentPrincipal = res.finalPrincipal;
                        // Track interest for final year
                        if (
                          finalYearStart &&
                          from.getTime() >= finalYearStart.getTime()
                        ) {
                          finalYearInterestForTotal += res.interest;
                        }
                      }
                    }

                    // Render transaction cell
                    currentPrincipal =
                      tx.type === "payment"
                        ? Math.max(0, currentPrincipal - tx.amount)
                        : currentPrincipal + tx.amount;

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
                        className={`mb-2 p-2 rounded relative ${tx.type === "payment" ? "bg-red-50" : "bg-green-50"}`}
                      >
                        <View
                          className="absolute top-2 right-2 flex-row z-10"
                          pointerEvents="box-none"
                        >
                          {tx.type === "payment" ? (
                            <>
                              <Button
                                variant="outline"
                                className="h-7 w-7 rounded-full p-0 mr-1 bg-white border-blue-600 items-center justify-center"
                                onPress={() => handleEditPayment(tx)}
                                hitSlop={{
                                  top: 8,
                                  bottom: 8,
                                  left: 8,
                                  right: 8,
                                }}
                              >
                                <MaterialIcons
                                  name="edit"
                                  size={14}
                                  color="#2563eb"
                                />
                              </Button>
                              <Button
                                variant="destructive"
                                className="h-7 w-7 rounded-full p-0 bg-red-600 items-center justify-center"
                                onPress={() => handleDeletePayment(tx.id)}
                                hitSlop={{
                                  top: 8,
                                  bottom: 8,
                                  left: 8,
                                  right: 8,
                                }}
                              >
                                <MaterialIcons
                                  name="delete"
                                  size={14}
                                  color="#ffffff"
                                />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                className="h-7 w-7 rounded-full p-0 mr-1 bg-white border-blue-600 items-center justify-center"
                                onPress={() => handleEditReceipt(tx)}
                                hitSlop={{
                                  top: 8,
                                  bottom: 8,
                                  left: 8,
                                  right: 8,
                                }}
                              >
                                <MaterialIcons
                                  name="edit"
                                  size={14}
                                  color="#2563eb"
                                />
                              </Button>
                              <Button
                                variant="destructive"
                                className="h-7 w-7 rounded-full p-0 bg-red-600 items-center justify-center"
                                onPress={() => handleDeleteReceipt(tx.id)}
                                hitSlop={{
                                  top: 8,
                                  bottom: 8,
                                  left: 8,
                                  right: 8,
                                }}
                              >
                                <MaterialIcons
                                  name="delete"
                                  size={14}
                                  color="#ffffff"
                                />
                              </Button>
                            </>
                          )}
                        </View>
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
                  // Only if there's a year summary (yearEnd exists) and we have transactions
                  if (yearSummary && yearTxs.length > 0 && yearEnd) {
                    const lastTx = yearTxs[yearTxs.length - 1];
                    const lastTxDate = startOfDay(new Date(lastTx.date));
                    const finalSegmentEnd =
                      endDate && endDate.getTime() < yearEnd.getTime()
                        ? endDate
                        : yearEnd;

                    if (finalSegmentEnd.getTime() > lastTxDate.getTime()) {
                      const principalAfterLastTx =
                        lastTx.type === "payment"
                          ? Math.max(0, currentPrincipal)
                          : currentPrincipal;

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
                            className="mb-2 p-2 rounded bg-blue-50"
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
                    }
                  }
                  if (yearSummary) {
                    rendered.push(
                      <View
                        key={`ys-${yearSummary.yearNumber}-${yearSummary.toDate}`}
                        className="mb-3 p-2 rounded bg-yellow-50"
                      >
                        <Text className="text-xs font-bold">{`Year ${yearSummary.yearNumber} Summary`}</Text>
                        <View className="mt-2 pt-2 border-t border-yellow-200">
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
                            className="mb-2 p-2 rounded bg-blue-50"
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
                          lastTxDateInYear.getTime() >= finalYearStart.getTime()
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
                  summaries.length > 0 ? summaries[summaries.length - 1] : null;
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
                            className="mb-2 p-2 rounded bg-blue-50"
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

                // Track final principal and final year interest for total amount due cell
                // Current Principal = Principal after last transaction in final year
                const finalPrincipalForDisplay =
                  hasCalculated && calculatedAmount > 0
                    ? finalPrincipalAfterLastTx > 0
                      ? finalPrincipalAfterLastTx
                      : finalYearInterestForTotal > 0
                        ? calculatedAmount - finalYearInterestForTotal
                        : calculatedAmount
                    : 0;

                // Old duplicate code removed - new year-cycle-based rendering above handles everything

                // Add Total Amount Due cell at the bottom
                if (hasCalculated && calculatedAmount > 0) {
                  rendered.push(
                    <View
                      key="total-amount-due"
                      className="mb-2 rounded bg-purple-50 border-2 border-purple-200"
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
                            {`₹${formatCurrency(finalPrincipalForDisplay)}`}
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
                            {`₹${formatCurrency(finalYearInterestForTotal)}`}
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

      {/* Action Buttons moved to top - removed bottom bar */}

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
        title={editingPaymentId ? "Edit repayment" : "Add repayment"}
      >
        <View className="pb-4">
          <Input
            label="Repayment Amount (₹)"
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            keyboardType="numeric"
            placeholder="0"
          />
          <View className="mt-4">
            <Text className="mb-2 text-sm font-medium">Repayment Date</Text>
            <Button
              variant="outline"
              onPress={() => setShowPaymentDatePicker(true)}
            >
              <Text>
                {paymentDate
                  ? new Date(paymentDate).toLocaleDateString()
                  : "Select date"}
              </Text>
            </Button>
            {showPaymentDatePicker && (
              <DateTimePicker
                value={paymentDate || new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, selectedDate) => {
                  setShowPaymentDatePicker(Platform.OS === "ios");
                  if (selectedDate) {
                    const d = new Date(selectedDate);
                    d.setHours(0, 0, 0, 0);
                    setPaymentDate(d);
                  }
                }}
              />
            )}
          </View>
          <Button
            variant="default"
            className="mt-6"
            onPress={handlePaymentSubmit}
            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
          >
            <Text>
              {editingPaymentId ? "Update repayment" : "Add repayment"}
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
        title={editingReceiptId ? "Edit borrowal" : "Add borrowal"}
      >
        <View className="pb-4">
          <Input
            label="Borrowal Amount (₹)"
            value={receiptAmount}
            onChangeText={setReceiptAmount}
            keyboardType="numeric"
            placeholder="0"
          />
          <View className="mt-4">
            <Text className="mb-2 text-sm font-medium">Borrowal Date</Text>
            <Button
              variant="outline"
              onPress={() => setShowReceiptDatePicker(true)}
            >
              <Text>
                {receiptDate
                  ? new Date(receiptDate).toLocaleDateString()
                  : "Select date"}
              </Text>
            </Button>
            {showReceiptDatePicker && (
              <DateTimePicker
                value={receiptDate || new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, selectedDate) => {
                  setShowReceiptDatePicker(Platform.OS === "ios");
                  if (selectedDate) {
                    const d = new Date(selectedDate);
                    d.setHours(0, 0, 0, 0);
                    setReceiptDate(d);
                  }
                }}
              />
            )}
          </View>
          <Button
            variant="default"
            className="mt-6"
            onPress={handleReceiptSubmit}
            disabled={!receiptAmount || parseFloat(receiptAmount) <= 0}
          >
            <Text>{editingReceiptId ? "Update borrowal" : "Add borrowal"}</Text>
          </Button>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
