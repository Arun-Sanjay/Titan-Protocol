export function assertIDBKey(label: string, key: unknown) {
  if (key === undefined || key === null) {
    throw new Error(`[IDBKeyError] ${label}: key is ${key}`);
  }
  if (typeof key === "string" && key.trim() === "") {
    throw new Error(`[IDBKeyError] ${label}: key is empty string`);
  }
  if (typeof key === "number" && Number.isNaN(key)) {
    throw new Error(`[IDBKeyError] ${label}: key is NaN`);
  }
  return key;
}

export function assertIDBRange(label: string, start: unknown, end: unknown) {
  assertIDBKey(`${label}.start`, start);
  assertIDBKey(`${label}.end`, end);
  return { start, end };
}
