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
- Google login with opaque database sessions and pending membership for new accounts; password login remains available for seeded local demo accounts.
- Server Actions validate the required role and call the server-only API client.
- Shared request provider, live refresh, loading/errors, details, and approval audit records. Mock records are reference fixtures only.
- Work and approval states are independent. Required approval gates both start and close. See the [status contract](REQUEST-STATUS-CONTRACT.md).
- `/` and `/open-house` are public. Pending accounts are directed to `/pending` and cannot access internal pages or request APIs.

## US-3 queue behavior

- TA Queue starts in **Active requests**: Pending, Assigned and In progress. Pending work remains visible when approval is submitted or rejected; approval is shown separately and still gates actions.
- **Ready to accept** keeps the approved, unassigned queue. **Assigned to me** shows the current TA's active work.
- **Closed history** shows completed work. Closing a request moves the TA to this view. Cancelled records remain available in **All requests**, but never in Active requests.
- Shared request tables support newest first, due date, category label A–Z, priority High → Medium → Low, and work status Pending → Assigned → In progress → Closed → Cancelled. Ties use newest creation time, then ID.
- Search and filters apply before sorting and pagination. Sorting/filter changes reset to the first page. Lists still load the authorized records client-side.
- This update changes the frontend only; no database migration is needed.

## Follow-up work for teammates

- Extend login/account lifecycle without reintroducing client email/role authority. Membership approval, role changes, activation and audit history are implemented in [US-10](US10-MEMBER-MANAGEMENT.md). Recovery and MFA remain future work.
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
