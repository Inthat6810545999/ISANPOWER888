"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import shared from "@/components/workspace/workspace.module.css";
import { StatusBadge } from "@/components/workspace/StatusBadge";
import styles from "../visitor-request/visitor.module.css";
import { readPublicVisit, requestedDate, REVIEW_LABELS, scheduleNote, SLOT_LABELS, WORK_LABELS, type PublicVisit, readPublicCollaboration, type PublicCollaboration } from "./contract";

type State = { kind: "idle" | "loading" } | { kind: "error"; message: string } | { kind: "found"; visit: PublicVisit | PublicCollaboration };


export function VisitorTrack({ collaboration = false }: { collaboration?: boolean }) {
  const unavailable = collaboration ? "Collaboration tracking is temporarily unavailable. Please try again later." : "Visit tracking is temporarily unavailable. Please try again later.";
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const inFlight = useRef(false);
  const lookup = useCallback(async (value: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ kind: "loading" });
    try {
      const origin = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!origin) throw new Error("API not configured");
      const endpoint = new URL(collaboration ? "/api/collaborations/track" : "/api/visits/track", origin);
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value.trim() }), credentials: "omit", cache: "no-store",
        referrerPolicy: "no-referrer", signal: AbortSignal.timeout(15000), redirect: "error",
      });
      if (response.status === 404) {
        setState({ kind: "error", message: collaboration ? "We could not find that collaboration request. Check your tracking code and try again." : "We could not find that visit request. Check your tracking code and try again." });
      } else if (response.status === 429) {
        const seconds = Number(response.headers.get("Retry-After"));
        setState({ kind: "error", message: Number.isSafeInteger(seconds) && seconds > 0
          ? `Too many attempts. Please wait ${seconds} seconds before trying again.`
          : "Too many attempts. Please wait a minute before trying again." });
      } else if (response.status === 200) {
        const body: unknown = await response.json();
        const visit = collaboration ? readPublicCollaboration(body) : readPublicVisit(body);
        setState(visit ? { kind: "found", visit } : { kind: "error", message: unavailable });
      } else setState({ kind: "error", message: unavailable });
    } catch { setState({ kind: "error", message: unavailable }); }
    finally { inFlight.current = false; }
  }, [collaboration, unavailable]);

  useEffect(() => {
    function readFragment() {
      const initial = new URLSearchParams(window.location.hash.slice(1)).get("code");
      if (window.location.hash) {
        window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      }
      if (initial !== null) {
        // Removal is synchronous, so Strict Mode replay cannot submit twice.
        queueMicrotask(() => { setCode(initial.trim()); void lookup(initial); });
      }
    }
    readFragment();
    window.addEventListener("hashchange", readFragment);
    return () => window.removeEventListener("hashchange", readFragment);
  }, [lookup]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(code);
  }
  const pending = state.kind === "loading";
  return <main className={shared.loginPage}><section className={styles.card}>
    {!collaboration && <Link className={styles.back} href="/open-house">← Back to Open House</Link>}
    <p className={shared.eyebrow}>{collaboration ? "ISANPOWER / INDUSTRY COLLABORATION" : "ISANPOWER / LAB VISITS"}</p>
    <h1>{collaboration ? "Track your collaboration request" : "Track your visit request"}</h1>
    <p className={styles.intro}>{collaboration ? "Enter the tracking code shared by the lab. No account is needed. Keep this code private." : "Enter the tracking code you saved when submitting your request. Keep this code private."}</p>
    <form onSubmit={submit} className={styles.form} aria-busy={pending}>
      <div className={shared.field}>
        <label htmlFor="tracking-code">Tracking code</label>
        <input id="tracking-code" value={code} onChange={event => setCode(event.target.value)}
          autoComplete="off" autoCapitalize="none" spellCheck={false} readOnly={pending}
          aria-describedby="tracking-hint" />
        <small id="tracking-hint">Codes are case-sensitive. Paste your full code, including any hyphens or underscores.</small>
      </div>
      <div className={styles.actions}><button className={shared.primaryButton} type="submit" disabled={pending}>
        {pending ? "Searching…" : "Find my request"}
      </button></div>
    </form>
    <div role="status" aria-live="polite" aria-atomic="true" className={styles.status}>
      {pending && <p>{collaboration ? "Searching for your collaboration request…" : "Searching for your visit request…"}</p>}
      {state.kind === "error" && <p className={styles.notice}>{state.message}</p>}
      {state.kind === "found" && <section aria-label={collaboration ? "Collaboration request result" : "Visit request result"}>
        <h2>{state.visit.approvalStatus === "rejected" ? "Request declined" : collaboration ? "Collaboration request found" : "Visit request found"}</h2>
        <dl className={styles.summary}>
          <dt>Review status</dt><dd><StatusBadge kind="approval" status={state.visit.approvalStatus} label={REVIEW_LABELS[state.visit.approvalStatus]} /></dd>
          <dt>Request status</dt><dd><StatusBadge status={state.visit.status} label={WORK_LABELS[state.visit.status]} /></dd>
          {"visitDate" in state.visit && <><dt>Requested date</dt><dd>{requestedDate(state.visit.visitDate)}</dd>
          <dt>Requested time</dt><dd>{SLOT_LABELS[state.visit.timeSlot]} · Thailand time (Asia/Bangkok)</dd></>}
          {"publicMessage" in state.visit && state.visit.publicMessage && <><dt>Message from the lab</dt><dd>{state.visit.publicMessage}</dd></>}
        </dl>
        {!collaboration && <p className={styles.notice}>{scheduleNote(state.visit.approvalStatus)}</p>}
      </section>}
    </div>
  </section></main>;
}
