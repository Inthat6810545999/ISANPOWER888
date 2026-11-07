import type { WorkspaceRequest } from "./types";
import { STATUS_LABELS } from "@/lib/request-status";
import styles from "@/components/workspace/workspace.module.css";

const labels = { created: "Request submitted", claimed: "Work assigned", started: "Work started", closed: "Work closed" };
const order = { created: 0, claimed: 2, started: 3, closed: 4 };
const roles: Record<string, string> = { member: "Member", ta: "TA", lab_manager: "Lab Manager", visitor: "Visitor (self-reported contact)" };
export function historyTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}

/** Work events and existing approval snapshots share a timeline, not a status field. */
export function RequestTimeline({ request }: { request: WorkspaceRequest }) {
  const history = request.history ?? [];
  const events = history.map(event => ({
    key: `work-${event.id}`, time: event.occurredAt, title: labels[event.action],
    person: `${event.actorName} (${event.actorEmail})`, role: roles[event.actorRole] ?? event.actorRole,
    detail: `Work: ${event.fromStatus ? `${STATUS_LABELS[event.fromStatus]} → ` : ""}${STATUS_LABELS[event.toStatus]}`,
    reason: "", superseded: false, rank: order[event.action],
  }));
  for (const [index, decision] of [...(request.decisionHistory ?? []), ...(request.decision ? [request.decision] : [])].entries()) {
    events.push({ key: `review-${index}-${decision.reviewedAt}-${decision.outcome}`, time: decision.reviewedAt,
      title: decision.outcome === "approved" ? "Request approved" : "Request rejected",
      person: `${decision.reviewerName} (${decision.reviewerEmail})`, role: "Lab Manager",
      detail: "Approval decision · Work status unchanged", reason: decision.reason, rank: 1,
      superseded: "supersededAt" in decision && !!decision.supersededAt });
  }
  events.sort((a, b) => a.time.localeCompare(b.time) || a.rank - b.rank);
  return <section className={styles.historySection} aria-label="Request history">
    <h3>Request history</h3>
    <p className={styles.helper}>Times shown in Asia/Bangkok. Names and roles reflect the recorded action.</p>
    {!history.some(event => event.action === "created") && <p className={styles.historyNote}>
      Earlier work history was not recorded. Only available events are shown; missing actors and times have not been reconstructed.
    </p>}
    {events.length ? <ol className={styles.historyList}>{events.map(event => <li key={event.key}>
      <div className={styles.historyHeading}><strong>{event.title}</strong><time dateTime={event.time}>{historyTime(event.time)}</time></div>
      <p>{event.detail}</p><p>{event.person} · {event.role}</p>
      {event.reason && <p className={styles.description}>Reason: {event.reason}</p>}
      {event.superseded && <p className={styles.historyNote}>Superseded decision — does not authorize current work.</p>}
    </li>)}</ol> : <p>No recorded events are available for this request.</p>}
  </section>;
}
