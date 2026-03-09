export type DateISO = string;

export type DateParts = {
  year: number;
  month: number;
  day: number;
};

export type DateRangeBounds = {
  start: DateISO;
  end: DateISO;
};

export function assertDateISO(dateISO: string): DateISO {
  if (typeof dateISO !== "string") {
    throw new Error("dateISO must be a string");
  }
  const s = dateISO.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Invalid dateISO: ${dateISO}`);
  }
  return s;
}

export function isDateISO(value: string): boolean {
  if (typeof value !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function parseDateISO(dateISO: string): DateParts {
  const safe = assertDateISO(dateISO);
  const [year, month, day] = safe.split("-").map(Number);
  return { year, month, day };
}

export function dateKeyFromParts(parts: DateParts): DateISO {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function todayISO(): DateISO {
  return dateToISO(new Date());
}

export function dateFromISO(dateISO: string): Date {
  const { year, month, day } = parseDateISO(dateISO);
  return new Date(year, month - 1, day);
}

export function dateToISO(date: Date): DateISO {
  return dateKeyFromParts({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

export function addDaysISO(dateISO: string, deltaDays: number): DateISO {
  const next = dateFromISO(dateISO);
  next.setDate(next.getDate() + deltaDays);
  return dateToISO(next);
}

export function subDaysISO(dateISO: string, deltaDays: number): DateISO {
  return addDaysISO(dateISO, -Math.abs(deltaDays));
}

export function monthBounds(dateISO: string): DateRangeBounds {
  const { year, month } = parseDateISO(dateISO);
  const start = dateKeyFromParts({ year, month, day: 1 });
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const end = dateKeyFromParts({ year: nextMonth.year, month: nextMonth.month, day: 1 });
  return { start, end };
}

export function weekStartISO(dateISO: string): DateISO {
  const date = dateFromISO(dateISO);
  const dayOfWeek = date.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setDate(date.getDate() - daysSinceMonday);
  return dateToISO(date);
}

export function weekRangeISO(dateISO: string): DateRangeBounds {
  const start = weekStartISO(dateISO);
  const end = addDaysISO(start, 6);
  return { start, end };
}

export function isDateInRangeISO(
  dateISO: string,
  startISO: string,
  endISO: string,
  options?: { endInclusive?: boolean },
): boolean {
  const date = assertDateISO(dateISO);
  const start = assertDateISO(startISO);
  const end = assertDateISO(endISO);
  if (options?.endInclusive === false) {
    return date >= start && date < end;
  }
  return date >= start && date <= end;
}

export function* iterateDateRangeISO(startISO: string, endISO: string): Generator<DateISO> {
  const start = assertDateISO(startISO);
  const end = assertDateISO(endISO);
  if (start > end) return;
  let cursor = start;
  while (cursor <= end) {
    yield cursor;
    cursor = addDaysISO(cursor, 1);
  }
}

export function listDateRangeISO(startISO: string, endISO: string): DateISO[] {
  return Array.from(iterateDateRangeISO(startISO, endISO));
}
