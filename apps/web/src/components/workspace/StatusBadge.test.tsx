import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { APPROVAL_STATUSES, REQUEST_STATUSES } from "@/lib/request-status";
import { StatusBadge, statusLabel, statusTone } from "./StatusBadge";

const EXPECTED_TONES: Record<string, string> = {
  // Work status
  pending: "pending", assigned: "neutral", in_progress: "neutral", closed: "danger", cancelled: "neutral",
  // Approval status
  not_required: "neutral", submitted: "neutral", under_review: "neutral", approved: "success", rejected: "danger",
};

describe("statusTone", () => {
  it("covers every status the API can send", () => {
    for (const status of [...REQUEST_STATUSES, ...APPROVAL_STATUSES]) {
      expect(statusTone(status), status).toBe(EXPECTED_TONES[status]);
    }
  });

  it("uses the agreed colours: pending amber, approved green, rejected and closed red", () => {
    expect(statusTone("pending")).toBe("pending");
    expect(statusTone("approved")).toBe("success");
    expect(statusTone("rejected")).toBe("danger");
    expect(statusTone("closed")).toBe("danger");
  });

  it("falls back to grey for unknown statuses", () => {
    for (const status of ["on_hold", "", "PENDING", "constructor", "toString"]) {
      expect(statusTone(status), JSON.stringify(status)).toBe("neutral");
    }
  });
});

describe("StatusBadge", () => {
  it("renders each known status with its label and tone", () => {
    render(<>
      {REQUEST_STATUSES.map((status) => <StatusBadge key={`w-${status}`} status={status} />)}
      {APPROVAL_STATUSES.map((status) => <StatusBadge key={`a-${status}`} kind="approval" status={status} />)}
    </>);
    expect(screen.getByText("Pending")).toHaveProperty("dataset.tone", "pending");
    expect(screen.getByText("Closed")).toHaveProperty("dataset.tone", "danger");
    expect(screen.getByText("In progress")).toHaveProperty("dataset.tone", "neutral");
    expect(screen.getByText("Approved")).toHaveProperty("dataset.tone", "success");
    expect(screen.getByText("Rejected")).toHaveProperty("dataset.tone", "danger");
    expect(screen.getByText("Awaiting approval")).toHaveProperty("dataset.tone", "neutral");
  });

  it("renders an unknown status in grey with a readable label instead of crashing", () => {
    render(<StatusBadge status="on_hold" />);
    const badge = screen.getByText("On hold");
    expect(badge.dataset.tone).toBe("neutral");
    expect(badge.dataset.status).toBe("on_hold");
  });

  it("supports a prefix and a custom label", () => {
    render(<>
      <StatusBadge status="pending" prefix="Work" />
      <StatusBadge kind="approval" status="under_review" label="Awaiting review" />
    </>);
    expect(screen.getByText("Work: Pending").dataset.tone).toBe("pending");
    expect(screen.getByText("Awaiting review").dataset.tone).toBe("neutral");
  });

  it("labels empty statuses as Unknown", () => {
    expect(statusLabel("")).toBe("Unknown");
    expect(statusLabel("cancelled", "approval")).toBe("Approval cancelled");
  });
});
