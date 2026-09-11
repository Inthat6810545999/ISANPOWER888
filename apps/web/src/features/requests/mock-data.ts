import type { Person, WorkspaceRequest } from "./types";

export const MOCK_MEMBER: Person = { id: "member-theewasu", name: "Theewasu A.", initials: "TA" };
export const MOCK_TA: Person = { id: "ta-kantee", name: "Kantee L.", initials: "KL" };
const inthat: Person = { id: "member-inthat", name: "Inthat N.", initials: "IN" };
const tanon: Person = { id: "ta-tanon", name: "Tanon L.", initials: "TL" };

const base = {
  category: "equipment", priority: "medium", status: "pending",
  requester: MOCK_MEMBER, assignee: null, location: "Electronics Lab",
  neededBy: "", requiresApproval: false,
  description: "Please help the team prepare the lab resources for our next project session.",
} satisfies Omit<WorkspaceRequest, "id" | "title" | "createdAt">;

export const MOCK_REQUESTS: WorkspaceRequest[] = [
  { ...base, id: "LAB-0009", title: "Prepare sensor testing equipment", neededBy: "2026-10-05", createdAt: "2026-09-11T09:00:00Z" },
  { ...base, id: "LAB-0008", title: "Restock electronics workbench", category: "consumable", requester: tanon, assignee: tanon, status: "in_progress", createdAt: "2026-09-10T09:00:00Z" },
  { ...base, id: "LAB-0007", title: "Book a supervised calibration workspace", priority: "low", neededBy: "2026-09-18", createdAt: "2026-09-09T09:00:00Z" },
  { ...base, id: "LAB-0006", title: "Restore workstation network connection", category: "general", requester: inthat, assignee: MOCK_TA, status: "closed", priority: "low", createdAt: "2026-09-08T09:00:00Z" },
  { ...base, id: "LAB-0005", title: "Purchase replacement sensor modules", category: "consumable", priority: "high", requiresApproval: true, neededBy: "2026-09-16", createdAt: "2026-09-07T09:00:00Z" },
  { ...base, id: "LAB-0004", title: "Arrange a research visitor session", category: "visitor", requester: inthat, assignee: tanon, status: "assigned", neededBy: "2026-09-21", createdAt: "2026-09-06T09:00:00Z" },
  { ...base, id: "LAB-0003", title: "Jumper wires and breadboards", category: "consumable", assignee: MOCK_TA, status: "assigned", neededBy: "2026-09-17", createdAt: "2026-09-05T09:00:00Z" },
  { ...base, id: "LAB-0002", title: "Access to Embedded Systems room", category: "access", requester: inthat, priority: "high", requiresApproval: true, neededBy: "2026-09-15", createdAt: "2026-09-04T09:00:00Z" },
  { ...base, id: "LAB-0001", title: "Oscilloscope calibration for sensor tests", assignee: MOCK_TA, status: "in_progress", priority: "high", neededBy: "2026-09-14", createdAt: "2026-09-03T09:00:00Z" },
];
