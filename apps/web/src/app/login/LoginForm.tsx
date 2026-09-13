"use client";
import { useActionState } from "react";
import { login } from "./actions";
import styles from "@/components/workspace/workspace.module.css";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: "" });
  return <form action={action} className={styles.requestForm}>
    <label className={styles.field}>Email address<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
    <label className={styles.field}>Password<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}
    <button className={styles.primaryButton} disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
  </form>;
}
