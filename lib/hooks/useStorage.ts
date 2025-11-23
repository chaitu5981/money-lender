import { STORAGE_KEYS } from "@/lib/constants";
import { Transaction } from "@/lib/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export function useStorage() {
  const [interestRate, setInterestRate] = useState<string>("");
  const [payments, setPayments] = useState<Transaction[]>([]);
  const [receipts, setReceipts] = useState<Transaction[]>([]);
  const [calculationEndDate, setCalculationEndDate] = useState<Date | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);

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
      // Error loading data
    } finally {
      setIsLoading(false);
    }
  };

  const saveInterestRate = async (rate: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.INTEREST_RATE, rate);
      setInterestRate(rate);
    } catch (error) {
      // Error saving interest rate
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
      // Error saving calculation end date
    }
  };

  const savePayments = async (updatedPayments: Transaction[]) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PAYMENTS,
        JSON.stringify(updatedPayments)
      );
      setPayments(updatedPayments);
    } catch (error) {
      // Error saving payments
    }
  };

  const saveReceipts = async (updatedReceipts: Transaction[]) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.RECEIPTS,
        JSON.stringify(updatedReceipts)
      );
      setReceipts(updatedReceipts);
    } catch (error) {
      // Error saving receipts
    }
  };

  const clearAllData = async () => {
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
      setCalculationEndDate(null);
    } catch (error) {
      // Error clearing data
    }
  };

  return {
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
  };
}

