import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequestTimeline } from "./RequestTimeline";
import type { WorkspaceRequest } from "./types";

const request: WorkspaceRequest = {
  id: "request-1", title: "Calibrate sensor", category: "equipment", description: "Calibration", location: "", neededBy: "", priority: "medium",
  status: "closed", approvalStatus: "approved", requiresApproval: true, requester: { id: "member", name: "Member", initials: "M" }, assignee: null,
  createdAt: "2026-11-07T02:00:00.000Z", source: "member", publicMessage: "", visit: null,
};
const event = { id: 1, action: "created" as const, fromStatus: null, toStatus: "pending" as const, actorId: "member", actorName: "Original member",
  actorEmail: "member@example.test", actorRole: "member", occurredAt: "2026-11-07T02:00:00.000Z" };

describe("request history", () => {
  it("orders tied approval/claim timestamps correctly and shows snapshots with Bangkok times", () => {
    render(<RequestTimeline request={{ ...request, history: [event, { ...event, id: 2, action: "claimed", fromStatus: "pending", toStatus: "assigned", actorRole: "ta", occurredAt: "2026-11-07T03:00:00.000Z" }],
      decision: { outcome: "approved", reviewerName: "Manager", reviewerEmail: "manager@example.test", reason: "Safety reviewed", reviewedAt: "2026-11-07T03:00:00.000Z" } }} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map(item => item.querySelector("strong")?.textContent)).toEqual(["Request submitted", "Request approved", "Work assigned"]);
    expect(within(items[0]).getByText(/09:00:00/)).toBeTruthy();
    expect(screen.getAllByText(/Original member/)).toHaveLength(2);
    expect(screen.getByText("Reason: Safety reviewed")).toBeTruthy();
    expect(screen.queryByText(/Earlier work history/)).toBeNull();
  });
  it("marks legacy gaps and superseded decisions without inventing submission events", () => {
    render(<RequestTimeline request={{ ...request, history: [], decisionHistory: [{ id: "old", outcome: "rejected", reason: "Old <script>text</script>",
      reviewerName: "Old reviewer", reviewerEmail: "old@example.test", reviewedAt: "2026-10-01T00:00:00Z", supersededAt: "2026-10-02T00:00:00Z" }] }} />);
    expect(screen.getByText(/Earlier work history/)).toBeTruthy();
    expect(screen.getByText(/Superseded decision/)).toBeTruthy();
    expect(screen.getByText("Reason: Old <script>text</script>")).toBeTruthy();
    expect(screen.queryByText("Request submitted")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });
  it("explains an empty legacy timeline and labels visitor identity as self-reported", () => {
    const { rerender } = render(<RequestTimeline request={request} />);
    expect(screen.getByText("No recorded events are available for this request.")).toBeTruthy();
    rerender(<RequestTimeline request={{ ...request, history: [{ ...event, actorRole: "visitor", actorId: null }] }} />);
    expect(screen.getByText(/Visitor \(self-reported contact\)/)).toBeTruthy();
  });
});
