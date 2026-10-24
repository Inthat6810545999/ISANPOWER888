import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { WORK_LABELS, REVIEW_LABELS, SLOT_LABELS, readPublicVisit, requestedDate, scheduleNote } from "../src/features/visitor-track/contract.ts";

test("Visitor labels cover exactly the real Prisma enums", () => {
  const schema = readFileSync(new URL("../../api/prisma/schema.prisma", import.meta.url), "utf8");
  for (const [name, labels] of [["RequestStatus", WORK_LABELS], ["ApprovalStatus", REVIEW_LABELS]]) {
    assert.deepEqual(Object.keys(labels), schema.match(new RegExp(`enum ${name} \\{([^}]+)\\}`))[1].trim().split(/\s+/));
  }
});
const data = { status: "pending", approvalStatus: "rejected", publicMessage: "", visitDate: "2099-12-01", timeSlot: "morning" };
test("public data reader preserves rejection independent of pending work and drops extra fields", () => {
  assert.deepEqual(readPublicVisit({ data: { ...data, reason: "private", requestId: "private" } }), data);
  assert.equal(REVIEW_LABELS.rejected, "Request declined");
});
test("requested dates and slots keep Bangkok calendar semantics", () => {
  assert.equal(requestedDate("2099-12-01"), "1 December 2099");
  assert.deepEqual(SLOT_LABELS, { morning: "09:00–12:00", afternoon: "13:00–16:00" });
});
test("missing messages are optional and markup stays text", () => {
  for (const publicMessage of [undefined, null, "", "<script>alert(1)</script>"]) {
    assert.equal(readPublicVisit({ data: { ...data, publicMessage } }).publicMessage, publicMessage ?? null);
  }
});
test("invalid public dates, slots and enum values fail closed", () => {
  for (const patch of [{ status: "approved" }, { approvalStatus: "closed" }, { timeSlot: "evening" }, { visitDate: "2099-02-30" }, { publicMessage: {} }]) {
    assert.equal(readPublicVisit({ data: { ...data, ...patch } }), null);
  }
});

test("the schedule note never promises a booking and never reads as a refusal", () => {
  const approved = scheduleNote("approved");
  // Approved must not imply a reserved slot: no confirmed time is ever stored.
  assert.equal(/not a confirmed appointment/.test(approved), false);
  assert.match(approved, /confirm the exact time/);

  // Every other state keeps the plain preference wording.
  for (const status of ["submitted", "under_review", "rejected", "cancelled", "not_required"]) {
    assert.equal(scheduleNote(status), "This is the date and time you requested. It is not a confirmed appointment.");
  }
});
