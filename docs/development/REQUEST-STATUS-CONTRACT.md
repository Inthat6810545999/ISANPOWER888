# Request status and permissions contract

Member, TA, and Manager read the same PostgreSQL records through the authenticated Express API. Next.js Server Actions check the role independently and forward a verified session token; client-supplied roles or actor emails never grant authority.

## Independent states

| Field | Values |
| --- | --- |
| `status` | `pending`, `assigned`, `in_progress`, `closed`, `cancelled` |
| `approvalStatus` | `not_required`, `submitted`, `under_review`, `approved`, `rejected`, `cancelled` |

Creation is Member-only. The API derives `requesterEmail` from the session, sets `status=pending`, `requiresApproval=true`, and `approvalStatus=submitted` for every request. It rejects client-supplied `requiresApproval`, initial status, role, or requester identity overrides.

| Action | Actor | Preconditions | Result |
| --- | --- | --- | --- |
| Claim | TA | Approved, pending, unassigned | Assigned to acting TA |
| Start | Assigned TA | Assigned; approval gate satisfied | In progress |
| Close | Assigned TA | In progress; approval gate satisfied | Closed |
| Approve/reject | Manager | Required approval; submitted/under_review; work not closed/cancelled; nonempty reason | Final approval status plus audit record |

All TA actions require `requiresApproval=true` and `approvalStatus=approved`. Pending review, rejection, cancelled approval, historical `not_required`, and inconsistent states fail closed. A TA can only claim for themselves and cannot take another TA's work. Start/close require current ownership and the next valid work state.

TA actions preserve approval and decision metadata. Manager decisions preserve work status and assignment. Final decisions are immutable; there is no reopen/review replacement endpoint. Existing work/approval `cancelled` states are readable, but cancellation is not a new UI action.

## API examples

All request endpoints require a Bearer session token obtained by password login. Next.js uses an HttpOnly cookie and forwards this token server-to-server.

Member `POST /api/requests`:

```json
{
  "title": "Calibrate oscilloscope",
  "description": "Prepare equipment for the next session.",
  "type": "equipment",
  "priority": "high",
  "location": "Lab B2",
  "neededBy": "2026-10-15"
}
```

TA `PATCH /api/requests/:id/ta-action` accepts one of:

```json
{ "action": "claim" }
```

```json
{ "action": "start" }
```

```json
{ "action": "close" }
```

The acting TA is derived from the session. The `assign` action and client-supplied assignee fields are rejected.

Manager `PATCH /api/requests/:id/approval-status`:

```json
{ "approvalStatus": "approved", "reason": "Budget and supervised access confirmed." }
```

Use `rejected` for rejection. Reason must contain 1–2000 characters after trimming. The server records reviewer ID/name/email and time in `approval_decisions` in the same transaction as the status update. A partial unique index permits only one current decision per request, and conditional updates prevent concurrent final decisions. Past reviewer snapshots remain meaningful if an account name changes later.

The compatibility `/status` endpoint accepts only TA `in_progress` or `closed` with identical ownership, transition, and approval checks. The old public API experiment is removed. This is a breaking API change for callers that previously sent requester/assignee emails or changed statuses without a session.

Members can list/read only their own requests. TA and Manager can list/read all. Manager-only `/api/requests/reports` returns aggregates by work status, approval status, and category with optional inclusive UTC creation dates `from`/`to`.

## Migrations and existing data

- `20260912000000_separate_request_status`: preserved all five legacy approval values in `approvalStatus`; initialized work to pending (cancelled remains cancelled), approval required, medium priority, empty location.
- `20260912010000_request_assignment`: added nullable assignee email and index.
- `20260912020000_sessions_and_manager`: adds users, opaque hashed sessions, and approval decision records. It does not delete or rewrite old requests.

- `20260920000000_approval_first_workflow`: changes defaults, returns all open requests to pending/submitted, clears assignees and marks their old decisions as superseded. Closed/cancelled requests and their decisions are unchanged. Existing open requests, even previously approved or rejected, need a fresh review and self-claim. No reviewer or reason is fabricated.

Responses retain `decision` for the current review and add `decisionHistory` for superseded reviews. Archived records keep their original outcome, reason, reviewer and time. Reopening is available only through this one-time migration, not an API action.

Stop the API, run `npx prisma generate` and `npx prisma migrate deploy` from `apps/api`, then restart. Do not reset an existing database. Seed local accounts once; see [local setup](LOCAL-DEMO.md).

## Verification

`npm --prefix apps/web run test:contracts` compares frontend/API/Prisma enum values. API tests require a dedicated database ending in `_test` and cover role boundaries, actor spoofing, password/session checks, ownership, approval gates, immutable audit data, assignment, reports, and concurrency. See the root README for lint, typecheck, build, and test commands.
