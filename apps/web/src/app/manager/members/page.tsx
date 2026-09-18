import { requireUser } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import type { SessionUser } from "@/lib/session-types";
import { PageHeading } from "@/components/workspace/PageHeading";
import { MemberReview, RefreshMembers } from "./MemberReview";
import styles from "./members.module.css";

export default async function MembersPage() {
  await requireUser("lab_manager");
  let users: SessionUser[] = [];
  let error = "";
  try { users = (await apiFetch<{ data: SessionUser[] }>("/memberships")).data; }
  catch { error = "Unable to load registrations. Check the connection and refresh to try again."; }
  return <>
    <PageHeading title="Member approvals" description="Review new registrations and assign the right lab role before granting access." showNewRequest={false} />
    <div className={styles.toolbar}><strong>{error ? "Registrations unavailable" : `${users.length} pending registration${users.length === 1 ? "" : "s"}`}</strong><RefreshMembers /></div>
    <p className={styles.hint}>Members submit requests. TAs manage work. Lab Managers approve requests and new members. System administrator access is managed separately.</p>
    {error ? <p role="alert" className={styles.error}>{error}</p> : users.length ? users.map(user => <MemberReview key={user.id} user={user} />) : <section className={styles.empty}><h2>No pending registrations</h2><p>New Google registrations will appear here. Refresh after a new member signs in.</p></section>}
  </>;
}
