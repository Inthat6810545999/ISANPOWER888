import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemberManagement } from "./MemberReview";
import type { ManagedMember } from "./types";
const mocks = vi.hoisted(() => ({ approve: vi.fn(), update: vi.fn(), history: vi.fn() }));
vi.mock("./actions", () => ({ approveMember: mocks.approve, updateMember: mocks.update, memberHistory: mocks.history }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const manager: ManagedMember = { id: "manager", name: "Manager", email: "manager@example.test", role: "lab_manager", membershipStatus: "APPROVED", active: true, membershipVersion: 0 };
const pending: ManagedMember = { ...manager, id: "pending", name: "Applicant", email: "applicant@example.test", role: "unassigned", membershipStatus: "PENDING" };
const member: ManagedMember = { ...manager, id: "member", name: "Member", email: "member@example.test", role: "member" };
beforeEach(() => { vi.clearAllMocks(); mocks.update.mockResolvedValue({ error: "", success: "Member updated." }); });
describe("member management", () => {
  it("filters names/emails, roles and account states together and clears to all accounts", () => {
    render(<MemberManagement users={[manager, pending, member, { ...member, id: "inactive", name: "Inactive", active: false }]} actorId="manager" />);
    fireEvent.change(screen.getByLabelText("Filter by account status"), { target: { value: "pending" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Approve & assign role" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search members"), { target: { value: "no match" } });
    expect(screen.getByText("No members found")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    fireEvent.change(screen.getByLabelText("Filter by role"), { target: { value: "member" } });
    fireEvent.change(screen.getByLabelText("Filter by account status"), { target: { value: "inactive" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Reactivate account" })).toBeTruthy();
  });
  it("disables changes to the last manager independently of filters", () => {
    render(<MemberManagement users={[manager, pending]} actorId="manager" />);
    const card = within(screen.getByRole("article", { name: "Manager (manager@example.test)" }));
    expect(card.getByRole("button", { name: "Deactivate account" })).toHaveProperty("disabled", true);
    expect(card.getByRole("button", { name: "Save role" })).toHaveProperty("disabled", true);
    expect(card.getByText(/last active Lab Manager/)).toBeTruthy();
  });
  it("requires a second click to deactivate and carries the current version to the server", async () => {
    render(<MemberManagement users={[manager, { ...member, membershipVersion: 4 }]} actorId="manager" />);
    const card = within(screen.getByRole("article", { name: "Member (member@example.test)" }));
    fireEvent.click(card.getByRole("button", { name: "Deactivate account" }));
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.click(card.getByRole("button", { name: "Cancel" }));
    expect(card.queryByRole("button", { name: "Confirm deactivation" })).toBeNull();
    fireEvent.click(card.getByRole("button", { name: "Deactivate account" }));
    fireEvent.click(card.getByRole("button", { name: "Confirm deactivation" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
    const data = mocks.update.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(data)).toEqual({ id: "member", version: "4", action: "active", active: "false" });
  });
  it("shows API errors and allows retry without claiming success", async () => {
    mocks.update.mockResolvedValue({ error: "This member changed. Refresh the list before trying again." });
    render(<MemberManagement users={[manager, member]} actorId="manager" />);
    const card = within(screen.getByRole("article", { name: "Member (member@example.test)" }));
    fireEvent.change(card.getByLabelText("Lab role"), { target: { value: "ta" } });
    fireEvent.click(card.getByRole("button", { name: "Save role" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "This member changed. Refresh the list before trying again.");
    expect(screen.queryByText("Member updated.")).toBeNull();
    expect(card.getByRole("button", { name: "Save role" })).toHaveProperty("disabled", false);
  });
  it("loads history lazily, reports failure and retries an empty legacy history", async () => {
    mocks.history.mockResolvedValueOnce({ error: "History unavailable" }).mockResolvedValueOnce({ history: { data: [], nextCursor: null } });
    render(<MemberManagement users={[manager]} actorId="manager" />);
    expect(mocks.history).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Management history"));
    fireEvent.click(screen.getByRole("button", { name: "Load history" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "History unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Load history" }));
    expect(await screen.findByText(/No recorded changes/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("resets pagination when search changes", () => {
    const users = Array.from({ length: 12 }, (_, i) => ({ ...member, id: String(i), name: `Person ${i}`, email: `person${i}@example.test` }));
    render(<MemberManagement users={users} actorId="manager" />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Search members"), { target: { value: "person0@" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });
});
