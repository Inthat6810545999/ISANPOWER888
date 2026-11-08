import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaQueue } from "./TaQueue";
import type { WorkspaceRequest } from "../requests/types";
import { RequestTable } from "../requests/RequestTable";

const state = vi.hoisted(() => ({ requests: [] as WorkspaceRequest[], taAction: vi.fn() }));
vi.mock("../requests/RequestsProvider", () => ({ useRequests: () => ({ ...state, user: { email: "ta@example.test" }, loading: false, error: "", refresh: vi.fn(), refreshing: false }) }));
vi.mock("../requests/RequestsSync", () => ({ RequestsSync: () => null }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
const base: WorkspaceRequest = {
  id: "1", title: "Awaiting", description: "Request details", category: "space", priority: "low", location: "", neededBy: "",
  status: "pending", approvalStatus: "submitted", requiresApproval: true, assignee: null,
  requester: { id: "member", name: "Member", initials: "M" }, createdAt: "2026-11-01T00:00:00Z", source: "member", publicMessage: "", visit: null,
};
const row = (id: string, patch: Partial<WorkspaceRequest>): WorkspaceRequest => ({ ...base, id, ...patch });
const titles = () => within(screen.getByRole("table")).getAllByRole("row").slice(1).map(el => el.querySelector("td button")?.textContent);

beforeEach(() => {
  state.taAction.mockReset();
  state.requests = [base,
    row("2", { title: "Rejected", approvalStatus: "rejected" }),
    row("3", { title: "Ready", approvalStatus: "approved" }),
    row("4", { title: "Mine", status: "assigned", approvalStatus: "approved", assignee: { id: "ta@example.test", name: "TA", initials: "T" } }),
    row("5", { title: "Other TA", status: "in_progress", approvalStatus: "approved", assignee: { id: "other@example.test", name: "Other", initials: "O" } }),
    row("6", { title: "Finished", status: "closed" }), row("7", { title: "Cancelled", status: "cancelled" }),
  ];
});

describe("US-3 queue views", () => {
  it("starts with every active work state including unapproved/rejected work, excluding terminal work", () => {
    render(<TaQueue />);
    expect(screen.getByRole("button", { name: "Active requests 5" }).getAttribute("aria-pressed")).toBe("true");
    expect(titles()).toEqual(["Awaiting", "Rejected", "Ready", "Mine", "Other TA"]);
    expect(within(screen.getByRole("row", { name: /Awaiting/ })).getByRole("button", { name: "Assign to myself" })).toHaveProperty("disabled", true);
    expect(within(screen.getByRole("row", { name: /Rejected/ })).getByRole("button", { name: "Assign to myself" })).toHaveProperty("disabled", true);
    expect(within(screen.getByRole("row", { name: /Other TA/ })).queryByRole("button", { name: "Mark closed" })).toBeNull();
  });
  it("keeps ready, own work and closed history separate and retains all-record lookup", () => {
    render(<TaQueue />);
    for (const [tab, expected] of [["Ready to accept 1", ["Ready"]], ["Assigned to me 1", ["Mine"]], ["Closed history 1", ["Finished"]]] as const) {
      fireEvent.click(screen.getByRole("button", { name: tab })); expect(titles()).toEqual(expected);
    }
    expect(screen.queryByRole("button", { name: "Mark closed" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "All requests 7" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search requests" }), { target: { value: "Cancelled" } });
    expect(titles()).toEqual(["Cancelled"]);
  });
  it("removes completed work on refresh and opens closed history after successful close", async () => {
    state.requests = [row("4", { title: "Mine", status: "in_progress", approvalStatus: "approved", assignee: { id: "ta@example.test", name: "TA", initials: "T" } })];
    state.taAction.mockImplementation(async () => { state.requests = [{ ...state.requests[0], status: "closed" }]; });
    render(<TaQueue />);
    fireEvent.click(screen.getByRole("button", { name: "Mark closed" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Closed history 1" }).getAttribute("aria-pressed")).toBe("true"));
    expect(screen.getByRole("button", { name: "Active requests 0" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Active requests 0" }));
    expect(screen.getByText("No requests found")).toBeTruthy();
  });
});

describe("US-3 sorting and filtering", () => {
  const records = [
    row("a", { title: "Space low", category: "space", priority: "low", status: "in_progress" }),
    row("b", { title: "Equipment high", category: "equipment", priority: "high", status: "assigned" }),
    row("c", { title: "Access medium", category: "access", priority: "medium", status: "pending", approvalStatus: "rejected" }),
  ];
  it.each([
    ["category", ["Access medium", "Equipment high", "Space low"]],
    ["priority", ["Equipment high", "Access medium", "Space low"]],
    ["status", ["Access medium", "Equipment high", "Space low"]],
  ])("sorts by %s independently of approval", (sort, expected) => {
    render(<RequestTable title="Queue" requests={records} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Sort requests" }), { target: { value: sort } });
    expect(titles()).toEqual(expected);
    expect(records.map(r => r.id)).toEqual(["a", "b", "c"]);
  });
  it("sorts the complete result before pagination and resets the page when filters/sort change", () => {
    const requests = Array.from({ length: 8 }, (_, i) => row(String(i), { title: `Request ${i}`, priority: i === 7 ? "high" : "low" }));
    render(<RequestTable title="Queue" requests={requests} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Sort requests" }), { target: { value: "priority" } });
    expect(titles()[0]).toBe("Request 7");
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by priority" }), { target: { value: "high" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by category" }), { target: { value: "space" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by status" }), { target: { value: "pending" } });
    expect(titles()).toEqual(["Request 7"]);
    fireEvent.change(screen.getByRole("textbox", { name: "Search requests" }), { target: { value: "no match" } });
    expect(screen.getByText("No requests found")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(titles()).toHaveLength(6);
  });
});
