/** Wire values match the Prisma RequestStatus / ApprovalStatus enums. Client-safe. */
export const REQUEST_STATUSES = ["pending", "assigned", "in_progress", "closed", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const APPROVAL_STATUSES = ["not_required", "submitted", "under_review", "approved", "rejected", "cancelled"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  not_required: "Not required",
  submitted: "Awaiting approval",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Approval cancelled",
};

export function initialApprovalStatus(requiresApproval: boolean): ApprovalStatus {
  return requiresApproval ? "submitted" : "not_required";
}

export function isActiveStatus(status: RequestStatus) {
  return status !== "closed" && status !== "cancelled";
}
