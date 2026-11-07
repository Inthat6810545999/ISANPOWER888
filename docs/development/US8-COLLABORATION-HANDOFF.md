# US-8: External Industry Collaboration

Implemented on `codex/us8-industry-collaboration`, based on `origin/main` at
`56d76d8` (PR #24 merged). GitHub PRs were checked before implementation: no
existing formal TA collaboration implementation was found. Visitor purpose
`collaboration` remains a separate public visit use case.

## Scope and design decisions

Active TAs with membership `APPROVED` submit a formal partnership on behalf of
an external contact. The existing role `lab_manager` reviews it; this project
has no separate Lecturer role. No role or membership privileges are expanded.

The six form fields, length limits, medium priority, submitter snapshots, and
dedicated staff detail page are additional design decisions beyond the short
User Story. They follow existing request UI conventions. The follow-up requirement
from Target Users / URS-10 / SRS-10–11 supersedes the original no-tracking
constraint: industry collaborators can now track without an account. There is
no contact email delivery, notification, attachment, or new approval flow.

## API contract

`POST /api/requests/industry-collaboration` requires the existing Bearer session.
Next.js reads its HttpOnly cookie and forwards the token server-to-server;
browser JavaScript receives no session token.

```json
{
  "title": "Joint research partnership",
  "organization": "Example Industry Ltd",
  "contactName": "Partner Contact",
  "contactEmail": "partner@example.test",
  "phone": "+66 2 123 4567",
  "description": "Purpose and details of the proposed collaboration."
}
```

| Field | Validation after trimming |
| --- | --- |
| title | Required string, 1–200 UTF-16 code units |
| organization | Required string, 1–200 |
| contactName | Required string, 1–120 |
| contactEmail | Required string, maximum 254; non-whitespace local/domain separated by @, domain includes a dot |
| phone | Optional string, maximum 40; empty allowed; otherwise 7–40 characters using digits, spaces, parentheses, periods, hyphens and optional leading + |
| description | Required string, 1–4000 |

Client and server independently enforce the same limits. Nulls, wrong types,
and extra body fields are rejected. In particular, requester identity, role,
source/type, approval flags/results, reviewer, and assignee cannot be supplied.

Success: **201** `{ "data": <LabRequest>, "trackingCode": "<one-time-secret>" }`, the existing staff representation
with `collaboration` added. The server sets:

```json
{
  "source": "industry_collaboration",
  "type": "industry_collaboration",
  "status": "pending",
  "requiresApproval": true,
  "approvalStatus": "submitted",
  "priority": "medium",
  "assigneeEmail": null,
  "decision": null,
  "decisionHistory": []
}
```

The response also contains generated ID/timestamps, title/description and
`requesterEmail` from the authenticated TA. `collaboration` contains `requestId`,
organization/contactName/contactEmail/phone and server-derived
`submittedById`, `submittedByName`, `submittedByEmail`. A tracking credential is
created atomically with the request and contact details; only its SHA-256 hash is
stored. The raw code is returned only in this successful creation receipt.
Existing Member/Visitor rows return `collaboration: null`.

Errors use the existing envelope: `{ "error": "..." }`; validation **400** also
includes Zod `details`. Missing, expired, revoked or inactive sessions return
**401**. Wrong role or non-APPROVED membership returns **403**. Malformed JSON is
**400**, oversized bodies **413**, persistence failures **503** (sanitized), and
unexpected failures **500**. UI preserves the
draft on failed submission and allows an explicit retry.

Neither authenticated list/detail reads nor approval/work responses return the
code or hash. The TA must save the creation receipt before leaving/reloading.

Existing authenticated `GET /api/requests` and `GET /api/requests/:id` return the
details to staff. List filters accept `source=industry_collaboration` and
`type=industry_collaboration`. Members remain restricted to their own **member**
source records, including when another source is requested. Manager reports
aggregate the new type, and category filters/search support it.

## Public collaboration tracking (follow-up)

`POST /api/collaborations/track` accepts only JSON `{ "code": "<secret>" }`.
No login, cookie, request ID, query-string credential or session token is needed.
Success **200** is exactly:

```json
{
  "data": {
    "kind": "industry_collaboration",
    "status": "pending",
    "approvalStatus": "submitted"
  }
}
```

The helper uses a database select allowlist; the HTTP handler independently
constructs the public response. The browser parser also discards extra fields.
No title, company, contact name/email/phone, submitting TA, request ID, internal
reason, decision/history, timestamp, publicMessage, credential/hash, visitDate or
timeSlot is included. Collaboration does not fabricate appointment dates.
The existing `/api/visits/track` response is unchanged and accepts only Visitor
codes. Cross-kind codes return not found; Visitor public-message editing is not
extended to Collaboration.

The public page is `/collaboration/track`. The TA's success screen builds a link
using the current web origin and `#code=<secret>` (never a query string), and
provides separate code/link copy buttons with manual-copy fallback. On opening
the link, the page immediately removes the fragment with `replaceState`, then
performs one POST lookup without credentials/referrer and with no-store. Opening
another fragment link in the same tab also works. A plain page accepts a pasted
code. Further status updates require pressing **Find my request**; there is no
polling or notification. Referrer policy is no-referrer and the new page is noindex.

Codes use the Visitor generator: 32 cryptographically random bytes encoded as
43 case-sensitive base64url characters (256 bits), stored only as SHA-256 in the
existing `visit_tracking_credentials` table. Its name is historical; its FK is to
LabRequest, not VisitDetails, so no additional schema migration is necessary for
this extension. No code is stored in browser localStorage/sessionStorage or
included in logs; deployment infrastructure must likewise avoid logging POST
bodies or Server Action responses. HTTPS remains required for deployment and
clipboard access outside localhost.

The raw code is available only in the successful creation response and that
page's component memory. Leaving/reloading loses the receipt. Later staff detail
reads cannot recover it; an ambiguous lost creation response can leave a saved
request whose code was not received. Check the queue instead of blindly creating
duplicates. There is no recovery/reissue/rotation endpoint in this scope.
Saved codes/links can be reused while their request/credential exists, including
after rejection or closure; no expiry is added beyond the existing Visitor policy.

Existing collaboration requests created before tracking retain their records and
approval/work flow, but have **no public tracking**. They receive no automatic
backfill. Staff can communicate status manually. A future issuance/reissue flow
would need separate authorization, auditing and secure one-time delivery; this
change deliberately does not manufacture or weaken recoverable credentials.

Security/error behavior matches Visitor: database-backed per-IP fixed window of
10 attempts/minute, including invalid bodies, shared across API instances;
separate `collaboration-track` scope so Visitor traffic does not consume it.
Untrusted forwarded IP headers are ignored. **429** includes Retry-After. Every
tracking response sets Cache-Control: no-store before CORS/parsing, including
errors. Configured CORS policy is unchanged. Missing, malformed, unknown,
wrong-kind and request-ID codes have the same **404** body:
`{"error":"Collaboration request not found."}`. Invalid body/JSON **400**,
oversize **413**, content type **415**, method **405**, denied CORS **403**,
database/service failures **503** use sanitized errors without logging raw
exceptions or code-bearing request bodies.

## Schema and permissions

Migration `20261107000000_industry_collaboration` adds one enum value to both
`RequestType` and `RequestSource`, plus `industry_collaborations` with a one-to-one
request FK/primary key and cascading deletion. Contact fields and immutable TA
identity snapshots live there; purpose/details use `LabRequest.description`.
Snapshots deliberately have no user FK, preserving attribution when accounts
change. Existing request and decision records are not rewritten.

Only the new TA endpoint can create this source/type. Generic creation stays
Member-only and excludes the industry type. API middleware validates current
session/account status and role; Server Actions also check TA permissions.

Manager uses the existing immutable approve/reject endpoint and audit record
(reviewer identity, reason, timestamp). Approval status and work status remain
independent. Approval must be `approved` before a TA can claim; claim assigns
the acting TA, start requires assigned ownership, and close requires owned
in-progress work. Rejection does not permit work. TA cannot approve, including
their own submission; Manager gains no TA work privileges.

External contact data appears only in protected staff views. Public Visitor
tracking keeps its existing whitelist and Visitor source restriction. An
industry request ID is not a tracking code. Public-message editing remains
Visitor-only. Internal decision reasons are visible to authorized staff,
including the submitting TA, and are not sent to the external contact.

## UI and manual verification

1. Sign in as an active, APPROVED TA. Open **External Industry Collaboration**
   from the TA navigation (`/ta/collaborations/new`). Verify submitting TA and
   external contact are displayed separately.
2. Try blank fields, invalid email/phone and boundary lengths. Submit valid
   details; while saving, inputs are read-only and the submit button is disabled.
3. Simulate a failed API request: values remain, an error appears, retry works.
   Success and the **Open created request** link appear only after API success.
4. Open the created request, reload, and verify persisted details and the separate
   Pending / Awaiting approval badges. HTML-looking text must remain plain text.
5. Save/copy the one-time code/link from the success screen. Open the link in a
   signed-out browser; it shows statuses only, without appointment fields. Search
   again after each decision or work transition to obtain the latest state.
6. Manager **Awaiting review** contains the request. Review displays the company,
   contact and submitting TA. Approve with a reason, then reload the TA detail
   page to see the decision, reviewer and time.
7. In TA queue, claim, start, then close. Repeat with a second rejected request;
   work actions must remain blocked. Verify Manager reports/category filtering.
8. Check Member creation, Visitor tracking and Visitor public-message editing.
   Neither Member nor anonymous users can read collaboration contact details.

The in-memory form draft survives submission errors, not navigation/reload.
Same-tab concurrent submission is locked synchronously. This does not introduce
API idempotency: after an ambiguous lost response, check the queue before retrying
to avoid creating a second formal request.

## Setup, migration and safe tests

Install dependencies in both apps with `npm.cmd ci`, then generate the API client:

```powershell
cd apps/api
npx.cmd prisma generate
```

For a reviewed deployment, set `DATABASE_URL` privately to the intended database,
inspect migration status, then deploy migrations before starting the new API:

```powershell
npx.cmd prisma migrate status
npx.cmd prisma migrate deploy
npm.cmd run dev
# Separate terminal, apps/web:
npm.cmd run dev
```

Do not use reset, db push or destructive tests on a real/demo/shared database.
**The shared Neon database has NOT been migrated by this task.** Its `.env` is
unchanged. The normal development API/web processes were stopped during this
work; only isolated test servers were started and cleaned up. Do not restart
the new API against Neon until the additive migration is reviewed and applied.

The US-8 runner requires an explicit local PostgreSQL admin URL with CREATE
DATABASE privileges and refuses non-local hosts. Supply this privately through
`US8_TEST_ADMIN_DATABASE_URL` (never commit the value), then from `apps/web`:

```powershell
npm.cmd run test:us8-live
```

It creates a unique `us8_*_test` database, applies the pre-US8 migrations, inserts
a legacy request/decision, upgrades and verifies those rows unchanged, runs the
entire API suite, and exercises Chrome against the real API/Next app on ports
4118/3118, then runs the existing Visitor tracking browser suite against those
services. It drops only the database it created, then stops its test processes.
Chrome and local PostgreSQL must be installed. Temporary Next/migration output
is under ignored `apps/web/build`. No application `.env` fallback is used.

Other commands:

```powershell
# apps/api (tests only with an isolated test DATABASE_URL):
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
# apps/web:
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:contracts
npm.cmd run build
```

Existing live regressions have `.env` fallbacks, so **always explicitly set**
`MESSAGE_TEST_ADMIN_DATABASE_URL` and `WORKFLOW_TEST_ADMIN_DATABASE_URL` to a
local admin connection before `test:public-message-live` or
`test:workflow-smoke-live`. Those runners create and drop their own test DBs.

## Actual verification (2026-11-07)

| Check | Result |
| --- | --- |
| Additive migration with legacy request/decision | Passed, values unchanged |
| Entire API suite | 138 tests / 11 files passed, including 9 US-8 creation/workflow tests and 5 tracking tests |
| Frontend unit suite | 28 tests / 5 files passed, including receipt copy/fallback and public contract tests |
| Existing frontend contract tests | 18 passed |
| Visitor tracking browser regression | 9 passed on the isolated 3118/4118 services, including actual persisted code/CORS, fragments, errors, keyboard and mobile widths |
| US-8 live UI/API/database | Passed: error/draft, duplicate lock, one-time receipt, anonymous tracking, persistence, approval/rejection, refreshed public assigned/in-progress/closed states, reports, protected routes |
| Existing public-message live regression (base US-8 run) | Passed, including 40 API tests and Manager save → fresh Visitor lookup; public-message API tests also pass in the current full suite |
| Existing Member → Manager → TA browser regression (base US-8 run) | Passed, including rejection; request API tests also pass in the current full suite |
| API lint/typecheck/build | Passed |
| Web lint/typecheck/production build | Passed |

US-8 API tests cover absent/expired/revoked sessions; Member, Manager, unassigned,
pending/inactive/demoted accounts; required fields and exact length limits;
identity/workflow forgery; generic-endpoint bypass; staff queue/report visibility;
Member/public privacy; final decisions, audit and approval-first work gates.
UI tests additionally cover rejected transport and explicit retry.

## Evidence

Synthetic test identities only; no session cookies or real partner data. Code/link
inputs are masked before screenshot capture (black rectangles), including the
success receipt and every public tracking result. Navigation failures involving
a fragment link are redacted by the harness; no browser trace/HAR is recorded:

- [01 Draft retained after failure](evidence/us8/01-draft-after-error.png)
- [02 API-confirmed success](evidence/us8/02-created.png)
- [03 Persisted details after reload](evidence/us8/03-persisted-details.png)
- [04 Manager review](evidence/us8/04-manager-review.png)
- [05 TA sees approval and audit](evidence/us8/05-ta-approved.png)
- [06 Approved work closed](evidence/us8/06-closed.png)
- [07 Rejection blocks work](evidence/us8/07-rejected-blocked.png)
- [08 Manager reports](evidence/us8/08-reports.png)
- [09 External pending review](evidence/us8/09-public-awaiting-review.png)
- [10 External approved](evidence/us8/10-public-approved.png)
- [11 External closed](evidence/us8/11-public-closed.png)
- [12 External rejected](evidence/us8/12-public-rejected.png)

## Changed areas and review handoff

- API: Prisma schema/additive migration, request model enums, controller, route,
  and `industryCollaborationRoutes.test.ts`.
- Web: TA navigation; new create/detail routes and industry feature components,
  validation/unit tests; existing request actions/types/API types; Member category
  separation; request table staff details/search; Manager review details.
- Tooling/docs: `test:us8-live`, its runner, this handoff, request status contract,
  and the twelve US-8 screenshots. No dependency upgrade is required.

Shared UI review: RequestTable now renders a guarded collaboration detail section
and searches organization/contact; ManagerApprovals uses the same details.
StatusBadge, VisitorDetails, public-message metadata and shared styling are not
changed. VisitorTrack shares the existing lookup/fragment/error UI through an
explicit collaboration mode and adds same-tab fragment handling. Visitor response
and scheduling semantics remain unchanged. Review Member/Visitor rows and mobile layout when integrating other UI
work. Generated test-build paths in tsconfig are not necessary for the feature
and are excluded from the deliverable.

Integration QA checklist:

- [ ] Review/apply migration to the intended deployment database before API rollout.
- [ ] Run the local isolated harness and review screenshots.
- [ ] Verify real TA/Manager accounts and current membership gates in staging.
- [ ] Repeat approve and reject paths; refresh detail and queue to see results.
- [ ] Save the one-time code/link, open signed out, and manually search after
  approval and each work transition. Verify old requests have no issued code.
- [ ] Verify Member/Visitor privacy and existing public-message behavior.
- [ ] Verify narrow/mobile layout and keyboard navigation on supported browsers.
- [ ] Review diff and ensure `.env`, credentials, build output and database dumps
  are absent before committing.

Remaining deployment/manual coverage: shared Neon migration and real-account
staging validation are deliberately not performed; visual automation uses desktop
Chrome, not all mobile/browser combinations. No commit or push has been made.

### File inventory

- `apps/api/prisma/migrations/20261107000000_industry_collaboration/migration.sql`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.ts`
- `apps/api/src/controllers/labRequestController.ts`
- `apps/api/src/models/LabRequest.ts`
- `apps/api/src/routes/collaborationTrackRoutes.test.ts`
- `apps/api/src/routes/industryCollaborationRoutes.test.ts`
- `apps/api/src/routes/labRequestRoutes.ts`
- `apps/api/src/routes/visitTrackRoutes.ts`
- `apps/api/src/visits/contract.ts`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- `apps/web/scripts/us8.live.test.mjs`
- `apps/web/src/app/collaboration/track/page.tsx`
- `apps/web/src/app/ta/collaborations/[id]/page.tsx`
- `apps/web/src/app/ta/collaborations/new/page.tsx`
- `apps/web/src/components/ta/TaShell.tsx`
- `apps/web/src/features/industry-collaboration/CollaborationDetails.tsx`
- `apps/web/src/features/industry-collaboration/CollaborationForm.test.tsx`
- `apps/web/src/features/industry-collaboration/CollaborationForm.tsx`
- `apps/web/src/features/industry-collaboration/validation.ts`
- `apps/web/src/features/manager/ManagerApprovals.tsx`
- `apps/web/src/features/request-submission/RequestSubmission.tsx`
- `apps/web/src/features/request-submission/validation.ts`
- `apps/web/src/features/requests/RequestTable.tsx`
- `apps/web/src/features/requests/actions.ts`
- `apps/web/src/features/requests/types.ts`
- `apps/web/src/features/visitor-track/VisitorTrack.tsx`
- `apps/web/src/features/visitor-track/collaboration-contract.test.ts`
- `apps/web/src/features/visitor-track/contract.ts`
- `apps/web/src/lib/api.ts`
- `docs/development/REQUEST-STATUS-CONTRACT.md`
- `docs/development/US8-COLLABORATION-HANDOFF.md`

Plus the twelve PNG evidence files listed above.
