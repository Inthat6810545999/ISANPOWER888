"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Dialog } from "@/components/workspace/Dialog";
import styles from "@/components/workspace/workspace.module.css";
import { VisitorDetails } from "@/features/requests/VisitorDetails";
import { PublicMessageMetadata } from "@/features/requests/PublicMessageMetadata";
import { StatusBadge } from "@/features/requests/RequestTable";
import type { WorkspaceRequest } from "@/features/requests/types";
import { savePublicMessage, reloadPublicMessageRequest } from "./public-message-actions";
import { canEditPublicMessage } from "./public-message-rules";
import type { LabRequest } from "@/lib/api";

export function PublicMessageDialog({ initial, onClose, onSaved }: {
  initial: WorkspaceRequest; onClose: () => void; onSaved: () => void;
}) {
  // Snapshot stays mounted even if the existing list poll fails or removes the row.
  const [request, setRequest] = useState(initial);
  const [draft, setDraft] = useState(initial.publicMessage);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const lock = useRef(false);
  const titleId = useId();
  const hintId = useId();
  const eligible = canEditPublicMessage(request);
  const count = draft.trim().length;

  function apply(data: LabRequest) {
    setRequest(current => ({ ...current, ...data, category: data.type,
      source: data.source ?? "member", publicMessage: data.publicMessage ?? "",
      visit: data.visit ?? null, neededBy: data.neededBy?.slice(0, 10) ?? "" }));
  }
  async function reload() {
    const result = await reloadPublicMessageRequest(request.id);
    if (result.ok) { apply(result.data); setNeedsReload(false); }
    else { setNeedsReload(true); setError(`Details could not be reloaded. ${result.error}`); }
  }
  async function retryReload() {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await reload(); }
    catch { setError("Details could not be reloaded. Your draft is kept. Try reloading again."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !eligible || needsReload || count > 2000) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const result = await savePublicMessage(request.id, draft);
      if (result.ok) {
        apply(result.data); setDraft(result.data.publicMessage ?? ""); setEditing(false);
        setNotice("Public message saved. Visitors will see it on their next lookup.");
        onSaved();
      } else {
        setError(result.error);
        if (result.status === 409) { setNeedsReload(true); await reload(); }
      }
    } catch { setError("Unable to save the message. Your draft is kept. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Dialog titleId={titleId} onClose={() => { if (!lock.current) onClose(); }}>
    <div className={styles.dialogHeader}><p className={styles.eyebrow}>REQUEST DETAILS</p><h2 id={titleId}>{request.title}</h2></div>
    <div className={styles.detailBody}>
      <StatusBadge request={request} />
      <VisitorDetails request={request} />
      <section className={styles.decisionRecord}>
        <h3>Public message to Visitor</h3>
        <p>Visitors can read this message on the public tracking page. Keep internal reasons and private staff information separate.</p>
        <p className={styles.description}>{request.publicMessage || "No public message."}</p>
        <PublicMessageMetadata request={request} />
        {notice && <p role="status">{notice}</p>}
        {!editing && eligible && <button className={styles.secondaryButton} onClick={() => {
          setDraft(request.publicMessage); setEditing(true); setError(""); setNotice("");
        }}>Edit public message</button>}
        {editing && <form className={styles.reviewForm} onSubmit={submit} aria-busy={busy}>
          <label className={styles.field}>Public message to Visitor<textarea rows={5} value={draft}
            readOnly={busy} aria-describedby={hintId} aria-invalid={count > 2000}
            onChange={event => setDraft(event.target.value)} /></label>
          <p id={hintId} className={styles.fieldHint}>{count.toLocaleString("en-US")} / 2,000 characters after trimming. Leave empty to clear the saved message.</p>
          {count > 2000 && <p role="alert" className={styles.error}>Shorten your message to 2,000 characters or fewer.</p>}
          {!eligible && <p role="alert">This request is no longer eligible. You can copy your draft before cancelling.</p>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {needsReload && <button type="button" disabled={busy} className={styles.secondaryButton} onClick={() => void retryReload()}>Reload request details</button>}
          <div className={styles.rowActions}>
            <button className={styles.primaryButton} disabled={busy || count > 2000 || !eligible || needsReload}>{busy ? "Saving / loading…" : "Save message"}</button>
            <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => {
              setDraft(request.publicMessage); setEditing(false); setError(""); setNotice("Editing cancelled. The saved message is unchanged.");
            }}>Cancel</button>
          </div>
        </form>}
      </section>
      {request.decision && <section className={styles.decisionRecord}>
        <h3>Approval reason (internal)</h3><p className={styles.description}>{request.decision.reason}</p>
        <p>This reason is never shown to the Visitor.</p>
      </section>}
    </div>
  </Dialog>;
}
