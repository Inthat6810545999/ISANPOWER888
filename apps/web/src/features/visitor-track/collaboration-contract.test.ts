import { expect, it } from "vitest";
import { readPublicCollaboration, readPublicVisit } from "./contract";
it("accepts collaboration without a schedule and discards all non-public fields", () => {
  const data = { kind: "industry_collaboration", status: "closed", approvalStatus: "approved" };
  expect(readPublicCollaboration({ data: { ...data, contactName: "PRIVATE", publicMessage: "PRIVATE", visitDate: "fake", decision: {} } })).toEqual(data);
  expect(readPublicVisit({ data })).toBeNull();
});
it("rejects incorrect kind, state and malformed responses without weakening Visitor validation", () => {
  for (const data of [null, {}, { kind: "visitor", status: "pending", approvalStatus: "submitted" }, { kind: "industry_collaboration", status: "unknown", approvalStatus: "approved" }]) expect(readPublicCollaboration({ data })).toBeNull();
  const visit = { status: "pending", approvalStatus: "submitted", visitDate: "2099-01-01", timeSlot: "morning", publicMessage: "" };
  expect(readPublicVisit({ data: visit })).toEqual(visit);
  expect(readPublicCollaboration({ data: visit })).toBeNull();
});
