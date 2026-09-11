# ISANPOWER888 (ISP888) — Lab Resource Request System

## US-1 / US-2 / US-3 local demo

Member และ TA เชื่อม Express API + Prisma + PostgreSQL เดียวกันแล้ว ส่งคำขอและ Claim / Start work / Mark closed บันทึกจริง รัน local บน Windows โดยไม่ใช้ Docker:

เปิด PostgreSQL, ตั้งค่า `.env` แล้วรัน `npm run dev` แยกใน `apps/api` และ `apps/web` ตามคู่มือด้านล่าง

เปิด Member ที่ http://127.0.0.1:3000/workspace/my-requests และ TA ที่ http://127.0.0.1:3000/ta/queue

ดู [คู่มือรัน local และขั้นตอนพรีเซนต์](docs/development/LOCAL-DEMO.md), [status contract](docs/development/REQUEST-STATUS-CONTRACT.md) และ [คู่มือส่งต่องาน](docs/development/US1-US3-HANDOFF.md)

ยังใช้ตัวตนเดโม่ ไม่มี login/authorization จริง ข้อมูลเก็บถาวรใน PostgreSQL ที่กำหนดใน `DATABASE_URL` บันทึกด้านล่างเป็นเอกสารแผนเดิม; stack ปัจจุบันให้ยึด Prisma schema และคู่มือ local

## Project Name
**Lab Workflow & Request Management System** *(Chosen IRL Challenge: Project B)*

A centralised system to make lab requests (equipment/space, consumables, access,
general tickets, and external visitor/collaboration requests) visible, trackable, and
reliable — replacing the current mix of email, chat, and spreadsheets.

## Group Members & GitHub Usernames

| Name | Student ID | GitHub Username |
|---|---|---|
| Theewasu Aekthong | 6810545701 | Theewasu-a |
| Kantee Laibuddee | 6710545440 | Kantee22 |
| Tanon Likhittaphong | 6710545547 | Tanon6710545547 |
| Inthat Niramarn | 6810545999 | Inthat6810545999 |


## Current Project Status

- **Phase:** Iteration 1 complete — planning/analysis stage
- **Done:** KAOS goal model (G-0 → SG-1...SG-7), Use Case Diagram, User Stories
  (US-1–US-9), User Requirement Specification (URS-1–URS-13), System Requirement
  Specification (SRS-1–SRS-16), Activity Diagrams (AD-1–AD-6), Software Architecture
  (Modular Monolithic MVC), Data Storage decision (RDBMS), Dev Environment decision
  (Docker/VM), Sequence Diagrams (SQD-1–SQD-8), and full Traceability Matrix.
- **Known open items (carried into Iteration 2):** 5 remaining consistency issues
  flagged in the Retrospective (e.g. SG-7 entry, UC-16 numbering, US-5/SRS-16
  traceability rows) — to be resolved before any new scope is added.
- **Not started:** Coding / implementation (Docker & PostgreSQL environment setup
  is intentionally deferred until covered in class, per instructor guidance).
- **Next milestone:** Iteration 2 — Login & Approval workflow (Midterm Demo).

## Where to Find Documents / Diagrams

All project artifacts are organised under the `docs/` folder:

```
docs/
├── proposal/
│   └── Software_Proposal_ISAN888.pdf
├── srs/
│   └── SRS_ISAN888.pdf
├── iteration-reports/
│   └── Iteration_Report_ISAN888.pdf
└── diagrams/
    ├── Gantt_Chart.json          # plane.so Gantt chart export
    ├── Usecase.json              # draw.io — Use Case Diagram
    ├── Activity_Diagram.json     # draw.io — Activity Diagrams
    └── Sequence.json             # draw.io — Sequence Diagrams
```

## Tech Stack

- **Architecture:** Modular Monolithic (MVC) — Next.js frontend + Express API + MongoDB
- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind CSS 4, TypeScript
- **Backend:** Node.js + Express 5 + Mongoose, TypeScript
- **Database:** MongoDB 8
- **Dev/Deploy Environment:** Docker containers (via Docker Compose)
- **CI/CD:** GitHub Actions

> **Note:** The SRS (Sections 9–11) specifies PostgreSQL/RDBMS. The implementation
> uses MongoDB, so the Data Storage section and the affected traceability rows need
> to be updated in Iteration 2.

## Repository Structure

```
apps/
├── api/                  # Express + Mongoose REST API (MVC)
│   └── src/
│       ├── config/       # environment validation
│       ├── controllers/  # request handlers
│       ├── db/           # Mongoose connection
│       ├── middleware/   # error handling
│       ├── models/       # Mongoose schemas
│       └── routes/       # route definitions
└── web/                  # Next.js frontend
    └── src/
        ├── app/          # App Router pages + server actions
        └── lib/          # API client
docs/                     # SRS, proposal, diagrams (see above)
docker-compose.yml        # mongo + api + web for local development
.github/workflows/        # CI (lint/typecheck/test/build) and CD (image publish)
```

## Getting Started

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/). Node.js 20+
is only needed if you want to run an app outside of Docker.

```bash
cp .env.example .env      # defaults work as-is for local development
docker compose up --build
```

- Web app → http://localhost:3000
- API → http://localhost:4000/api/health
- MongoDB → localhost:27017

Both apps hot-reload — editing a file in `apps/web` or `apps/api` updates the running
container. To stop everything, `docker compose down` (add `-v` to also wipe the database).

### Running an app without Docker

```bash
docker compose up mongo   # database still needs to run

cd apps/api && cp .env.example .env && npm install && npm run dev
cd apps/web && cp .env.example .env && npm install && npm run dev
```

### Useful commands

| Command | Where | What it does |
|---|---|---|
| `npm run dev` | `apps/api`, `apps/web` | Start the dev server |
| `npm run lint` | `apps/api`, `apps/web` | Run ESLint |
| `npm run typecheck` | `apps/api`, `apps/web` | Type-check without emitting |
| `npm test` | `apps/api` | Run the API test suite (Vitest) |
| `npm run build` | `apps/api`, `apps/web` | Production build |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Service and database status |
| `GET` | `/api/requests` | List lab requests (`?status=`, `?type=` filters) |
| `POST` | `/api/requests` | Create a lab request |
| `GET` | `/api/requests/:id` | Fetch a single request |
| `PATCH` | `/api/requests/:id/status` | Update work status (pending / assigned / in_progress / closed / cancelled) |
| `PATCH` | `/api/requests/:id/approval-status` | Update approval status independently of work status |

## CI/CD

- **CI** (`.github/workflows/ci.yml`) runs on every push and pull request to `main`:
  lint, type-check, tests, and production builds for both apps, plus a Docker image build.
- **CD** (`.github/workflows/cd.yml`) builds and publishes both production images to
  GitHub Container Registry (`ghcr.io`) on pushes to `main` and on `v*` tags.
  Deployment to an actual server is not configured yet.
