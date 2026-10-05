"use client";

import styles from "@/components/workspace/workspace.module.css";
import { requestedDate, SLOT_LABELS } from "@/features/visitor-track/contract";
import { PURPOSES } from "@/features/visitor-request/validation";
import type { WorkspaceRequest } from "./types";

const SLOT_NAMES = { morning: "Morning", afternoon: "Afternoon" } as const;

/** Staff-only panel. The visitor reads nothing here except publicMessage,
 *  which is rendered separately by PublicMessage. */
export function VisitorDetails({ request }: { request: WorkspaceRequest }) {
  const visit = request.visit;
  if (request.source !== "visitor" || !visit) return null;
  return <section className={styles.decisionRecord}>
    <h3>Visitor request · staff only</h3>
    <p>This requester has no lab account, so these contact details are the only way to reach them. Keep them internal.</p>
    <dl className={styles.detailGrid}>
      <div><dt>Contact name</dt><dd>{visit.contactName}</dd></div>
      <div><dt>Email</dt><dd>{visit.email}</dd></div>
      <div><dt>Phone</dt><dd>{visit.phone || "Not provided"}</dd></div>
      <div><dt>Organization</dt><dd>{visit.organization || "Not provided"}</dd></div>
      <div><dt>Requested date</dt><dd>{requestedDate(visit.visitDate)}</dd></div>
      <div><dt>Requested time</dt><dd>{SLOT_NAMES[visit.timeSlot]} {SLOT_LABELS[visit.timeSlot]}</dd></div>
      <div><dt>Visitors</dt><dd>{visit.visitorCount}</dd></div>
      <div><dt>Requested host</dt><dd>{visit.requestedHost || "No preference"}</dd></div>
    </dl>
    <p><strong>Purpose:</strong> {PURPOSES[visit.purpose]}</p>
    {visit.details && <p><strong>Details:</strong> {visit.details}</p>}
    {visit.arrangements && <p><strong>Arrangements requested:</strong> {visit.arrangements}</p>}
    <p>Requested times are preferences in Asia/Bangkok, not a confirmed booking. Approving does not reserve the room.</p>
  </section>;
}

/** The stored message the requester can read on /visit/track. */
export function PublicMessage({ request }: { request: WorkspaceRequest }) {
  if (request.source !== "visitor") return null;
  // approvalBox lays its children out in a row, so the text stacks inside one child.
  return <section className={styles.approvalBox}>
    <div>
      <h3>Message to the requester</h3>
      {request.publicMessage
        ? <p className={styles.description}>{request.publicMessage}</p>
        : <p>No message yet. The requester sees only the status until a Lab Manager writes one.</p>}
      <p className={styles.helper}>Visible on the public tracking page. The approval reason and decision history are never shown there.</p>
    </div>
  </section>;
}
