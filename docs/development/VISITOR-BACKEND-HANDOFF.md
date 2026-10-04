# Visitor backend — owner 2

Implemented on `features/visitor-backend`, based on the merged Visitor form on main.
The field/receipt contract in VISITOR-FORM-HANDOFF.md remains authoritative.
This document records the implemented backend contract for owners 1, 3 and 4;
it does not imply those owners have reviewed or accepted it yet.

## Submit and persistence

Public `POST /api/visits` accepts the documented JSON fields, without authentication.
Optional strings can be absent or empty. Strings are trimmed. All unknown fields,
including identity, role, priority, status and publicMessage, are rejected.
Validation uses the current Bangkok date; dates are real calendar dates. Counts
must be positive safe integers (stored as double precision to preserve the full
JavaScript safe integer range, not a 32-bit SQL integer).

One Prisma nested write atomically inserts:

- `LabRequest`: source=`visitor`, type=`visitor`, status=`pending`,
  approvalStatus=`submitted`, requiresApproval=true, priority=`medium`.
- `VisitDetails`: all form fields; requestId is the one-to-one foreign key.
- `VisitTrackingCredential`: requestId and a unique SHA-256 codeHash only.

`requesterEmail` stays an empty string for Visitors for compatibility with existing
staff clients. Contact email is only in `visit.email`. It is never used as identity.
Existing records and authenticated member submissions have source=`member`.
Member list/detail reads additionally require source=`member`, regardless of email.
Do not infer source from type: members can also submit requests of type `visitor`.

visitDate is the requested local YYYY-MM-DD, timeSlot is morning/afternoon.
neededBy is the requested window start (09:00 or 13:00 Asia/Bangkok) as a UTC instant.
These are preferences, not confirmed capacity reservations.

Only after commit: HTTP 201 `{ "data": { "requestId": "...", "trackingCode": "..." } }`.
The receipt has Cache-Control: no-store. No token/contact payload is logged by the
submission handler. Validation=400, oversized JSON=413, rate limit=429 with
Retry-After, persistence/rate-limit storage unavailable=503. No receipt on failure.

## Owner 3: tracking

Use `findPublicVisit(code)` from `apps/api/src/visits/contract.ts`.
Codes are 32 cryptographically random bytes encoded as 43-character base64url,
case-sensitive and unpadded. Hash the exact UTF-8 code with SHA-256, lowercase hex.
No lowercasing or alternate normalization. The helper returns null for malformed
or unknown codes, and otherwise only:

```
{ status, approvalStatus, publicMessage, visitDate, timeSlot }
```

Use approvalStatus to distinguish rejection from a still-pending work status.
Never serialize LabRequest, VisitDetails, decision/history, contact data, or the
credential row into public responses. Do not use requestId as a tracking secret.

Owner 3 still owns the HTTP tracking route, `/visit/track`, uniform wrong-code
responses, no-store response headers and applying `publicRateLimit` to lookups.
The helper is ready; no public tracking route has been added in this branch.

## Owner 4: staff views and messages

Existing protected request list/detail responses now include `source`,
`publicMessage` and `visit` (null for ordinary member requests). They never include
the tracking relation/hash. Render Visitor identity from visit.contactName and
visit.email, rather than the empty requesterEmail. Keep this information staff-only.

Existing manager PATCH `/api/requests/:id/approval-status` accepts optional
`publicMessage` (trimmed, max 2000) alongside approvalStatus and required reason.
Approval, internal decision record and publicMessage update in the same transaction.
`reason` and decisionHistory remain internal; they are never copied to publicMessage.
Omission preserves the current public message; empty string explicitly clears it.
Existing clients remain compatible. Final reviews remain immutable.

TA claim/start/close endpoints retain their approval-first, assigned-TA-only gates.
No visitor-specific bypass or new TA permissions were added. Owner 4 still owns
staff UI adaptation and any separately designed progress-message editing endpoint.

## Rate limits and deployment

Submission: 10 attempts per 60-second fixed window per socket client IP. Invalid
schema submissions count. Counters live in PostgreSQL, shared across API instances,
and expired buckets are cleaned up. Arbitrary X-Forwarded-For is ignored.
The current frontend calls from a Next.js server, so users behind that server share
its bucket. Before production, owners 1/2 must configure a trusted ingress/client-IP
handoff and appropriate limits; do not simply enable trust proxy for arbitrary peers.

Idempotency is not implemented: identical retries create separate requests. The
form currently sends no idempotency key. Before real deployment, owners 1/2 must
agree on a stable per-submission key and a secure replayable receipt design, as
required by the original handoff's lost-response warning. Do not retry automatically.

Apply from apps/api after reviewing DATABASE_URL:

```
npx prisma migrate deploy
npx prisma generate
npm run build
```

Migration adds tables/columns and preserves existing requests. It has been applied
only to the isolated test database during this task, not to the application database.

## Verification

Integration tests cover persisted receipts/hash-only storage, invalid/privileged
fields, Bangkok midnight, large safe integers, matching-email Member isolation,
staff responses without credentials, approval/TA ownership, rejection, public
allowlists, shared rate limits, malformed/oversized bodies and storage failure.
Run against a dedicated database whose name ends in `_test`:

```
DATABASE_URL=postgresql://USER@localhost:5432/isan_visitor_backend_test npm test
npm run typecheck
npm run lint
npm run build
```
