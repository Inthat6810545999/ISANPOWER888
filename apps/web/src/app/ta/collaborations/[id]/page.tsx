import Link from "next/link";
import { loadCollaboration } from "@/features/requests/actions";
import { CollaborationDetails } from "@/features/industry-collaboration/CollaborationDetails";
import { RequestStatusBadges } from "@/features/requests/RequestTable";
import { StatusBadge } from "@/components/workspace/StatusBadge";
import styles from "@/components/workspace/workspace.module.css";

export default async function CollaborationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadCollaboration(id);
  if (!result.ok) return <section><p role="alert" className={styles.error}>{result.error}</p><Link href={`/ta/collaborations/${encodeURIComponent(id)}`}>Try again</Link></section>;
  const request = result.data;
  return <section className={styles.tableCard}>
    <div className={styles.detailBody}>
      <h1>{request.title}</h1><RequestStatusBadges request={request} />
      <CollaborationDetails request={request} />
      <h2>Purpose and collaboration details</h2><p className={styles.description}>{request.description}</p>
      {request.decision && <section className={styles.decisionRecord}>
        <h2>Approval decision</h2><StatusBadge kind="approval" status={request.decision.outcome} />
        <p className={styles.description}>{request.decision.reason}</p>
        <p>Reviewed by {request.decision.reviewerName} ({request.decision.reviewerEmail}) · {new Date(request.decision.reviewedAt).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })} (Asia/Bangkok)</p>
      </section>}
      <p><Link href="/ta/queue">Open TA queue to view current status and available work actions</Link></p>
    </div>
  </section>;
}
