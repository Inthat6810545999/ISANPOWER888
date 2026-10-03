# Visitor request form — Iteration 3

Implemented frontend: Continue as Guest → `/open-house` → `/visit/request` → review → confirmed receipt. Public, no login needed. English copy follows the existing app. Dates and time slots use Asia/Bangkok. Form state is memory-only and survives validation/API errors, but not refresh or navigation. Success requires a confirmed API response; no mock success or locally generated tracking code.

## Backend contract proposed for integration

The Next.js public Server Action sends `POST ${API_BASE_URL}/api/visits` without a session or Authorization header. This endpoint is **not implemented in this branch**. Backend owner should agree on the following contract before integration.

JSON fields: `contactName` (1–120), `email` (valid, max 254), `phone` (optional, max 40), `organization` (optional, max 200), `purpose` (`tour|study|collaboration|other`), `details` (1–4000), `visitDate` (real YYYY-MM-DD, not before today in Bangkok), `timeSlot` (`morning|afternoon`), `visitorCount` (positive safe integer, includes contact), `requestedHost` (optional, max 200), `arrangements` (optional, max 1000). Optional fields are empty strings when omitted by the visitor. Morning means 09:00–12:00 and afternoon 13:00–16:00 Thailand time; these are requested windows, not inventory-backed reservations.

Only after committing the request and its tracking credential, return HTTP 201:

```json
{ "data": { "requestId": "persisted-request-id", "trackingCode": "server-generated-secret-code" } }
```

Receipt accepts a nonempty request ID up to 200 characters and a code of 12–128 ASCII letters, digits, underscores or hyphens. This is a transport format, not an entropy guarantee: backend must generate a cryptographically random secret with sufficient entropy. No sequential codes. Store a hash for lookups. Do not log credentials.

400/422: validation failure. 429: rate limited. 404/501/503: service unavailable. Unconfirmed/network/malformed receipt responses never display success. Backend should add idempotency before real deployment to address a saved request whose response is lost; the UI only prevents concurrent clicks, not repeat submissions across tabs or retries.

Repeat all validation at the API boundary, rate-limit public submissions and tracking, and set status/approval/priority on the server. Never accept client role or approval fields. Unverified visitor email must not grant ownership through existing member email-based queries; distinguish external requests from member requests. Keep contact details and internal notes out of tracking responses.

## Remaining owners / dependencies

- Backend: persistence, tracking-code generation, API validation/abuse controls, integration with approval workflow.
- Tracking owner: `/visit/track` and public status API. This branch deliberately does not add a broken link to a missing page. Success currently provides code copying and a summary; add the tracking link once the route exists.
- Manager/TA owner: visit details in their queues and external-facing decision messages.
- Product: confirm opening windows, capacity rules, and how the lab handles unavailable requested times.

## Manual acceptance

1. Continue as Guest → Request a lab visit opens the public form without login.
2. Empty/whitespace name or details, invalid email, past/invalid date, missing purpose/time and fractional/zero/negative headcount show inline errors and focus the first invalid field.
3. A valid form opens review. Edit preserves all values. Optional fields can be blank.
4. With the current API (no visit endpoint), sending shows unavailable and retains details. No success/code appears.
5. With an integrated API returning the documented persisted 201 receipt, success shows the code and visit summary; copy works, with a manual-copy fallback.
6. Rejected, rate-limited, unreachable or malformed responses never show success. Double-click sends once while pending.
7. Check keyboard navigation and narrow/mobile layout. Refresh after success intentionally clears the receipt; the visitor is prompted to save their code.
