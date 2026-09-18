# Lab Manager membership approvals

Menu: **Member approvals** at `/manager/members`.

1. New users sign in with Google. They receive `unassigned / PENDING` and see `/pending`.
2. An approved Lab Manager refreshes Member approvals and selects Member, TA or Lab Manager.
3. Approve & assign role atomically updates the role and membership to `APPROVED`.
4. The new user clicks Check membership status and enters their assigned workspace.

The API (`GET /api/memberships`, `POST /api/memberships/:id/approve`) and server
action verify manager access. Approval stores the reviewer's ID and timestamp.
Only active, pending, unassigned accounts can be approved. Concurrent or repeated
decisions return 409. Assignable roles are Member, TA and Lab Manager only.
The existing session remains valid and reloads membership from the database.

Run `npm install`, `npx prisma generate`, and `npx prisma migrate deploy` in
`apps/api`, then restart the API and frontend. Existing accounts retain approved
access through the Google membership migration. Configure Google OAuth using the
API and web `.env.example` files; this change does not supply OAuth credentials.

Tests use a dedicated database ending in `_test` and cover role restrictions,
pending sessions, all assignable roles, audit fields, races and Google account reuse.
