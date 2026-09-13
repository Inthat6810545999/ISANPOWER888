"use client";

import { useRequests } from "./RequestsProvider";
import styles from "@/components/workspace/workspace.module.css";

export function RequestsSync() {
  const { refresh, loading, refreshing, error } = useRequests();
  return <div className={styles.syncBar}>
    <span role={error ? "alert" : "status"}>{error || (loading ? "Loading requests…" : "Live requests · Updates every 4 seconds")}{error && <> · <a href="/login">Sign in</a></>}</span>
    <button className={styles.secondaryButton} disabled={refreshing} onClick={() => void refresh()}>{refreshing ? "Refreshing…" : "Refresh requests"}</button>
  </div>;
}
