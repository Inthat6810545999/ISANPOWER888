"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { useRequests } from "@/features/requests/RequestsProvider";
import { RequestsSync } from "@/features/requests/RequestsSync";
import { RequestTable, StatusBadge } from "@/features/requests/RequestTable";
import { CATEGORIES, type WorkspaceRequest } from "@/features/requests/types";
import { PublicMessage, VisitorDetails } from "@/features/requests/VisitorDetails";
import { PageHeading } from "@/components/workspace/PageHeading";
import { Dialog } from "@/components/workspace/Dialog";
import styles from "@/components/workspace/workspace.module.css";

function needsReview(r: WorkspaceRequest) { return r.requiresApproval && ["submitted", "under_review"].includes(r.approvalStatus) && !["closed", "cancelled"].includes(r.status); }
export function ManagerApprovals() {
  const { requests, review, loading, error } = useRequests();
  const [all, setAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = requests.find((r) => r.id === selectedId);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [reviewError, setReviewError] = useState("");
  const titleId = useId();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !selected) return;
    const form = new FormData(event.currentTarget);
    lock.current = true; setBusy(true); setReviewError("");
    // Sent only for Visitors: members read decisions in their own workspace.
    const publicMessage = selected.source === "visitor" ? String(form.get("publicMessage") ?? "") : undefined;
    try { await review(selected.id, String(form.get("decision")) as "approved" | "rejected", String(form.get("reason") ?? ""), publicMessage); setSelectedId(null); }
    catch (err) { setReviewError(err instanceof Error ? err.message : "Unable to record the decision."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <PageHeading title="Request approvals" description="Review the details and record a decision. Work remains in the TA queue." showNewRequest={false} />
    <RequestsSync />
    <div className={styles.scopeSwitch} role="group" aria-label="Approval view">
      <button aria-pressed={!all} onClick={() => setAll(false)}>Awaiting review <span>{requests.filter(needsReview).length}</span></button>
      <button aria-pressed={all} onClick={() => setAll(true)}>All requests <span>{requests.length}</span></button>
    </div>
    {!loading && (!error || requests.length > 0) && <RequestTable title={all ? "All requests" : "Awaiting review"} requests={all ? requests : requests.filter(needsReview)} renderRowActions={(r) => needsReview(r) ? <button className={styles.secondaryButton} onClick={() => { setSelectedId(r.id); setReviewError(""); }}>Review</button> : null} />}
    {selected && <Dialog titleId={titleId} onClose={() => { if (!busy) setSelectedId(null); }}>
      <div className={styles.dialogHeader}><p className={styles.eyebrow}>REQUEST REVIEW</p><h2 id={titleId}>{selected.title}</h2></div>
      <div className={styles.detailBody}><StatusBadge request={selected} /><p className={styles.description}>{selected.description}</p>
        <dl className={styles.detailGrid}>
          <div><dt>Requester</dt><dd>{selected.requester.name}</dd></div><div><dt>Assigned to</dt><dd>{selected.assignee?.name ?? "Unassigned"}</dd></div>
          <div><dt>Category</dt><dd>{CATEGORIES[selected.category]}</dd></div><div><dt>Priority</dt><dd>{selected.priority}</dd></div>
          <div><dt>Location</dt><dd>{selected.location || "Not specified"}</dd></div><div><dt>Needed by</dt><dd>{selected.neededBy || "No due date"}</dd></div>
        </dl>
        <VisitorDetails request={selected} />
        <PublicMessage request={selected} />
        <form onSubmit={submit} className={styles.reviewForm}>
          <label className={styles.field}>Decision<select name="decision" required defaultValue=""><option value="" disabled>Select a decision</option><option value="approved">Approve</option><option value="rejected">Reject</option></select></label>
          <label className={styles.field}>Reason (internal)<textarea name="reason" required maxLength={2000} rows={4} /></label>
          <p className={styles.fieldHint}>The reason stays in the internal record. It is never shown to the requester.</p>
          {selected.source === "visitor" && <>
            <label className={styles.field}>Message to the requester (public)<textarea name="publicMessage" maxLength={2000} rows={4} defaultValue={selected.publicMessage} /></label>
            <p className={styles.fieldHint}>Shown on the visitor&apos;s tracking page. Write it for someone outside the lab: say what happens next, and who to contact. Do not paste the internal reason, and do not include other people&apos;s details. Leave unchanged to keep the current message; clear it to remove the message.</p>
          </>}
          <p>Your identity and review time will be recorded. Final decisions cannot be overwritten.</p>
          {reviewError && <p role="alert" className={styles.error}>{reviewError}</p>}
          <button className={styles.primaryButton} disabled={busy || !needsReview(selected)}>{busy ? "Recording…" : "Record decision"}</button>
        </form>
      </div>
    </Dialog>}
  </>;
}
