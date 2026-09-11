"use client";

import { useState } from "react";
import { Icon } from "@/components/workspace/Icon";
import { PageHeading } from "@/components/workspace/PageHeading";
import styles from "@/components/workspace/workspace.module.css";
import { MOCK_TA, MOCK_REQUESTS } from "@/features/requests/mock-data";
import { RequestTable } from "@/features/requests/RequestTable";
import type { WorkspaceRequest } from "@/features/requests/types";

type Scope = "pending" | "mine" | "all";

/** US-3 owner: replace this session-only queue with a server-authorized TA workflow. */
export function TaQueue() {
  const [scope, setScope] = useState<Scope>("pending");
  const [requests, setRequests] = useState<WorkspaceRequest[]>(MOCK_REQUESTS);
  const [notice, setNotice] = useState("");

  const pending = requests.filter((request) => request.status === "pending");
  const mine = requests.filter((request) => request.assignee?.id === MOCK_TA.id && request.status !== "closed");
  const visible = scope === "pending" ? pending : scope === "mine" ? mine : requests;

  function updateRequest(id: string, changes: Partial<WorkspaceRequest>) {
    setRequests((current) => current.map((request) => (request.id === id ? { ...request, ...changes } : request)));
  }

  function claim(request: WorkspaceRequest) {
    updateRequest(request.id, { assignee: MOCK_TA, status: "assigned" });
    setNotice(`${request.id} is now assigned to you.`);
  }

  function startWork(request: WorkspaceRequest) {
    updateRequest(request.id, { status: "in_progress" });
    setNotice(`${request.id} marked in progress.`);
  }

  function markClosed(request: WorkspaceRequest) {
    updateRequest(request.id, { status: "closed" });
    setNotice(`${request.id} closed.`);
  }

  function rowAction(request: WorkspaceRequest) {
    if (!request.assignee) {
      return <button className={styles.secondaryButton} onClick={() => claim(request)}>Claim</button>;
    }
    if (request.assignee.id !== MOCK_TA.id) return null;
    if (request.status === "assigned") {
      return <button className={styles.secondaryButton} onClick={() => startWork(request)}>Start work</button>;
    }
    if (request.status === "in_progress") {
      return <button className={styles.secondaryButton} onClick={() => markClosed(request)}>Mark closed</button>;
    }
    return null;
  }

  return <>
    <PageHeading title="TA Queue" description="See what needs attention. Help your lab take the next step." showNewRequest={false} />
    {notice && <div className={styles.notice} role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><Icon name="close" /></button></div>}
    <div className={styles.scopeSwitch} role="group" aria-label="Queue view">
      <button aria-pressed={scope === "pending"} onClick={() => setScope("pending")}>Pending <span>{pending.length}</span></button>
      <button aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>Assigned to me <span>{mine.length}</span></button>
      <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>All requests <span>{requests.length}</span></button>
    </div>
    <RequestTable
      key={scope}
      title={scope === "pending" ? "Pending requests" : scope === "mine" ? "Assigned to me" : "All requests"}
      requests={visible}
      renderRowActions={rowAction}
    />
  </>;
}
