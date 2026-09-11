import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as web from "../src/lib/request-status.ts";
import * as api from "../../api/src/models/LabRequest.ts";

const schema = readFileSync(new URL("../../api/prisma/schema.prisma", import.meta.url), "utf8");
function prismaValues(name) {
  const block = schema.match(new RegExp(`enum ${name} \\{([^}]+)\\}`));
  assert.ok(block, `Prisma enum ${name} must exist`);
  return block[1].trim().split(/\s+/);
}

test("work-status values and labels match the API and PostgreSQL schema", () => {
  assert.deepEqual(web.REQUEST_STATUSES, api.REQUEST_STATUSES);
  assert.deepEqual(web.REQUEST_STATUSES, prismaValues("RequestStatus"));
  assert.deepEqual(Object.keys(web.STATUS_LABELS), web.REQUEST_STATUSES);
  assert.ok(!web.REQUEST_STATUSES.includes("approved"));
});

test("approval-status values and labels match the API and PostgreSQL schema", () => {
  assert.deepEqual(web.APPROVAL_STATUSES, api.APPROVAL_STATUSES);
  assert.deepEqual(web.APPROVAL_STATUSES, prismaValues("ApprovalStatus"));
  assert.deepEqual(Object.keys(web.APPROVAL_LABELS), web.APPROVAL_STATUSES);
  assert.ok(!web.APPROVAL_STATUSES.includes("closed"));
});

test("new demo requests initialize approval exactly like the API", () => {
  assert.equal(web.initialApprovalStatus(false), "not_required");
  assert.equal(web.initialApprovalStatus(true), "submitted");
});

test("closed and cancelled work is excluded from active TA actions", () => {
  assert.equal(web.isActiveStatus("closed"), false);
  assert.equal(web.isActiveStatus("cancelled"), false);
  assert.equal(web.isActiveStatus("pending"), true);
  assert.equal(web.isActiveStatus("assigned"), true);
  assert.equal(web.isActiveStatus("in_progress"), true);
});
