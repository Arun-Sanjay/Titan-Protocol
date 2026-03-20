import { describe, it, expect } from "vitest";
import {
  assertDateISO,
  isDateISO,
  parseDateISO,
  dateKeyFromParts,
  todayISO,
  dateFromISO,
  dateToISO,
  addDaysISO,
  subDaysISO,
  monthBounds,
  weekStartISO,
  weekRangeISO,
  isDateInRangeISO,
  listDateRangeISO,
} from "../date";

describe("assertDateISO", () => {
  it("accepts valid YYYY-MM-DD strings", () => {
    expect(assertDateISO("2024-01-15")).toBe("2024-01-15");
    expect(assertDateISO("2026-12-31")).toBe("2026-12-31");
  });

  it("trims whitespace", () => {
    expect(assertDateISO("  2024-01-15  ")).toBe("2024-01-15");
  });

  it("rejects invalid formats", () => {
    expect(() => assertDateISO("2024/01/15")).toThrow("Invalid dateISO");
    expect(() => assertDateISO("01-15-2024")).toThrow("Invalid dateISO");
    expect(() => assertDateISO("2024-1-5")).toThrow("Invalid dateISO");
    expect(() => assertDateISO("not-a-date")).toThrow("Invalid dateISO");
    expect(() => assertDateISO("")).toThrow("Invalid dateISO");
  });

  it("rejects non-string input", () => {
    expect(() => assertDateISO(123 as unknown as string)).toThrow("must be a string");
  });
});

describe("isDateISO", () => {
  it("returns true for valid dates", () => {
    expect(isDateISO("2024-01-15")).toBe(true);
  });

  it("returns false for invalid dates", () => {
    expect(isDateISO("2024/01/15")).toBe(false);
    expect(isDateISO("")).toBe(false);
    expect(isDateISO(null as unknown as string)).toBe(false);
  });
});

describe("parseDateISO", () => {
  it("parses date into parts", () => {
    expect(parseDateISO("2024-03-25")).toEqual({ year: 2024, month: 3, day: 25 });
  });
});

describe("dateKeyFromParts", () => {
  it("formats parts with zero-padding", () => {
    expect(dateKeyFromParts({ year: 2024, month: 1, day: 5 })).toBe("2024-01-05");
    expect(dateKeyFromParts({ year: 2024, month: 12, day: 31 })).toBe("2024-12-31");
  });
});

describe("todayISO", () => {
  it("returns a valid YYYY-MM-DD string", () => {
    const today = todayISO();
    expect(isDateISO(today)).toBe(true);
  });
});

describe("dateFromISO / dateToISO roundtrip", () => {
  it("roundtrips correctly", () => {
    const original = "2024-06-15";
    const date = dateFromISO(original);
    expect(dateToISO(date)).toBe(original);
  });

  it("handles month/year boundaries", () => {
    expect(dateToISO(dateFromISO("2024-01-01"))).toBe("2024-01-01");
    expect(dateToISO(dateFromISO("2024-12-31"))).toBe("2024-12-31");
  });
});

describe("addDaysISO / subDaysISO", () => {
  it("adds days correctly", () => {
    expect(addDaysISO("2024-01-30", 2)).toBe("2024-02-01");
    expect(addDaysISO("2024-02-28", 1)).toBe("2024-02-29"); // leap year
    expect(addDaysISO("2023-02-28", 1)).toBe("2023-03-01"); // non-leap year
  });

  it("subtracts days correctly", () => {
    expect(subDaysISO("2024-03-01", 1)).toBe("2024-02-29");
    expect(subDaysISO("2024-01-01", 1)).toBe("2023-12-31");
  });
});

describe("monthBounds", () => {
  it("returns correct month boundaries", () => {
    const bounds = monthBounds("2024-03-15");
    expect(bounds.start).toBe("2024-03-01");
    expect(bounds.end).toBe("2024-04-01");
  });

  it("handles December correctly", () => {
    const bounds = monthBounds("2024-12-15");
    expect(bounds.start).toBe("2024-12-01");
    expect(bounds.end).toBe("2025-01-01");
  });

  it("handles January correctly", () => {
    const bounds = monthBounds("2024-01-15");
    expect(bounds.start).toBe("2024-01-01");
    expect(bounds.end).toBe("2024-02-01");
  });
});

describe("weekStartISO", () => {
  it("returns Monday for any day in the week", () => {
    // 2024-03-18 is a Monday
    expect(weekStartISO("2024-03-18")).toBe("2024-03-18");
    // 2024-03-19 is a Tuesday
    expect(weekStartISO("2024-03-19")).toBe("2024-03-18");
    // 2024-03-24 is a Sunday
    expect(weekStartISO("2024-03-24")).toBe("2024-03-18");
  });
});

describe("weekRangeISO", () => {
  it("returns Monday-Sunday range", () => {
    const range = weekRangeISO("2024-03-20"); // Wednesday
    expect(range.start).toBe("2024-03-18");
    expect(range.end).toBe("2024-03-24");
  });
});

describe("isDateInRangeISO", () => {
  it("includes both endpoints by default", () => {
    expect(isDateInRangeISO("2024-03-01", "2024-03-01", "2024-03-31")).toBe(true);
    expect(isDateInRangeISO("2024-03-31", "2024-03-01", "2024-03-31")).toBe(true);
    expect(isDateInRangeISO("2024-03-15", "2024-03-01", "2024-03-31")).toBe(true);
  });

  it("excludes end when endInclusive is false", () => {
    expect(isDateInRangeISO("2024-03-31", "2024-03-01", "2024-03-31", { endInclusive: false })).toBe(false);
    expect(isDateInRangeISO("2024-03-30", "2024-03-01", "2024-03-31", { endInclusive: false })).toBe(true);
  });

  it("rejects dates outside range", () => {
    expect(isDateInRangeISO("2024-02-28", "2024-03-01", "2024-03-31")).toBe(false);
    expect(isDateInRangeISO("2024-04-01", "2024-03-01", "2024-03-31")).toBe(false);
  });
});

describe("listDateRangeISO", () => {
  it("lists all dates in range inclusive", () => {
    const dates = listDateRangeISO("2024-03-28", "2024-04-01");
    expect(dates).toEqual(["2024-03-28", "2024-03-29", "2024-03-30", "2024-03-31", "2024-04-01"]);
  });

  it("returns single date when start equals end", () => {
    expect(listDateRangeISO("2024-03-15", "2024-03-15")).toEqual(["2024-03-15"]);
  });

  it("returns empty array when start > end", () => {
    expect(listDateRangeISO("2024-04-01", "2024-03-01")).toEqual([]);
  });
});
