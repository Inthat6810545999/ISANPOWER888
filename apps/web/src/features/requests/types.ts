/** UI-only contracts. Agree on an API adapter before replacing the mock provider. */
export const CATEGORIES = {
  equipment: "Equipment / space",
  space: "Space booking",
  consumable: "Consumables",
  access: "Access permission",
  visitor: "Visitor / collaboration",
  general: "General support",
} as const;

export const STATUSES = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  closed: "Closed",
} as const;

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Category = keyof typeof CATEGORIES;
export type Status = keyof typeof STATUSES;
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
  requester: Person;
  assignee: Person | null;
  createdAt: string;
};
