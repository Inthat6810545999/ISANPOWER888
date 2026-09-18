"use client";
import { useActionState } from "react";
import { saveUser } from "./actions";
import type { SessionUser } from "@/lib/session-types";
import styles from "./admin.module.css";
export type ManagedUser = SessionUser & { active: boolean };
export function UserForm({ user, self = false }: { user?: ManagedUser; self?: boolean }) {
  const [state, action, pending] = useActionState(saveUser, { message: "", ok: false });
  if (user?.membershipStatus === "PENDING") return <p>Awaiting Lab Manager membership approval. Roles can be edited after approval.</p>;
  return <form action={action} className={styles.form}>
    {user && <input type="hidden" name="id" value={user.id} />}
    <label>Name<input name="name" defaultValue={user?.name} required maxLength={100} autoComplete="name" /></label>
    <label>Email<input name="email" type="email" defaultValue={user?.email} readOnly={!!user} required autoComplete="email" /></label>
    {!user && <label>Initial password<input name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password" /><small>At least 12 characters.</small></label>}
    <label>Role<select name="role" defaultValue={user?.role ?? "member"} disabled={self}>
      <option value="member">Lab Member</option><option value="ta">Teaching Assistant</option>
      <option value="lab_manager">Lab Manager</option><option value="admin">Administrator</option>
    </select></label>
    {self && <input type="hidden" name="role" value="admin" />}
    {user && <label className={styles.check}><input name="active" type="checkbox" defaultChecked={user.active} disabled={self} />Account active</label>}
    {self && <input type="hidden" name="active" value="on" />}
    <button disabled={pending}>{pending ? "Saving..." : user ? "Save changes" : "Create account"}</button>
    {state.message && <p role={state.ok ? "status" : "alert"}>{state.message}</p>}
  </form>;
}
