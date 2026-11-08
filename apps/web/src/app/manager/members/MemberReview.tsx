"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveMember, updateMember, memberHistory } from "./actions";
import { roleLabels, type ManagedMember, type MembershipEvent } from "./types";
import styles from "./members.module.css";

export function RefreshMembers() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button className={styles.refresh} disabled={pending} onClick={() => start(() => router.refresh())}>{pending ? "Refreshing..." : "Refresh members"}</button>;
}
function RoleOptions() {
  return <>{(["member", "ta", "lab_manager"] as const).map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}</>;
}
export function MemberReview({ user }: { user: ManagedMember }) {
  const [state, action, pending] = useActionState(approveMember, { error: "" });
  return <form action={action} className={styles.form}>
    <input type="hidden" name="id" value={user.id} />
    <label>Assign lab role<select name="role" required defaultValue="" disabled={pending}>
      <option value="" disabled>Select a role</option><RoleOptions />
    </select></label>
    <button disabled={pending}>{pending ? "Approving..." : "Approve & assign role"}</button>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    {state.success && <p role="status">{state.success}</p>}
  </form>;
}
function MemberHistory({ id }: { id: string }) {
  const [events, setEvents] = useState<MembershipEvent[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function load(more = false) {
    start(async () => {
      const result = await memberHistory(id, more ? cursor ?? undefined : undefined);
      setError(result.error ?? "");
      if (result.history) {
        const history = result.history;
        setEvents(previous => more ? [...previous, ...history.data] : history.data);
        setCursor(history.nextCursor); setLoaded(true);
      }
    });
  }
  const labels: Record<string, string> = { approved: "Registration approved", role_changed: "Role changed", deactivated: "Account deactivated", reactivated: "Account reactivated" };
  return <details className={styles.history}>
    <summary>Management history</summary>
    <button className={styles.refresh} disabled={pending} onClick={() => load()}>{pending ? "Loading..." : loaded ? "Refresh history" : "Load history"}</button>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {loaded && !events.length && <p>No recorded changes. Changes made before this feature are not reconstructed.</p>}
    <ol>{events.map(event => <li key={event.id}>
      <strong>{labels[event.action] ?? event.action}</strong>
      <p>{roleLabels[event.previousRole]} → {roleLabels[event.nextRole]} · {event.previousActive ? "Active" : "Inactive"} → {event.nextActive ? "Active" : "Inactive"}</p>
      {event.previousMembership !== event.nextMembership && <p>{event.previousMembership} → {event.nextMembership}</p>}
      <p>By {event.actorName} ({event.actorEmail})</p>
      <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })} (Asia/Bangkok)</time>
    </li>)}</ol>
    {cursor !== null && <button className={styles.refresh} disabled={pending} onClick={() => load(true)}>Load older changes</button>}
  </details>;
}
function MemberCard({ user, actorId, lastManager }: { user: ManagedMember; actorId: string; lastManager: boolean }) {
  const [state, action, pending] = useActionState(updateMember, { error: "" });
  const [confirm, setConfirm] = useState(false);
  const protectedManager = lastManager && user.active && user.role === "lab_manager" && user.membershipStatus === "APPROVED";
  const fields = <><input type="hidden" name="id" value={user.id} /><input type="hidden" name="version" value={user.membershipVersion} /></>;
  return <article className={styles.card} aria-label={`${user.name} (${user.email})`}>
    <div>
      <span className={styles.badge}>{!user.active ? "Inactive" : user.membershipStatus === "PENDING" ? "Awaiting approval" : "Active"} · {roleLabels[user.role]}</span>
      <h2>{user.name}{user.id === actorId ? " (you)" : ""}</h2><p>{user.email}</p>
      {protectedManager && <p className={styles.hint}>This is the last active Lab Manager. Add another before changing access.</p>}
      <MemberHistory key={user.membershipVersion} id={user.id} />
    </div>
    <div className={styles.controls}>
      {user.active && user.membershipStatus === "PENDING" && <MemberReview user={user} />}
      {user.membershipStatus === "APPROVED" && <form action={action} className={styles.form}>
        {fields}<input type="hidden" name="action" value="role" />
        <label>Lab role<select key={`${user.id}-${user.role}`} name="role" defaultValue={user.role} disabled={pending || protectedManager}><RoleOptions /></select></label>
        <button disabled={pending || protectedManager}>{pending ? "Saving..." : "Save role"}</button>
      </form>}
      <form action={action} className={styles.form} onSubmit={() => setConfirm(false)}>
        {fields}<input type="hidden" name="action" value="active" /><input type="hidden" name="active" value={String(!user.active)} />
        {user.active ? <>
          <p className={styles.hint}>Deactivation signs this member out. Existing requests and assignments remain; arrange any unfinished work before changing access.</p>
          {confirm ? <div className={styles.confirm}><p>Deactivate {user.email}{user.id === actorId ? " and sign yourself out" : ""}?</p>
            <button disabled={pending || protectedManager}>Confirm deactivation</button>
            <button type="button" disabled={pending} onClick={() => setConfirm(false)}>Cancel</button></div>
            : <button type="button" disabled={pending || protectedManager} onClick={() => setConfirm(true)}>Deactivate account</button>}
        </> : <><p className={styles.hint}>Reactivation keeps the existing role and approval status. The member must sign in again.</p><button disabled={pending}>{pending ? "Saving..." : "Reactivate account"}</button></>}
      </form>
      {user.id === actorId && !protectedManager && <p className={styles.hint}>Changing your own role takes you to the workspace for that role.</p>}
      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </div>
  </article>;
}
export function MemberManagement({ users, actorId }: { users: ManagedMember[]; actorId: string }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const filtered = users.filter(user => `${user.name} ${user.email}`.toLowerCase().includes(search.trim().toLowerCase()) &&
    (!role || user.role === role) && (!status || (status === "inactive" ? !user.active : status === "pending" ? user.active && user.membershipStatus === "PENDING" : user.active && user.membershipStatus === "APPROVED")));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages);
  const lastManager = users.filter(user => user.active && user.role === "lab_manager" && user.membershipStatus === "APPROVED").length === 1;
  return <>
    <div className={styles.filters}>
      <label>Search members<input type="search" value={search} placeholder="Name or email" onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>
      <label>Filter by role<select value={role} onChange={e => { setRole(e.target.value); setPage(1); }}><option value="">All roles</option><option value="unassigned">Unassigned</option><RoleOptions /></select></label>
      <label>Filter by account status<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="pending">Awaiting approval</option><option value="active">Active members</option><option value="inactive">Inactive</option></select></label>
      <button className={styles.refresh} onClick={() => { setSearch(""); setRole(""); setStatus(""); setPage(1); }}>Clear filters</button>
    </div>
    <p className={styles.hint} role="status">{filtered.length} matching accounts</p>
    {!filtered.length && <section className={styles.empty}><h2>No members found</h2><p>Try different filters or refresh after a new Google registration.</p></section>}
    {filtered.slice((current - 1) * 10, current * 10).map(user => <MemberCard key={user.id} user={user} actorId={actorId} lastManager={lastManager} />)}
    {pages > 1 && <div className={styles.toolbar}><button className={styles.refresh} disabled={current === 1} onClick={() => setPage(current - 1)}>Previous page</button><span>Page {current} of {pages}</span><button className={styles.refresh} disabled={current === pages} onClick={() => setPage(current + 1)}>Next page</button></div>}
  </>;
}
