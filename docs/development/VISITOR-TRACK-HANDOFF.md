# Visitor tracking — owner 3 delivery

## Current policy: explicit development origins (latest follow-up)

Development now permits exactly `http://localhost:3000` and
`http://127.0.0.1:3000`. The shared implementation is
`apps/api/src/config/cors.ts`, used by both the tracking boundary and existing
global API middleware. It checks exact membership before returning any CORS
allow header; there is no wildcard, unchecked reflection, credential enabling,
or trust-proxy change. Both allowed origins receive 204 preflight and their own
exact Access-Control-Allow-Origin value plus Vary: Origin. Other ports, schemes,
hosts and the literal Origin null are not automatically included.

Unlisted Origin values receive HTTP 403 `{"error":"Origin not allowed."}` for
OPTIONS and actual requests, without Access-Control-Allow-Origin, before route
processing. Tracking still sets no-store first, including this new 403. Requests
without an Origin header retain existing server-to-server access/auth behavior;
CORS is not a substitute for authentication. Existing global allowed methods and
headers are preserved. Tests cover health, invalid submission and protected
requests in addition to tracking, and prove denied requests create no DB rows or
rate buckets. Development ignores CORS_ORIGIN in favor of the two exact entries.

Production requires one explicit HTTP(S) CORS_ORIGIN, for example
`https://lab.example.org`; no localhost aliases are added. Missing/wildcard/list/
credential/path/query configurations fail at startup. A root trailing slash is
canonicalized. Test mode uses only its configured CORS_ORIGIN (localhost:3000
default), allowing isolated port-3100 tests without adding production aliases.
`src/index.ts` now passes the validated NODE_ENV into createApp explicitly.

Next development also needed `allowedDevOrigins: ["localhost", "127.0.0.1"]` in
`apps/web/next.config.ts`: otherwise Next 16 blocked its dev resources from the
second host, leaving the page without working client handlers. This setting
affects Next development resources only, not the production API origin policy.

Latest verification (all completed):

| Gate | Command | Result |
| --- | --- | --- |
| API lint | npm run lint | PASS |
| API types | npm run typecheck | PASS |
| API build | npm run build | PASS |
| Web lint | npm run lint | PASS |
| Web types | npm run typecheck | PASS |
| Web build | npm run build | PASS |
| Web contracts | npm run test:contracts | PASS, 11 tests |
| API integration | npm test | PASS, 116 tests / 8 files on isanpower_visitor_track_test; includes 15 CORS tests and retiredAdminRoutes |
| Chrome browser suite | npm run test:tracking-browser | PASS, 10 tests including persisted codes from both actual port-3000 origins |

Browser environment: TRACK_TEST_WEB_URL=http://127.0.0.1:3000,
TRACK_TEST_API_URL=http://127.0.0.1:4000,
TRACK_TEST_ORIGINS=http://localhost:3000,http://127.0.0.1:3000. The API at port 4000
temporarily used the authorized `_test` DB and NODE_ENV=development. Each live
origin test obtained a real persisted code through POST /api/visits, then opened
the actual page in Chrome and retrieved its result once with no cookies/referrer.
No lookup responses were mocked for those two cases. The remaining tests cover
real malformed/unknown lookups and supplementary injected browser error cases.
The original dev API was restored in a finally block and restarted against its
normal development environment after the suite. No development data was used as
browser fixtures and no credentials are included in this handoff.

Initial reruns exposed a stopped web server and then the Next dev-origin block;
both were fixed before the successful final run. A test tuple typing error was
also corrected before API typecheck/build passed. Browser setup now checks page
readiness before creating credentials and redacts navigation failures involving
real tracking fragments. No gate remains unrun. No commit or push was performed.

Files changed in this follow-up (earlier Visitor tracking changes are retained):

- apps/api/src/config/cors.ts — new shared exact-origin policy.
- apps/api/src/config/cors.test.ts — new development/production/denial regressions.
- apps/api/src/app.ts — install the shared policy for all routes.
- apps/api/src/config/env.ts — no implicit production CORS_ORIGIN default.
- apps/api/src/index.ts — explicitly select the runtime CORS mode.
- apps/api/src/routes/visitTrackRoutes.ts — accept the shared middleware after no-store.
- apps/api/src/routes/visitTrackRoutes.test.ts — assert 403 and no-store on denied origin.
- apps/api/.env.example — document fixed development list and single production origin.
- apps/web/.env.example — describe both local web origins and production setup.
- apps/web/next.config.ts — permit both explicit loopback hosts for Next dev resources.
- apps/web/scripts/visitor-track.browser.test.mjs — real-code tests for both origins and safer test startup.
- docs/development/VISITOR-TRACK-HANDOFF.md — current policy, fresh results and restart details.

The historical sections below document previous checkpoints. The current policy
and counts above supersede their former single-origin development guidance.

## Previous follow-up: malformed code appeared as unavailable

Reproduced in actual Chrome against the user's running page at
`http://127.0.0.1:3000/visit/track`. The browser correctly targeted
`http://127.0.0.1:4000/api/visits/track` using NEXT_PUBLIC_API_BASE_URL (not the
server-only API_BASE_URL). The effective CORS_ORIGIN contained a root trailing
slash. API preflight returned `Access-Control-Allow-Origin: http://127.0.0.1:3000/`,
which does not equal the browser Origin `http://127.0.0.1:3000`. Chrome blocked
preflight, never sent the lookup POST, and fetch raised a network failure. Thus
the existing unavailable mapping was correct for the failure it actually saw.

Fix in `apps/api/src/app.ts`: canonicalize the configured URL with `.origin`
before passing it to both tracking and global CORS. This preserves one explicit
allowed origin; it does not allow arbitrary origins, enable credentials, alter
trust proxy or change the lookup helper/schema. Localhost and 127.0.0.1 remain
different origins; use the configured `http://127.0.0.1:3000` web URL locally.

After the fix, actual preflight returns 204 with the slash-free allowed origin
and no-store. Actual browser requests with a malformed Thai string and a valid
43-character unknown code both return 404, no-store, and exactly
`{"error":"Visit request not found."}`. Both render the identical not-found
message. No UI-only validation workaround was added; all attempts reach the API
and its limiter. Existing 429 mapping and network/5xx unavailable mapping remain.

Added API regression for slash-suffixed config, preflight, uniform not-found
responses and retention of the explicit allowed origin for an untrusted caller.
Added a real-browser regression that reads responses through actual CORS without
mocking the lookup endpoint. A focused run on the user's running 3000/4000 apps
passed 5 browser tests: live malformed/unknown, 404, 429, 503 and network-failure
mapping. Error-injection browser cases remain supplementary mocks. API
lint/typecheck/build and Web lint also passed after this fix.
The complete API integration suite then passed 101 tests on
`isanpower_visitor_track_test`, including the new CORS regression and
`retiredAdminRoutes.test.ts`.

The first regression attempt could not retrieve an unread no-store response body
through Chrome DevTools; the test now reads a cloned response inside the browser
without recording request data. A subsequent automatic approval-service usage
failure temporarily prevented reruns; after the user requested continuation,
the browser run completed successfully. Neither issue was an application failure.

## Initial delivery

HTTP contract accepted by the user and owner 2 in this task. Implemented on
`features/visitor-track`, based on `main` at `ead954801c6b9221204f867879cc805b23cc13d9`.
After fetching origin, backend commit `020d492` is an ancestor of main; PR #14 is
the actual merge. Initial working tree was clean. The proposal and helper tests
from the preceding preparation turn were preserved and completed.

Read both `VISITOR-FORM-HANDOFF.md` and `VISITOR-BACKEND-HANDOFF.md` (whose title is
“Visitor backend — owner 2”), plus `apps/web/AGENTS.md` and installed Next docs.
No backend schema/helper, historical migration, permission, Manager/TA page or
owner 1 receipt/form file was changed. No PR, commit or push was created.

## Implemented HTTP contract

Public `POST /api/visits/track`, JSON `{ "code": "<exact code>" }`.
No authentication required. Only the UI trims outer whitespace; API input is
passed unchanged to `findPublicVisit`. No replacement hashing or credential query.

| Status | Meaning | Exact body |
| --- | --- | --- |
| 200 | Found | `{ "data": { "status": "pending", "approvalStatus": "submitted", "publicMessage": "", "visitDate": "2099-12-01", "timeSlot": "morning" } }` (example values, exact keys) |
| 404 | Missing/non-string/malformed code or well-formed unknown code | `{ "error": "Visit request not found." }` |
| 400 | Malformed JSON, non-object envelope or extra envelope keys | `{ "error": "Invalid tracking request." }` |
| 413 | JSON body over parser's 100 KiB default | `{ "error": "Request body too large" }` |
| 415 | Unsupported media type | `{ "error": "Expected application/json." }` |
| 403 | Origin not in the current mode's allowlist (including preflight) | `{ "error": "Origin not allowed." }`, no Access-Control-Allow-Origin |
| 405 | Unsupported method | `{ "error": "Method not allowed." }`, `Allow: POST, OPTIONS` |
| 429 | More than 10 attempts per 60-second fixed window/socket IP | `{ "error": "Too many requests. Please try again later." }`, integer-seconds Retry-After |
| 503 | Helper/storage/unexpected processing failure | `{ "error": "Visitor service is temporarily unavailable." }` |
| 204 | CORS OPTIONS | No body |

All responses above use `Cache-Control: no-store`. The exact path is mounted in
`app.ts` BEFORE global CORS and JSON parsing. The tracking router sets no-store,
handles CORS/methods, applies unchanged publicRateLimit, checks content type,
parses JSON, calls the helper and constructs a new five-key response. Its local
error handler sanitizes failures without passing raw errors to global logging.
Invalid envelopes have 400 precedence; equivalent valid envelopes with invalid
or unknown code have identical 404 bodies. No timing-equivalence claim is made.

## Changes and evidence index

Paths below are relative to repository root; IDs are used in the checklist.

| ID | File | Purpose/evidence |
| --- | --- | --- |
| A | apps/api/src/routes/visitTrackRoutes.ts | Middleware, public handler, allowlist, sanitized errors |
| B | apps/api/src/app.ts | Mount tracking boundary before global parsers |
| C | apps/api/src/routes/visitTrackRoutes.test.ts | 10 HTTP integration tests with real DB/counters, plus supplementary fault injection |
| D | apps/api/src/visits/publicVisitContract.test.ts | 6 real-DB helper tests, private sentinels, Closed/Rejected, exact-code behavior |
| E | apps/web/src/app/visit/track/page.tsx | Public page and no-referrer metadata |
| F | apps/web/src/features/visitor-track/VisitorTrack.tsx | Direct fetch, fragment lifecycle, accessible UI and plain text |
| G | apps/web/src/features/visitor-track/contract.ts | Public response reader, actual-enum labels, requested date/slots |
| H | apps/web/scripts/visitor-track.test.mjs | 5 contract tests, enums checked against Prisma schema |
| I | apps/web/scripts/visitor-track.browser.test.mjs | 8 headless Chrome tests; includes real API/DB path and browser-only mocked error cases |
| J | apps/web/next.config.ts | HTTP Referrer-Policy and optional isolated test distDir |
| K | apps/web/.env.example, docker-compose.yml | Browser-reachable API origin configuration |
| L | apps/web/package.json, package-lock.json | Include new contract tests, browser test command and Playwright dev dependency |
| M | apps/web/tsconfig.json | Allow .ts imports for node:test contracts and isolated Next-generated test route types |
| N | docs/development/VISITOR-TRACK-HANDOFF.md | Contract, results, owner coordination and checklist |

Local ignored `.env.local`: appended `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000`,
preserving all existing entries. Existing local API CORS_ORIGIN and web APP_BASE_URL
already match `http://127.0.0.1:3000`. No credentials were printed or committed.

## Database and verification

Inspected DATABASE_URL without printing password/full URL. User authorized local
development DB `127.0.0.1:5432/isanpower_local` and creation/cleanup of isolated
`isanpower_visitor_track_test` using the same host/user. Used PostgreSQL createdb
after checking existence. No production/shared DB and no migrate reset.

| Directory / target | Command executed | Result |
| --- | --- | --- |
| apps/api / isanpower_local | npx prisma migrate deploy | PASS; 11 migrations present, none pending |
| apps/api / isanpower_local | npx prisma generate | PASS; Prisma Client 6.19.3 generated |
| apps/api / isanpower_visitor_track_test | npx prisma migrate deploy | PASS; applied all 11 existing migrations |
| apps/api / dedicated test DB | npm test | PASS; 7 files, 100 tests including 10 tracking HTTP + 6 helper tests |
| apps/api / same suite | retiredAdminRoutes.test.ts | PASS; included in the 100 tests |
| apps/api | npm run lint | PASS |
| apps/api | npm run typecheck | PASS |
| apps/api | npm run build | PASS |
| apps/web | npm run lint | PASS |
| apps/web | npm run typecheck | PASS |
| apps/web | npm run test:contracts | PASS; 11 tests (6 existing + 5 tracking) |
| apps/web | npm run build | PASS; public /visit/track included |
| apps/web | npm run test:tracking-browser | PASS; 8 tests in Chrome against Next dev Strict Mode |

The existing test setup enforces database names ending `_test`, migrates before
tests, and deletes test records after each test. Commands were executed through a
local ignored wrapper that sets DATABASE_URL privately, restricts the host/database
to the authorized targets and redacts captured output. Browser integration used
API port 4100 pointing to the isolated test DB and web port 3100. Production data
was not used as fixtures. Browser runs leave only synthetic test records there.

Initial sandbox API suite startup failed on esbuild ancestor-directory access;
rerun outside sandbox passed. Initial web build failed downloading existing Google
Fonts; permitted network rerun passed. Prisma generate initially failed because
the pre-existing dev API held the Windows engine DLL. The user explicitly approved
pausing/restarting it; generation then passed and the dev watcher was restored.
One browser mock initially failed to expose Retry-After through CORS; fixed the
fixture to match the actual API and reran successfully. These are resolved failures,
not skipped gates. Contract tests emit an existing Node module-type warning.

Mobile screenshots at 375 px and desktop at 1280 px were visually inspected;
automated overflow/focus checks cover 320/375 px and long public messages. Tests
exercise Tab, Shift+Tab and Enter, visible focus, input label, live-region markup,
loading/errors/results. No human screen-reader speech test was performed.
Screenshots in local ignored tmp use a synthetic, non-production code.

To repeat isolated port-3100 browser tests: set API DATABASE_URL privately to the authorized `_test`
database, run migrations, start API with NODE_ENV=test, PORT=4100 and
CORS_ORIGIN=http://localhost:3100. Start web with
NEXT_PUBLIC_API_BASE_URL=http://localhost:4100, NEXT_DIST_DIR=.next/visitor-track-test,
and `npm run dev -- --port 3100`. Then run `npm run test:tracking-browser` in
apps/web. Default browser is installed Chrome; PLAYWRIGHT_CHANNEL can select another
installed Playwright-supported channel. TRACK_TEST_WEB_URL and TRACK_TEST_API_URL
override the local test origins. Do not point browser tests at a production API.

## Owner 1 handoff

Use `/visit/track#code=${encodeURIComponent(trackingCode)}` from the receipt.
The page reads the fragment client-side, removes it using history.replaceState
before the API request, keeps the code in component memory, and submits once.
The manual input stays available. Do not use query strings, API path parameters,
localStorage, analytics or logs for the credential. The receipt component was
intentionally not edited to avoid concurrent ownership conflicts.

This note is ready to relay to owner 1. No owner contact/task identifier was
provided, so no outbound team message or owner 1 receipt change is claimed.

## Owner 4 handoff

The UI labels real RequestStatus values pending/assigned/in_progress/closed/cancelled
as Awaiting processing/Assigned to lab staff/In progress/Closed/Request cancelled.
Real ApprovalStatus values not_required/submitted/under_review/approved/rejected/
cancelled map to Approval not required/Awaiting review/Under review/Approved/
Request declined/Approval cancelled. Rejection has a prominent heading even when
work remains pending; both statuses remain visible. Approved never implies the
requested window is a booked appointment. Requested dates/slots use Asia/Bangkok.

Owner 4 still needs to review this Visitor wording and agree editorial guidance
for publicMessage. Only that explicitly public field is displayed, as plain text;
reason and decisionHistory remain internal and are never used as fallback text.
The backend currently stores a non-null string defaulting to empty; UI also
tolerates missing/null. Existing backend rules trim at most 2000 characters,
preserve on omission and clear on empty input. No new message-editing endpoint,
staff UI, permissions, schema or helper change was made. Direct owner 4 messaging
is pending an owner contact/task identifier.

## Rate-limit production limitation and owner 2 observations

Tracking uses browser → API with `credentials: "omit"`, not a Next server proxy.
Scope `visit-track` is separate from `visit-submit`; tested across API instances.
Invalid codes/JSON/oversized bodies consume attempts before validation/parsing.
429 Retry-After is exposed through narrowly configured CORS. Submission still
uses its existing Next Server Action, so its users share the Next server IP bucket.

Before production, configure NEXT_PUBLIC_API_BASE_URL to the public HTTPS API
origin at build time and CORS_ORIGIN to the exact web origin. Compose's internal
`http://api:4000` is server-only and is not the browser URL. Direct fetch avoids
Next's shared bucket but does NOT guarantee end-user IPs at a reverse proxy/NAT.
Deployment owner and owner 2 must verify the real ingress and set a precise trusted
proxy policy before using forwarded client IPs. Current API trusts no arbitrary
X-Forwarded-For; no broad trust proxy or limit bypass was added. All callers behind
one visible proxy/NAT IP still share 10/minute. This remains a deployment limitation.

Owner 2's lookup already supports Closed and Rejected; integration proves both.
Its return fields match documentation. timeSlot/date are database strings validated
on submission, not Prisma enums. publicMessage is non-null in schema, with a UI
fallback for absent values. No helper/schema mismatch requiring a change was found.
The original global JSON parser and generic error logger could not guarantee
tracking no-store/counting/privacy, so tracking has a path-local boundary ahead
of them; submission and global error behavior were not changed.

## Requirement checklist

Evidence IDs refer to exact files above. “ทำแล้ว” is limited to the specific
implementation/check described, not a claim about untested deployment topology.

### Preconditions and scope

- ทำแล้ว: read form handoff — source document and this handoff.
- ทำแล้ว: locate/read “Visitor backend — owner 2” — VISITOR-BACKEND-HANDOFF.md.
- ทำแล้ว: read applicable AGENTS.md and installed Next guides — apps/web/AGENTS.md.
- ทำแล้ว: inspect clean initial working tree — git status recorded before changes.
- ทำแล้ว: preserve uncommitted work — retained preparation files; no unrelated edits.
- ทำแล้ว: inspect latest Git history/ancestry after fetch — SHAs and merge above.
- ทำแล้ว: create features/visitor-track from main with backend merged — git branch.
- ทำแล้ว: inspect actual findPublicVisit — unchanged apps/api/src/visits/contract.ts.
- ทำแล้ว: inspect actual publicRateLimit — unchanged apps/api/src/visits/rateLimit.ts.
- ทำแล้ว: inspect actual Prisma enums — schema and H.
- ทำแล้ว: get HTTP contract agreement before route implementation — user approval.
- ทำแล้ว: keep owner 2 schema unchanged — git diff of prisma is empty.
- ทำแล้ว: keep owner 2 helpers unchanged — git diff of contract.ts/rateLimit.ts empty.
- ทำแล้ว: no Admin role recreated — no role code edits; retiredAdminRoutes passes.
- ทำแล้ว: no existing permission changes — production diff limited to tracking.
- ทำแล้ว: no email-as-ownership logic — A/F have no identity inference.
- ทำแล้ว: no Manager/TA page changes — git diff boundaries checked.

### Task 1 — API

- ทำแล้ว: public lookup without login — A/C/I.
- ทำแล้ว: lookup exclusively through findPublicVisit — A source and C exact-call spy.
- ทำแล้ว: no custom production credential query — A source.
- ทำแล้ว: explicit status allowlist field — A/C/D.
- ทำแล้ว: explicit approvalStatus allowlist field — A/C/D.
- ทำแล้ว: explicit publicMessage allowlist field — A/C/D.
- ทำแล้ว: explicit visitDate allowlist field — A/C/D.
- ทำแล้ว: explicit timeSlot allowlist field — A/C/D.
- ทำแล้ว: exclude LabRequest object — exact C/D equality.
- ทำแล้ว: exclude VisitDetails object — exact C/D equality.
- ทำแล้ว: exclude decision/history — C extra-field injection and D private fixture.
- ทำแล้ว: exclude contact information — C/D private sentinels.
- ทำแล้ว: exclude credential/hash — C/D exact keys and hash exclusion.
- ทำแล้ว: exclude requestId — C/D exact keys and ID exclusion.
- ทำแล้ว: exclude reason — C extra-field injection and D private reason.
- ทำแล้ว: exclude decisionHistory — C extra-field injection.
- ทำแล้ว: 43-character base64url and case sensitivity — unchanged helper, C/D.
- ทำแล้ว: UI trims outer whitespace only — F/I mixed-case request-body assertion.
- ทำแล้ว: API never lowercases/normalizes — A and C exact-call spy.
- ทำแล้ว: helper validates/looks up codes — A/C/D.
- ทำแล้ว: no substitute hashing — A source; fixture hashing uses existing helper only.
- ทำแล้ว: malformed/unknown code identical HTTP status — C.
- ทำแล้ว: malformed/unknown code identical response body — C.
- ทำแล้ว: no-store success — A/B/C.
- ทำแล้ว: no-store validation failure — C invalid-envelope case.
- ทำแล้ว: no-store malformed JSON — C parser case.
- ทำแล้ว: no-store oversized JSON/413 — C parser case.
- ทำแล้ว: no-store 429 — C shared-counter case.
- ทำแล้ว: no-store 503 — C helper/storage fault cases.
- ทำแล้ว: no-store early OPTIONS/405/415 — C transport case.
- ทำแล้ว: inspect middleware/error-handler early responses — B boundary before parser.
- ทำแล้ว: rate-limit all lookup attempts including invalid codes — A/C counter assertions.
- ทำแล้ว: 429 with Retry-After — C exact 59-second assertion, I 429 UI.
- ทำแล้ว: storage/helper failure returns service unavailable — C.
- ทำแล้ว: failure not disguised as not-found — C exact 503 body.
- ทำแล้ว: errors reveal no internal details — A and C private-error injection.
- ทำแล้ว: no code logging — A/F source scan and C console spies.
- ทำแล้ว: no body logging — A local handler, C console spies.
- ทำแล้ว: no credential logging — A/F source scan and C console spies.
- ทำแล้ว: inspect browser/server path — old actions.ts versus F direct fetch.
- ทำแล้ว: credentials omit — F/I options and actual no-cookie request.
- ทำแล้ว: configure matching local CORS origin — existing local config + I actual API.
- ทำแล้ว: separate visit-track from visit-submit — C DB bucket counts.
- ทำแล้ว: 10 attempts/60 seconds/socket IP — A and C fixed-window test.
- ทำแล้ว: arbitrary X-Forwarded-For not trusted — C spoofed-IP test.
- ทำแล้ว: limiter not disabled — A/C.
- ทำแล้ว: no broad trust proxy added — B diff/source inspection.
- ทำแล้ว: document shared-IP deployment limitation — rate-limit section above.
- ยังไม่ได้ทำ: configure/verify production trusted proxy — deployment topology not supplied.

### Task 2 — Page

- ทำแล้ว: public /visit/track — E/I no-session navigation.
- ทำแล้ว: manual input — F/I.
- ทำแล้ว: search button — F/I.
- ทำแล้ว: result view — F/I.
- ทำแล้ว: loading view — I delayed-response test.
- ทำแล้ว: understandable not-found view — I 404.
- ทำแล้ว: understandable rate-limit view — I 429.
- ทำแล้ว: understandable unavailable view — I 503/network/malformed response.
- ทำแล้ว: concurrent submit prevention — F inFlight/disabled, I repeated Enter.
- ทำแล้ว: no automatic error retry — I response counts.
- ทำแล้ว: no automatic 429 retry — I response count.
- ทำแล้ว: result shows only public statuses/date/time/message — F/G/I and C allowlist.
- ทำแล้ว: use actual visitDate — G/H/I.
- ทำแล้ว: morning 09:00–12:00 — G/H/I.
- ทำแล้ว: afternoon 13:00–16:00 — G/H/I real API case.
- ทำแล้ว: Asia/Bangkok calendar display — G/H/I with browser in Los Angeles.
- ทำแล้ว: requested preferences, not booked appointment — F/I wording assertion.
- ทำแล้ว: rejection distinguished while pending — F/I.
- ทำแล้ว: map actual enums to Visitor labels — G/H schema comparison.
- ทำแล้ว: no invented/additional enum values — H and unchanged schema.
- ทำแล้ว: match existing Visitor English/style — F shared CSS, inspected screenshots.
- ทำแล้ว: Closed stays discoverable — C/D/I.
- ทำแล้ว: Rejected stays discoverable — C/D/I.
- ไม่เกี่ยวข้อง: request Closed/Rejected helper repair — helper already supports both.
- ทำแล้ว: absent/empty publicMessage handling — F/G/H/I.
- ทำแล้ว: publicMessage plain text, never HTML — F/I HTML-like fixture.
- ทำแล้ว: keyboard navigation — I Tab/Shift+Tab/Enter.
- ทำแล้ว: associated input label — F/I getByLabel.
- ทำแล้ว: loading announcement markup — F/I role=status/live region.
- ทำแล้ว: error announcement markup — F/I live-region error assertions.
- ทำแล้ว: result announcement markup — F/I live-region result.
- ทำแล้ว: mobile layout — I 320/375px and long text; screenshot visually inspected.
- ทำแล้ว: fragment auto-search — F/I real and mock browser tests.
- ทำแล้ว: fragment read client-side — F useEffect.
- ทำแล้ว: code kept in state — F/I manual input after lookup.
- ทำแล้ว: fragment removed with replaceState before request — F/I request-time assertion.
- ทำแล้ว: no code in API query — F/I exact endpoint assertion.
- ทำแล้ว: no code in API path — F/I exact endpoint assertion.
- ทำแล้ว: no localStorage code — F source, I empty localStorage.
- ทำแล้ว: no analytics code capture added — F/E/root layout source scan.
- ทำแล้ว: no application logs of code — A/F source and C spies.
- ทำแล้ว: Referrer-Policy no-referrer — E/J and I actual header/no Referer.
- ทำแล้ว: manual entry always available — F/I input editable after fragment/result.
- ทำแล้ว: specify owner 1 link format — owner 1 handoff above.
- ยังไม่ได้ทำ: send owner 1 a direct notification — no recipient/contact/task identifier supplied.
- ทำแล้ว: do not overwrite receipt page — unchanged owner 1 files.
- ยังไม่ได้ทำ: owner 1 adds receipt link — intentionally reserved for owner 1 coordination.

### Task 3 — Tests

- ทำแล้ว: unauthenticated page test — I.
- ทำแล้ว: unauthenticated API test — C/I.
- ทำแล้ว: valid code — C/D/I.
- ทำแล้ว: valid-format unknown code — C/D.
- ทำแล้ว: malformed code — C/D.
- ทำแล้ว: case sensitivity — C/D/I.
- ทำแล้ว: only UI trim normalization — C exact input and I trimmed request body.
- ทำแล้ว: malformed/unknown status equality — C.
- ทำแล้ว: malformed/unknown body equality — C.
- ทำแล้ว: rate-limited 429 — C/I.
- ทำแล้ว: Retry-After assertion — C/I.
- ทำแล้ว: invalid attempts count — C DB counters.
- ทำแล้ว: Closed lookup test — C/D.
- ทำแล้ว: Rejected lookup test — C/D.
- ทำแล้ว: rejected approval + pending work UI test — I.
- ทำแล้ว: exact allowlist response keys — C/D.
- ทำแล้ว: contact exclusion — C/D.
- ทำแล้ว: requestId exclusion — C/D.
- ทำแล้ว: hash exclusion — C/D.
- ทำแล้ว: reason exclusion — C/D.
- ทำแล้ว: decisionHistory exclusion — C.
- ทำแล้ว: all other internal fields excluded — C exact equality/extra-field injection.
- ทำแล้ว: no-store every implemented response status — C.
- ทำแล้ว: storage/helper failure sanitized — C fault injection with console spies.
- ทำแล้ว: fragment auto-lookup — I.
- ทำแล้ว: fragment removed before lookup — I.
- ทำแล้ว: no duplicate lookup from lifecycle — I with Next dev Strict Mode.
- ทำแล้ว: publicMessage plain text — I markup fixture.
- ทำแล้ว: keyboard checks — I.
- ทำแล้ว: mobile checks — I and visual review.
- ทำแล้ว: tests follow repository patterns — Vitest/Supertest API, node:test web.
- ทำแล้ว: real DB integration, not mock-only coverage — C/D and I live API case.

### Database, quality and remaining coordination

- ทำแล้ว: inspect DATABASE_URL before commands — safe host/database output only.
- ทำแล้ว: never print password/full connection string — private env + wrapper redaction.
- ทำแล้ว: use only authorized development/test DBs — exact targets listed above.
- ทำแล้ว: create test DB via createdb with same host/user — existence check then create.
- ทำแล้ว: apply development migrations — npx prisma migrate deploy.
- ทำแล้ว: generate Prisma client — npx prisma generate after approved server pause.
- ทำแล้ว: dedicated integration DB ends in _test — setup guard + observed datasource.
- ทำแล้ว: apply test migrations before tests — explicit deploy + existing setup hook.
- ทำแล้ว: never use migrate reset — command history.
- ทำแล้ว: no historical migration edits — empty prisma diff.
- ไม่เกี่ยวข้อง: new migration for schema/helper change — none needed or made.
- ทำแล้ว: inspect scripts before selecting gate commands — per-app package.json.
- ทำแล้ว: API lint — npm run lint.
- ทำแล้ว: Web lint — npm run lint.
- ทำแล้ว: API typecheck — npm run typecheck.
- ทำแล้ว: Web typecheck — npm run typecheck.
- ทำแล้ว: API build — npm run build.
- ทำแล้ว: Web build — npm run build.
- ทำแล้ว: contract tests — npm run test:contracts, 11 passed.
- ทำแล้ว: API integration — npm test, 100 passed.
- ทำแล้ว: retiredAdminRoutes remains passing — included integration suite.
- ทำแล้ว: report initial failures and successful reruns accurately — verification section.
- ทำแล้ว: prepare owner 4 publicMessage/status guidance — owner 4 handoff above.
- ยังไม่ได้ทำ: obtain owner 4 copy/editorial agreement — requires owner 4 review.
- ทำแล้ว: reason/decisionHistory remain internal — A/C/D/F.
- ทำแล้ว: record rate-limit limitation before real deployment — deployment section.
- ไม่เกี่ยวข้อง: PR creation/attachment — no PR requested or opened in this delivery.
