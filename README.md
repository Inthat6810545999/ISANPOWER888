# ISANPOWER888

A lab request workspace built with Next.js, TypeScript, Express, Prisma, and PostgreSQL. Members submit requests, TAs manage the work, and Lab Managers make approval decisions and review reports. All three workspaces use the same database.

## Roles and workflow

| Capability | Lab Member | TA | Lab Manager |
| --- | --- | --- | --- |
| Submit requests | Yes | No | No |
| List and read request details | Own requests | All requests | All requests |
| Claim or assign work to an active TA | No | Yes | No |
| Start and close work | No | Assigned TA only | No |
| Approve or reject with a reason | No | No | Yes |
| Dashboard, date filters, aggregate CSV reports | No | No | Yes |

**Lab Manager does not inherit TA permissions.** Work and approval are separate fields:

- Work: `pending → assigned → in_progress → closed`.
- Approval: `not_required`, or `submitted → approved / rejected`.
- A TA may claim or assign a request while approval is pending. Starting and closing require `approved` if the request requires approval; otherwise they require `not_required`.
- Rejected requests cannot start or close successfully. Existing unapproved work that was already in progress in an older demo is also blocked from closing.
- Approval never changes work status. Closing never changes approval or its audit record.
- Every final decision requires a reason and records the verified reviewer ID, name, email, and server timestamp. Final decisions cannot be overwritten.

Legacy `under_review` and `cancelled` values remain readable for compatibility. The current UI does not offer cancellation or reopening decisions.

## Local setup in VS Code

Run everything locally; Docker and custom startup scripts are not needed. Use Node.js 24 and a running PostgreSQL service (PostgreSQL 16 is used for integration tests; the local setup also runs on PostgreSQL 18).

### 1. Open the project and create a database

Open the repository folder in VS Code and select **Terminal → New Terminal**. New terminal commands below start at the repository root.

In pgAdmin, create `isanpower_local` under **Databases → Create → Database**. Skip this if it already exists. Alternatively, run this once while connected to the `postgres` database:

```sql
CREATE DATABASE isanpower_local;
```

### 2. Configure local environment files

Create `apps/api/.env` using `apps/api/.env.example`:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/isanpower_local
CORS_ORIGIN=http://127.0.0.1:3000
```

Use your PostgreSQL username, password, and port. Percent-encode special characters in the URL password. API port `4000` and database port `5432` are different services.

Create `apps/web/.env.local`:

```dotenv
API_BASE_URL=http://127.0.0.1:4000
```

Restart the relevant server after changing an environment file. Commit placeholder `.env.example` files only, never real `.env`, `.env.local`, or `.demo-accounts.json` files.

### 3. Terminal 1: database migrations, accounts, and API

```powershell
cd apps/api
npm ci
npx prisma generate
npx prisma migrate deploy
npm run seed:demo
npm run dev
```

Run `seed:demo` **once per database**. It creates four local accounts with independently generated random passwords, saved in the ignored file `apps/api/.demo-accounts.json`. Open that file privately in VS Code for login credentials. Do not commit or distribute it. Each teammate seeds accounts for their own database.

| Account | Role |
| --- | --- |
| `member@isanpower.test` | Lab Member |
| `ta@isanpower.test` | TA (Kantee L.) |
| `ta2@isanpower.test` | TA (Tanon L.), for assignment demos |
| `manager@isanpower.test` | Lab Manager |

The seed refuses to overwrite existing accounts, roles, passwords, or its credential file, and refuses production mode. If accounts already exist, use their original credentials and omit the seed command. There is no password reset UI yet.

Migrations add tables without deleting existing requests. Do not use `prisma migrate reset` on your presentation database. When upgrading, stop the API before generating Prisma Client on Windows to avoid a locked query-engine DLL.

Leave Terminal 1 running. Check [API health](http://127.0.0.1:4000/api/health): it should report `status: ok` and `database: connected`.

### 4. Terminal 2: frontend

Open a new terminal at the repository root:

```powershell
cd apps/web
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open [Sign in](http://127.0.0.1:3000/login). After login the server selects the workspace from the account's database role:

| Workspace | Route |
| --- | --- |
| Member requests | `/workspace/my-requests` |
| Member submission | `/workspace/requests/new` |
| TA queue | `/ta/queue` |
| Manager approvals | `/manager/approvals` |
| Manager dashboard/reports | `/manager/reports` |

`/` shows the public lab landing page with an overview, workflow guide, and a contact placeholder. Its login links lead to `/login`. Opening another role's route redirects to your own workspace; calling another role's API or Server Action is still denied independently.

### Starting again later

Start PostgreSQL, then run `npm run dev` from `apps/api` and `npm run dev -- --hostname 127.0.0.1 --port 3000` from `apps/web` in separate terminals. Keep both open; Ctrl+C stops each service without deleting data.

Repeat `npm ci` only when dependencies change. After pulling migrations, stop the API, run `npx prisma generate` and `npx prisma migrate deploy` from `apps/api`, then restart. Do not seed again if accounts exist.

## Presentation walkthrough

Use **separate browser profiles or different browsers** for Member, TA, and Manager. Tabs in the same browser profile and host share one login cookie; opening three tabs does not create three independent sessions. Alternatively, sign out and sign in sequentially in one browser.

1. Member: create a request with **Requires Lab Manager approval** checked. The request starts as **Pending**, approval **Submitted**.
2. TA: refresh the queue and **Claim**, or select another TA under **Assign to TA**. The work becomes **Assigned** while approval stays **Submitted**. **Start work** is disabled.
3. Manager: open **Approvals**, select **Review**, choose **Approve**, write a reason, and save. The record now shows the reviewer and review time.
4. Assigned TA: refresh and select **Start work**, then **Mark closed**.
5. Member: verify the same request becomes **In progress**, then **Closed**, while approval remains **Approved** and its decision history is visible in details.
6. Repeat with a second request and choose **Reject** in Manager. TA cannot start or successfully close it.
7. Create a request without approval and demonstrate normal TA claim/start/close.
8. Manager: open **Dashboard / Reports**, filter by creation date (UTC), refresh, and download the aggregate CSV.

Request lists refresh every four seconds while visible, on focus, and manually. Reports refresh on entry and through their refresh button. Failed submissions retain form input and never show saved success. No connected page falls back to mock records.

## Authentication scope and limitations

This version has password verification and database-backed sessions with server/API role enforcement. It no longer grants permissions from fixed demo identities, an email in a payload, a role header, or a client-side role selector.

Passwords are stored as salted scrypt hashes. Login returns a random opaque session token; PostgreSQL stores only its SHA-256 hash with an eight-hour expiry. Next.js stores the token in an HttpOnly, SameSite=Lax cookie (Secure in production) and forwards it server-to-server as a Bearer token. Each protected API request reloads the session, active account, and current role. Logout revokes the session. Next.js Server Actions retain their built-in origin protection; do not loosen allowed origins for untrusted sites.

**This is a local presentation authentication implementation, not a complete production identity platform.** Accounts are manually seeded demo accounts. There is no SSO, self-registration, password recovery, MFA, user administration, or production security review. Login throttling is in-memory for one API process. Production requires HTTPS, secure account provisioning, a shared rate limiter, and deployment-specific hardening. Existing request ownership remains email-based; a future email-change feature must migrate ownership consistently. Historical approval values are preserved, but reviewer metadata is not invented for old decisions.

## API reference

Base URL: `http://127.0.0.1:4000`. All endpoints except health and login require `Authorization: Bearer <session token>`.

| Method | Endpoint | Allowed role / purpose |
| --- | --- | --- |
| GET | `/api/health` | Public API/database health |
| POST | `/api/auth/login` | Public; strict `{email, password}` |
| GET | `/api/auth/me` | Verified session account |
| POST | `/api/auth/logout` | Revoke current session |
| GET | `/api/auth/assignees` | TA; active TA accounts only |
| GET | `/api/requests` | Member: own; TA/Manager: all |
| POST | `/api/requests` | Member; requester comes from session |
| GET | `/api/requests/:id` | Member: own; TA/Manager: all |
| PATCH | `/api/requests/:id/ta-action` | TA; claim, assign, start, close |
| PATCH | `/api/requests/:id/status` | TA compatibility route; start/close with identical gates |
| PATCH | `/api/requests/:id/approval-status` | Manager; approve/reject with reason |
| GET | `/api/requests/reports` | Manager; optional `from`/`to` ISO dates, UTC creation dates |

POST request fields: `title`, `type`, optional `description`, `priority`, `location`, `neededBy`, `requiresApproval`. The Member form requires a description too. Sending `requesterEmail`, `role`, or initial statuses is rejected.

TA payloads are `{action: "claim"}`, `{action: "start"}`, `{action: "close"}`, or `{action: "assign", assigneeId, expectedUpdatedAt}`. Assignment accepts only an active TA's database ID and the latest request timestamp. It is allowed only before work starts. Only the assigned TA can start/close. The legacy `/status` accepts only `{status: "in_progress"}` or `{status: "closed"}` with the same checks.

Manager payload: `{approvalStatus: "approved" | "rejected", reason}`. The reason is trimmed and must contain 1–2000 characters. The server supplies all reviewer metadata. Review applies to active, required requests in `submitted` or `under_review`; a final decision cannot be replaced.

List filters: `requesterEmail`, `status`, `approvalStatus`, `type`. A Member cannot use a filter to read another Member's data. Unauthenticated requests return 401, wrong-role actions 403, hidden/missing details 404, invalid fields 400, and workflow/concurrency conflicts 409. Updates use atomic state checks; decisions and audit records are saved in one transaction.

See [Request status contract](docs/development/REQUEST-STATUS-CONTRACT.md) for enum and migration details.

## Development and testing

From the repository root:

```powershell
npm --prefix apps/api run lint
npm --prefix apps/api run typecheck
npm --prefix apps/api run build
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run test:contracts
npm --prefix apps/web run build
```

The existing Next.js font setup downloads Google Fonts during a build, so that step requires network access.

For API integration tests, create a **separate database ending in `_test`**, then use a separate terminal:

```powershell
cd apps/api
$env:DATABASE_URL = 'postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/isanpower_test'
npm test
```

Tests apply migrations and delete requests, decisions, users, and sessions between cases. Never use your development/presentation database. Close the test terminal afterward to avoid reusing its database override.

Coverage includes password login/logout/expiry, current database roles, unauthenticated access, cross-role actions, spoofed identity fields, Member ownership, assignment targets, concurrent claims/decisions, approval gates including the legacy status endpoint, rejection, immutable audit data, and Manager-only reports. Frontend contract tests compare UI, API, and Prisma status definitions. See [local demo notes](docs/development/LOCAL-DEMO.md) for manual checks.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Missing `DATABASE_URL` | Create `apps/api/.env`; `apps/web/.env.local` does not configure Prisma. |
| Database connection/authentication error | Check the PostgreSQL service, password, database name, and database port. |
| Missing tables or columns | Run `npx prisma migrate deploy` in `apps/api`. |
| Invalid login | Use the generated password in `apps/api/.demo-accounts.json`; run the seed once if accounts do not exist. |
| Redirected to another workspace | Your signed-in account has a different role. Sign out or use a separate browser profile. |
| API connection error | Check port 4000 health and `API_BASE_URL`; restart the web app after env changes. |
| Port already in use | Stop the previous project server before starting another. |
| PowerShell blocks `npm.ps1` | Use `npm.cmd` / `npx.cmd`. |
| Teammate cannot see local requests | Each computer has its own database. Git transfers code, not database records or account credentials. |

## Repository structure and team workflow

- `apps/api/src/auth/`: password and session verification.
- `apps/api/src/routes/`: API endpoints and integration tests.
- `apps/api/src/controllers/`: validation, approval gates, assignment, reports.
- `apps/api/prisma/`: schema and additive SQL migrations.
- `apps/web/src/app/`: login and protected role layouts.
- `apps/web/src/features/`: Member, TA, Manager, and shared request UI.
- `apps/web/src/lib/`: server-only session/API clients and shared types.
- `docs/development/`: setup, status contract, and handoff notes.

Start each feature from the latest merged `main`:

```powershell
git switch main
git pull --ff-only origin main
git switch -c features/your-feature
```

Before committing:

```powershell
git status
git add --dry-run .
git add .
git diff --cached --name-status
git diff --cached
git commit -m "feat: describe your change"
git push -u origin features/your-feature
```

`--dry-run` previews only; it does not stage files. Review the staged diff and keep credentials out of Git. Open a pull request to `main`; coordinate shared schema/session/provider changes with teammates. Container/CI files are outside this local implementation; running a local build does not verify deployment.

## Project documents

- [Software proposal](docs/Software_Proposal_ISAN888.pdf)
- [Software requirements](docs/SRS_ISAN888.pdf)
- [Iteration report](docs/Iteration_Report_ISAN888.pdf)
- [US-1 / US-2 / US-3 handoff](docs/development/US1-US3-HANDOFF.md)
- [Frontend guide](apps/web/README.md)

| Name | Student ID | GitHub |
| --- | --- | --- |
| Theewasu Aekthong | 6810545701 | Theewasu-a |
| Kantee Laibuddee | 6710545440 | Kantee22 |
| Tanon Likhittaphong | 6710545547 | Tanon6710545547 |
| Inthat Niramarn | 6810545999 | Inthat6810545999 |

Course project: Lab Workflow & Request Management System, IRL Challenge Project B.
