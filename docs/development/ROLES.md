# Application roles

Internal roles are **Member**, **TA**, and **Lab Manager**. Authenticated users
awaiting membership use `unassigned / PENDING`. Guests browse public content only.
There is no Admin role, account-management API, `/admin` page, or admin bootstrap command.
Lab Managers approve pending membership through `/manager/members`; their role
does not inherit TA work actions. See [membership approvals](MEMBER-APPROVALS.md).

## Upgrade existing databases

From `apps/api`, stop the running API, then run:

```powershell
npx prisma generate
npx prisma migrate deploy
npm run dev
```

The removal migration preserves former Admin account IDs, names, emails, passwords,
Google identities, and related records. It revokes their sessions and moves them to
`unassigned / PENDING`, clearing their old membership-approval fields. An approved
Lab Manager can then assign an allowed role through the normal membership flow.
Member, TA, and Lab Manager accounts and their sessions are unchanged.

Keep the historical Admin-addition migration: teammates may already have applied it.
The later removal migration supports both existing installations and fresh databases.
Do not edit applied migration history or reset the database to remove this role.
