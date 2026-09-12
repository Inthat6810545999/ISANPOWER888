# ISANPOWER888

A lab request management system for coordinating equipment, space, consumables, access, visitor sessions, and general support.

Lab Members submit and track requests. Teaching Assistants (TAs) view the shared queue, claim requests, start work, and close completed tasks. Both workspaces use the same Express API and PostgreSQL database.

**Current scope:** a working local presentation demo for US-1, US-2, and US-3. Login, authenticated sessions, role-based authorization, and the Lab Manager approval interface are not implemented yet.

## Contents

- [Implemented features](#implemented-features)
- [Technology stack](#technology-stack)
- [Local setup in VS Code](#local-setup-in-vs-code)
- [Presentation walkthrough](#presentation-walkthrough)
- [Development and testing](#development-and-testing)
- [Repository structure](#repository-structure)
- [API reference](#api-reference)
- [Team workflow](#team-workflow)
- [Project documents](#project-documents)
- [Team](#team)

## Implemented features

| User story | Feature | Route |
| --- | --- | --- |
| US-1 | Submit a request with category, priority, description, location, due date, and an approval requirement | `/workspace/requests/new` |
| US-2 | View member requests, search, filter, sort, and inspect details | `/workspace/my-requests` |
| US-3 | View pending requests, claim work, start work, and close requests | `/ta/queue` |

- Requests and assignments are persisted in PostgreSQL and survive application restarts.
- Member and TA pages refresh every four seconds while visible, when returning to a tab, and through the **Refresh requests** button.
- Submission shows success only after the API saves the request. Failed submissions retain form input for retry.
- TA actions check the current status and assignee atomically to prevent conflicting claims and stale updates.
- Work status and approval status are independent. Approving a request does not close the work, and closing work does not approve it.

### Demo identities and remaining work

| Workspace | Display name | Demo identity |
| --- | --- | --- |
| Lab Member | Theewasu A. | `member@isanpower.test` |
| Teaching Assistant | Kantee L. | `ta@isanpower.test` |

Server Actions select these fixed identities for the demo. They are not login credentials. Separate routes and email filters do not enforce authorization; real sessions and API role checks are still required before deployment for multiple users.

The approval requirement is stored and displayed, but an approval gate and Lab Manager interface are still pending. The original `/` page is an API experiment with direct status controls; use the workspace routes above for presentations.

## Technology stack

| Layer | Implementation |
| --- | --- |
| Runtime | Node.js 24 for the documented development and test commands |
| Frontend | Next.js 16 App Router, React 19, TypeScript, CSS Modules, Tailwind CSS 4 |
| Backend | Express 5, TypeScript, Zod validation |
| Database | PostgreSQL 16, Prisma 6, versioned SQL migrations |
| Verification | ESLint, TypeScript, Vitest, Supertest, Node.js contract tests |

Request flow: **Next.js UI → Server Action → Express API → Prisma → PostgreSQL**.

## Local setup in VS Code

This setup runs PostgreSQL, the API, and the frontend locally. Docker and custom startup scripts are not required.

### 1. Prepare the project

Install Node.js 24 and PostgreSQL 16. Use pgAdmin or another PostgreSQL client to manage the database. Make sure the PostgreSQL service is running.

Clone the repository if needed:

```powershell
git clone https://github.com/Inthat6810545999/ISANPOWER888.git
cd ISANPOWER888
```

In VS Code, select **File → Open Folder** and open `ISANPOWER888`. Open a terminal through **Terminal → New Terminal**. The commands below assume each new terminal starts at the repository root.

### 2. Create a local database

Connect to your PostgreSQL server in pgAdmin. Create a database named `isanpower_local` through **Databases → Create → Database**, or run the following once in the Query Tool while connected to the `postgres` database:

```sql
CREATE DATABASE isanpower_local;
```

Use a PostgreSQL account that owns the database or has permission to create its tables and apply migrations. Skip creation if this database already exists.

### 3. Configure the environment

Create `apps/api/.env` using [apps/api/.env.example](apps/api/.env.example) as a starting point:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/isanpower_local
CORS_ORIGIN=http://127.0.0.1:3000
```

Replace `postgres`, `YOUR_PASSWORD`, and port `5432` with your own PostgreSQL connection details. Percent-encode special characters in the password portion of the URL. The example password is a placeholder.

Create `apps/web/.env.local`:

```dotenv
API_BASE_URL=http://127.0.0.1:4000
```

`API_BASE_URL` is used by the Next.js server. Restart the relevant app after changing its environment file. Local environment files are ignored by Git; commit only example files with placeholder values.

### 4. Terminal 1: start the API

```powershell
cd apps/api
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Keep this terminal open. Check [API health](http://127.0.0.1:4000/api/health); a working setup returns `"status": "ok"` and `"database": "connected"`.

### 5. Terminal 2: start the frontend

Click **+** in the VS Code terminal panel to open a second terminal at the repository root:

```powershell
cd apps/web
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open the workspaces:

- [Lab Member](http://127.0.0.1:3000/workspace/my-requests)
- [TA Queue](http://127.0.0.1:3000/ta/queue)

A new database starts with an empty queue. Create requests through the Member form to populate it.

### Starting again later

Start PostgreSQL, then run the following in separate terminals from the repository root:

| Terminal | Directory | Command |
| --- | --- | --- |
| API | `cd apps/api` | `npm run dev` |
| Web | `cd apps/web` | `npm run dev -- --hostname 127.0.0.1 --port 3000` |

Run `npm ci` again when dependencies change. Run `npx prisma generate` and `npx prisma migrate deploy` from `apps/api` after pulling schema or migration changes.

Press **Ctrl+C** in each terminal to stop its server. Stopping the apps does not delete database records. Stop an older server before starting another instance on the same port.

### Troubleshooting

| Symptom | Check |
| --- | --- |
| Database connection or authentication error | Confirm PostgreSQL is running and `DATABASE_URL` has the correct account, password, port, and database name. |
| Database tables or columns are missing | Run `npx prisma migrate deploy` from `apps/api` against the intended database. |
| Member or TA shows an API connection error | Check the health endpoint, confirm the API is running on port 4000, and check `apps/web/.env.local`. |
| Port 3000 or 4000 is already in use | Stop the previous project server in its terminal before restarting. |
| PowerShell blocks `npm.ps1` or `npx.ps1` | Use `npm.cmd` and `npx.cmd` in place of `npm` and `npx`. |
| A teammate does not see local requests | Each computer has its own local database unless both apps are explicitly configured to use a shared API. Git does not transfer database records. |

## Presentation walkthrough

1. Open the Member workspace and TA Queue in separate tabs.
2. In Member, select **New request**, fill in the required fields, and submit.
3. Confirm the saved request appears in **My requests** with status **Pending**.
4. Switch to TA and wait for refresh, or click **Refresh requests**. The same request should appear.
5. Click **Claim**. The request moves to **Assigned to me** with status **Assigned**.
6. Click **Start work**, then **Mark closed**. Check Member after each action to see **In progress**, then **Closed**.
7. Reload the pages to confirm that the saved request and its status persist.

If **Requires Lab Manager approval** was selected, the approval state remains separate throughout this work-status flow.

## Development and testing

Run these commands from the repository root:

```powershell
npm --prefix apps/api run lint
npm --prefix apps/api run typecheck
npm --prefix apps/api run build
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run test:contracts
npm --prefix apps/web run build
```

### API integration tests

Create a separate PostgreSQL database whose name ends in `_test`, such as `isanpower_test`. In a separate terminal:

```powershell
cd apps/api
$env:DATABASE_URL = 'postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/isanpower_test'
npm test
```

Replace the connection details before running. Tests apply migrations and delete request records between cases, so never point this command at a presentation or development database. Close the test terminal afterward so its test connection setting is not reused for the development server.

The suite covers field persistence, member filtering, independent approval/work statuses, the Member-to-TA workflow, concurrent claims, and stale actions. Frontend contract tests compare status values across the UI, API, and Prisma schema.

## Repository structure

```text
apps/
  api/
    prisma/              Database schema and SQL migrations
    src/
      config/            Environment validation
      controllers/       Request validation and workflow handlers
      db/                Prisma client and database connection
      middleware/        Error handling
      models/            Request enum definitions
      routes/            API routes and integration tests
      test/              Test database lifecycle
  web/
    scripts/             Contract tests; not startup scripts
    src/
      app/               Next.js routes and layouts
      components/        Shared UI and separate Member/TA shells
      features/          Submission, My Requests, TA Queue, and shared state
      lib/               Server-only API client and status definitions
docs/                    Project deliverables and development notes
.github/workflows/       Workflow configuration
```

The frontend guide is in [apps/web/README.md](apps/web/README.md). Sample records in `mock-data.ts` remain as reference fixtures; connected Member and TA pages do not use them.

## API reference

Local base URL: `http://127.0.0.1:4000`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Check API and database health |
| GET | `/api/requests` | List requests; filters: `requesterEmail`, `status`, `approvalStatus`, `type` |
| POST | `/api/requests` | Create a request |
| GET | `/api/requests/:id` | Read a single request |
| PATCH | `/api/requests/:id/ta-action` | Perform `claim`, `start`, or `close` with `assigneeEmail` |
| PATCH | `/api/requests/:id/status` | Set work status through the existing API experiment |
| PATCH | `/api/requests/:id/approval-status` | Set approval status independently |

POST fields: `title`, `type`, `requesterEmail`, and optional `description`, `priority`, `location`, `neededBy`, `requiresApproval`. The Member form also requires a description. Initial statuses are set by the server.

| Field | Values |
| --- | --- |
| `type` | `equipment`, `space`, `consumable`, `access`, `visitor`, `general` |
| `priority` | `low`, `medium`, `high` |
| `status` | `pending`, `assigned`, `in_progress`, `closed`, `cancelled` |
| `approvalStatus` | `not_required`, `submitted`, `under_review`, `approved`, `rejected`, `cancelled` |

New requests begin as `pending`. Approval begins as `submitted` when required, otherwise `not_required`. TA actions return HTTP 409 if the status or assignee has changed; the direct `/status` endpoint is separate from those TA transition checks.

## Team workflow

Start a feature from the latest shared `main` after its foundation changes have been merged:

```powershell
git switch main
git pull --ff-only origin main
git switch -c features/your-feature
```

Before committing, review the changes:

```powershell
git status
git add --dry-run .
git add .
git diff --cached --name-status
git diff --cached
```

`--dry-run` only previews files; `git add .` stages them. Press `q` to exit the diff viewer. Then commit and push:

```powershell
git commit -m "feat: describe your change"
git push -u origin features/your-feature
```

Use your actual feature branch name and open a pull request into `main`. Coordinate edits to shared types, the API client, providers, CSS, and migrations with teammates.

### Automation configuration

Container and GitHub Actions files remain in the repository, but are not needed for the local setup above. The current `ci.yml` contains an API job fragment and needs a complete workflow definition before it can run as CI. `cd.yml` defines image publishing to GitHub Container Registry on pushes to `main`, `v*` tags, or manual dispatch; publishing an image does not deploy the application to a server.

## Project documents

| Document | File |
| --- | --- |
| Software proposal | [Software_Proposal_ISAN888.pdf](docs/Software_Proposal_ISAN888.pdf) |
| Software requirements specification | [SRS_ISAN888.pdf](docs/SRS_ISAN888.pdf) |
| Iteration report | [Iteration_Report_ISAN888.pdf](docs/Iteration_Report_ISAN888.pdf) |
| Use case diagram | [Usecase.json](docs/Usecase.json) |
| Activity diagram | [Activity_Diagram.json](docs/Activity_Diagram.json) |
| Sequence diagrams | [Sequence.json](docs/Sequence.json) |
| Project schedule | [Gant_Chart.json](docs/Gant_Chart.json) |

Additional development notes are currently written in Thai:

- [Local demo notes](docs/development/LOCAL-DEMO.md)
- [US-1 / US-2 / US-3 handoff](docs/development/US1-US3-HANDOFF.md)
- [Request status contract and migrations](docs/development/REQUEST-STATUS-CONTRACT.md)

## Team

| Name | Student ID | GitHub |
| --- | --- | --- |
| Theewasu Aekthong | 6810545701 | Theewasu-a |
| Kantee Laibuddee | 6710545440 | Kantee22 |
| Tanon Likhittaphong | 6710545547 | Tanon6710545547 |
| Inthat Niramarn | 6810545999 | Inthat6810545999 |

Course project: **Lab Workflow & Request Management System**, IRL Challenge Project B.
