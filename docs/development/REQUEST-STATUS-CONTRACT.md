# Request status and permissions contract

Member, TA, and Manager read the same PostgreSQL records through the authenticated Express API. Next.js Server Actions check the role independently and forward a verified session token; client-supplied roles or actor emails never grant authority.

## Independent states

| Field | Values |
| --- | --- |
| `status` | `pending`, `assigned`, `in_progress`, `closed`, `cancelled` |
| `approvalStatus` | `not_required`, `submitted`, `under_review`, `approved`, `rejected`, `cancelled` |

Creation is Member-only. The API derives `requesterEmail` from the session, sets `status=pending`, and chooses `submitted` if `requiresApproval=true`, otherwise `not_required`. It rejects initial status, role, or requester identity overrides.

| Action | Actor | Preconditions | Result |
| --- | --- | --- | --- |
| Claim | TA | Pending, unassigned | Assigned to acting TA |
| Assign/reassign | TA | Pending/assigned; latest `updatedAt`; active target TA | Assigned to target TA |
| Start | Assigned TA | Assigned; approval gate satisfied | In progress |
| Close | Assigned TA | In progress; approval gate satisfied | Closed |
| Approve/reject | Manager | Required approval; submitted/under_review; work not closed/cancelled; nonempty reason | Final approval status plus audit record |

The approval gate is `(requiresApproval && approvalStatus === approved) || (!requiresApproval && approvalStatus === not_required)`. Pending review, rejection, cancelled approval, and inconsistent states fail closed. TA may claim/assign before review, including rejected records, but cannot start or successfully close rejected work. Assignment is not allowed after work starts.

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
  "neededBy": "2026-10-15",
  "requiresApproval": true
}
```

TA `PATCH /api/requests/:id/ta-action` accepts one of:

```json
{ "action": "claim" }
```

```json
{ "action": "assign", "assigneeId": "ACTIVE_TA_UUID", "expectedUpdatedAt": "2026-09-12T10:00:00.000Z" }
```

```json
{ "action": "start" }
```

```json
{ "action": "close" }
```

Choose the assignment ID from `GET /api/auth/assignees` (TA-only) and use the latest record timestamp. No `assigneeEmail` actor field is accepted.

Manager `PATCH /api/requests/:id/approval-status`:

```json
{ "approvalStatus": "approved", "reason": "Budget and supervised access confirmed." }
```

Use `rejected` for rejection. Reason must contain 1–2000 characters after trimming. The server records reviewer ID/name/email and time in `approval_decisions` in the same transaction as the status update. The unique request ID and conditional update prevent concurrent final decisions. Past reviewer snapshots remain meaningful if an account name changes later.

The compatibility `/status` endpoint accepts only TA `in_progress` or `closed` with identical ownership, transition, and approval checks. The old public API experiment is removed. This is a breaking API change for callers that previously sent requester/assignee emails or changed statuses without a session.

Members can list/read only their own requests. TA and Manager can list/read all. Manager-only `/api/requests/reports` returns aggregates by work status, approval status, and category with optional inclusive UTC creation dates `from`/`to`.

## Migrations and existing data

- `20260912000000_separate_request_status`: preserved all five legacy approval values in `approvalStatus`; initialized work to pending (cancelled remains cancelled), approval required, medium priority, empty location.
- `20260912010000_request_assignment`: added nullable assignee email and index.
- `20260912020000_sessions_and_manager`: adds users, opaque hashed sessions, and approval decision records. It does not delete or rewrite old requests.

Historical final decisions without reviewer metadata remain visible with their existing status. No reviewer or reason is fabricated. Old unapproved in-progress requests must be approved before closing. Old assignees must correspond to an active TA account to work through login; requests in pending/assigned can be reassigned by a TA.

Stop the API, run `npx prisma generate` and `npx prisma migrate deploy` from `apps/api`, then restart. Do not reset an existing database. Seed local accounts once; see [local setup](LOCAL-DEMO.md).

## Verification

`npm --prefix apps/web run test:contracts` compares frontend/API/Prisma enum values. API tests require a dedicated database ending in `_test` and cover role boundaries, actor spoofing, password/session checks, ownership, approval gates, immutable audit data, assignment, reports, and concurrency. See the root README for lint, typecheck, build, and test commands.
