"use client";

import { PageHeading } from "@/components/workspace/PageHeading";
import { MOCK_MEMBER } from "@/features/requests/mock-data";
import { useRequests } from "@/features/requests/RequestsProvider";
import { RequestTable } from "@/features/requests/RequestTable";

/** US-2 owner: replace mock ownership with a server-authorized query. */
export function MyRequests() {
  const { requests } = useRequests();
  const mine = requests.filter((request) => request.requester.id === MOCK_MEMBER.id);
  return <>
    <PageHeading title="My requests" description="Every request, its owner, and what happens next." />
    <RequestTable title="My requests" requests={mine} />
  </>;
}
