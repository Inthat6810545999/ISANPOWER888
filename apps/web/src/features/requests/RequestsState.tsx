"use client";

import { Icon } from "@/components/workspace/Icon";
import styles from "@/components/workspace/workspace.module.css";

/** The list pages previously rendered nothing while loading and nothing on a failed
 *  load, so a broken API looked identical to an empty queue. This renders the
 *  loading and error states, and warns when a stale list is still on screen. */
export function RequestsState({ loading, error, hasData, onRetry, retrying }: {
  loading: boolean;
  error: string;
  hasData: boolean;
  onRetry: () => void;
  retrying?: boolean;
}) {
  if (loading && !hasData) {
    return <section className={styles.tableCard}>
      <div className={styles.empty} role="status">
        <Icon name="requests" />
        <h3>Loading requests…</h3>
        <p>Fetching the latest from your lab workspace.</p>
      </div>
    </section>;
  }

  if (error && !hasData) {
    return <section className={styles.tableCard}>
      <div className={styles.empty} role="alert">
        <Icon name="close" />
        <h3>We could not load your requests</h3>
        <p>{error}</p>
        <button className={styles.secondaryButton} type="button" disabled={retrying} onClick={onRetry}>
          {retrying ? "Retrying…" : "Try again"}
        </button>
      </div>
    </section>;
  }

  // Keep the last good list visible rather than blanking the page mid-shift.
  if (error) {
    return <div className={styles.staleWarning} role="alert">
      <span>{error} Showing the last list we loaded, which may be out of date.</span>
      <button className={styles.secondaryButton} type="button" disabled={retrying} onClick={onRetry}>
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </div>;
  }

  return null;
}
