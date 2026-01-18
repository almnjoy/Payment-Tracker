export type RecurrenceType = "one_time" | "weekly" | "biweekly" | "monthly" | "yearly";
export type TimePeriod = "weekly" | "biweekly" | "monthly" | "yearly";

const WEEKS_PER_PERIOD: Record<TimePeriod, number> = {
  weekly: 1,
  biweekly: 2,
  monthly: 4.33,
  yearly: 52,
};

const RECURRENCE_WEEKS: Record<RecurrenceType, number> = {
  one_time: 0,
  weekly: 1,
  biweekly: 2,
  monthly: 4.33,
  yearly: 52,
};

export function getRecurrenceMultiplier(
  entryRecurrence: RecurrenceType | null | undefined,
  selectedPeriod: TimePeriod
): number {
  if (!entryRecurrence || entryRecurrence === "one_time") {
    return 1;
  }
  
  const entryWeeks = RECURRENCE_WEEKS[entryRecurrence];
  const periodWeeks = WEEKS_PER_PERIOD[selectedPeriod];
  
  return periodWeeks / entryWeeks;
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
  
  const recurrenceLabels: Record<RecurrenceType, string> = {
    one_time: "One-time",
    weekly: "Weekly",
    biweekly: "Bi-Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
  };
  
  const periodLabels: Record<TimePeriod, string> = {
    weekly: "weekly",
    biweekly: "bi-weekly",
    monthly: "monthly",
    yearly: "yearly",
  };
  
  const formattedMultiplier = multiplier < 1 
    ? multiplier.toFixed(2).replace(/\.?0+$/, '')
    : multiplier.toFixed(1).replace(/\.0$/, '');
  
  return `${recurrenceLabels[entryRecurrence]} entry counted as ${formattedMultiplier}x for ${periodLabels[selectedPeriod]} total`;
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
