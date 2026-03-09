export function uid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();

  const getRand = () => {
    if (c && typeof c.getRandomValues === "function") {
      const arr = new Uint8Array(16);
      c.getRandomValues(arr);
      return arr;
    }
    const arr = new Uint8Array(16);
    for (let i = 0; i < 16; i += 1) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  };

  const b = getRand();
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;

  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
