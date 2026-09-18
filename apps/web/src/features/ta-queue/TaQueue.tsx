"use client";
import { useRef, useState } from "react";
import { PageHeading } from "@/components/workspace/PageHeading";
import styles from "@/components/workspace/workspace.module.css";
import { RequestTable } from "@/features/requests/RequestTable";
import { RequestsSync } from "@/features/requests/RequestsSync";
import { useRequests } from "@/features/requests/RequestsProvider";
import type { WorkspaceRequest } from "@/features/requests/types";
import type { TaAction } from "@/lib/api";
import { isActiveStatus } from "@/lib/request-status";

type Scope = "pending" | "mine" | "all";
export function TaQueue() {
  const [scope, setScope] = useState<Scope>("pending");
  const { user, requests, taAction, loading, error } = useRequests();
  const [busy, setBusy] = useState("");
  const lock = useRef(false);
  const [actionError, setActionError] = useState("");
  const pending = requests.filter((request) => request.status === "pending" && request.approvalStatus === "approved" && request.requiresApproval && !request.assignee);
  const mine = requests.filter((request) => request.assignee?.id === user.email && isActiveStatus(request.status));
  const visible = scope === "pending" ? pending : scope === "mine" ? mine : requests;

  async function act(request: WorkspaceRequest, payload: TaAction) {
    if (lock.current) return;
    lock.current = true; setBusy(request.id); setActionError("");
    try {
      await taAction(request.id, payload);
      if (payload.action === "claim") setScope("mine");
      if (payload.action === "close") setScope("all");
    } catch (err) { setActionError(err instanceof Error ? err.message : "Unable to save this change."); }
    finally { lock.current = false; setBusy(""); }
  }

  function rowAction(request: WorkspaceRequest) {
    if (!isActiveStatus(request.status)) return null;
    const canWork = request.requiresApproval && request.approvalStatus === "approved";
    const isMine = request.assignee?.id === user.email;
    const workAction = isMine && request.status === "assigned" ? "start" : isMine && request.status === "in_progress" ? "close" : null;
    return <div className={styles.actionStack}>
      {request.status === "pending" && !request.assignee && <button className={styles.secondaryButton} disabled={!!busy || !canWork} onClick={() => void act(request, { action: "claim" })}>Assign to myself</button>}
      {workAction && <button className={styles.secondaryButton} disabled={!!busy || !canWork} onClick={() => void act(request, { action: workAction })}>{workAction === "start" ? "Start work" : "Mark closed"}</button>}
      {!canWork && <small>{request.approvalStatus === "rejected" ? "Rejected — work blocked" : "Waiting for manager approval"}</small>}
      {busy === request.id && <small role="status">Saving…</small>}
    </div>;
  }
  return <>
    <PageHeading title="TA Queue" description="Accept approved requests for yourself, then start and complete your own work." showNewRequest={false} />
    <RequestsSync />
    {actionError && <p className={styles.error} role="alert">{actionError}</p>}
    <div className={styles.scopeSwitch} role="group" aria-label="Queue view">
      <button aria-pressed={scope === "pending"} onClick={() => setScope("pending")}>Ready to accept <span>{pending.length}</span></button>
      <button aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>Assigned to me <span>{mine.length}</span></button>
      <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>All requests <span>{requests.length}</span></button>
    </div>
    {!loading && (!error || requests.length > 0) && <RequestTable key={scope} title={scope === "pending" ? "Approved requests ready to accept" : scope === "mine" ? "Assigned to me" : "All requests"} requests={visible} renderRowActions={rowAction} />}
  </>;
}
