export interface Transaction {
  id: string;
  amount: number;
  date: string; // ISO date string
  type: "payment" | "receipt";
}

export interface YearSummary {
  yearNumber: number;
  fromDate: string;
  toDate: string;
  interest: number;
  newPrincipal: number;
}

export interface TransactionPeriod {
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
}

