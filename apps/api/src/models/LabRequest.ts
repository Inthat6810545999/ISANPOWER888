export const REQUEST_TYPES = [
  "equipment",
  "space",
  "consumable",
  "access",
  "visitor",
  "general",
] as const;

export const REQUEST_STATUSES = [
  "pending",
  "assigned",
  "in_progress",
  "closed",
  "cancelled",
] as const;

export const APPROVAL_STATUSES = [
  "not_required",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "cancelled",
] as const;

export const REQUEST_PRIORITIES = ["low", "medium", "high"] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
