# Visitor staff views and messages — owner 4

Implemented on `features/visitor-staff-views`, based on main after the Visitor form
(PR #13), backend (PR #14), tracking (PR #15) and tracking links (PR #16) merged.
`VISITOR-FORM-HANDOFF.md`, `VISITOR-BACKEND-HANDOFF.md` and `VISITOR-TRACK-HANDOFF.md`
remain authoritative for fields, receipts and the public contract.

This document records what owner 4 reviewed and implemented. It does not imply
owners 1–3 have accepted it.

## Visitor wording: reviewed and accepted

Owner 3's visitor-facing labels are accepted without change. They are the only
labels a Visitor sees, and they live in `apps/web/src/features/visitor-track/contract.ts`.

| Real value | Visitor reads | Accepted because |
| --- | --- | --- |
| status pending | Awaiting processing | Says nothing has started without implying refusal |
| status assigned | Assigned to lab staff | Names a person-shaped step, not an internal queue |
| status in_progress | In progress | Plain and unambiguous |
| status closed | Closed | Neutral; does not claim the visit happened |
| status cancelled | Request cancelled | Distinct from a declined decision |
| approval submitted | Awaiting review | Separates "not looked at yet" from "refused" |
| approval under_review | Under review | — |
| approval approved | Approved | Paired with the booking disclaimer below |
| approval rejected | Request declined | Softer than "rejected" and still unambiguous |
| approval cancelled | Approval cancelled | — |
| approval not_required | Approval not required | — |

One label **was** changed: the scheduling note under the result.

Previously every state showed "This is the date and time you requested. It is not a
confirmed appointment." Next to **Approved** that reads as a refusal, which confused a
reviewer during the walkthrough. It now varies (`scheduleNote` in
`apps/web/src/features/visitor-track/contract.ts`):

- approved → "The lab has accepted your request. This is still the date and time you
  asked for — the lab will contact you to confirm the exact time."
- every other state → unchanged.

This keeps both truths visible: the lab agreed to host, and no slot is reserved. The
alternative, a real confirmation step, needs a stored confirmed date/slot and an
endpoint to set it — owner 2's area, and out of scope here. Until then, a specific
confirmed time belongs in `publicMessage`. Owner 3 owns this page; the wording change
is owner 4's call under this handoff, and it updated one assertion in
`scripts/visitor-track.browser.test.mjs` plus a new `test:contracts` case.

Two rules this depends on, both verified:

- **Approved never means a confirmed appointment.** The requested date and slot are
  preferences in Asia/Bangkok. The tracking page says so, and the staff views repeat it
  so staff do not promise a booking the system never made.
- **Rejection stays visible while work status is still `pending`.** A declined request
  keeps `status: pending`, so showing only the work status would read as "Awaiting
  processing" to someone who was actually declined. Both statuses are always shown.

## publicMessage: editorial guidance

`publicMessage` is the **only** free text a Visitor can read. `reason` and
`decisionHistory` are internal and are never copied into it, in either direction.

Write it for someone outside the lab:

- Say what happens next and who to contact. A Visitor cannot see the queue.
- Give arrival instructions on approval: where to go, what to bring, who to ask for.
- On a decline, give the actionable part only ("the lab is unavailable that week;
  please request a date after 1 December"), never the internal cause.
- Do not paste the internal reason. Do not name other requesters, staffing problems,
  budget lines, security arrangements or audits.
- Plain text only. It is rendered as text, never as HTML.
- Omitting the field keeps the stored message; submitting an empty field clears it.
  Both are surfaced in the form hint.

Members do not read this field, so the UI only sends it for `source: "visitor"`.

## Staff views

Manager review and the shared request detail dialog now show, for Visitor requests only:

- A staff-only panel: contact name, email, phone, organization, requested date and
  slot in Asia/Bangkok, visitor count, requested host, purpose, details and
  arrangements, plus the "not a confirmed booking" note.
- The current public message, in its own panel, labelled as publicly visible.
- The approval reason, labelled explicitly as internal and never shown to the requester.

Lists mark Visitor rows "External visitor", because a Member can also file a request
of type `visitor`; source and type are not the same thing. Visitor identity is read
from `visit.contactName` and `visit.email`, because `requesterEmail` is empty by design
for Visitors and must never be treated as identity.

Manager review gained an optional "Message to the requester (public)" field alongside
the existing required internal reason, sent through the existing
`PATCH /api/requests/:id/approval-status`. No new endpoint, permission, schema or
helper was added. TA claim/start/close keep their approval-first, assigned-TA-only
gates; TAs can read the message panel but cannot write it.

## Verification

Full path exercised against a running API, database and browser:

- Visitor submits → Manager approves with a public message → TA claims, starts and
  closes → Visitor tracking shows each status change. Verified through the real UI
  (Playwright, Chrome) for the Manager decision, and over HTTP for the rest.
- Rejection path: Manager declines with a public message → TA claim is refused with
  409 → Visitor sees `pending / rejected` with the declined heading.
- Internal leak check on every decided request: tracking returns exactly
  `status, approvalStatus, publicMessage, visitDate, timeSlot`, and no internal
  wording from the reason appears anywhere in the public response.
- Gates: API `npm test` 116 passed; web `test:contracts` 11 passed;
  `test:tracking-browser` 9 passed against the isolated ports 3100/4100 and a
  dedicated `_test` database; lint, typecheck and build pass for both apps.

## Not done

- No separate message-editing endpoint: the message can currently only be written as
  part of a review decision. Editing it after a final decision would need owner 2,
  since final decisions are immutable by design.
- No notification to the Visitor when the message changes; they must revisit tracking.
- Production proxy/client-IP handoff and submission idempotency remain open from
  owners 2 and 3.
