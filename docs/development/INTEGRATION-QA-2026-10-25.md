# Integration QA - 25 October 2026

Scope: CI checks and the Visitor public-message feature. This is a test record, not a claim that work on other branches is integrated.

## CI and automated checks

| Case | Expected | Actual | Result | Evidence / limit |
| --- | --- | --- | --- | --- |
| Web CI job | `npm ci`, lint, typecheck, contract tests, build on Node 24 | All steps passed in GitHub Actions run 40133102095 | Pass | https://github.com/Inthat6810545999/ISANPOWER888/actions/runs/40133102095 |
| Visitor form in regular tests | Existing form tests run under `test:contracts` alongside status and tracking contracts | 18 cases pass with Node 24.22.1 | Pass locally | `apps/web/package.json`; command output |
| Web lint | No errors | Passed locally | Pass | `npm --prefix apps/web run lint` |
| Web typecheck/build | Pass in a clean checkout | Both pass on Node 24 after moving stale generated `.next/dev/types` out of the local checkout | Pass locally | Initial failure was a September-generated reference to removed `/admin/page`; clean CI run still pending |
| API CI job | Isolated `_test` database, API lint/typecheck/tests/build | All steps passed in GitHub Actions run 40133102095 | Pass | https://github.com/Inthat6810545999/ISANPOWER888/actions/runs/40133102095 |
| Visitor message, tracking and core workflow API security | Only eligible Manager edits; wrong roles denied; public response has limited fields; approval and rejection gates work | 40 API cases pass across message, tracking and request routes in a uniquely named `_test` database | Pass locally | `npm --prefix apps/web run test:public-message-live` runs all three suites before the browser flow |
| Manager to Visitor live flow | Manager save; fresh Visitor lookup; clear and refresh | Live API + browser test passes on Node 24 | Pass locally | `apps/web/scripts/public-message.live.test.mjs`; isolated DB created and dropped; existing evidence screenshots refreshed |
| Member/Visitor/TA workflow UX | Loading, failure, retry and duplicate actions are handled; rejection and pending work read separately | Person 3's browser fixture test passes after PR #21 was merged into this QA branch | Pass locally | `npm --prefix apps/web run test:workflow-ux-browser`; screenshots in `docs/development/evidence/workflow-ux/` |

## Integration checklist after teammate branches are merged

Record the tested commit, test database, browser profiles, expected and actual result, pass/fail, screenshots or command output, and bug ID for each case.

| Case | Expected | Current result |
| --- | --- | --- |
| Manager edits approved Visitor message | Save succeeds; approval, internal reason and work status unchanged | Pass - focused API and live browser tests |
| Manager edits rejected or closed Visitor message | Save succeeds under documented contract | Pass - focused API test |
| Manager clears message | Empty string saved; fresh tracking lookup shows empty message | Pass - live browser test |
| Member, TA, anonymous PATCH | 403/401; no data changed | Pass - focused API test |
| Wrong source or pending approval PATCH | Rejected without changing decision/history/status | Pass - focused API test |
| Public tracking after save | Fresh lookup shows latest public message only | Pass - live browser test |
| Tracking privacy | No internal reason, editor identity, contact data or session token in public response | Pass - focused API and live browser tests |
| Member -> Manager -> TA approval flow | Submit, approve, self-claim, start and close succeed | Pass - isolated API workflow test; browser UI smoke remains to be done |
| Rejection flow | Rejected request cannot be claimed, started or closed | Pass - isolated API workflow test; browser UI smoke remains to be done |
| UX loading/error/double-submit | Input retained on failure; buttons disabled during request; success only after API confirmation | Pass - browser fixture test after PR #21 merge |

The backend and frontend feature branches are integrated in the tested checkout. The focused API cases belong to the backend owner; this is an independent integration run of those tests and the live browser flow. A macOS cleanup defect in the live test was fixed in `apps/web/scripts/public-message.live.test.mjs`; the earlier interrupted run left an isolated test database, which was removed. The passing rerun created and dropped a new isolated database.

Before closing QA: complete the original Member/Manager/TA browser UI smoke paths with a running database and record evidence. Do not use the development or demo database for API tests; the test suite deletes records and requires a database name ending in `_test`.
