"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Report } from "@/lib/api";
import { loadReport } from "@/features/requests/actions";
import { PageHeading } from "@/components/workspace/PageHeading";
import { STATUS_LABELS, APPROVAL_LABELS } from "@/lib/request-status";
import { CATEGORIES } from "@/features/requests/types";
import styles from "@/components/workspace/workspace.module.css";

const labels: Record<string, string> = { ...STATUS_LABELS, ...APPROVAL_LABELS, ...CATEGORIES };
export function ManagerReports() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [range, setRange] = useState({ from: "", to: "" });
  useEffect(() => {
    let active = true;
    loadReport().then((data) => { if (active) setReport(data); }).catch((err) => { if (active) setError(err instanceof Error ? err.message : "Unable to load reports."); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = { from: String(form.get("from") ?? ""), to: String(form.get("to") ?? "") };
    setBusy(true); setError("");
    try { setReport(await loadReport(next.from, next.to)); setRange(next); }
    catch (err) { setReport(null); setError(err instanceof Error ? err.message : "Unable to load reports."); }
    finally { setBusy(false); }
  }
  function download() {
    if (!report) return;
    const rows = [["Group", "Value", "Count"], ["Total", "Requests", String(report.total)]];
    for (const [group, entries] of [["Work status", report.byStatus], ["Approval status", report.byApproval], ["Category", report.byType]] as const) {
      for (const entry of entries) rows.push([group, entry.label, String(entry.count)]);
    }
    const text = `Generated at,${report.generatedAt}\r\nFrom,${range.from || "All dates"}\r\nTo,${range.to || "All dates"}\r\n` + rows.map((r) => r.join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "lab-request-report.csv"; link.click();
    URL.revokeObjectURL(url);
  }
  const count = (entries: Report["byStatus"], key: string) => entries.find((e) => e.label === key)?.count ?? 0;
  return <>
    <PageHeading title="Dashboard / Reports" description="Understand request volume, work progress, and approval outcomes." showNewRequest={false} />
    <form className={styles.reportFilters} onSubmit={submit}>
      <label className={styles.field}>Created from (UTC)<input type="date" name="from" /></label>
      <label className={styles.field}>Created through (UTC)<input type="date" name="to" /></label>
      <button className={styles.primaryButton} disabled={busy}>{busy ? "Loading…" : "Refresh report"}</button>
      <button type="button" className={styles.secondaryButton} disabled={!report || busy || !!error} onClick={download}>Download CSV</button>
    </form>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {report && <>
      <p className={styles.helper}>Created dates: {range.from || "no start limit"} to {range.to || "no end limit"} · Generated {new Date(report.generatedAt).toLocaleString()}</p>
      <div className={styles.reportCards}>
        <div><small>Total requests</small><strong>{report.total}</strong></div>
        <div><small>Awaiting approval</small><strong>{count(report.byApproval, "submitted") + count(report.byApproval, "under_review")}</strong></div>
        <div><small>In progress</small><strong>{count(report.byStatus, "in_progress")}</strong></div>
        <div><small>Closed</small><strong>{count(report.byStatus, "closed")}</strong></div>
      </div>
      <div className={styles.reportGroups}>{([["Work status", report.byStatus], ["Approval status", report.byApproval], ["Category", report.byType]] as const).map(([title, entries]) => <section className={styles.tableCard} key={title}>
        <h2>{title}</h2><table className={styles.table}><thead><tr><th>Value</th><th>Requests</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.label}><td>{labels[entry.label] ?? entry.label}</td><td>{entry.count}</td></tr>)}</tbody></table>
        {!entries.length && <p>No requests in this period.</p>}
      </section>)}</div>
    </>}
  </>;
}
