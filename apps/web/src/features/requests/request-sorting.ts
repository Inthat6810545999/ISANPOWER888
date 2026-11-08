import { CATEGORIES, type WorkspaceRequest } from "./types";

export type RequestSort = "latest" | "due" | "category" | "priority" | "status";
const priorities = { high: 0, medium: 1, low: 2 };
const statuses = { pending: 0, assigned: 1, in_progress: 2, closed: 3, cancelled: 4 };

/** Compare before pagination. Stable tie-breaks keep refreshes predictable. */
export function compareRequests(a: WorkspaceRequest, b: WorkspaceRequest, sort: RequestSort) {
  let order = 0;
  if (sort === "due") order = (a.neededBy || "9999").localeCompare(b.neededBy || "9999");
  if (sort === "category") order = CATEGORIES[a.category].localeCompare(CATEGORIES[b.category], "en");
  if (sort === "priority") order = priorities[a.priority] - priorities[b.priority];
  if (sort === "status") order = statuses[a.status] - statuses[b.status];
  return order || Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id, "en");
}
