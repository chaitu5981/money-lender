// Core interest calculation function with annual compounding
export const calculateInterestWithAnnualCompounding = (
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

