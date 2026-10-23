# Visitor public-message editing — Q backend handoff

Branch: `features/visitor-message-api`. Owner: Q (คิว). Frontend implementation
belongs to owner 2; integration QA and CI belong to owner 4.

## API contract

`PATCH /api/requests/:id/public-message`

Headers: `Authorization: Bearer <session token>`, `Content-Type: application/json`.
Use the existing server-side session/API client; do not expose the token to browser JavaScript.

Only active, approved Lab Managers may call this endpoint. The request must have
`source: "visitor"` and `approvalStatus: "approved" | "rejected"`.
`type: "visitor"` alone is insufficient: Members can submit that request type too.
There is no work-status restriction: decided requests can be edited while pending,
assigned, in progress, closed or cancelled. This never reopens work or reverses a decision.

Request body (required field, no additional fields):

```json
{ "publicMessage": "Please meet at reception." }
```

- Trim outer whitespace; maximum 2,000 UTF-16 code units after trimming, matching
  the existing approval form API validation.
- Empty string or whitespace-only text clears the message.
- Missing, null, non-string, oversized or extra fields return 400.
- Plain text only: the API stores text, including characters such as `<` and `>`.
  Render it as text in React; never use `dangerouslySetInnerHTML`.
- Reviewer identity, timestamps, approval and work fields cannot be supplied by the caller.

Success: HTTP 200, `Cache-Control: no-store`, `{ "data": <updated request> }`.
The data is the same full request representation returned by the existing detail
and approval endpoints, including `visit`, `decision`, and `decisionHistory`.
It excludes tracking credentials. The following is a **subset** of the response:

```json
{
  "data": {
    "id": "request-id",
    "source": "visitor",
    "publicMessage": "Please meet at reception.",
    "publicMessageUpdatedById": "verified-manager-id",
    "publicMessageUpdatedByName": "Manager Name",
    "publicMessageUpdatedByEmail": "manager@example.test",
    "publicMessageUpdatedAt": "2026-10-23T15:00:00.000Z"
  }
}
```

These four metadata fields also appear in authenticated request list/detail
responses. They are nullable for existing messages with no recorded editor.
They are snapshots of the latest writer, not a full message revision history.
Timestamps are server-generated UTC ISO strings; format them for display in the UI.
When a Visitor message is supplied during the initial approval/rejection, that
existing endpoint records the same metadata. Omitting it leaves metadata unchanged.

| Status | Meaning / response |
| --- | --- |
| 200 | Updated request in `{ data }` |
| 400 | `{ "error": "Validation failed", "details": [...] }`; malformed JSON uses `{ "error": "Invalid JSON body" }` |
| 401 | Missing/invalid/expired/revoked session or inactive account; `{ error: string }` |
| 403 | Wrong current database role or pending membership; `{ error: string }` |
| 404 | `{ "error": "Lab request not found" }` |
| 409 | `{ "error": "Only approved or rejected visitor requests can have their public message edited." }` |
| 413 | `{ "error": "Request body too large" }` for the existing JSON parser limit |
| 500 | `{ "error": "Internal server error" }` for unexpected storage/server failures |

The normal CORS policy still applies. Authentication and role checks run before
record lookup; validation runs before the eligible-record update.

## Consistency and privacy

Message, latest editor snapshots and timestamp are written together in a
transaction with an atomic source/approval eligibility check. `updatedAt` also
changes. Approval status, work status, assignment, reason, current decision and
decision history are preserved.

Concurrent valid edits use last-write-wins; no version conflict UI is required in
this iteration. Re-saving the same message refreshes editor metadata. There is no
message revision history, notification or automatic push to an already-open page.

Public `POST /api/visits/track` remains unchanged and returns exactly:
`status`, `approvalStatus`, `publicMessage`, `visitDate`, `timeSlot`.
It reads the latest persisted message on the next lookup. It must never expose
editor identity/timestamps, internal reasons, decision history or contact details.

## Frontend owner checklist

1. Extend request types for the four nullable metadata fields above.
2. Add a server-only API helper and authenticated Server Action following existing patterns.
3. Show edit controls only to Managers for eligible Visitor-source requests.
4. Label the text as public; keep it separate from internal approval reasons.
5. Provide Save/Cancel, disable duplicate submissions while saving, preserve draft
   on failure, and use returned data on success. Cancel restores the saved value.
6. Explain that empty text clears the message. Show unknown editor/time gracefully
   for old messages; never infer missing metadata from the original decision.
7. For 409, refresh the request and explain the action is no longer available.
8. Verify tracking with a fresh lookup after editing and clearing.

## Migration / local setup

Migration `20261023000000_visitor_message_editor` adds four nullable columns only.
It does not reset requests, rewrite decisions or invent metadata for existing data.
After pulling, stop the API and run from `apps/api`:

```sh
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Do not use `prisma migrate reset`. The development/demo database was not migrated
by this task. The migration was applied successfully in the isolated test database.

## Verification — 23 October 2026

- API lint, typecheck and build: PASS.
- Full API integration suite: **124 tests / 9 files passed**, including 8 new tests
  in `src/routes/visitorMessageRoutes.test.ts`.
- Database: isolated temporary PostgreSQL 18 server on local port 55439,
  database `isanpower_message_api_test`; no existing development/demo data used.
- The temporary server was stopped after verification.

New cases cover approved/rejected edits, initial/latest editor metadata, text
boundaries and clearing, malformed/forged fields, missing/expired/revoked sessions,
pending/inactive/demoted accounts, cross-role denial, missing/ineligible requests,
all work states, concurrent edits, unchanged decisions and exact public HTTP response keys.
Existing API regression tests also passed.

Owner 4 should independently verify these boundaries and the complete browser flow
after owner 2's UI is integrated. No UI/browser tests, frontend changes, CI/CD changes,
commit or push are included in this backend delivery.
