import { APPROVAL_LABELS, STATUS_LABELS } from "@/lib/request-status";
import styles from "./workspace.module.css";

/** One colour per meaning, agreed by the team: waiting = amber, approved = green,
 *  rejected and closed = red. Everything else, including any status a newer API
 *  sends before the web app knows it, falls back to grey instead of breaking. */
export type StatusTone = "pending" | "success" | "danger" | "neutral";
const TONES: Record<string, StatusTone> = { pending: "pending", approved: "success", rejected: "danger", closed: "danger" };

export function statusTone(status: string): StatusTone {
  return Object.hasOwn(TONES, status) ? TONES[status] : "neutral";
}

export type StatusKind = "work" | "approval";

export function statusLabel(status: string, kind: StatusKind = "work"): string {
  const labels: Record<string, string> = kind === "approval" ? APPROVAL_LABELS : STATUS_LABELS;
  if (Object.hasOwn(labels, status)) return labels[status];
  const words = status.replace(/_/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "Unknown";
}

export function StatusBadge({ status, kind = "work", label, prefix }: {
  status: string;
  kind?: StatusKind;
  /** Overrides the default wording, e.g. the visitor-facing labels on /visit/track. */
  label?: string;
  prefix?: string;
}) {
  return <span className={styles.statusBadge} data-tone={statusTone(status)} data-status={status} data-kind={kind}>
    {prefix && `${prefix}: `}{label ?? statusLabel(status, kind)}
  </span>;
}
