"use client";
import { useEffect, useRef, useState } from "react";
import { PageHeading } from "@/components/workspace/PageHeading";
import styles from "@/components/workspace/workspace.module.css";
import { RequestTable } from "@/features/requests/RequestTable";
import { RequestsSync } from "@/features/requests/RequestsSync";
import { useRequests } from "@/features/requests/RequestsProvider";
import { loadAssignees } from "@/features/requests/actions";
import type { WorkspaceRequest } from "@/features/requests/types";
import type { SessionUser } from "@/lib/session-types";
import type { TaAction } from "@/lib/api";
import { isActiveStatus } from "@/lib/request-status";

type Scope = "pending" | "mine" | "all";
export function TaQueue() {
  const [scope, setScope] = useState<Scope>("pending");
  const { user, requests, taAction, loading, error } = useRequests();
  const [assignees, setAssignees] = useState<SessionUser[]>([]);
  const [busy, setBusy] = useState("");
  const lock = useRef(false);
  const [actionError, setActionError] = useState("");
  useEffect(() => {
    let active = true;
    loadAssignees().then((data) => { if (active) setAssignees(data); }).catch(() => { if (active) setActionError("Unable to load TA accounts. Reload the page to retry."); });
    return () => { active = false; };
  }, []);
  const pending = requests.filter((request) => request.status === "pending");
  const mine = requests.filter((request) => request.assignee?.id === user.email && isActiveStatus(request.status));
  const visible = scope === "pending" ? pending : scope === "mine" ? mine : requests;

  async function act(request: WorkspaceRequest, payload: TaAction) {
    if (lock.current) return;
    lock.current = true; setBusy(request.id); setActionError("");
    try {
      await taAction(request.id, payload);
      if (payload.action === "claim") setScope("mine");
      if (payload.action === "close" || payload.action === "assign") setScope("all");
    } catch (err) { setActionError(err instanceof Error ? err.message : "Unable to save this change."); }
    finally { lock.current = false; setBusy(""); }
  }

  function rowAction(request: WorkspaceRequest) {
    if (!isActiveStatus(request.status)) return null;
    const canWork = request.requiresApproval ? request.approvalStatus === "approved" : request.approvalStatus === "not_required";
    const isMine = request.assignee?.id === user.email;
    const workAction = isMine && request.status === "assigned" ? "start" : isMine && request.status === "in_progress" ? "close" : null;
    return <div className={styles.actionStack}>
      {request.status === "pending" && !request.assignee && <button className={styles.secondaryButton} disabled={!!busy} onClick={() => void act(request, { action: "claim" })}>Claim</button>}
      {(request.status === "pending" || request.status === "assigned") && <label>Assign to TA
        <select aria-label={`Assign ${request.title}`} disabled={!!busy || !assignees.length} value="" onChange={(event) => {
          if (event.target.value && request.updatedAt) void act(request, { action: "assign", assigneeId: event.target.value, expectedUpdatedAt: request.updatedAt });
        }}><option value="">Select TA…</option>{assignees.map((ta) => <option key={ta.id} value={ta.id}>{ta.name}</option>)}</select>
      </label>}
      {workAction && <button className={styles.secondaryButton} disabled={!!busy || !canWork} onClick={() => void act(request, { action: workAction })}>{workAction === "start" ? "Start work" : "Mark closed"}</button>}
      {!canWork && <small>{request.approvalStatus === "rejected" ? "Rejected — work blocked" : "Waiting for manager approval"}</small>}
      {busy === request.id && <small role="status">Saving…</small>}
    </div>;
  }
  return <>
    <PageHeading title="TA Queue" description="Assign and complete lab work. Approval decisions belong to the Lab Manager." showNewRequest={false} />
    <RequestsSync />
    {actionError && <p className={styles.error} role="alert">{actionError}</p>}
    <div className={styles.scopeSwitch} role="group" aria-label="Queue view">
      <button aria-pressed={scope === "pending"} onClick={() => setScope("pending")}>Pending <span>{pending.length}</span></button>
      <button aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>Assigned to me <span>{mine.length}</span></button>
      <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>All requests <span>{requests.length}</span></button>
    </div>
    {!loading && (!error || requests.length > 0) && <RequestTable key={scope} title={scope === "pending" ? "Pending requests" : scope === "mine" ? "Assigned to me" : "All requests"} requests={visible} renderRowActions={rowAction} />}
  </>;
}
