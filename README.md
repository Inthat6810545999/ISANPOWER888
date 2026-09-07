# ISANPOWER888 (ISP888) — Lab Resource Request System

## Project Name
**Lab Workflow & Request Management System** *(Chosen IRL Challenge: Project B)*

A centralised system to make lab requests (equipment/space, consumables, access,
general tickets, and external visitor/collaboration requests) visible, trackable, and
reliable — replacing the current mix of email, chat, and spreadsheets.

## Group Members & GitHub Usernames

| Name | Student ID | GitHub Username |
|---|---|---|
| Theewasu Aekthong | 6810545701 | Theewasu-a> |
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

Source code, prototype, and database files are kept in the `source/` folder.

## Tech Stack (planned, from SRS Sections 9–11)

- **Architecture:** Modular Monolithic (MVC)
- **Database:** RDBMS — PostgreSQL
- **Dev/Deploy Environment:** Docker containers (via Docker Compose) / VM
