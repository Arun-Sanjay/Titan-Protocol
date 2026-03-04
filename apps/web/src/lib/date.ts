export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function assertDateISO(dateISO: string): string {
  if (typeof dateISO !== "string") {
    throw new Error("dateISO must be a string");
  }
  const s = dateISO.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Invalid dateISO: ${dateISO}`);
  }
  return s;
}

export function monthBounds(dateISO: string): { start: string; end: string } {
  const s = assertDateISO(dateISO);
  const [y, m] = s.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  const end = `${nextMonth.y}-${String(nextMonth.m).padStart(2, "0")}-01`;
  return { start, end };
}
