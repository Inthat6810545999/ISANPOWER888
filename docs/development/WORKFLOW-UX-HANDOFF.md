# Workflow UX — owner 3

Implemented on `features/workflow-ux`, based on main after the Visitor message API
(PR #18) and its Manager UI (PR #19) merged. Scope is the existing workflow: the
Member and Visitor submission pages, and the TA accept/start/close queue.

Out of scope and untouched: backend rules, the Manager public-message feature (owner 2),
and any wider redesign.

## What the audit found

Three of the four points in the brief were already satisfied, and are now covered by
tests rather than changed:

- **In-flight guards exist.** Member submission, the Visitor form and TA actions each
  hold a `useRef` lock set synchronously, so a double click cannot send two writes.
  Verified by firing two clicks in a single tick, where `disabled` has not yet rendered.
- **Typed input survives a failure.** Both forms keep their values on a failed save.
- **Success is only claimed after the API confirms.** The success notice comes from the
  provider after the write resolves; a failure leaves the form in place with an error.

The gaps were in how a page looks while loading or after a failed load, and in how a
rejection reads next to work progress.

## What changed

**Loading and error states (`RequestsState`, new).** `RequestsSync` already showed a
thin status line with the error text and a Refresh button, but the content area itself
rendered nothing: a failed load looked the same as an empty queue. The TA queue and
My requests now render, in the content area:

- loading with no data → a "Loading requests…" card
- failed load with no data → "We could not load your requests", the reason, and **Try again**
- failed refresh with data already on screen → a warning strip that keeps the last list
  visible and says it may be out of date, rather than blanking the page

Manager approvals has the same gap and was deliberately left alone: it is owner 2's
active file this iteration. Dropping `<RequestsState … />` under its scope switch is
all that is needed.

**Approval and work progress read separately (`StatusBadge`).** A declined request keeps
`status: "pending"`, so the old badge showed a prominent "Pending" with "Approval:
Rejected" in 9px underneath — it read as "still waiting", not "refused". The work badge
is now labelled `Work: …`, and a rejection gets its own red badge instead of a quiet note.
Other approval states keep the quiet note.

**TA action failures name the request.** The queue can show several rows and all action
buttons re-enable together, so "Unable to save this change." left it unclear what failed.
The message now reads `Assigning "<title>" did not save. <reason> You can try again below.`

**Saving is announced, not just implied.** Both submission forms set `aria-busy` and
replace their footer hint with a live "Saving your request… keep this page open." while
the write is in flight; previously only the button label changed.

## Verification

`npm run test:workflow-ux-browser` (new) drives the real UI against an isolated HTTP
fixture with controlled latency and failures — no database, no real accounts or tokens.
It covers the four cases the brief asks for:

| Case | Expected | Result |
| --- | --- | --- |
| Slow load | "Loading requests…" card, not an empty queue | pass |
| Failed load | Explanation + working **Try again** | pass |
| Double click on Assign to myself | exactly one PATCH | pass |
| Failed TA action | error names the request, button usable again | pass |
| Double submit of a request | exactly one POST | pass |
| Failed submit | error shown, typed title and description preserved, button usable | pass |
| Declined + pending | "Work: Pending" and "Approval: Rejected" both visible | pass |

Evidence screenshots: `docs/development/evidence/workflow-ux/`.

Other gates, all passing: API `npm test` 124; web `test:contracts` 12;
`test:public-message-browser` (owner 2) 1; `test:tracking-browser` 9 on the isolated
3100/4100 setup; `scripts/visitor-request.test.mjs` 6; lint, typecheck and build for
both apps.

## Notes for the team

- **Shared files touched:** `RequestTable.tsx` (StatusBadge), `workspace.module.css`
  (three added classes). Owner 2 did not touch either this iteration, so there is no
  overlap, but both are shared — please re-check if you are editing them.
- `scripts/visitor-request.test.mjs` still is not part of `test:contracts`, so it only
  runs when invoked directly. Folding it in is on owner 4's list.
- The sync bar's **Refresh requests** and the new **Try again** now both retry the same
  load. The sync bar is pre-existing and shared, so it was left as is; if the team wants
  one control, that is a small follow-up.
