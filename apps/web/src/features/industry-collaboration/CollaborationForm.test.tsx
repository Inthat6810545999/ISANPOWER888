import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CollaborationForm } from "./CollaborationForm";
import { COLLABORATION_FIELDS, validateCollaboration } from "./validation";
import { MEMBER_CATEGORIES, CATEGORIES } from "@/features/requests/types";

const submitCollaboration = vi.hoisted(() => vi.fn());
vi.mock("@/features/requests/actions", () => ({ submitCollaboration }));
vi.mock("@/features/requests/RequestsProvider", () => ({ useRequests: () => ({ user: { name: "Verified TA", email: "ta@example.test" } }) }));
const input = { title: "Formal partnership", organization: "Industry Partner", contactName: "Partner Contact", contactEmail: "contact@example.test", phone: "", description: "Joint research objectives" };
const button = () => screen.getByRole("button", { name: "Submit collaboration request" });
function fill() {
  for (const [key, value] of Object.entries(input)) fireEvent.change(screen.getByLabelText(COLLABORATION_FIELDS[key as keyof typeof input].label, { exact: false }), { target: { value } });
}
beforeEach(() => submitCollaboration.mockReset());
it("validates lengths and required fields without offering the type to Members", () => {
  expect(validateCollaboration(input).errors).toEqual({});
  expect(MEMBER_CATEGORIES).not.toHaveProperty("industry_collaboration");
  expect(CATEGORIES.industry_collaboration).toBe("External Industry Collaboration");
  for (const [key, { max }] of Object.entries(COLLABORATION_FIELDS)) {
    expect(validateCollaboration({ ...input, [key]: "x".repeat(max + 1) }).errors).toHaveProperty(key);
    if (!["phone", "contactEmail"].includes(key)) expect(validateCollaboration({ ...input, [key]: "x".repeat(max) }).errors).toEqual({});
    if (key !== "phone") expect(validateCollaboration({ ...input, [key]: "  " }).errors).toHaveProperty(key);
  }
  expect(validateCollaboration({ ...input, contactEmail: "bad@address" }).errors.contactEmail).toBeTruthy();
  expect(validateCollaboration({ ...input, requiresApproval: false }).errors.form).toBeTruthy();
});
it("shows field errors and disables invalid submissions", () => {
  render(<CollaborationForm />); expect(button()).toHaveProperty("disabled", true);
  fireEvent.blur(screen.getByLabelText(/External contact email/));
  expect(screen.getByText("This field is required.")).toBeTruthy();
  fill(); expect(button()).toHaveProperty("disabled", false);
});
it("locks duplicate submits, retains draft on failure, and links only a confirmed created request", async () => {
  let finish!: (value: unknown) => void;
  submitCollaboration.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<CollaborationForm />); fill();
  const form = button().closest("form")!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(submitCollaboration).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Submitting…" })).toHaveProperty("disabled", true);
  expect(screen.queryByText("Open created request")).toBeNull();
  finish({ ok: false, error: "API unavailable" });
  await screen.findByRole("alert");
  expect(screen.getByLabelText(/Request title/)).toHaveProperty("value", input.title);
  expect(screen.getByLabelText(/External contact email/)).toHaveProperty("value", input.contactEmail);
  submitCollaboration.mockResolvedValueOnce({ ok: true, data: { id: "saved-id", trackingCode: "synthetic-code" } });
  fireEvent.click(button());
  await waitFor(() => expect(screen.getByRole("link", { name: "Open created request" }).getAttribute("href")).toBe("/ta/collaborations/saved-id"));
  expect(submitCollaboration).toHaveBeenLastCalledWith(input);
  expect(screen.getByLabelText("Tracking code")).toHaveProperty("value", "synthetic-code");
  expect(screen.getByLabelText("Tracking link")).toHaveProperty("value", `${window.location.origin}/collaboration/track#code=synthetic-code`);
});
it("copies code/link and provides a manual fallback without persisting the receipt", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  submitCollaboration.mockResolvedValue({ ok: true, data: { id: "saved", trackingCode: "synthetic-code" } });
  const view = render(<CollaborationForm />); fill(); fireEvent.click(button());
  fireEvent.click(await screen.findByRole("button", { name: "Copy tracking code" }));
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("synthetic-code"));
  fireEvent.click(screen.getByRole("button", { name: "Copy tracking link" }));
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}/collaboration/track#code=synthetic-code`));
  writeText.mockRejectedValueOnce(new Error("Denied"));
  fireEvent.click(screen.getByRole("button", { name: "Copy tracking code" }));
  await screen.findByText("Copy unavailable. Select the code or link and copy it manually.");
  view.unmount(); render(<CollaborationForm />);
  expect(screen.queryByLabelText("Tracking code")).toBeNull();
});
it("retains values on transport errors", async () => {
  submitCollaboration.mockRejectedValueOnce(new Error("Network"));
  render(<CollaborationForm />); fill(); fireEvent.click(button());
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Unable to submit. Your draft is kept. Check your connection and try again.");
  expect(screen.getByLabelText(/Company/)).toHaveProperty("value", input.organization);
});
