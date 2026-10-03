"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import shared from "@/components/workspace/workspace.module.css";
import styles from "./visitor.module.css";
import { submitVisit } from "./actions";
import { EMPTY_VISIT, PURPOSES, TIME_SLOTS, validateVisit, type FieldErrors, type VisitInput, type VisitReceipt } from "./validation";

const LABELS: Record<keyof VisitInput, string> = {
  contactName: "Contact person's full name", email: "Email", phone: "Phone (optional)", organization: "Organization / school (optional)",
  purpose: "Purpose of visit", details: "What would you like to see or discuss?", visitDate: "Preferred visit date", timeSlot: "Preferred time slot",
  visitorCount: "Number of visitors, including you", requestedHost: "Person you would like to meet (optional)", arrangements: "Anything we should prepare? (optional)",
};

export function VisitorRequest() {
  const [values, setValues] = useState<VisitInput>({ ...EMPTY_VISIT });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"form" | "review">("form");
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<VisitReceipt | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorBox = useRef<HTMLParagraphElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step, receipt]);
  useEffect(() => { if (message) errorBox.current?.focus(); }, [message]);

  function field(name: keyof VisitInput, options: { type?: string; maxLength?: number; optional?: boolean; multiline?: boolean; hint?: string } = {}) {
    const props = {
      id: name, name, value: values[name], required: !options.optional,
      "aria-invalid": Boolean(errors[name]), "aria-describedby": [errors[name] ? `${name}-error` : "", options.hint ? `${name}-hint` : ""].filter(Boolean).join(" ") || undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setValues((previous) => ({ ...previous, [name]: event.target.value }));
        setErrors((previous) => ({ ...previous, [name]: undefined }));
      },
    };
    return <div className={shared.field}>
      <label htmlFor={name}>{LABELS[name]}</label>
      {name === "purpose" || name === "timeSlot" ? <select {...props}><option value="">Select an option</option>{Object.entries(name === "purpose" ? PURPOSES : TIME_SLOTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        : options.multiline ? <textarea {...props} maxLength={options.maxLength} rows={4} />
        : <input {...props} type={options.type ?? "text"} maxLength={options.maxLength} min={name === "visitorCount" ? 1 : undefined} step={name === "visitorCount" ? 1 : undefined} autoComplete={name === "contactName" ? "name" : name === "email" ? "email" : name === "phone" ? "tel" : name === "organization" ? "organization" : undefined} />}
      {options.hint && <small id={`${name}-hint`}>{options.hint}</small>}
      {errors[name] && <span id={`${name}-error`} className={styles.error}>{errors[name]}</span>}
    </div>;
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateVisit(values);
    setErrors(checked.errors);
    setMessage("");
    if (Object.keys(checked.errors).length) {
      document.getElementById(Object.keys(checked.errors)[0])?.focus();
      return;
    }
    setValues(checked.values);
    setStep("review");
  }
  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = await submitVisit(values);
      if (result.ok) setReceipt(result.receipt);
      else {
        if (result.fieldErrors) { setErrors(result.fieldErrors); setStep("form"); }
        setMessage(result.error);
      }
    } catch {
      setMessage("We could not confirm your submission. Your details are still here; check your connection before trying again.");
    } finally { submitting.current = false; setPending(false); }
  }
  async function copyCode() {
    if (!receipt) return;
    try { await navigator.clipboard.writeText(receipt.trackingCode); setCopyMessage("Tracking code copied."); }
    catch { setCopyMessage("Copy was unavailable. Select the code above and copy it manually."); }
  }
  const summary = <dl className={styles.summary}>{(Object.keys(LABELS) as (keyof VisitInput)[]).filter((key) => values[key]).map((key) => <div key={key} style={{ display: "contents" }}><dt>{LABELS[key]}</dt><dd>{key === "purpose" ? PURPOSES[values.purpose as keyof typeof PURPOSES] : key === "timeSlot" ? `${TIME_SLOTS[values.timeSlot as keyof typeof TIME_SLOTS]} · Thailand time` : values[key]}</dd></div>)}</dl>;

  return <main className={shared.loginPage}><section className={styles.card}>
    {!pending && <Link className={styles.back} href="/open-house">← Back to Open House</Link>}
    <p className={shared.eyebrow}>ISANPOWER / LAB VISITS</p>
    <h1 ref={heading} tabIndex={-1}>{receipt ? "Your visit request is saved" : step === "review" ? "Check your visit details" : "Come explore our lab"}</h1>
    {receipt ? <>
      <p className={styles.intro}>Your request is awaiting Lab Manager approval. This is not a confirmed appointment.</p>
      <label htmlFor="tracking-code">Your tracking code</label>
      <input id="tracking-code" className={styles.code} readOnly value={receipt.trackingCode} onFocus={(event) => event.currentTarget.select()} />
      <div className={styles.actions}><button type="button" className={shared.primaryButton} onClick={copyCode}>Copy tracking code</button></div>
      <p className={styles.status} role="status">{copyMessage}</p>
      <p className={styles.notice}>Save this code before leaving or refreshing this page. Keep it private and quote it when contacting the lab about your visit.</p>
      {summary}
      <Link className={shared.secondaryButton} href="/open-house">Return to Open House</Link>
    </> : <>
      <p className={styles.intro}>{step === "review" ? "Make sure the contact details and preferred date are correct before sending." : "Request a visit for yourself or your group. No account needed. Fields marked optional can be left blank."}</p>
      {message && <p ref={errorBox} tabIndex={-1} role="alert" className={shared.error}>{message}</p>}
      {step === "form" ? <form className={styles.form} noValidate onSubmit={review}>
        <fieldset className={styles.section}><legend>01 / Your contact details</legend>
          {field("contactName", { maxLength: 120 })}
          <div className={shared.formGrid}>{field("email", { type: "email", maxLength: 254 })}{field("phone", { type: "tel", maxLength: 40, optional: true })}</div>
          {field("organization", { maxLength: 200, optional: true })}
        </fieldset>
        <fieldset className={styles.section}><legend>02 / Plan your visit</legend>
          {field("purpose")}{field("details", { multiline: true, maxLength: 4000, hint: "For example: exploring IoT equipment for a student project. Maximum 4,000 characters." })}
          <div className={shared.formGrid}>{field("visitDate", { type: "date" })}{field("timeSlot", { hint: "All times are in Thailand (UTC+7)." })}</div>
          {field("visitorCount", { type: "number", hint: "Include the contact person in the total. Group size is subject to approval." })}
        </fieldset>
        <fieldset className={styles.section}><legend>03 / Anything else?</legend>
          {field("requestedHost", { maxLength: 200, optional: true, hint: "Leave blank if you do not have a specific person in mind." })}
          {field("arrangements", { multiline: true, maxLength: 1000, optional: true, hint: "Tell us about practical arrangements, such as step-free access. No medical details needed." })}
        </fieldset>
        <p className={styles.notice}>The lab team will use these details to review and coordinate your visit. Sending a request does not confirm an appointment; please wait for approval.</p>
        <div className={styles.actions}><button className={shared.primaryButton} type="submit">Review request →</button></div>
      </form> : <>
        {summary}
        <p className={styles.notice}>Your preferred date and time are subject to approval. Save the tracking code shown after a successful submission.</p>
        <div className={styles.actions} style={{ marginTop: 24 }}><button type="button" className={shared.secondaryButton} disabled={pending} onClick={() => { setStep("form"); setMessage(""); }}>Edit details</button><button type="button" className={shared.primaryButton} disabled={pending} onClick={submit}>{pending ? "Sending request…" : "Send visit request"}</button></div>
      </>}
    </>}
  </section></main>;
}
