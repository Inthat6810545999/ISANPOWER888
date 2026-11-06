"use client";

import { useState } from "react";
import { useRequests } from "./RequestsProvider";
import styles from "@/components/workspace/workspace.module.css";

export function RequestsSync() {
  const { refresh, loading, error } = useRequests();
  const [manualRefreshing, setManualRefreshing] = useState(false);

  async function handleRefresh() {
    if (manualRefreshing) return;
    setManualRefreshing(true);
    try {
      await refresh();
    } finally {
      setManualRefreshing(false);
    }
  }

  return <div className={styles.syncBar}>
    <span role={error ? "alert" : "status"}>{error || (loading ? "Loading requests…" : "Live requests · Updates every 4 seconds")}{error && <> · <a href="/login">Sign in</a></>}</span>
    <button className={styles.secondaryButton} type="button" disabled={manualRefreshing} aria-busy={manualRefreshing} onClick={() => void handleRefresh()}>
      {manualRefreshing && <span className={styles.spinner} data-testid="refresh-spinner" aria-hidden="true" />}
      {manualRefreshing ? "Refreshing…" : "Refresh requests"}
    </button>
  </div>;
}
