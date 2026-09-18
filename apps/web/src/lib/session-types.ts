export type InternalRole = "member" | "ta" | "lab_manager";
export type Role = InternalRole | "unassigned";
export type SessionUser = { id: string; name: string; email: string; role: Role; membershipStatus: "PENDING" | "APPROVED" };
export const roleHome: Record<Role, string> = { member: "/workspace/my-requests", ta: "/ta/queue", lab_manager: "/manager/approvals", unassigned: "/pending" };
export function hasInternalAccess(user: SessionUser) { return user.membershipStatus === "APPROVED" && user.role !== "unassigned"; }
export function sessionHome(user: SessionUser) { return hasInternalAccess(user) ? roleHome[user.role] : "/pending"; }
export function displayPerson(user: SessionUser) {
  return { id: user.email, name: user.name, initials: user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() };
}
