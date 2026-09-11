"use client";

import { PageHeading } from "@/components/workspace/PageHeading";
import { RequestsSync } from "@/features/requests/RequestsSync";
import { useRequests } from "@/features/requests/RequestsProvider";
import { RequestTable } from "@/features/requests/RequestTable";

export function MyRequests() {
  const { requests, loading, error } = useRequests();
  return <>
    <PageHeading title="My requests" description="Every request, its owner, and what happens next." />
    <RequestsSync />
    {!loading && (!error || requests.length > 0) && <RequestTable title="My requests" requests={requests} />}
  </>;
}
