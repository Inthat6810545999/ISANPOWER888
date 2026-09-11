import type { ApprovalStatus, RequestStatus } from "@/lib/request-status";
export { STATUS_LABELS as STATUSES } from "@/lib/request-status";
/** UI view model; actions.ts maps API field names without changing status values. */
export const CATEGORIES = {
  equipment: "Equipment / space",
  space: "Space booking",
  consumable: "Consumables",
  access: "Access permission",
  visitor: "Visitor / collaboration",
  general: "General support",
} as const;

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Category = keyof typeof CATEGORIES;
export type Status = RequestStatus;
export type Priority = (typeof PRIORITIES)[number];
export type Person = { id: string; name: string; initials: string };

export type RequestDraft = {
  title: string;
  category: Category;
  priority: Priority;
  description: string;
  location: string;
  neededBy: string;
  requiresApproval: boolean;
};

export type WorkspaceRequest = RequestDraft & {
  id: string;
  status: Status;
  approvalStatus: ApprovalStatus;
  requester: Person;
  assignee: Person | null;
  createdAt: string;
};
