"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { PageHeading } from "@/components/workspace/PageHeading";
import styles from "@/components/workspace/workspace.module.css";
import { useRequests } from "@/features/requests/RequestsProvider";
import { submitCollaboration } from "@/features/requests/actions";
import { COLLABORATION_FIELDS, EMPTY_COLLABORATION, validateCollaboration, type CollaborationInput } from "./validation";

export function CollaborationForm() {
  const { user } = useRequests();
  const [values, setValues] = useState({ ...EMPTY_COLLABORATION });
  const [touched, setTouched] = useState<Partial<Record<keyof CollaborationInput, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingLink, setTrackingLink] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopyMessage("Copied. Share privately with the external contact."); }
    catch { setCopyMessage("Copy unavailable. Select the code or link and copy it manually."); }
  }
  const [savedId, setSavedId] = useState("");
  const lock = useRef(false);
  const id = useId();
  const { errors } = validateCollaboration(values);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || Object.keys(errors).length || savedId) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await submitCollaboration(values);
      if (result.ok) {
        setSavedId(result.data.id); setTrackingCode(result.data.trackingCode);
        setTrackingLink(`${window.location.origin}/collaboration/track#code=${encodeURIComponent(result.data.trackingCode)}`);
      }
      else setError(result.error);
    } catch { setError("Unable to submit. Your draft is kept. Check your connection and try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <PageHeading title="External Industry Collaboration" description="Submit a formal request on behalf of an industry partner." showNewRequest={false} />
    {savedId ? <section className={styles.tableCard}><div className={styles.requestForm}>
      <p role="status">Collaboration request submitted. It needs Lab Manager approval before work can begin.</p>
      <p>Save this code or link before leaving or refreshing. It is shown only now and cannot be recovered later. Anyone with it can view public statuses without signing in. Share it privately with the external contact.</p>
      <div className={styles.field}><label htmlFor="collaboration-code">Tracking code</label><input id="collaboration-code" readOnly value={trackingCode} onFocus={e => e.currentTarget.select()} /></div>
      <div className={styles.field}><label htmlFor="collaboration-link">Tracking link</label><input id="collaboration-link" readOnly value={trackingLink} onFocus={e => e.currentTarget.select()} /></div>
      <button type="button" className={styles.secondaryButton} onClick={() => void copy(trackingCode)}>Copy tracking code</button>
      <button type="button" className={styles.secondaryButton} onClick={() => void copy(trackingLink)}>Copy tracking link</button>
      <p role="status">{copyMessage}</p>
      <Link className={styles.primaryButton} href={`/ta/collaborations/${encodeURIComponent(savedId)}`}>Open created request</Link>
    </div></section> : <section className={styles.tableCard}>
      <form onSubmit={submit} className={styles.requestForm} aria-busy={busy}>
        <p>Submitting TA: <strong>{user.name}</strong> ({user.email}). External contact details below identify the partner, not the submitting TA.</p>
        {(Object.keys(COLLABORATION_FIELDS) as (keyof CollaborationInput)[]).map(key => {
          const field = COLLABORATION_FIELDS[key];
          const errorText = touched[key] ? errors[key] : undefined;
          const props = { id: `${id}-${key}`, name: key, value: values[key], required: key !== "phone", maxLength: field.max,
            readOnly: busy, "aria-invalid": !!errorText, "aria-describedby": errorText ? `${id}-${key}-error` : undefined,
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
              setValues(current => ({ ...current, [key]: event.target.value })); setTouched(current => ({ ...current, [key]: true }));
            }, onBlur: () => setTouched(current => ({ ...current, [key]: true })) };
          return <div className={styles.field} key={key}>
            <label htmlFor={props.id}>{field.label}{key !== "phone" && " *"}</label>
            {key === "description" ? <textarea {...props} rows={6} /> : <input {...props} type={key === "contactEmail" ? "email" : key === "phone" ? "tel" : "text"} />}
            {errorText && <span className={styles.fieldError} id={`${id}-${key}-error`}>{errorText}</span>}
          </div>;
        })}
        <div className={styles.approvalBox}><p><strong>Needs approval</strong> — sent to the Lab Manager. Work starts as Pending / Awaiting approval. Submitting does not assign the work to you.</p></div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.formFooter}>
          <span role="status">{busy ? "Saving your collaboration request… keep this page open." : "Partner contact details are visible only to authorized staff."}</span>
          <button className={styles.primaryButton} disabled={busy || !!Object.keys(errors).length}>{busy ? "Submitting…" : "Submit collaboration request"}</button>
        </div>
      </form>
    </section>}
  </>;
}
