// Helper function to format currency safely (₹, no decimals)
export const formatCurrency = (amount: number | string | undefined): string => {
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

