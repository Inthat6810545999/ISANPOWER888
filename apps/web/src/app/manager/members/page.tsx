import { requireUser } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { PageHeading } from "@/components/workspace/PageHeading";
import { MemberManagement, RefreshMembers } from "./MemberReview";
import type { ManagedMember } from "./types";
import styles from "./members.module.css";

export default async function MembersPage() {
  const actor = await requireUser("lab_manager");
  let users: ManagedMember[] = [];
  let error = "";
  try { users = (await apiFetch<{ data: ManagedMember[] }>("/memberships?scope=all")).data; }
  catch { error = "Unable to load members. Check the connection and refresh to try again."; }
  return <>
    <PageHeading title="Member management" description="Approve registrations, manage lab roles and account access, and review recorded changes." showNewRequest={false} />
    <div className={styles.toolbar}><strong>{error ? "Members unavailable" : `${users.length} registered accounts`}</strong><RefreshMembers /></div>
    <p className={styles.hint}>Members submit requests. TAs manage work. Lab Managers approve requests and manage members. Keep at least one active Lab Manager.</p>
    {error ? <p role="alert" className={styles.error}>{error}</p> : <MemberManagement users={users} actorId={actor.id} />}
  </>;
}
