# Administrator accounts (US-10)

Administrators sign in through `/login` and land on `/admin`. They can list and
create accounts, edit names and roles, and deactivate/reactivate accounts.
The API and every server action require an authenticated administrator.
Administrators do not inherit TA or Lab Manager workflow permissions.

## Setup

From `apps/api`, with your normal `DATABASE_URL` configured:

```sh
npx prisma generate
npx prisma migrate deploy
```

Set `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` (at least 12 characters)
in your local shell environment, then run `npm run admin:create` from `apps/api`.
The command creates a new admin; it refuses to overwrite or promote an existing
account. Do not commit credentials. Existing demo accounts are unchanged.

## Account rules

- Passwords use the existing salted scrypt implementation; API responses omit hashes.
- Role changes and deactivation revoke all sessions for the affected user.
- An admin cannot deactivate or demote their own account. Account updates are
  serialized and the acting admin is rechecked inside the transaction.
- Email addresses are immutable because request ownership uses email addresses.
- Deactivation preserves request and approval records; there is no delete operation.

## Verification

Use a dedicated PostgreSQL database whose name ends in `_test`:

```sh
DATABASE_URL=<dedicated-test-database-url> npm test -- --no-file-parallelism
```

Admin integration tests cover access control, creation and login, duplicate emails,
validation, session revocation, reactivation and self-lockout protection.
