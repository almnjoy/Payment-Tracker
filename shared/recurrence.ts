export type RecurrenceType = "one_time" | "weekly" | "biweekly" | "monthly" | "yearly";
export type TimePeriod = "weekly" | "biweekly" | "monthly" | "yearly";

// Exact deterministic multipliers - no averaging or approximation
const MULTIPLIER_TABLE: Record<RecurrenceType, Record<TimePeriod, number>> = {
  one_time: { weekly: 1, biweekly: 1, monthly: 1, yearly: 1 },
  weekly: { weekly: 1, biweekly: 2, monthly: 4, yearly: 52 },
  biweekly: { weekly: 0.5, biweekly: 1, monthly: 2, yearly: 26 },
  monthly: { weekly: 0.25, biweekly: 0.5, monthly: 1, yearly: 12 },
  yearly: { weekly: 1/52, biweekly: 1/26, monthly: 1/12, yearly: 1 },
};

export function getRecurrenceMultiplier(
  entryRecurrence: RecurrenceType | null | undefined,
  selectedPeriod: TimePeriod
): number {
  if (!entryRecurrence || entryRecurrence === "one_time") {
    return 1;
  }
  
  return MULTIPLIER_TABLE[entryRecurrence]?.[selectedPeriod] ?? 1;
}

export function getMultiplierLabel(
  entryRecurrence: RecurrenceType | null | undefined,
  selectedPeriod: TimePeriod
): string | null {
  if (!entryRecurrence || entryRecurrence === "one_time") {
    return null;
  }
  
  const multiplier = getRecurrenceMultiplier(entryRecurrence, selectedPeriod);
  
  if (multiplier === 1) {
    return null;
  }
  
  const periodLabels: Record<TimePeriod, string> = {
    weekly: "weekly",
    biweekly: "biweekly",
    monthly: "monthly",
    yearly: "yearly",
  };
  
  // Format multiplier: round to 2 decimals only at display time
  let formattedMultiplier: string;
  if (multiplier < 1) {
    formattedMultiplier = multiplier.toFixed(2).replace(/\.?0+$/, '');
  } else if (Number.isInteger(multiplier)) {
    formattedMultiplier = multiplier.toString();
  } else {
    formattedMultiplier = multiplier.toFixed(2).replace(/\.?0+$/, '');
  }
  
  return `${formattedMultiplier}x for ${periodLabels[selectedPeriod]}`;
}

export function isOneTimeInRange(
  entryDate: string,
  selectedPeriod: TimePeriod
): boolean {
  const today = new Date();
  const entry = new Date(entryDate);
  
  let startDate: Date;
  
  switch (selectedPeriod) {
    case "weekly":
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      break;
    case "biweekly":
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 14);
      break;
    case "monthly":
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 1);
      break;
    case "yearly":
      startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 1);
      break;
  }
  
  return entry >= startDate && entry <= today;
}

export function getPeriodDays(period: TimePeriod): number {
  switch (period) {
    case "weekly":
      return 7;
    case "biweekly":
      return 14;
    case "monthly":
      return 30;
    case "yearly":
      return 365;
  }
}

export function formatRecurrence(recurrence: RecurrenceType | null | undefined): string {
  if (!recurrence) return "One-time";
  
  const labels: Record<RecurrenceType, string> = {
    one_time: "One-time",
    weekly: "Weekly",
    biweekly: "Bi-Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
  };
  
  return labels[recurrence] || "One-time";
}
