export const REQUEST_TYPES = [
  "equipment",
  "space",
  "consumable",
  "access",
  "visitor",
  "general",
] as const;

export const REQUEST_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "cancelled",
] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];