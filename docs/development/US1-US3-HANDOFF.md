# Feature handoff: Member, TA, and Lab Manager

The shared Next.js/TypeScript frontend uses Express, Prisma, and PostgreSQL. Follow the [local guide](LOCAL-DEMO.md) to run without Docker.

| Feature | Route | Directory |
| --- | --- | --- |
| US-1 Submission | `/workspace/requests/new` | `apps/web/src/features/request-submission/` |
| US-2 My Requests | `/workspace/my-requests` | `apps/web/src/features/my-requests/` |
| US-3 TA Queue | `/ta/queue` | `apps/web/src/features/ta-queue/` |
| Manager decisions/reports | `/manager/approvals`, `/manager/reports` | `apps/web/src/features/manager/` |
| Login | `/login` | `apps/web/src/app/login/`, `apps/api/src/auth/` |

## Shared implementation

- Protected layouts and separate navigation for all three roles; Manager has no TA inheritance.
- API role checks on every endpoint, session-derived actors, Member ownership filtering, and active TA assignment targets.
- Password login with opaque database sessions; seeded demo accounts are provisioned once with random passwords.
- Server Actions validate the required role and call the server-only API client.
- Shared request provider, live refresh, loading/errors, details, and approval audit records. Mock records are reference fixtures only.
- Work and approval states are independent. Required approval gates both start and close. See the [status contract](REQUEST-STATUS-CONTRACT.md).
- Legacy unrestricted root form removed; `/` now selects the verified user's workspace.

## Follow-up work for teammates

- Extend login/account lifecycle without reintroducing client email/role authority. SSO, recovery, MFA, and user administration remain future work.
- Add server-side pagination if data volume grows; current list/search/filter UI loads the authorized request list.
- Agree on cancellation, reopening, and historical decision correction rules before adding actions; final decisions are currently immutable.
- Preserve session and approval checks on new Server Actions and API endpoints. Hiding a button is not authorization.
- Preserve both status fields and audit snapshots when changing request models.

For simultaneous presentation roles use separate browsers/profiles, not normal tabs sharing a cookie. Never commit environment files or `apps/api/.demo-accounts.json`.

## Branch workflow

After the shared changes are merged:

```powershell
git switch main
git pull --ff-only origin main
git switch -c features/your-feature
```

Coordinate changes to schema/migrations, sessions, shared types, providers, API clients, and CSS. Run lint/typecheck/build, frontend contract tests, and API tests against a separate `_test` database. Check the full Member → TA claim → Manager approve → assigned TA start/close → Member flow, rejection, and denied cross-role access before a pull request.
