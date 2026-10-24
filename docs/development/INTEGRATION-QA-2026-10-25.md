# Integration QA - 25 October 2026

Scope: CI checks and the Visitor public-message feature. This is a test record, not a claim that work on other branches is integrated.

## CI and automated checks

| Case | Expected | Actual | Result | Evidence / limit |
| --- | --- | --- | --- | --- |
| Web CI job | `npm ci`, lint, typecheck, contract tests, build on Node 24 | Job added to `.github/workflows/ci.yml` | Configured; remote run pending | No GitHub Actions run for these unpushed local changes |
| Visitor form in regular tests | Existing form tests run under `test:contracts` alongside status and tracking contracts | 18 cases pass with Node 24.22.1 | Pass locally | `apps/web/package.json`; command output |
| Web lint | No errors | Passed locally | Pass | `npm --prefix apps/web run lint` |
| Web typecheck/build | Pass in a clean checkout | Both pass on Node 24 after moving stale generated `.next/dev/types` out of the local checkout | Pass locally | Initial failure was a September-generated reference to removed `/admin/page`; clean CI run still pending |
| API CI job | Isolated `_test` database, API lint/typecheck/tests/build | Existing job retained unchanged | Configured; remote run pending | Do not run destructive API tests against development/demo DB |
| Visitor message and tracking API security | Only eligible Manager edits; wrong roles denied; public response has limited fields | 19 focused API cases pass in a uniquely named `_test` database | Pass locally | `npm --prefix apps/web run test:public-message-live` runs both focused suites before the browser flow |
| Manager to Visitor live flow | Manager save; fresh Visitor lookup; clear and refresh | Live API + browser test passes on Node 24 | Pass locally | `apps/web/scripts/public-message.live.test.mjs`; isolated DB created and dropped; existing evidence screenshots refreshed |

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
| Member -> Manager -> TA approval flow | Submit, approve, self-claim, start and close succeed | Pending manual smoke test |
| Rejection flow | Rejected request cannot be claimed, started or closed | Pending manual smoke test |
| UX loading/error/double-submit | Input retained on failure; buttons disabled during request; success only after API confirmation | Pending person 3 merge/review |

The backend and frontend feature branches are integrated in the tested checkout. The focused API cases belong to the backend owner; this is an independent integration run of those tests and the live browser flow. A macOS cleanup defect in the live test was fixed in `apps/web/scripts/public-message.live.test.mjs`; the earlier interrupted run left an isolated test database, which was removed. The passing rerun created and dropped a new isolated database.

Before closing QA: run the clean CI workflow, attach its URL, complete the original Member/Manager/TA smoke paths and UX review, and replace each remaining Pending cell with Pass/Fail plus evidence. Do not use the development or demo database for API tests; the test suite deletes records and requires a database name ending in `_test`.
