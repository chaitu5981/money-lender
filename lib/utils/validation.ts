// Helper function to validate and filter input for amounts (only digits)
export const validateAmountInput = (text: string): string => {
  // Remove all non-digit characters
  return text.replace(/[^0-9]/g, "");
};

// Helper function to validate and filter input for interest rate (digits and decimal point)
export const validateInterestRateInput = (text: string): string => {
  // Allow digits and a single decimal point
  // Remove any character that's not a digit or decimal point
  let filtered = text.replace(/[^0-9.]/g, "");
  // Ensure only one decimal point
  const parts = filtered.split(".");
  if (parts.length > 2) {
    // More than one decimal point, keep only the first one
    filtered = parts[0] + "." + parts.slice(1).join("");
  }
  return filtered;
};

