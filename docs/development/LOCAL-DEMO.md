# Local presentation demo: Member, TA, and Lab Manager

Follow the [root setup guide](../../README.md#local-setup-in-vs-code) for PostgreSQL, environment files, migrations, and the two VS Code terminals. No Docker or custom startup script is required.

## Upgrade an existing local database

Stop the API with Ctrl+C. From `apps/api`:

```powershell
npm ci
npx prisma generate
npx prisma migrate deploy
npm run seed:demo
npm run dev
```

Run `seed:demo` once only. If accounts or `apps/api/.demo-accounts.json` already exist, preserve them and use the original credentials. The migration adds users, sessions, and approval decisions without resetting requests. Existing final approval states remain intact; the migration does not invent past reviewer identities.

In a separate terminal, from `apps/web`:

```powershell
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open [login](http://127.0.0.1:3000/login). Read the generated credentials privately from `apps/api/.demo-accounts.json`, which is ignored by Git. `.env` and `.env.local` also stay local. Each teammate provisions accounts against their own database.

## Browser setup

Use separate browser profiles or different browsers for simultaneous Member, TA, and Manager sessions. Normal tabs on the same host share the session cookie. A single browser also works if you sign out and sign in as each role sequentially.

| Account | Workspace |
| --- | --- |
| `member@isanpower.test` | My Requests / New Request |
| `ta@isanpower.test` | TA Queue |
| `ta2@isanpower.test` | TA Queue; second assignment target |
| `manager@isanpower.test` | Approvals / Dashboard and Reports |

All accounts have independently generated passwords, not a common default password. Roles are read from the database through a verified session. The login form has no role selector.

## Manual verification checklist

1. Member submits a new request requiring approval; verify saved success, Pending work, and Awaiting approval.
2. TA sees the same ID, claims it or assigns another TA. Work becomes Assigned; starting is disabled with an approval message.
3. Manager sees request details and reviews it with a required reason. Verify Approved, reviewer identity, and timestamp; work must remain Assigned.
4. Assigned TA starts and closes it. Member sees the updates and the unchanged approval decision.
5. Repeat with Reject. TA must not start or close successfully; rejection reason stays visible.
6. Submit a request without approval. TA can claim, start, and close normally.
7. Manager opens Dashboard / Reports, refreshes, filters creation dates in UTC, and exports the aggregate CSV.
8. Open another role's URL directly; it must redirect to the signed-in role's workspace. Signed-out pages must redirect to login.
9. Sign out, then use browser Back/refresh; protected data must require a session. Previously rendered browser content is not proof of active access.
10. Stop the API and try a save; an error must appear without a false success. Restart and refresh.

The API integration suite independently tests denied cross-role actions, forged identity fields, ownership, expired/revoked sessions, races, and attempts to bypass approval via `/status`. Run it only against a dedicated database ending in `_test`; it deletes test users, sessions, decisions, and requests.

## Scope

Local demo accounts now use password authentication and server/API role enforcement. They are still seeded presentation accounts. SSO, password recovery, user administration, MFA, distributed throttling, and production deployment hardening are not part of this feature. Manager never inherits TA privileges. See [the status contract](REQUEST-STATUS-CONTRACT.md) for transition details.

## Verification record (2026-09-13)

- API integration suite: 19 cases passed against an isolated PostgreSQL 16 test database, including denial matrices and parameterized approval-gate checks.
- Frontend status contracts: 4 passed. API/web lint, typecheck, and production builds passed.
- Browser: Member password login and submission; Member-to-Manager URL denial; TA claim with disabled start while awaiting approval; Manager approve with reason; Manager-to-TA URL denial; assigned TA start/close; Member details retained the approval, reason, reviewer, and time. Manager dashboard rendered database aggregates.
- API tests verified rejection, report date boundaries, session expiry/logout, forbidden API actions, and concurrent decisions. These checks do not constitute a production security audit.
- The additive migration was applied to `isanpower_local`. Existing requests were preserved. One clearly labelled `Role workflow verification — local demo` request was created through the UI and left closed as a presentation example.
