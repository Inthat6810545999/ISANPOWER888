export const COLLABORATION_FIELDS = {
  title: { label: "Request title", max: 200 },
  organization: { label: "Company / organization", max: 200 },
  contactName: { label: "External contact name", max: 120 },
  contactEmail: { label: "External contact email", max: 254 },
  phone: { label: "Phone (optional)", max: 40 },
  description: { label: "Purpose and collaboration details", max: 4000 },
} as const;
export type CollaborationInput = Record<keyof typeof COLLABORATION_FIELDS, string>;
export type CollaborationErrors = Partial<Record<keyof CollaborationInput, string>> & { form?: string };
export const EMPTY_COLLABORATION: CollaborationInput = { title: "", organization: "", contactName: "", contactEmail: "", phone: "", description: "" };

/** Trimmed UTF-16 limits and email/phone syntax match the API's independent checks. */
export function validateCollaboration(input: unknown) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const values = { ...EMPTY_COLLABORATION };
  const errors: CollaborationErrors = {};
  if (Object.keys(source).some(key => !Object.hasOwn(COLLABORATION_FIELDS, key))) errors.form = "Unexpected request fields.";
  for (const key of Object.keys(values) as (keyof CollaborationInput)[]) {
    if (source[key] === undefined && key === "phone") continue;
    if (typeof source[key] !== "string") { errors[key] = "Enter a valid value."; continue; }
    values[key] = source[key].trim();
    if (!values[key] && key !== "phone") errors[key] = "This field is required.";
    else if (values[key].length > COLLABORATION_FIELDS[key].max) errors[key] = `Use ${COLLABORATION_FIELDS[key].max} characters or fewer.`;
  }
  if (values.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail)) errors.contactEmail = "Enter a valid email address.";
  if (values.phone && !/^\+?[\d\s().-]{7,40}$/.test(values.phone)) errors.phone = "Enter a valid phone number.";
  return { values, errors };
}
