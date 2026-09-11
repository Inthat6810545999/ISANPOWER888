"use client";

import { useState } from "react";
import { PageHeading } from "@/components/workspace/PageHeading";
import styles from "@/components/workspace/workspace.module.css";
import { MOCK_TA, MOCK_REQUESTS } from "@/features/requests/mock-data";
import { RequestTable } from "@/features/requests/RequestTable";

/** US-3 owner: add server-side TA authorization, assignment and queue workflow. */
export function TaQueue() {
  const [scope, setScope] = useState<"all" | "mine">("all");
  const requests = MOCK_REQUESTS;
  const assigned = requests.filter((request) => request.assignee?.id === MOCK_TA.id && request.status !== "closed");
  return <>
    <PageHeading title="TA Queue" description="See what needs attention. Help your lab take the next step." showNewRequest={false} />
    <div className={styles.scopeSwitch} role="group" aria-label="Queue view">
      <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>All requests <span>{requests.length}</span></button>
      <button aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>Assigned to me <span>{assigned.length}</span></button>
    </div>
    <RequestTable key={scope} title={scope === "all" ? "All requests" : "Assigned to me"} requests={scope === "all" ? requests : assigned} />
  </>;
}
