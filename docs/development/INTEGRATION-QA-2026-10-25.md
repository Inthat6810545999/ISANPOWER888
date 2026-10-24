# Integration QA - 25 October 2026

Scope: CI checks and the Visitor public-message feature. This is a test record, not a claim that work on other branches is integrated.

## CI and automated checks

| Case | Expected | Actual | Result | Evidence / limit |
| --- | --- | --- | --- | --- |
| Web CI job | `npm ci`, lint, typecheck, contract tests, build on Node 24 | Job added to `.github/workflows/ci.yml` | Configured; remote run pending | No GitHub Actions run for these unpushed local changes |
| Visitor form in regular tests | Existing form tests run under `test:contracts` | 12 total contract/form cases pass with bundled Node 24 | Pass locally | `apps/web/package.json`; Node 24.22.1 test run |
| Web lint | No errors | Passed locally | Pass | `npm --prefix apps/web run lint` |
| Web typecheck/build | Pass in a clean checkout | Both pass on Node 24 after moving stale generated `.next/dev/types` out of the local checkout | Pass locally | Initial failure was a September-generated reference to removed `/admin/page`; clean CI run still pending |
| API CI job | Isolated `_test` database, API lint/typecheck/tests/build | Existing job retained unchanged | Configured; remote run pending | Do not run destructive API tests against development/demo DB |

## Integration checklist after teammate branches are merged

Record the tested commit, test database, browser profiles, expected and actual result, pass/fail, screenshots or command output, and bug ID for each case.

| Case | Expected | Current result |
| --- | --- | --- |
| Manager edits approved Visitor message | Save succeeds; approval, internal reason and work status unchanged | Pending - edit API/UI absent from this checkout |
| Manager edits rejected or closed Visitor message | Save succeeds under documented contract | Pending |
| Manager clears message | Empty string saved; fresh tracking lookup shows empty message | Pending |
| Member, TA, anonymous PATCH | 403/401; no data changed | Pending - independent security check after API merge |
| Wrong source or pending approval PATCH | Rejected without changing decision/history/status | Pending |
| Public tracking after save | Fresh lookup shows latest public message only | Pending |
| Tracking privacy | No internal reason, editor identity, contact data or session token in public response | Pending |
| Member -> Manager -> TA approval flow | Submit, approve, self-claim, start and close succeed | Pending manual smoke test |
| Rejection flow | Rejected request cannot be claimed, started or closed | Pending manual smoke test |
| UX loading/error/double-submit | Input retained on failure; buttons disabled during request; success only after API confirmation | Pending person 3 merge/review |

The current checkout contains Visitor submission and tracking, but no `PATCH /api/requests/:id/public-message` route or `docs/development/VISITOR-MESSAGE-API.md`. The integration cases above must be executed after the backend and frontend feature branches are integrated. The existing API tests belong to the backend owner; this checklist is an independent end-to-end/security review.

Before closing QA: run the clean CI workflow, attach its URL, list bugs and retest results, and replace each Pending cell with Pass/Fail plus evidence. Do not use the development or demo database for API tests; the test suite deletes records and requires a database name ending in `_test`.
