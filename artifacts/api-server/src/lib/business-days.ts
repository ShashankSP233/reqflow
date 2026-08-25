// Helpers for point 15: purchase team members must update requisition status
// every business day (i.e. every day that is not a Saturday, Sunday, or a
// configured company holiday). All dates are treated as plain YYYY-MM-DD
// strings in Indian Standard Time, since this app is INR/India-specific.

const IST_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

/** Today's date in IST, as YYYY-MM-DD. */
export function todayIST(): string {
  return IST_FORMATTER.format(new Date());
}

/** Converts a Date (or ISO string/timestamp) to a YYYY-MM-DD string in IST. */
export function toDateOnlyIST(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return IST_FORMATTER.format(date);
}

export function isWeekend(dateStr: string): boolean {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6; // Sunday | Saturday
}

export function isBusinessDay(dateStr: string, holidaySet: Set<string>): boolean {
  return !isWeekend(dateStr) && !holidaySet.has(dateStr);
}

/**
 * Counts business days strictly between two YYYY-MM-DD dates (excludes both
 * endpoints). Used to measure how many days of required status updates were
 * missed between the last update and today.
 */
export function countBusinessDaysBetweenExclusive(
  startDateStr: string,
  endDateStr: string,
  holidaySet: Set<string>
): number {
  if (startDateStr >= endDateStr) return 0;
  let count = 0;
  const d = new Date(`${startDateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const end = new Date(`${endDateStr}T00:00:00Z`);
  while (d.getTime() < end.getTime()) {
    const s = d.toISOString().split("T")[0];
    if (isBusinessDay(s, holidaySet)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

export interface ComplianceStatus {
  last_activity_date: string;
  business_days_overdue: number;
  due_today: boolean;
}

/**
 * Given the date of the last known activity on a requisition (its last
 * status update, or the date it was assigned if there's no update yet),
 * computes whether the purchase team member is behind on the "update every
 * business day" requirement.
 */
export function computeCompliance(
  lastActivityDateStr: string,
  holidaySet: Set<string>,
  todayStr: string = todayIST()
): ComplianceStatus {
  const businessDaysOverdue = countBusinessDaysBetweenExclusive(lastActivityDateStr, todayStr, holidaySet);
  return {
    last_activity_date: lastActivityDateStr,
    business_days_overdue: businessDaysOverdue,
    due_today: isBusinessDay(todayStr, holidaySet) && lastActivityDateStr !== todayStr,
  };
}
