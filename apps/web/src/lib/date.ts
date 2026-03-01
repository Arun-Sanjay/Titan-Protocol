const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(year, (month || 1) - 1, day || 1);
}

export function toISODateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysISO(iso: string, n: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + n);
  return toISODateLocal(date);
}

export function diffDaysISO(a: string, b: string): number {
  const start = parseISODate(a).getTime();
  const end = parseISODate(b).getTime();
  return Math.floor((end - start) / MS_PER_DAY);
}
