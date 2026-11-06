import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MyRequests } from "@/features/my-requests/MyRequests";
import type { WorkspaceRequest } from "./types";
import { RequestsProvider } from "./RequestsProvider";

type ListResult = { ok: true; data: WorkspaceRequest[] } | { ok: false; error: string };

// The real actions are Server Actions that call the API; every call is mocked here.
const loadRequests = vi.hoisted(() => vi.fn<(scope: string) => Promise<ListResult>>());
vi.mock("./actions", () => ({
  loadRequests,
  submitRequest: vi.fn(), changeTaRequest: vi.fn(), reviewRequest: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/workspace/my-requests" }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const request: WorkspaceRequest = {
  id: "REQ-1", title: "Calibrate the oscilloscope", description: "Bench 3", category: "equipment",
  priority: "medium", location: "Lab B2", neededBy: "", requiresApproval: true, status: "pending",
  approvalStatus: "submitted", requester: { id: "member@example.test", name: "Test Member", initials: "TM" },
  assignee: null, createdAt: "2026-11-01T09:00:00Z", source: "member", publicMessage: "", visit: null,
};
const user = { id: "u1", name: "Test Member", email: "member@example.test", role: "member" as const, membershipStatus: "APPROVED" as const };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function renderLoaded() {
  render(<RequestsProvider user={user}><MyRequests /></RequestsProvider>);
  await screen.findByText("Calibrate the oscilloscope");
  return screen.getByRole("button", { name: /Refresh requests/ });
}

describe("manual refresh", () => {
  beforeEach(() => {
    loadRequests.mockReset();
    loadRequests.mockResolvedValueOnce({ ok: true, data: [request] });
  });

  it("disables the button and shows a spinner while loading", async () => {
    const button = await renderLoaded();
    const pending = deferred<ListResult>();
    loadRequests.mockReturnValueOnce(pending.promise);

    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveProperty("disabled", true));
    expect(button.textContent).toContain("Refreshing…");
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByTestId("refresh-spinner")).toBeTruthy();

    // A second click while loading must not start another request.
    fireEvent.click(button);
    expect(loadRequests).toHaveBeenCalledTimes(2);

    await act(async () => pending.resolve({ ok: true, data: [request] }));
    await waitFor(() => expect(button).toHaveProperty("disabled", false));
    expect(screen.queryByTestId("refresh-spinner")).toBeNull();
    expect(button.textContent).toBe("Refresh requests");
  });

  it("shows the empty state when the refreshed list is empty", async () => {
    const button = await renderLoaded();
    loadRequests.mockResolvedValueOnce({ ok: true, data: [] });

    fireEvent.click(button);
    expect(await screen.findByRole("heading", { name: "No requests yet" })).toBeTruthy();
    expect(screen.queryByText("Calibrate the oscilloscope")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows an error with a retry button when the refresh fails, and retry recovers", async () => {
    const button = await renderLoaded();
    loadRequests.mockResolvedValueOnce({ ok: false, error: "The lab workspace is unavailable." });

    fireEvent.click(button);
    expect(await screen.findByRole("heading", { name: "We could not load your requests" })).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Try again" });

    loadRequests.mockResolvedValueOnce({ ok: true, data: [request] });
    fireEvent.click(retry);
    expect(await screen.findByText("Calibrate the oscilloscope")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("keeps the last list and offers retry when the connection drops", async () => {
    const button = await renderLoaded();
    loadRequests.mockRejectedValueOnce(new Error("network down"));

    fireEvent.click(button);
    expect(await screen.findByText(/Showing the last list we loaded/)).toBeTruthy();
    expect(screen.getByText("Calibrate the oscilloscope")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("keeps the spinner until a poll that was already running finishes", async () => {
    render(<RequestsProvider user={user}><MyRequests /></RequestsProvider>);
    await screen.findByText("Calibrate the oscilloscope");
    const pollInFlight = deferred<ListResult>();
    loadRequests.mockReturnValueOnce(pollInFlight.promise);
    act(() => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(loadRequests).toHaveBeenCalledTimes(2));

    const button = screen.getByRole("button", { name: /Refresh requests/ });
    fireEvent.click(button);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(button).toHaveProperty("disabled", true);
    expect(screen.getByTestId("refresh-spinner")).toBeTruthy();
    expect(loadRequests).toHaveBeenCalledTimes(2);

    await act(async () => pollInFlight.resolve({ ok: true, data: [request] }));
    await waitFor(() => expect(button).toHaveProperty("disabled", false));
  });
});
