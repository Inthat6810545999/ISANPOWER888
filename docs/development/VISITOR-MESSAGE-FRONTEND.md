# Visitor public-message editing — owner 2 delivery

Verified locally on 24 October 2026 (Asia/Bangkok).

## Readiness and scope

- Started from clean `main`, commit `b926bc3`, which merges PR #18 / `features/visitor-message-api`.
- Read `apps/web/AGENTS.md`, the installed Next.js Server Function guide, the API contract, README and Visitor staff/tracking handoffs.
- The developer applied `20261005000000_visitor_requests` and `20261023000000_visitor_message_editor` successfully and started the API. The initial connection failure was a sandbox restriction; an outside-sandbox read subsequently confirmed the missing migrations before they were applied.
- Backend, migrations, API contract, role rules and public tracking implementation are unchanged.

## Using the feature

Sign in as an approved Lab Manager, open **Request approvals → All requests → Public message** on a decided Visitor-source row. This opens a Manager-owned request-detail dialog with status, Visitor details, the public message and a separately labelled internal approval reason. Choose **Edit public message**, then **Save message** or **Cancel**.

The button is available only for `source: visitor` and `approvalStatus: approved/rejected`, including closed and cancelled work. Member-origin requests of type `visitor` do not qualify. The Server Action independently verifies current membership/role and the API enforces eligibility again.

The editor starts from the stored message. Cancel restores the stored value. The counter/validation use trimmed UTF-16 length, matching the contract; over 2,000 is rejected without silently truncating a pasted draft. Empty/whitespace text clears the message. React renders all message text literally. Editor name/time come from the API; legacy null values display “Not recorded.” Time is labelled Asia/Bangkok.

A synchronous lock and disabled controls prevent repeated submission. A successful response updates the dialog from the API record and refreshes the existing list once. No new notification system or periodic refresh is added. The dialog owns a snapshot so existing list polling cannot discard its draft on session/network errors. Closing the dialog intentionally discards the local draft; it is not persisted to browser storage.

Errors 400/401/403/404/409/413 and server/network failures have user-facing messages. A 409 triggers one authenticated detail GET, keeps the draft, and never resubmits. If reloading fails, saving is blocked until the user retries the reload. If the refreshed request is ineligible, its draft remains available to copy/cancel.

## Files

- `apps/web/src/features/manager/ManagerApprovals.tsx`: Manager entry point and stable dialog snapshot.
- `apps/web/src/features/manager/PublicMessageDialog.tsx`: editing, validation, conflict reload and inline feedback.
- `apps/web/src/features/manager/public-message-actions.ts`: independently authenticated Server Actions and safe error mapping.
- `apps/web/src/features/manager/public-message-api.ts`: server-only PATCH/detail GET helper; HttpOnly session token stays server-side.
- `apps/web/src/features/manager/public-message-rules.ts`: eligibility using actual source/approval values, independent of work status.
- `apps/web/src/lib/api.ts`, `features/requests/types.ts`, `features/requests/actions.ts`: nullable metadata types and API-to-workspace mapping.
- `apps/web/src/features/requests/PublicMessageMetadata.tsx`: staff metadata display.
- `apps/web/src/features/requests/VisitorDetails.tsx`: two-line integration of metadata into the existing staff-only public-message panel.
- `apps/web/scripts/public-message.browser.test.mjs`: real Next/UI with isolated HTTP fixtures for deterministic errors.
- `apps/web/scripts/public-message.live.test.mjs`: relevant existing API integration suites plus actual browser/API/PostgreSQL save/clear/tracking flow.
- `apps/web/package.json`: test commands only; no dependency changes.
- This handoff and `docs/development/evidence/visitor-message/*.png`.

## Coordination

No identifiable owner-3 chat/contact was available in the accessible chat inventory, so no direct coordination occurred. Owner 3 should review the two-line `VisitorDetails.tsx` integration and new metadata component. Shared Dialog, RequestTable, RequestsProvider, CSS and Visitor tracking files were deliberately left unchanged; Manager editing is isolated in its own component. Existing list polling remains as it was. No Backend issue requiring a contract/schema change was found for Q.

Owner 3 review points (acceptance is still pending):

- [ ] Review `PublicMessage` in `apps/web/src/features/requests/VisitorDetails.tsx`: the only changes are importing and rendering `PublicMessageMetadata`. This shared panel is used in authenticated staff request details and Manager review.
- [ ] Review `apps/web/src/features/requests/PublicMessageMetadata.tsx`: show the API name, fall back to the API email only when the name is absent, and show “Not recorded” when neither exists. The editor ID is carried in the model but not displayed. Do not infer identity from the decision reviewer.
- [ ] Verify `publicMessageUpdatedAt` is independently nullable, formatted in Asia/Bangkok, and never inferred from `updatedAt` or the approval time. Clearing the public text must still show the latest editor metadata returned by the API.
- [ ] Confirm staff can distinguish the public message body from staff-only editor metadata; the panel's public-visibility hint refers to the message, not its metadata. Check the copy in the shared read-only panel and the separate Manager editing dialog.
- [ ] Confirm TA sees read-only metadata without editing controls, ordinary Member-origin requests do not show the Visitor panel, and `VisitorTrack.tsx` does not import the metadata component or display these fields.
- [ ] Check long names/emails, null legacy values and layout at narrow widths; record any requested copy/layout changes before acceptance.

## Reproduction and verification

From the repository root:

```powershell
npm.cmd --prefix apps/web run lint
npm.cmd --prefix apps/web run typecheck
npm.cmd --prefix apps/web run test:contracts
npm.cmd --prefix apps/api run lint
npm.cmd --prefix apps/api run typecheck
npm.cmd --prefix apps/api run build
```

From `apps/web`:

```powershell
npm.cmd run test:public-message-browser
npm.cmd run test:public-message-live
$env:NEXT_DIST_DIR = 'build/production'
npm.cmd run build
Remove-Item Env:NEXT_DIST_DIR
```

Browser tests require installed dependencies and Chrome. Fixture tests start their own Next/API servers at 3101/4101 and do not access a database. Live tests use 3102/4102 and read the local API connection privately (or `MESSAGE_TEST_ADMIN_DATABASE_URL`), create a unique `visitor_message_<timestamp>_test` database, apply migrations, run the existing API suites, and drop only that newly created database during cleanup. The connection needs database creation permission. They never reset or delete development/demo records and do not use demo credentials. The live test generates a temporary session only in the isolated database. Screenshot capture clears the tracking code first.

Next may add test-output type paths to `tsconfig.json` when custom output directories run. Those generated additions are excluded from this delivery. Build needs network access for the existing fonts. Running tests/build in separate output directories avoids the initial output-cleanup conflict.

### Why `tsconfig.json` is not part of this change

The feature needs no compiler-option change. Next automatically appended generated-type include paths for the temporary output directories (`.next/message-browser`, `build/message-browser`, `build/message-live`, and `build/production`) during verification. Those paths are specific to local test/build output and are not required to ship the editor. The original compiler options and include list have been restored. A remaining newline-only difference was also removed using this checkout's CRLF working-tree convention (`core.autocrlf=true`); Git now reports no `tsconfig.json` change. Do not stage generated include additions merely because a local test run recreates them. Inspect the diff and remove only test-generated additions, preserving any teammate's unrelated changes.

Results:

- Web lint: PASS.
- Web typecheck: PASS.
- API lint, typecheck and build: PASS.
- Existing frontend contracts: 12 PASS.
- Production build: PASS with `NEXT_DIST_DIR=build/production`.
- API public-message suite: 8 PASS; API tracking suite: 11 PASS (19 total), exclusively on a new test database.
- Live browser + API + PostgreSQL: PASS for save, confirmed database metadata, fresh public lookup, exact five-field public response and clearing followed by another lookup.
- Fixture browser: PASS for cancel/restore, clearing, plain text, nullable metadata, 2,001-character rejection, success, failures retaining draft, session expiry, role denial, conflict reload without retry, ineligible conflict retaining draft, both final approvals across all five work statuses, and hiding controls for ineligible sources/approvals.
- Additional fixture assertions cover duplicate form submissions while pending and manual retry with the same draft after 500.

Both browser scripts report one top-level test with multiple assertions/scenarios, not one test per scenario. The final fixture rerun passed in approximately 147 seconds; the live run including the 19 API tests passed in approximately 17 seconds. Results above are from the implementation verification on 24 October 2026. The subsequent pre-commit review changed only this document and normalized `tsconfig.json`; it did not rerun or claim a new execution of the application test suites.

Initial verification issues were resolved: missing installed Playwright dependency (installed from the existing lockfile), conflicting Next output directories (separated), and asynchronous fixture transitions (waited for action completion). No production code workaround was needed for those test setup issues.

## Evidence

All records shown are synthetic fixtures; these are not real Visitor details.

- [Successful save, real API/database](evidence/visitor-message/live-saved.png)
- [Visitor sees latest message, real API/database](evidence/visitor-message/live-visitor-latest.png)
- [Successful save and literal HTML-like text, fixture API](evidence/visitor-message/saved.png)
- [Cancel, fixture API](evidence/visitor-message/cancel.png)
- [Clear, fixture API](evidence/visitor-message/cleared.png)
- [Save failure with draft retained, fixture API](evidence/visitor-message/save-error.png)
- [Visitor literal text, fixture API](evidence/visitor-message/visitor-latest.png)

The saved/cancel/clear/error and real Visitor screenshots were visually inspected. Browser automation uses Chrome on Windows. No claim is made for production deployment, mobile-device validation, other browsers, or owner-3/owner-4 acceptance. No commit or push is included.

## Owner 4 — Integration QA handoff checklist

All boxes below are intentionally unchecked: owner 2's passing results are evidence, not owner 4's independent sign-off. Record tester, date, commit SHA, commands, actual results and evidence links when completing this checklist.

- [ ] Confirm the integrated branch contains Backend PR #18 and `VISITOR-MESSAGE-API.md`; check migration status for the QA database, including both Visitor migrations. Route contract/schema/Backend issues to Q instead of changing them in this frontend task.
- [ ] Use installed lockfile dependencies, Chrome on Windows, free ports 3101/4101 and 3102/4102, and a PostgreSQL connection permitted to create an isolated test database. Run the commands above. Never run deletion-based API suites against development/demo data. Confirm the temporary test database and spawned test servers are removed after the run; investigate leftovers if a run is forcibly interrupted.
- [ ] Independently run lint/typecheck/build for both apps, 12 frontend contract tests, the fixture browser suite and the live suite (8 message + 11 tracking API tests). Save results; do not interpret the single browser-test count as a single scenario.
- [ ] Repeat approved and rejected Visitor-source cases across `pending`, `assigned`, `in_progress`, `closed` and `cancelled`. Verify no edit controls for Member-source `type: visitor`, submitted/under-review/not-required/cancelled approvals, TA or Member. Confirm approval decisions, internal reasons, assignment and work status are unchanged after edits.
- [ ] Check saved-value initialization, cancel then reopen, exactly 2,000 versus 2,001 UTF-16 units after trim (including emoji), whitespace clearing, plain-text HTML-like input, duplicate submission while pending, and manual retry after failure with the original draft intact.
- [ ] Check missing/expired/revoked session, role or membership changes, and API 400/401/403/404/413/500 errors. In addition to the existing HTTP-error fixtures, explicitly test network interruption/timeout; inspect browser requests and serialized action responses to ensure no session token is exposed to browser JavaScript.
- [ ] For 409, verify one detail reload, unchanged draft and no automatic PATCH retry. Cover refreshed eligible and ineligible records. **Additional QA needed:** make the detail GET itself fail, verify saving remains blocked, then retry the reload and confirm recovery without losing the draft.
- [ ] Complete Manager UI save → database persistence → Visitor fresh lookup, then clear → fresh lookup. Verify the public response has exactly `status`, `approvalStatus`, `publicMessage`, `visitDate`, `timeSlot`; no editor metadata, internal reason/history or extra contact data. Confirm an already-open Visitor page is not automatically pushed an update.
- [ ] Obtain owner 3's metadata/copy acceptance using the checklist above; verify legacy null metadata and latest editor/time after initial decision, edit and clear in Manager/TA read-only views.
- [ ] Check keyboard navigation, focus, loading/error announcements, dialog close behavior and narrow/mobile layout. These additional usability checks and non-Chrome browsers have not been claimed as verified by owner 2.
- [ ] Attach QA screenshots/logs under a clearly identified evidence folder, label fixture versus real API/database evidence, and remove tracking/session credentials and real personal details before sharing.
- [ ] Recheck final staged scope and secret candidates before committing; exclude `.env*`, `.demo-accounts.json`, database dumps, build outputs and automatic `tsconfig.json` edits. Record remaining issues and acceptance explicitly.

## Final pre-commit scope review

Reviewed the complete tracked diff and all untracked delivery files: 21 files with content changes/additions (14 text files and 7 PNG screenshots). No changes to `apps/api`, Prisma schema/migrations, API contract, authentication/role infrastructure, CI, lockfiles or existing public tracking code are included. `package.json` adds only two feature test commands. No unrelated file was found in this candidate set.

The review checked source/test literals and scanned candidate text files for private keys, credential-bearing URLs, common provider token formats and JWTs; no real credential was found. `synthetic-browser-session` and `synthetic-code` are intentionally fake values for the isolated HTTP fixture. The live test creates random credentials at runtime in its own newly created database, does not embed them in source, and clears the tracking field before screenshots. Environment and demo-account files, dependencies and build outputs remain ignored and are not delivery candidates. This is a scoped review of these files, not an audit of repository history or every ignored local file.

`git diff --check` passes. `tsconfig.json` has no content or status change. The feature is ready to prepare a scoped commit based on owner 2's completed checks; owner 3 acceptance and owner 4 independent Integration QA remain pending before merge/release acceptance. No files were staged, committed or pushed during this review.
