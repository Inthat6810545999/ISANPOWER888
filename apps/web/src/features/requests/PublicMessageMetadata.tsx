import type { WorkspaceRequest } from "./types";

export function PublicMessageMetadata({ request }: { request: Pick<WorkspaceRequest,
  "publicMessageUpdatedByName" | "publicMessageUpdatedByEmail" | "publicMessageUpdatedAt"> }) {
  return <div>
    <p>Last edited by: {request.publicMessageUpdatedByName || request.publicMessageUpdatedByEmail || "Not recorded"}</p>
    <p>Last edited at: {request.publicMessageUpdatedAt
      ? new Date(request.publicMessageUpdatedAt).toLocaleString("en-GB", { timeZone: "Asia/Bangkok" }) + " (Asia/Bangkok)"
      : "Not recorded"}</p>
  </div>;
}
