import { REQUEST_STATUSES, APPROVAL_STATUSES, type RequestStatus, type ApprovalStatus } from "../../lib/request-status.ts";

export type PublicVisit = {
  status: RequestStatus; approvalStatus: ApprovalStatus; publicMessage: string | null;
  visitDate: string; timeSlot: "morning" | "afternoon";
};
export const WORK_LABELS: Record<RequestStatus, string> = {
  pending: "Awaiting processing", assigned: "Assigned to lab staff", in_progress: "In progress",
  closed: "Closed", cancelled: "Request cancelled",
};
export const REVIEW_LABELS: Record<ApprovalStatus, string> = {
  not_required: "Approval not required", submitted: "Awaiting review", under_review: "Under review",
  approved: "Approved", rejected: "Request declined", cancelled: "Approval cancelled",
};
export const SLOT_LABELS = { morning: "09:00–12:00", afternoon: "13:00–16:00" };

export function readPublicVisit(body: unknown): PublicVisit | null {
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const data = body.data;
  if (!data || typeof data !== "object") return null;
  if (!("status" in data) || !REQUEST_STATUSES.includes(data.status as RequestStatus)
    || !("approvalStatus" in data) || !APPROVAL_STATUSES.includes(data.approvalStatus as ApprovalStatus)
    || !("visitDate" in data) || typeof data.visitDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.visitDate)
    || !("timeSlot" in data) || (data.timeSlot !== "morning" && data.timeSlot !== "afternoon")) return null;
  const date = new Date(`${data.visitDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== data.visitDate) return null;
  const message = "publicMessage" in data ? data.publicMessage : null;
  if (message != null && typeof message !== "string") return null;
  return { status: data.status as RequestStatus, approvalStatus: data.approvalStatus as ApprovalStatus,
    publicMessage: message ?? null, visitDate: data.visitDate, timeSlot: data.timeSlot };
}

export function requestedDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${date}T00:00:00+07:00`));
}
