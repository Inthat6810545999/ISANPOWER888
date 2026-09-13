export type Role = "member" | "ta" | "lab_manager";
export type SessionUser = { id: string; name: string; email: string; role: Role };
export const roleHome: Record<Role, string> = { member: "/workspace/my-requests", ta: "/ta/queue", lab_manager: "/manager/approvals" };
export function displayPerson(user: SessionUser) {
  return { id: user.email, name: user.name, initials: user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() };
}
