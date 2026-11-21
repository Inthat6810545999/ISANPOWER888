# ISANPOWER888

A lab workflow and request management system built with Next.js, TypeScript, Express, Prisma, and PostgreSQL.

Members submit and track requests, Teaching Assistants (TAs) carry out approved work, and Lab Managers review requests, manage member access, and view reports. Visitors and industry collaborators can track their requests without creating an account.

## Features and roles

| Role | Capabilities |
| --- | --- |
| Lab Member | Submit requests and view their own requests and history |
| TA | View requests, claim approved work, start and close assigned work, and submit industry collaboration requests |
| Lab Manager | Approve or reject requests, manage membership and account access, and view history and aggregate reports |
| Visitor | Submit a public lab-visit request and track it using a private tracking code |
| Industry collaborator | Track a request submitted on their behalf by a TA |

New Google users start with `unassigned / PENDING` access. An approved Lab Manager must approve their registration and assign a role before they can enter an internal workspace. Existing users retain their stored membership and role.

Lab Managers do not inherit TA work permissions. There is no Admin role.

## Request workflow

Work progress and approval are separate fields:

- Work: `pending → assigned → in_progress → closed`
- Approval: `submitted → approved / rejected`

For new requests:

1. A Member, Visitor, or TA submits a request through the appropriate form.
2. A Lab Manager approves or rejects it with a required reason.
3. After approval, a TA claims the request for themselves.
4. The assigned TA starts and closes the work.
5. Authorized users can review the recorded history.

Approval is required before a TA can claim, start, or close work. Another TA cannot take over an assigned request. Approval does not change work progress, and closing work does not change its approval decision. Final approval decisions cannot be overwritten through the current application.

Historical status values remain readable. Cancellation, reassignment, and reopening are not available as current workflow actions.

## Local setup in VS Code

This guide runs the API and frontend directly on your computer. Docker files are included but are not covered by these instructions.

Prerequisites:

- Git, Node.js 24 with npm, and a running PostgreSQL service.
- PostgreSQL credentials with permission to create a local database, or an empty database prepared for you. CI uses PostgreSQL 16; development has also been verified with PostgreSQL 18.
- Internet access to install dependencies. The frontend build also downloads Google Fonts.

### 1. Fork, clone, and create a database

Fork the repository on GitHub, clone your fork, and open the cloned repository folder in VS Code. Forking alone does not download the project to your computer. The commands below assume that new terminals start at the repository root, which contains this README and `apps/`.

Create a local database named `isanpower_local` using pgAdmin, or run the following while connected to the `postgres` database:

```sql
CREATE DATABASE isanpower_local;
```

For a first-time review, use a new, empty database. Your local database and accounts are independent of the team's databases; neither records nor credentials are included in a fork.

### 2. Configure environment files

Copy `apps/api/.env.example` to `apps/api/.env`. Keep its optional Google settings and configure the local values below:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/isanpower_local
CORS_ORIGIN=http://127.0.0.1:3000
```

Replace the database username, password, and port as needed. Percent-encode special characters in the connection URL password. API port `4000` and database port `5432` belong to different services.

Copy `apps/web/.env.example` to `apps/web/.env.local` and use matching local origins:

```dotenv
API_BASE_URL=http://127.0.0.1:4000
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000
APP_BASE_URL=http://127.0.0.1:3000
```

| Variable | Purpose |
| --- | --- |
| `API_BASE_URL` | API address used by the Next.js server |
| `NEXT_PUBLIC_API_BASE_URL` | Browser-accessible API origin used by public tracking pages |
| `APP_BASE_URL` | Canonical frontend origin used by the Google sign-in flow |

In development, API CORS allows `http://localhost:3000` and `http://127.0.0.1:3000` explicitly. `CORS_ORIGIN` is used in test/production and must be one exact web origin, not a comma-separated list or `*`.

**Google OAuth is not required to review the core request workflow.** Leave the Google credentials blank and use the seeded local accounts described below. To test Google registration, configure a Google OAuth Web application client using the API `.env.example`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`. With this setup, the redirect URI is `http://127.0.0.1:3000/auth/google/callback`; register it with Google and keep its origin consistent with `APP_BASE_URL`. OAuth secrets belong only in the API environment.

Restart the relevant server after changing environment variables. Set `NEXT_PUBLIC_API_BASE_URL` before a production frontend build. Keep real environment files and generated account credentials out of Git.

### 3. Terminal 1: install dependencies and start the API

From the repository root:

```sh
cd apps/api
npm ci
npx prisma generate
npx prisma migrate deploy
npm run seed:demo
npm run dev
```

These commands are for a new database. For an existing installation, read [Updating an existing database](#updating-an-existing-database) first.

Run `seed:demo` once per new database. It creates four approved local accounts with independently generated random passwords:

| Account | Role |
| --- | --- |
| `member@isanpower.test` | Lab Member |
| `ta@isanpower.test` | TA |
| `ta2@isanpower.test` | Second TA for ownership checks |
| `manager@isanpower.test` | Lab Manager |

Read the passwords privately from `apps/api/.demo-accounts.json`. This file is ignored by Git. Do not commit or distribute it.

The seed refuses to overwrite existing demo accounts or its credential file and refuses production mode. If accounts already exist, skip the seed command and use their original credentials. There is no password recovery UI.

Leave this terminal running. Check [API health](http://127.0.0.1:4000/api/health): it should report `status: ok` and `database: connected`.

### 4. Terminal 2: start the frontend

Open another terminal at the repository root:

```sh
cd apps/web
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open [Sign in](http://127.0.0.1:3000/login), expand **Local demo account**, and enter an account and its generated password. This option is visible in development and hidden in production. Use `npm run dev` for this local review walkthrough.

After login, the server selects the workspace from the account's database membership and role.

### Starting again later

Start PostgreSQL, then run `npm run dev` from `apps/api` and `npm run dev -- --hostname 127.0.0.1 --port 3000` from `apps/web` in separate terminals. Keep both open; Ctrl+C stops each service without deleting database records.

Run `npm ci` after dependency changes. Apply pending migrations after pulling database changes. Do not seed accounts again if they already exist.

## Updating an existing database

Back up the intended database and review all pending migrations before applying them. Stop the API, then run from `apps/api`:

```sh
npm ci
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
npm run dev
```

On Windows, stop the API before generating Prisma Client to avoid a locked query-engine DLL.

**The approval-first migration changes existing open work.** If `20260920000000_approval_first_workflow` has not been applied, it returns every request that is not closed or cancelled to `pending / submitted` and clears its assignee. Previous decisions remain in history as superseded records. Affected requests must be reviewed and claimed again. Closed and cancelled requests are unchanged.

Later migrations add request history and member-management records. Missing historical actions are not reconstructed. Apply all pending migrations before starting the current API.

Do not use `prisma migrate reset` on a development, shared, or presentation database. Do not edit or remove previously applied migration files, including the historical Admin-addition and removal migrations.

## Main routes

| Page | Route |
| --- | --- |
| Public landing page | `/` |
| Sign in | `/login` |
| Open House | `/open-house` |
| Visitor submission | `/visit/request` |
| Visitor tracking | `/visit/track` |
| Industry collaboration tracking | `/collaboration/track` |
| Pending membership | `/pending` |
| Member requests | `/workspace/my-requests` |
| Member submission | `/workspace/requests/new` |
| TA queue | `/ta/queue` |
| TA collaboration submission | `/ta/collaborations/new` |
| Manager request approvals | `/manager/approvals` |
| Manager reports | `/manager/reports` |
| Manager member management | `/manager/members` |

Internal routes require an active account, approved membership, and the appropriate role. Server Actions and the API check authorization independently of the visible controls.

## Presentation walkthrough

Use separate browser profiles or different browsers for Member, TA, and Manager. Tabs in one browser profile and host share the login cookie. Alternatively, sign out and sign in sequentially.

1. Member submits a request. It starts as **Pending / Awaiting approval**.
2. TA verifies the request is visible but **Assign to myself** is disabled.
3. Manager opens Approvals and approves it with a reason.
4. TA opens **Ready to accept**, selects **Assign to myself**, then **Start work** and **Mark closed**. Another TA cannot take or update it.
5. Member checks the final status, approval decision, and timeline.
6. Repeat with rejection and verify that TA work actions remain blocked.
7. Manager filters reports by creation date (UTC) and exports the aggregate CSV.
8. Manager opens Member management to inspect accounts, roles, activation controls, and management history. New Google registrations require OAuth configuration; the seeded accounts are already approved.

Visitors save their private tracking code from the successful submission receipt. For industry collaboration, the submitting TA receives the code and must share it with the external contact manually; no email is sent automatically. Codes are shown only in the creation receipt, so save them before leaving or reloading the page.

Request lists refresh every four seconds while visible and on focus. Reports refresh on entry and through their refresh button. Request timelines display Asia/Bangkok timestamps. Older requests show an incomplete-history notice when events were not recorded.

## API overview

Local base URL: `http://127.0.0.1:4000`.

Protected endpoints require `Authorization: Bearer <session token>`. Internal endpoints also require approved membership and the correct role. Health, login, Google start/callback, and public submission/tracking do not require an existing session.

| Area | Endpoints |
| --- | --- |
| Health | `GET /api/health` |
| Authentication | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| Google sign-in | `POST /api/auth/google/start`, `POST /api/auth/google/callback` |
| Active, approved TA accounts | `GET /api/auth/assignees` (TA only) |
| Requests | `GET /api/requests`, `POST /api/requests` (Member only), `GET /api/requests/:id` |
| TA work actions | `PATCH /api/requests/:id/ta-action` |
| Legacy work-status route | `PATCH /api/requests/:id/status` |
| Approval decisions | `PATCH /api/requests/:id/approval-status` |
| Visitor public message | `PATCH /api/requests/:id/public-message` |
| Reports | `GET /api/requests/reports` |
| Visitor submission and tracking | `POST /api/visits`, `POST /api/visits/track` |
| Industry collaboration | `POST /api/requests/industry-collaboration` (TA only), `POST /api/collaborations/track` (public) |
| Pending registrations | `GET /api/memberships` (Manager only; pending active unassigned accounts by default) |
| All accounts | `GET /api/memberships?scope=all` (Manager only) |
| Member approval and management | `POST /api/memberships/:id/approve`, `PATCH /api/memberships/:id`, `GET /api/memberships/:id/history` (Manager only) |

Next.js keeps the session token in an HttpOnly cookie and forwards it to the API server-to-server. Requester and reviewer identities come from verified sessions. Members can read only their own requests; TAs and Managers can read staff request views. Managers alone can review requests, edit eligible Visitor public messages, and read reports.

See the development documents below for payloads, validation, permissions, and response contracts.

## Development and testing

From the repository root:

```sh
npm --prefix apps/api run lint
npm --prefix apps/api run typecheck
npm --prefix apps/api run build
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run test:contracts
npm --prefix apps/web test
npm --prefix apps/web run build
```

The frontend build downloads Google Fonts and requires network access. A successful production build does not enable the development-only local login form.

API integration tests require a separate database whose name ends in `_test`. Create that database first. Tests apply migrations and delete test records; never point them at your development, shared, or presentation database.

PowerShell example, in a separate terminal:

```powershell
cd apps/api
$env:DATABASE_URL = 'postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/isanpower_test'
npm test
```

macOS/Linux example, from the repository root:

```sh
cd apps/api
DATABASE_URL='postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/isanpower_test' npm test
```

Replace the placeholder credentials. Close the PowerShell test terminal afterward to avoid reusing its database override.

Additional browser and live workflow scripts are listed in `apps/web/package.json`. See each feature document for its database and browser requirements. CI runs API integration tests and frontend unit/contract tests; it does not run every live browser workflow.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| API cannot connect to PostgreSQL | Check the service, credentials, database name, and port in `apps/api/.env` |
| Missing tables or columns | Stop the API and apply pending migrations from `apps/api` |
| Invalid local login | Use the original generated credentials; do not reseed an existing database |
| Local demo account option is missing | Use `npm run dev`; the password form is hidden in production |
| Public tracking is unavailable | Check `NEXT_PUBLIC_API_BASE_URL`, API health, and CORS; restart/rebuild the web app after changing its public environment |
| Google sign-in fails | Check OAuth credentials, registered redirect URI, and matching frontend origin; use Local demo account for the core review |
| Redirected to another workspace | Check the account's current role and membership |
| Port already in use | Stop the previous project server |
| PowerShell blocks `npm.ps1` | Use `npm.cmd` and `npx.cmd` |
| Teammates cannot see local records | Each local database is independent; Git does not transfer database records |

## Scope and limitations

The application supports Google registration, local demo passwords, database-backed sessions, role enforcement, membership management, and recorded request history.

Current limitations include:

- No password recovery, MFA, membership rejection, or account deletion.
- No request reassignment, cancellation action, or reopening of final decisions.
- No automatic email delivery or tracking-code recovery.
- No confirmed calendar booking or equipment-utilization analytics.
- Request lists and their filters load authorized records for client-side processing.
- Login throttling is in memory. Public submission/tracking rate limits use PostgreSQL; deployment-specific proxy configuration still determines which client IP the API sees.
- Assigned work is not automatically reassigned when a TA loses access.

Production deployment requires HTTPS, correct OAuth and CORS configuration, secure account provisioning, and deployment-specific review. Passing local checks does not verify a deployed environment.

## Repository structure and team workflow

```text
apps/
  api/
    prisma/        Database schema and migrations
    src/           API, authentication, validation, and integration tests
  web/
    public/        Static assets
    scripts/       Contract and browser workflow tests
    src/           Pages, components, features, and unit tests
docs/
  development/     Feature contracts, setup notes, and verification evidence
```

Dockerfiles, Docker Compose, and GitHub Actions workflows are also included. Generated build files, dependencies, local credentials, and temporary database files are not source documentation.

Start a feature from the latest merged `main`:

```sh
git switch main
git pull --ff-only origin main
git switch -c features/your-feature
```

Run the relevant checks and inspect the staged diff before committing. Keep credentials out of Git. Open a pull request to `main` and coordinate changes to shared schema, migrations, sessions, providers, API clients, and styles with teammates.

## Documentation

Implementation guides:

- [Frontend guide](apps/web/README.md)
- [Request status and permissions](docs/development/REQUEST-STATUS-CONTRACT.md)
- [Roles and migration notes](docs/development/ROLES.md)
- [Member, TA, and Manager workflow](docs/development/US1-US3-HANDOFF.md)
- [Visitor backend](docs/development/VISITOR-BACKEND-HANDOFF.md)
- [Visitor tracking](docs/development/VISITOR-TRACK-HANDOFF.md)
- [Visitor public-message API](docs/development/VISITOR-MESSAGE-API.md)
- [Industry collaboration](docs/development/US8-COLLABORATION-HANDOFF.md)
- [Request history](docs/development/US6-REQUEST-HISTORY.md)
- [Member management](docs/development/US10-MEMBER-MANAGEMENT.md)

Some handoff notes describe an earlier branch or iteration. For local setup, use this README; for current member-management behavior, use the US-10 guide above. Read older notes alongside their recorded scope and date.

Course documents:

- [Software proposal](docs/Software_Proposal_ISAN888.pdf)
- [Software requirements](docs/SRS_ISAN888.pdf)
- [Iteration 1](docs/Iteration_Report_ISAN888.pdf)
- [Iteration 2](docs/ISP888-Iteration2%20Report-2.pdf)
- [Iteration 3](docs/ISP888-Iteration3%20Report.pdf)
- [Iteration 4](docs/ISP888-Iteration4%20Report.pdf)
- [Iteration 5](docs/ISP888-Iteration5%20Report.pdf)

Course documents record requirements and project progress. Some role and workflow descriptions still need reconciliation with the current implementation.

## Team

| Name | Student ID | GitHub |
| --- | --- | --- |
| Theewasu Aekthong | 6810545701 | Theewasu-a |
| Kantee Laibuddee | 6710545440 | Kantee22 |
| Tanon Likhittaphong | 6710545547 | Tanon6710545547 |
| Inthat Niramarn | 6810545999 | Inthat6810545999 |

Course project: Lab Workflow & Request Management System, IRL Challenge Project B.
