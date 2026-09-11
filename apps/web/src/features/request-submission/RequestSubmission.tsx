"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/workspace/Dialog";
import { Icon } from "@/components/workspace/Icon";
import { PageHeading } from "@/components/workspace/PageHeading";
import styles from "@/components/workspace/workspace.module.css";
import { useRequests } from "@/features/requests/RequestsProvider";
import { CATEGORIES, PRIORITIES, type Category, type Priority } from "@/features/requests/types";

export function RequestSubmission() {
  const router = useRouter();
  const { addRequest } = useRequests();
  const titleId = useId();
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submitting = useRef(false);
  const close = () => { if (!submitting.current) router.push("/workspace/my-requests"); };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const category = String(data.get("category")) as Category;
    const priority = String(data.get("priority")) as Priority;
    if (!title || !description.trim()) {
      setError("Please add a request title and describe what you need.");
      return;
    }
    if (!(category in CATEGORIES) || !PRIORITIES.includes(priority)) {
      setError("Please choose a valid category and priority.");
      return;
    }
    setSubmitted(true);
    submitting.current = true;
    setError("");
    try {
      await addRequest({ title, category, priority, description: description.trim(),
        location: String(data.get("location") ?? "").trim(), neededBy: String(data.get("neededBy") ?? ""),
        requiresApproval: data.get("requiresApproval") === "on" });
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
      <form className={styles.requestForm} onSubmit={submit}>
        <label className={styles.field}>Request title *<input autoFocus name="title" required maxLength={200} placeholder="e.g. Calibrate the oscilloscope for sensor testing" /></label>
        <div className={styles.formGrid}>
          <label className={styles.field}>Category *<select name="category" defaultValue="equipment">{Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className={styles.field}>Priority *<select name="priority" defaultValue="medium">{PRIORITIES.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
        </div>
        <label className={styles.field}>What do you need? *<textarea name="description" required maxLength={4000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what you need, why it matters, and anything the team should know." aria-describedby="description-help" /></label>
        <div className={styles.fieldHint} id="description-help"><span>Give your team enough context to take action.</span><span>{description.length}/4000</span></div>
        <div className={styles.formGrid}>
          <label className={styles.field}><span>Location <small>Optional</small></span><input name="location" maxLength={200} placeholder="Lab, room, or workstation" /></label>
          <label className={styles.field}><span>Needed by <small>Optional</small></span><input name="neededBy" type="date" /></label>
        </div>
        <label className={styles.approvalBox}><input name="requiresApproval" type="checkbox" /><span><strong>Requires Lab Manager approval</strong><small>Choose this for spending, sensitive access, or work requiring authorisation.</small></span><Icon name="shield" /></label>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.formFooter}><span>Submit to save to your lab workspace</span><div><button className={styles.secondaryButton} type="button" disabled={submitted} onClick={close}>Cancel</button><button className={styles.primaryButton} type="submit" disabled={submitted}>{submitted ? "Submitting…" : "Submit request"}<Icon name="arrow" /></button></div></div>
      </form>
    </Dialog>
  </>;
}
