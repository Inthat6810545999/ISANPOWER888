import { describe, expect, it } from "vitest";
import type { ApprovalStatus, RequestStatus } from "@prisma/client";
import { prisma } from "../db/connect.js";
import { findPublicVisit, hashTrackingCode } from "./contract.js";

// Synthetic fixture only. Production lookup must use findPublicVisit unchanged.
const code = "Ab".repeat(21) + "A";
const publicKeys = ["approvalStatus", "publicMessage", "status", "timeSlot", "visitDate"];

async function persistVisit(
  status: RequestStatus = "pending",
  approvalStatus: ApprovalStatus = "submitted",
  publicMessage = "",
) {
  return prisma.labRequest.create({
    data: {
      title: "INTERNAL_TITLE", description: "INTERNAL_DESCRIPTION",
      type: "visitor", source: "visitor", requesterEmail: "",
      status, approvalStatus, publicMessage, requiresApproval: true,
      visit: { create: {
        contactName: "PRIVATE_CONTACT", email: "private@example.test",
        phone: "PRIVATE_PHONE", organization: "PRIVATE_ORGANIZATION",
        purpose: "tour", details: "PRIVATE_DETAILS", visitorCount: 2,
        requestedHost: "PRIVATE_HOST", arrangements: "PRIVATE_ARRANGEMENTS",
        visitDate: "2099-12-01", timeSlot: "afternoon",
      } },
      tracking: { create: { codeHash: hashTrackingCode(code) } },
      decisions: { create: {
        outcome: "under_review", reason: "PRIVATE_DECISION_REASON",
        reviewerName: "PRIVATE_REVIEWER", reviewerEmail: "reviewer@example.test",
        reviewer: { create: {
          name: "PRIVATE_REVIEWER", email: "reviewer@example.test",
          role: "lab_manager", membershipStatus: "APPROVED",
        } },
      } },
    },
    select: { id: true },
  });
}

// Real database tests, governed by src/test/setup.ts's dedicated _test guard.
// These do not define the still-unagreed HTTP route contract.
describe("owner 3 public lookup helper contract", () => {
  it("returns the exact public allowlist from persisted data without private fields", async () => {
    const saved = await persistVisit("pending", "submitted", "Please wait for review.");
    const found = await findPublicVisit(code);
    expect(found).toEqual({
      status: "pending", approvalStatus: "submitted", publicMessage: "Please wait for review.",
      visitDate: "2099-12-01", timeSlot: "afternoon",
    });
    expect(Object.keys(found!).sort()).toEqual(publicKeys);
    const serialized = JSON.stringify(found);
    for (const secret of [saved.id, code, hashTrackingCode(code), "PRIVATE_", "INTERNAL_", "@example.test"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("preserves code case and does not trim or normalize at the helper boundary", async () => {
    await persistVisit();
    expect(await findPublicVisit(code)).not.toBeNull();
    expect(await findPublicVisit(code.toLowerCase())).toBeNull();
    expect(await findPublicVisit(code.toUpperCase())).toBeNull();
    expect(await findPublicVisit(` ${code}`)).toBeNull();
    expect(await findPublicVisit(`${code} `)).toBeNull();
    expect(await findPublicVisit(`${code}\n`)).toBeNull();
  });

  it("returns null for both malformed values and a valid-format unknown code", async () => {
    await persistVisit();
    const unknownResult = await findPublicVisit("Z".repeat(43));
    expect(unknownResult).toBeNull();
    for (const malformed of [undefined, null, 123, {}, [], "", "short", "A".repeat(42), "A".repeat(44), "+".repeat(43), "/".repeat(43), "=".repeat(43)]) {
      expect(await findPublicVisit(malformed)).toBe(unknownResult);
    }
  });

  it("keeps closed requests discoverable", async () => {
    await persistVisit("closed", "approved", "Your request is closed.");
    expect(await findPublicVisit(code)).toEqual({
      status: "closed", approvalStatus: "approved", publicMessage: "Your request is closed.",
      visitDate: "2099-12-01", timeSlot: "afternoon",
    });
  });

  it("keeps rejection discoverable when work is pending without publishing internal reason", async () => {
    await persistVisit("pending", "rejected");
    expect(await findPublicVisit(code)).toEqual({
      status: "pending", approvalStatus: "rejected", publicMessage: "",
      visitDate: "2099-12-01", timeSlot: "afternoon",
    });
  });

  it("returns public message text unchanged for the UI to render as plain text", async () => {
    const message = '<img src=x onerror="alert(1)"> & <strong>Notice</strong>';
    await persistVisit("pending", "under_review", message);
    expect((await findPublicVisit(code))?.publicMessage).toBe(message);
  });
});
