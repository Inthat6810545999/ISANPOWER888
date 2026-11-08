"use client";
import { useRef, useState } from "react";
import { PageHeading } from "@/components/workspace/PageHeading";
import styles from "@/components/workspace/workspace.module.css";
import { RequestTable } from "@/features/requests/RequestTable";
import { RequestsSync } from "@/features/requests/RequestsSync";
import { useRequests } from "@/features/requests/RequestsProvider";
import { RequestsState } from "@/features/requests/RequestsState";
import type { WorkspaceRequest } from "@/features/requests/types";
import type { TaAction } from "@/lib/api";
import { isActiveStatus } from "@/lib/request-status";

type Scope = "active" | "pending" | "mine" | "closed" | "all";
const LABELS: Record<TaAction["action"], string> = { claim: "Assigning", start: "Starting", close: "Closing" };
export function TaQueue() {
  const [scope, setScope] = useState<Scope>("active");
  const { user, requests, taAction, loading, error, refresh, refreshing } = useRequests();
  const [busy, setBusy] = useState("");
  const lock = useRef(false);
  const [actionError, setActionError] = useState("");
  const active = requests.filter(request => isActiveStatus(request.status));
  const closed = requests.filter(request => request.status === "closed");
  const pending = requests.filter((request) => request.status === "pending" && request.approvalStatus === "approved" && request.requiresApproval && !request.assignee);
  const mine = requests.filter((request) => request.assignee?.id === user.email && isActiveStatus(request.status));
  const visible = scope === "active" ? active : scope === "pending" ? pending : scope === "mine" ? mine : scope === "closed" ? closed : requests;

  async function act(request: WorkspaceRequest, payload: TaAction) {
    if (lock.current) return;
    lock.current = true; setBusy(request.id); setActionError("");
    try {
      await taAction(request.id, payload);
      if (payload.action === "claim") setScope("mine");
      if (payload.action === "close") setScope("closed");
    } catch (err) {
      // Name the request: the queue can hold several, and the buttons re-enable together.
      const reason = err instanceof Error ? err.message : "Unable to save this change.";
      setActionError(`${LABELS[payload.action]} "${request.title}" did not save. ${reason}`);
    }
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
    <PageHeading title="TA Queue" description="View all open work, accept approved requests, and follow progress through to completion." showNewRequest={false} />
    <RequestsSync />
    {actionError && <p className={styles.error} role="alert">{actionError} You can try again below.</p>}
    <div className={styles.scopeSwitch} role="group" aria-label="Queue view">
      <button aria-pressed={scope === "active"} onClick={() => setScope("active")}>Active requests <span>{active.length}</span></button>
      <button aria-pressed={scope === "pending"} onClick={() => setScope("pending")}>Ready to accept <span>{pending.length}</span></button>
      <button aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>Assigned to me <span>{mine.length}</span></button>
      <button aria-pressed={scope === "closed"} onClick={() => setScope("closed")}>Closed history <span>{closed.length}</span></button>
      <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>All requests <span>{requests.length}</span></button>
    </div>
    <RequestsState loading={loading} error={error} hasData={requests.length > 0} onRetry={() => void refresh()} retrying={refreshing} />
    {requests.length > 0 && <RequestTable key={scope} title={scope === "active" ? "Active requests" : scope === "pending" ? "Approved requests ready to accept" : scope === "mine" ? "Assigned to me" : scope === "closed" ? "Closed request history" : "All requests"} requests={visible} renderRowActions={rowAction} />}
  </>;
}
