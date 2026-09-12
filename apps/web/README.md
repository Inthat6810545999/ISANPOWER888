# ISANPOWER888 Web

The Next.js frontend for Lab Member requests and the Teaching Assistant queue. It uses React, TypeScript, and a shared Express/PostgreSQL backend.

For database creation, environment configuration, and the complete two-terminal workflow, start with the [root setup guide](../../README.md#local-setup-in-vs-code).

## Run locally

Use Node.js 24. Start PostgreSQL and the API first, then create `apps/web/.env.local`:

```dotenv
API_BASE_URL=http://127.0.0.1:4000
```

From `apps/web`:

```powershell
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

On later runs, omit `npm ci` unless dependencies have changed. Keep the terminal open and use Ctrl+C to stop. Restart the frontend after changing `.env.local`.

## Routes and feature ownership

| Feature | Route | Entry component |
| --- | --- | --- |
| US-1: Request Submission | `/workspace/requests/new` | `src/features/request-submission/RequestSubmission.tsx` |
| US-2: My Requests | `/workspace/my-requests` | `src/features/my-requests/MyRequests.tsx` |
| US-3: TA Queue | `/ta/queue` | `src/features/ta-queue/TaQueue.tsx` |

Open [Member](http://127.0.0.1:3000/workspace/my-requests) and [TA](http://127.0.0.1:3000/ta/queue) in separate tabs. The old `/workspace/ta-queue` route redirects to `/ta/queue`. The root `/` page is an earlier API experiment.

## Data flow

- `src/features/requests/actions.ts` contains Server Actions and maps API records into the UI model, including `type` to `category`, dates, and requester/assignee display data.
- `RequestsProvider.tsx` loads data, handles saves and errors, refreshes visible pages every four seconds, and refreshes when returning to a tab.
- `RequestTable.tsx` provides shared search, filters, sorting, pagination, and live request details.
- `src/lib/api.ts` is server-only. Call it through Server Actions or Server Components rather than importing it into Client Components.
- `src/lib/request-status.ts` provides shared work and approval status values and labels.
- `src/components/workspace/` and `src/components/ta/` provide separate navigation and shells for the two workspaces.

Requests are saved through the API before the UI reports success. Connection errors are displayed without falling back to mock data. `mock-data.ts` remains a reference fixture only.

## Demo boundaries

`demo-identity.ts` defines the fixed Member and TA identities selected by the server. Replace these with authenticated sessions and enforce roles in both the web server and API before deploying for multiple users.

Work status is separate from approval status. Claiming, starting, or closing a request does not approve it. The Lab Manager interface and approval gate are not implemented yet.

## Verification

Run from `apps/web`:

```powershell
npm run lint
npm run typecheck
npm run test:contracts
npm run build
```

Contract tests in `scripts/request-status.test.mjs` compare UI status values with the API and Prisma schema. This directory contains tests, not local startup automation.

For a manual check, submit a Member request, claim/start/close it in TA, and confirm each status in Member. Reload the pages to check persistence and use the API health endpoint to diagnose connection problems.

See the [root README](../../README.md) for API integration tests, contribution commands, and project documents.
