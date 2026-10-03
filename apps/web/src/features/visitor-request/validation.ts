export const PURPOSES = { tour: "Lab tour", study: "Study visit", collaboration: "Discuss collaboration", other: "Other" } as const;
export const TIME_SLOTS = { morning: "Morning (09:00–12:00)", afternoon: "Afternoon (13:00–16:00)" } as const;
export type VisitInput = {
  contactName: string; email: string; phone: string; organization: string;
  purpose: string; details: string; visitDate: string; timeSlot: string;
  visitorCount: string; requestedHost: string; arrangements: string;
};
export type FieldErrors = Partial<Record<keyof VisitInput, string>>;
export type VisitReceipt = { requestId: string; trackingCode: string };
export type SubmitResult = { ok: true; receipt: VisitReceipt } | { ok: false; error: string; fieldErrors?: FieldErrors };
export const EMPTY_VISIT: VisitInput = {
  contactName: "", email: "", phone: "", organization: "", purpose: "", details: "",
  visitDate: "", timeSlot: "", visitorCount: "1", requestedHost: "", arrangements: "",
};
export function bangkokDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validateVisit(input: unknown, today = bangkokDate()): { values: VisitInput; errors: FieldErrors } {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const values = { ...EMPTY_VISIT };
  const errors: FieldErrors = {};
  for (const key of Object.keys(values) as (keyof VisitInput)[]) {
    values[key] = typeof source[key] === "string" ? source[key].trim() : "";
    if (typeof source[key] !== "string") errors[key] = "Please check this field.";
  }
  for (const [key, limit] of Object.entries({ contactName: 120, email: 254, phone: 40, organization: 200, details: 4000, requestedHost: 200, arrangements: 1000 }) as [keyof VisitInput, number][]) {
    if (values[key].length > limit) errors[key] = `Use ${limit} characters or fewer.`;
  }
  if (!values.contactName) errors.contactName = "Enter the contact person's name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Enter a valid email address.";
  if (values.phone && !/^\+?[\d\s().-]{7,40}$/.test(values.phone)) errors.phone = "Enter a phone number, including the country code if needed.";
  if (!Object.hasOwn(PURPOSES, values.purpose)) errors.purpose = "Choose a purpose for your visit.";
  if (!values.details) errors.details = "Tell us what you would like to see or discuss.";
  const date = new Date(`${values.visitDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.visitDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== values.visitDate) errors.visitDate = "Choose a valid visit date.";
  else if (values.visitDate < today) errors.visitDate = "Choose today or a future date (Thailand time).";
  if (!Object.hasOwn(TIME_SLOTS, values.timeSlot)) errors.timeSlot = "Choose a preferred time slot.";
  if (!/^\d+$/.test(values.visitorCount) || !Number.isSafeInteger(Number(values.visitorCount)) || Number(values.visitorCount) < 1) errors.visitorCount = "Enter a whole number of visitors, at least 1.";
  return { values, errors };
}
export function isVisitReceipt(value: unknown): value is VisitReceipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Record<string, unknown>;
  return typeof receipt.requestId === "string" && receipt.requestId.trim().length > 0 && receipt.requestId.length <= 200 &&
    typeof receipt.trackingCode === "string" && /^[A-Za-z0-9_-]{12,128}$/.test(receipt.trackingCode);
}
