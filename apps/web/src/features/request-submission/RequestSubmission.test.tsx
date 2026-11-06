import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bangkokDate } from "@/features/visitor-request/validation";
import { RequestSubmission } from "./RequestSubmission";
import { validateRequestForm } from "./validation";

// addRequest is the only path to the API; it is mocked so no request is sent.
const addRequest = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("@/features/requests/RequestsProvider", () => ({ useRequests: () => ({ addRequest }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

function shiftDate(days: number) {
  const date = new Date(`${bangkokDate()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const title = () => screen.getByRole("textbox", { name: "Request title *" });
const description = () => screen.getByRole("textbox", { name: "What do you need? *" });
const neededBy = () => screen.getByLabelText(/Needed by/);
const submit = () => screen.getByRole("button", { name: /Submit request/ });

describe("request form validation", () => {
  beforeEach(() => { addRequest.mockReset(); push.mockReset(); });

  it("starts with submit disabled and no error messages", () => {
    render(<RequestSubmission />);
    expect(submit()).toHaveProperty("disabled", true);
    expect(screen.queryByText("Enter a request title.")).toBeNull();
  });

  it("shows an error under each required field left empty and keeps submit disabled", () => {
    render(<RequestSubmission />);
    fireEvent.blur(title());
    fireEvent.blur(description());
    expect(screen.getByText("Enter a request title.")).toBeTruthy();
    expect(screen.getByText("Describe what you need.")).toBeTruthy();
    expect(title().getAttribute("aria-invalid")).toBe("true");
    expect(title().getAttribute("aria-describedby")).toBe(screen.getByText("Enter a request title.").id);
    expect(submit()).toHaveProperty("disabled", true);
  });

  it("treats whitespace-only text as empty", () => {
    render(<RequestSubmission />);
    fireEvent.change(title(), { target: { value: "   " } });
    fireEvent.change(description(), { target: { value: "\n  " } });
    expect(screen.getByText("Enter a request title.")).toBeTruthy();
    expect(screen.getByText("Describe what you need.")).toBeTruthy();
    expect(submit()).toHaveProperty("disabled", true);
  });

  it("rejects a needed-by date in the past and accepts today", () => {
    render(<RequestSubmission />);
    fireEvent.change(title(), { target: { value: "Prepare the sensor bench" } });
    fireEvent.change(description(), { target: { value: "Two benches for Thursday." } });
    fireEvent.change(neededBy(), { target: { value: shiftDate(-1) } });
    expect(screen.getByText("Choose today or a future date (Thailand time).")).toBeTruthy();
    expect(submit()).toHaveProperty("disabled", true);

    fireEvent.change(neededBy(), { target: { value: shiftDate(0) } });
    expect(screen.queryByText("Choose today or a future date (Thailand time).")).toBeNull();
    expect(submit()).toHaveProperty("disabled", false);
  });

  it("does not call the API when the form is submitted while invalid", () => {
    render(<RequestSubmission />);
    fireEvent.submit(submit().closest("form")!);
    expect(addRequest).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a request title.")).toBeTruthy();
  });

  it("submits trimmed values once the form is valid", async () => {
    addRequest.mockResolvedValueOnce(undefined);
    render(<RequestSubmission />);
    fireEvent.change(title(), { target: { value: "  Prepare the sensor bench " } });
    fireEvent.change(description(), { target: { value: " Two benches for Thursday. " } });
    fireEvent.change(neededBy(), { target: { value: shiftDate(3) } });
    expect(submit()).toHaveProperty("disabled", false);

    fireEvent.click(submit());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/workspace/my-requests"));
    expect(addRequest).toHaveBeenCalledTimes(1);
    expect(addRequest).toHaveBeenCalledWith({
      title: "Prepare the sensor bench", category: "equipment", priority: "medium",
      description: "Two benches for Thursday.", location: "", neededBy: shiftDate(3),
    });
  });
});

describe("validateRequestForm", () => {
  const valid = { title: "Bench", category: "equipment", priority: "medium", description: "Need it", location: "", neededBy: "" };

  it("accepts a complete form with no due date", () => {
    expect(validateRequestForm(valid, "2026-11-06")).toEqual({});
  });

  it("rejects invalid categories, priorities, impossible dates and overlong text", () => {
    expect(validateRequestForm({ ...valid, category: "toString", priority: "urgent", neededBy: "2026-02-30", location: "x".repeat(201) }, "2026-11-06")).toEqual({
      category: "Choose a category.", priority: "Choose a priority.", neededBy: "Choose a valid date.", location: "Use 200 characters or fewer.",
    });
    expect(validateRequestForm({ ...valid, title: "x".repeat(201) }, "2026-11-06").title).toBe("Use 200 characters or fewer.");
  });

  it("compares dates against today in Thailand time", () => {
    expect(validateRequestForm({ ...valid, neededBy: "2026-11-05" }, "2026-11-06").neededBy).toBeTruthy();
    expect(validateRequestForm({ ...valid, neededBy: "2026-11-06" }, "2026-11-06").neededBy).toBeUndefined();
  });
});
