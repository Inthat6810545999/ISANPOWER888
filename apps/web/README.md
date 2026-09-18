# ISANPOWER888 Web

Next.js/TypeScript frontend with separate Member, TA, and Lab Manager workspaces. Start with the [local setup guide](../../README.md#local-setup-in-vs-code) for PostgreSQL, migrations, API startup, and local account provisioning.

## Run locally

Create `apps/web/.env.local` with `API_BASE_URL=http://127.0.0.1:4000`. From `apps/web`, run:

```powershell
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open [Sign in](http://127.0.0.1:3000/login). Credentials are generated once by `npm run seed:demo` in the API app and saved to its ignored `.demo-accounts.json`. Use separate browser profiles for simultaneous roles; tabs on the same host share a session.

## Routes and ownership

| Role | Route | Component |
| --- | --- | --- |
| Public | `/login` | `app/login/LoginForm.tsx` |
| Member | `/workspace/requests/new` | `features/request-submission/RequestSubmission.tsx` |
| Member | `/workspace/my-requests` | `features/my-requests/MyRequests.tsx` |
| TA | `/ta/queue` | `features/ta-queue/TaQueue.tsx` |
| Lab Manager | `/manager/approvals` | `features/manager/ManagerApprovals.tsx` |
| Lab Manager | `/manager/reports` | `features/manager/ManagerReports.tsx` |

`/` is the public landing page; `/open-house` is public visitor content, and `/pending` is for authenticated users awaiting membership. Internal layouts check approved membership and the verified role. Server Actions independently check permissions, and the API enforces them again. Manager does not inherit TA rights.

## Data and session flow

- `lib/session.ts` reads the HttpOnly session cookie and verifies it through `/api/auth/me`.
- `lib/api.ts` is server-only and forwards the session token as a Bearer header. Never send tokens to Client Components or localStorage.
- `features/requests/actions.ts` checks the action's role and maps API records into the UI model. No requester/actor email is accepted as authority.
- `RequestsProvider.tsx` keeps API-backed state and refreshes every four seconds while visible and on focus. Success appears only after persistence.
- `RequestTable.tsx` provides search, filters, pagination, details, and the approval decision record.
- `demo-identity.ts` supplies presentation labels for legacy email-based records only. It never grants access. Mock records are unused reference fixtures.

TA can claim/assign before approval. Start/close are shown only for the assigned TA and blocked until required approval is granted. The API repeats these checks atomically. Manager can review and report, with no work actions. A final review needs a reason; reviewer identity/time are server-generated and immutable.

Sessions support Google accounts and manually seeded local demo accounts. Google requires OAuth credentials; new Google accounts remain pending. Membership approval screens, password recovery, MFA, and distributed throttling are not implemented. See the root README for the complete limitations.

## Checks

```powershell
npm run lint
npm run typecheck
npm run test:contracts
npm run build
```

`next build` currently downloads the project's existing Google Fonts. Contract tests live in `scripts/`; they are not startup scripts. Follow the [presentation walkthrough](../../README.md#presentation-walkthrough) to verify all three roles and the approval gate.

## Google and pending membership

The current login page adds Google sign-in and Guest access. Secrets are backend-only. New users go to `/pending`; `/open-house` and the existing landing page are public. Password login remains an expandable local-demo option in development.

`SessionUser` now includes `membershipStatus`, and `role` can be `unassigned`. Use `sessionHome()` for post-login routing and `requireUser()`/`requireActionRole()` for internal access. A role by itself is insufficient; membership must also be APPROVED. Do not add a client-controlled role selector or a membership promotion action. TA and Manager request workflows are unchanged.
