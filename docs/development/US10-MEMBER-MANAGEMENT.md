# US-10: Lab Manager member management

Actor: **Lab Manager**, with approved membership and an active account. There is no Admin role. The screen is `/manager/members` (Member management).

## Behavior

- Lists registered accounts, including pending and inactive users. Search by name/email; combine role and account-status filters. Client-side pagination shows ten accounts per page.
- Approves a pending, active Google registration and assigns Member, TA or Lab Manager. Approval records the reviewer and time.
- Changes an approved member's role. API authorization reads the current database role on each request, so existing sessions use the new permissions. Changing one's own role redirects to the new workspace.
- Deactivates/reactivates accounts without deleting accounts, requests, assignments or request history. Deactivation requires an explicit confirmation in the UI and deletes all existing sessions. Reactivation preserves the role and membership state and requires a new sign-in; it does not approve a pending account.
- At least one active, approved Lab Manager must remain. The API serializes membership writes, rechecks the acting manager inside the transaction, and enforces this rule even for concurrent changes or forged requests. The UI disables changes to the last manager as an additional convenience.
- Changes use `membershipVersion` to reject stale edits with HTTP 409. Refresh before retrying; an old tab cannot overwrite a newer role or activation state.
- Approval, role changes, deactivation and reactivation append audit snapshots in the same transaction as the account update. History includes actor/target identity, previous/new role, active and membership states, and time. History is newest-first with 50-entry cursor pages; UI timestamps use Asia/Bangkok. There are no audit edit/delete endpoints. Legacy actions are not reconstructed.

Existing assigned work is **not automatically reassigned** when a TA loses access. Arrange unfinished work before changing access; restoring the TA role/activation restores access to those assignments. Reassignment is a separate workflow, not part of US-10.

## Database upgrade

Migration: `20261108000000_member_management`. It adds a version column with default zero and an empty `membership_audit` table. Existing accounts and request data remain intact.

Stop the API, then from `apps/api` run:

```sh
npx prisma migrate deploy
npx prisma generate
npm run dev
```

These commands target `DATABASE_URL` from the API environment. Apply once per database, including a shared cloud database; each developer regenerates their own Prisma client and restarts their API. Do not reset or reseed an existing database for this feature.

Implementation validation applied this migration only to isolated local test databases. The team's cloud database was not changed.

## API contract

All routes below require an approved, active Lab Manager session.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/memberships` | Backward-compatible pending active registrations |
| `GET /api/memberships?scope=all` | All accounts; safe identity/role/state/version fields only |
| `POST /api/memberships/:id/approve` | `{ "role": "member" }` (also `ta`, `lab_manager`) |
| `PATCH /api/memberships/:id` | `{ "action": "role", "role": "ta", "expectedVersion": 0 }` or `{ "action": "active", "active": false, "expectedVersion": 0 }` |
| `GET /api/memberships/:id/history` | `{ data, nextCursor }`; optional `?before=<nextCursor>` for older events |

Actor identity is always derived from the session. Unsupported fields/roles and malformed IDs are rejected. Approval and account management do not grant Managers the TA's work-action permissions.

## Verification (2026-11-08)

- API: 175 tests passed, including 16 membership cases covering approval, authorization, concurrent changes, last-manager protection, audit snapshots, stale versions and session revocation.
- Frontend: 49 tests passed, including search/filter/pagination, last-manager controls, confirmation, stale-error presentation and history retry.
- Frontend contract suite: 18 tests passed.
- API/web lint, typecheck and builds passed.
- `npm --prefix apps/web run test:us10-live`: real API/PostgreSQL/Chrome test passed. Creates a new local database, verifies upgrading legacy user data without fabricated history, then exercises approval, role changes, two-tab conflict, deactivation/reactivation, old session denial and self-demotion redirects. Checks desktop and 390px mobile layout. Deletes its own database after completion.
- To run the browser test, set `US10_TEST_ADMIN_DATABASE_URL` to a local PostgreSQL admin connection with database-create privileges. Remote hosts are rejected. Never point integration tests at the team's database.

Screenshots: [desktop](evidence/us10/desktop.png), [history](evidence/us10/history.png), [mobile](evidence/us10/mobile.png).

## Proposal wording

Suggested US-10: “As a Lab Manager, I want to approve registrations, manage member roles and account activation, and review management history so that access to lab services is controlled and traceable.”

Use this actor consistently in user stories, use-case diagrams, permissions and acceptance criteria. The Google registration flow provides account creation; manual password/account creation, membership rejection, account deletion, password recovery and MFA are outside this story.
