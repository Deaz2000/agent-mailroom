/** Opaque ID helpers for receipts and events. */
export function newId(prefix: string): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return prefix + "_" + hex;
}

export function receiptId(): string {
  return newId("rcpt");
}

export function eventId(): string {
  return newId("evt");
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}
