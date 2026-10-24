"use client";

import { PageHeading } from "@/components/workspace/PageHeading";
import { RequestsSync } from "@/features/requests/RequestsSync";
import { useRequests } from "@/features/requests/RequestsProvider";
import { RequestTable } from "@/features/requests/RequestTable";
import { RequestsState } from "@/features/requests/RequestsState";

export function MyRequests() {
  const { requests, loading, error, refresh, refreshing } = useRequests();
  return <>
    <PageHeading title="My requests" description="Every request, its owner, and what happens next." />
    <RequestsSync />
    <RequestsState loading={loading} error={error} hasData={requests.length > 0} onRetry={() => void refresh()} retrying={refreshing} />
    {(requests.length > 0 || (!loading && !error)) && <RequestTable title="My requests" requests={requests} />}
  </>;
}
