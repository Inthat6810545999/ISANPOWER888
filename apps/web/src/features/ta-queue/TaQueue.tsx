"use client";

import { useRef, useState } from "react";
import { PageHeading } from "@/components/workspace/PageHeading";
import styles from "@/components/workspace/workspace.module.css";
import { DEMO_TA } from "@/features/requests/demo-identity";
import { RequestTable } from "@/features/requests/RequestTable";
import { RequestsSync } from "@/features/requests/RequestsSync";
import { useRequests } from "@/features/requests/RequestsProvider";
import type { WorkspaceRequest } from "@/features/requests/types";
import { isActiveStatus } from "@/lib/request-status";

type Scope = "pending" | "mine" | "all";

export function TaQueue() {
  const [scope, setScope] = useState<Scope>("pending");
  const { requests, taAction, loading, error } = useRequests();
  const [busy, setBusy] = useState("");
  const lock = useRef(false);
  const [actionError, setActionError] = useState("");
  const pending = requests.filter((request) => request.status === "pending");
  const mine = requests.filter((request) => request.assignee?.id === DEMO_TA.id && isActiveStatus(request.status));
  const visible = scope === "pending" ? pending : scope === "mine" ? mine : requests;

  async function act(request: WorkspaceRequest, action: "claim" | "start" | "close") {
    if (lock.current) return;
    lock.current = true;
    setBusy(request.id);
    setActionError("");
    try {
      await taAction(request.id, action);
      if (action === "claim") setScope("mine");
      if (action === "close") setScope("all");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to save this change. Please retry.");
    } finally { lock.current = false; setBusy(""); }
  }

  function rowAction(request: WorkspaceRequest) {
    let action: "claim" | "start" | "close";
    let label: string;
    if (request.status === "pending" && !request.assignee) { action = "claim"; label = "Claim"; }
    else if (request.assignee?.id === DEMO_TA.id && request.status === "assigned") { action = "start"; label = "Start work"; }
    else if (request.assignee?.id === DEMO_TA.id && request.status === "in_progress") { action = "close"; label = "Mark closed"; }
    else return null;
    return <button className={styles.secondaryButton} disabled={Boolean(busy)} onClick={() => void act(request, action)}>{busy === request.id ? "Saving…" : label}</button>;
  }

  return <>
    <PageHeading title="TA Queue" description="See what needs attention. Help your lab take the next step." showNewRequest={false} />
    <RequestsSync />
    {actionError && <p className={styles.error} role="alert">{actionError}</p>}
    <div className={styles.scopeSwitch} role="group" aria-label="Queue view">
      <button aria-pressed={scope === "pending"} onClick={() => setScope("pending")}>Pending <span>{pending.length}</span></button>
      <button aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>Assigned to me <span>{mine.length}</span></button>
      <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>All requests <span>{requests.length}</span></button>
    </div>
    {!loading && (!error || requests.length > 0) && <RequestTable key={scope}
      title={scope === "pending" ? "Pending requests" : scope === "mine" ? "Assigned to me" : "All requests"}
      requests={visible} renderRowActions={rowAction} />}
  </>;
}
