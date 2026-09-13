"use client";
import { useState } from "react";
import { logout } from "@/app/login/actions";
import styles from "./workspace.module.css";
export function SignOut() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return <div><button className={styles.secondaryButton} disabled={pending} onClick={async () => {
    setPending(true); setError("");
    try { await logout(); } catch { setError("Sign out failed. Please retry."); setPending(false); }
  }}>{pending ? "Signing out…" : "Sign out"}</button>{error && <p role="alert">{error}</p>}</div>;
}
