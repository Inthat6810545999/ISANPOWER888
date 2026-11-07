# US-6: Request history and closed-request search

## Delivered scope

US-6 / URS-6 requires a traceable record of who changed a request, what changed,
and when. Existing aggregate reports and CSV remain available. Manager → Request
approvals → **Closed history** provides searchable closed records, category and
priority filters, and the shared request-detail timeline. Dashboard / Reports links
to the request views. Members can read their own history and staff can read requests
within the existing authorization rules. The TA collaboration detail also includes
the timeline. Times are explicitly displayed in Asia/Bangkok.

## Storage and API

Migration `20261107010000_request_history` adds only `RequestHistoryAction` and
`request_history`, with a foreign key to requests and an ordered lookup index.
It does not update, reset or delete existing requests, approvals, users or sessions.

- New Member, Visitor and TA collaboration submissions atomically create a
  `created` event with the request. Visitor identity is self-reported, labelled as
  such, with no authenticated actor ID.
- Successful claim/start/close operations append `claimed`/`started`/`closed`
  events in the same transaction as the conditional request update. Both TA API
  routes use this logic. Rejected, unauthorized, duplicate and concurrent losing
  actions create no event. A history-write failure rolls back the work change.
- Each work event stores ID, request ID, action, old/new work status, actor
  ID/name/email/role snapshots and server timestamp. Snapshots survive later
  account edits. An integer ID provides deterministic ordering for tied timestamps.
- Protected request list/detail/mutation responses include `history`, oldest first
  by `occurredAt`, then ID. Existing role and Member ownership checks apply.
- Approval decisions continue to use the existing `ApprovalDecision` table. The
  UI combines these with work history chronologically, includes reasons and
  labels superseded decisions. Approval never becomes a work-state transition.
- There is no client endpoint to create, edit or delete individual history events.
  Database administrators still have database-level access; this is application
  audit history, not a tamper-proof external audit ledger.
- Anonymous Visitor/collaboration tracking retains its existing exact public
  response. It does not disclose history, staff identities or internal reasons.

## Historical data and limits

No old transition is invented. A request with no recorded creation event displays
an explicit incomplete-history notice; subsequent real events and original
approval records still appear. Historical reports remain request-count summaries,
not equipment utilization measurements. Public-message edits retain their existing
latest-editor metadata and are not part of this work-status timeline.

List filtering/search remains client-side on the authorized request list. Server
pagination and lazy-loaded history can be introduced if volume grows. This change
does not implement other review findings (US-1 API validation, US-3 sort options,
or expanded Manager work permissions).

## Applying the change

The implementation was tested only on an isolated local PostgreSQL cluster.
The shared Neon database was not migrated during development.

1. Back up the intended database and verify the destination privately.
2. Stop the API. From `apps/api`, run:

   ```sh
   npx prisma generate
   npx prisma migrate status
   npx prisma migrate deploy
   npm run dev
   ```

3. Review **all** pending migrations before deploy, not only US-6. In particular,
   the older approval-first migration resets open work if it has never run there.
4. Restart the frontend. Submit a fresh request, approve it, claim/start/close as
   the assigned TA, then open Closed history as Manager and the detail as Member.
5. Check the original records and approval decisions still exist. Old records
   should show incomplete-history notices, not manufactured event times.

Do not use `migrate reset` or API tests on a development/shared/demo database.
The new API expects the history table, so apply the migration before starting it.

## Repeatable validation

- API lint, typecheck and build passed; all **142 API tests** passed on isolated
  PostgreSQL 18, including competing claims, actor snapshots, legacy data, denied
  reads/writes and actual database failure rollback. An initial full run encountered
  a `socket hang up` in an existing visitor-message authorization test on Node 26;
  the subsequent full run passed. No retry/skip was added to hide the failure.
- Web lint, typecheck, **31 unit tests** and **18 contract tests** passed.
- Production build passed with `NEXT_DIST_DIR=build/us6-production npm run build`
  outside the sandbox. The first sandbox build stalled on a Turbopack port-binding
  restriction; a clean separate output directory removed the cached failure.
  No Next.js configuration or dependency version was changed to bypass it.
- `npm run test:us6-live` verifies preservation across the new migration, the real
  browser/API/database workflow, rejection, closed search, persisted Member and
  Manager timelines, legacy notices and a narrow mobile viewport. It requires
  `US6_TEST_ADMIN_DATABASE_URL` pointing to **local** PostgreSQL with CREATE
  DATABASE permission. It creates and drops its own uniquely named `_test`
  database; it never falls back to the API `.env` or permits a remote host.
- Browser evidence is in `docs/development/evidence/us6/`. All accounts/data are
  synthetic, and sessions are not included in screenshots.
