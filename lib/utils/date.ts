// Normalize a date to local start of day (00:00:00.000)
export const startOfDay = (d: Date): Date => {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd;
};

// Add calendar years preserving month/day when possible
// If the target month doesn't have the same day (e.g., Feb 29 → Feb end), clamp to last day of month
export const addCalendarYears = (d: Date, years: number): Date => {
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
export const diffDaysExclusive = (start: Date, end: Date): number => {
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();
  return Math.max(0, Math.floor((e - s) / (1000 * 60 * 60 * 24)));
};

