import type { SessionUser } from "@/lib/session-types";
export type ManagedMember = SessionUser & { active: boolean; membershipVersion: number };
export type MembershipEvent = {
  id: number; targetId: string; targetName: string; targetEmail: string;
  actorName: string; actorEmail: string; action: string; occurredAt: string;
  previousRole: SessionUser["role"]; nextRole: SessionUser["role"];
  previousActive: boolean; nextActive: boolean;
  previousMembership: SessionUser["membershipStatus"]; nextMembership: SessionUser["membershipStatus"];
};
export type HistoryPage = { data: MembershipEvent[]; nextCursor: number | null };
export const roleLabels = { unassigned: "Unassigned", member: "Lab Member", ta: "Teaching Assistant", lab_manager: "Lab Manager" };
