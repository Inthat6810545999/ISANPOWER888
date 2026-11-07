"use client";

import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/workspace/Dialog";
import { Icon } from "@/components/workspace/Icon";
import { PageHeading } from "@/components/workspace/PageHeading";
import styles from "@/components/workspace/workspace.module.css";
import { useRequests } from "@/features/requests/RequestsProvider";
import { MEMBER_CATEGORIES as CATEGORIES, PRIORITIES, type Category, type Priority } from "@/features/requests/types";
import { validateRequestForm, type RequestFormValues } from "./validation";

const EMPTY_FORM: RequestFormValues = { title: "", category: "equipment", priority: "medium", description: "", location: "", neededBy: "" };

export function RequestSubmission() {
  const router = useRouter();
  const { addRequest } = useRequests();
  const titleId = useId();
  const fieldId = useId();
  const [values, setValues] = useState<RequestFormValues>(EMPTY_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof RequestFormValues, boolean>>>({});
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submitting = useRef(false);
  const close = () => { if (!submitting.current) router.push("/workspace/my-requests"); };

  const fieldErrors = validateRequestForm(values);
  const valid = Object.keys(fieldErrors).length === 0;
  const shownError = (name: keyof RequestFormValues) => touched[name] ? fieldErrors[name] : undefined;
  // Errors appear once a field has been edited or left, never on a fresh form.
  function control(name: keyof RequestFormValues) {
    const message = shownError(name);
    return {
      id: `${fieldId}-${name}`, name, value: values[name],
      "aria-invalid": Boolean(message), "aria-describedby": message ? `${fieldId}-${name}-error` : undefined,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { value } = event.target;
        setValues((previous) => ({ ...previous, [name]: value }));
        setTouched((previous) => ({ ...previous, [name]: true }));
      },
      onBlur: () => setTouched((previous) => ({ ...previous, [name]: true })),
    };
  }
  function fieldError(name: keyof RequestFormValues) {
    const message = shownError(name);
    return message && <span id={`${fieldId}-${name}-error`} className={styles.fieldError}>{message}</span>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!valid) {
      setTouched({ title: true, category: true, priority: true, description: true, location: true, neededBy: true });
      return;
    }
    setSubmitted(true);
    submitting.current = true;
    setError("");
    try {
      await addRequest({ title: values.title.trim(), category: values.category as Category, priority: values.priority as Priority,
        description: values.description.trim(), location: values.location.trim(), neededBy: values.neededBy });
      router.push("/workspace/my-requests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save. Please retry.");
      setSubmitted(false);
    } finally { submitting.current = false; }
  }

  return <>
    <PageHeading title="Create a request" description="A few clear details make a good start." />
    <Dialog titleId={titleId} onClose={close}>
      <div className={styles.dialogHeader}><p className={styles.eyebrow}>LET’S GET IT MOVING</p><h2 id={titleId}>Create a request</h2><p>A few clear details make a good start.</p></div>
      <form className={styles.requestForm} onSubmit={submit} aria-busy={submitted}>
        <div className={styles.field}><label htmlFor={`${fieldId}-title`}>Request title *</label><input autoFocus {...control("title")} required maxLength={200} placeholder="e.g. Calibrate the oscilloscope for sensor testing" />{fieldError("title")}</div>
        <div className={styles.formGrid}>
          <label className={styles.field}>Category *<select {...control("category")}>{Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{fieldError("category")}</label>
          <label className={styles.field}>Priority *<select {...control("priority")}>{PRIORITIES.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select>{fieldError("priority")}</label>
        </div>
        <div className={styles.field}><label htmlFor={`${fieldId}-description`}>What do you need? *</label><textarea {...control("description")} required maxLength={4000} rows={4} placeholder="Describe what you need, why it matters, and anything the team should know." aria-describedby={[shownError("description") && `${fieldId}-description-error`, "description-help"].filter(Boolean).join(" ")} />{fieldError("description")}</div>
        <div className={styles.fieldHint} id="description-help"><span>Give your team enough context to take action.</span><span>{values.description.length}/4000</span></div>
        <div className={styles.formGrid}>
          <div className={styles.field}><label htmlFor={`${fieldId}-location`}>Location <small>Optional</small></label><input {...control("location")} maxLength={200} placeholder="Lab, room, or workstation" />{fieldError("location")}</div>
          <div className={styles.field}><label htmlFor={`${fieldId}-neededBy`}>Needed by <small>Optional</small></label><input {...control("neededBy")} type="date" />{fieldError("neededBy")}</div>
        </div>
        <div className={styles.approvalBox}><Icon name="shield" /><span><strong>Every request needs Lab Manager approval</strong><small>A TA can accept and start your request only after it is approved.</small></span></div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.formFooter}><span role="status">{submitted ? "Saving your request… keep this page open." : "Submit to save to your lab workspace"}</span><div><button className={styles.secondaryButton} type="button" disabled={submitted} onClick={close}>Cancel</button><button className={styles.primaryButton} type="submit" disabled={submitted || !valid}>{submitted ? "Submitting…" : "Submit request"}<Icon name="arrow" /></button></div></div>
      </form>
    </Dialog>
  </>;
}
