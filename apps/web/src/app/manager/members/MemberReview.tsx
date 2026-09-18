"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { approveMember } from "./actions";
import type { SessionUser } from "@/lib/session-types";
import styles from "./members.module.css";

export function RefreshMembers() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button className={styles.refresh} disabled={pending} onClick={() => start(() => router.refresh())}>{pending ? "Refreshing..." : "Refresh registrations"}</button>;
}
export function MemberReview({ user }: { user: SessionUser }) {
  const [state, action, pending] = useActionState(approveMember, { error: "" });
  return <article className={styles.card}>
    <div><span className={styles.badge}>Awaiting approval</span><h2>{user.name}</h2><p>{user.email}</p></div>
    <form action={action} className={styles.form}>
      <input type="hidden" name="id" value={user.id} />
      <label>Assign lab role<select name="role" required defaultValue="" disabled={pending}>
        <option value="" disabled>Select a role</option><option value="member">Lab Member</option>
        <option value="ta">Teaching Assistant</option><option value="lab_manager">Lab Manager</option>
      </select></label>
      <button disabled={pending}>{pending ? "Approving..." : "Approve & assign role"}</button>
      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    </form>
  </article>;
}
