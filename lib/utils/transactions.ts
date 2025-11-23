import { Transaction } from "@/lib/types";
import { startOfDay } from "./date";

// Helper function to sort transactions by date
// When dates are the same, borrowals (receipts) come before repayments (payments)
export const sortTransactionsByDate = (
  transactions: Transaction[]
): Transaction[] => {
  return [...transactions].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    // Same date: receipts (borrowals) come before payments (repayments)
    // receipt type = 0, payment type = 1, so receipts sort first
    const typeA = a.type === "receipt" ? 0 : 1;
    const typeB = b.type === "receipt" ? 0 : 1;
    return typeA - typeB;
  });
};

// Helper function to sort combined transactions (with type property)
export const sortCombinedTransactions = <
  T extends { date: string; type: "payment" | "receipt" },
>(
  transactions: T[]
): T[] => {
  return [...transactions].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    // Same date: receipts (borrowals) come before payments (repayments)
    const typeA = a.type === "receipt" ? 0 : 1;
    const typeB = b.type === "receipt" ? 0 : 1;
    return typeA - typeB;
  });
};

// Helper function to combine transactions on the same day for report/calculation
// Groups transactions by date and creates a single net transaction per day
export const combineTransactionsByDate = (
  transactions: {
    date: string;
    amount: number;
    type: "payment" | "receipt";
    id: string;
  }[]
): {
  date: string;
  amount: number;
  type: "payment" | "receipt";
  id: string;
}[] => {
  // Group transactions by date
  const transactionsByDate = new Map<
    string,
    { amount: number; type: "payment" | "receipt"; id: string }[]
  >();

  transactions.forEach((tx) => {
    const dateKey = startOfDay(new Date(tx.date)).toISOString();
    if (!transactionsByDate.has(dateKey)) {
      transactionsByDate.set(dateKey, []);
    }
    transactionsByDate
      .get(dateKey)!
      .push({ amount: tx.amount, type: tx.type, id: tx.id });
  });

  // Combine transactions on the same day
  const combined: {
    date: string;
    amount: number;
    type: "payment" | "receipt";
    id: string;
  }[] = [];

  transactionsByDate.forEach((txs, dateKey) => {
    // Calculate net amount: sum of borrowals - sum of repayments
    let netAmount = 0;
    txs.forEach((tx) => {
      if (tx.type === "receipt") {
        netAmount += tx.amount; // Borrowal adds to net
      } else {
        netAmount -= tx.amount; // Repayment subtracts from net
      }
    });

    // Determine type based on net amount
    // If net amount <= 0, it's a repayment, otherwise it's a borrowal
    const type: "payment" | "receipt" =
      netAmount <= 0 ? "payment" : "receipt";
    const amount = Math.abs(netAmount);

    // Use the first transaction's ID or create a combined ID
    const combinedId = `combined-${dateKey}-${txs[0].id}`;

    combined.push({
      date: dateKey,
      amount,
      type,
      id: combinedId,
    });
  });

  // Sort by date
  return combined.sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
};

