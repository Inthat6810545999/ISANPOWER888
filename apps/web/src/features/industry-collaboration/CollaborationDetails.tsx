import type { WorkspaceRequest } from "@/features/requests/types";
import styles from "@/components/workspace/workspace.module.css";

export function CollaborationDetails({ request }: { request: WorkspaceRequest }) {
  const details = request.collaboration;
  if (request.source !== "industry_collaboration" || !details) return null;
  return <section className={styles.decisionRecord} aria-label="Industry collaboration details">
    <h3>External Industry Collaboration</h3>
    <p>Staff only. Submitted by a TA on behalf of an industry partner. Public tracking shows statuses only. Codes are shown once at submission and cannot be recovered here. Older requests created before tracking support have no code.</p>
    <dl className={styles.detailGrid}>
      <div><dt>Company / organization</dt><dd>{details.organization}</dd></div>
      <div><dt>External contact</dt><dd>{details.contactName}</dd></div>
      <div><dt>External contact email</dt><dd>{details.contactEmail}</dd></div>
      <div><dt>Phone</dt><dd>{details.phone || "Not provided"}</dd></div>
      <div><dt>Submitted by TA</dt><dd>{details.submittedByName} ({details.submittedByEmail})</dd></div>
      <div><dt>Submitted at</dt><dd>{new Date(request.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })} (Asia/Bangkok)</dd></div>
    </dl>
  </section>;
}
