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

## Setup on Windows, macOS, and Linux

Choose **one** route. Both create a separate database on your computer; no Neon credentials or team Google secrets are needed for the local demo.

| Route | Install on your computer | Where the services run |
| --- | --- | --- |
| A: Docker Compose | Git and Docker with Compose v2; VS Code optional | API, web, and PostgreSQL in Docker |
| B: Native development | Git, Node.js 24 with npm, PostgreSQL 16 or newer; VS Code optional | API, web, and PostgreSQL on your computer |

The commands below use PowerShell 5.1 on Windows and Terminal with bash/zsh on macOS/Linux. Linux package examples use Ubuntu/Debian; other distributions need their equivalent package manager. Do not mix Windows paths/tools with a WSL installation: run an entire setup in the same environment.

### 1. Install the tools for your operating system

#### Windows

1. Download [Git for Windows](https://git-scm.com/downloads/win), run the installer, and enable Git for command-line applications when asked about PATH.
2. Optionally install [Visual Studio Code](https://code.visualstudio.com/download). Enable **Add to PATH** in its installer.
3. For route A, follow [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/). Use Linux containers and the WSL 2 backend. Enable virtualization/WSL if requested and restart Windows when prompted. Open Docker Desktop and wait for its engine to start.
4. For route B, download **Node.js 24** from [Node.js downloads](https://nodejs.org/en/download), select Windows Installer (`.msi`) for your architecture, and keep npm and Add to PATH enabled. Install [PostgreSQL for Windows](https://www.postgresql.org/download/windows/) with the server, command-line tools, and pgAdmin. Record the password you choose for the `postgres` database user and the port (normally `5432`). This is a database password, not your Windows password.
5. Close PowerShell and VS Code completely, then open a new PowerShell window so PATH changes take effect.
6. Check the tools for your chosen route after completing either the installers above or the terminal commands below.

**Install from PowerShell (alternative to downloading installers manually).** On supported Windows 10/11, check Windows Package Manager first:

```powershell
winget --version
```

If missing, install/update Microsoft's **App Installer** from Microsoft Store, then reopen PowerShell. See [WinGet installation](https://learn.microsoft.com/windows/package-manager/winget/#install-winget). Run these commands one at a time and approve installer/UAC prompts:

```powershell
winget install --id Git.Git --exact --source winget
# Optional editor:
winget install --id Microsoft.VisualStudioCode --exact --source winget
```

For **route A**, open PowerShell as Administrator for the WSL setup (skip it if WSL 2 is already ready):

```powershell
wsl --install --no-distribution
wsl --update
```

Restart Windows if requested before continuing. Install and open Docker Desktop:

```powershell
winget install --id Docker.DockerDesktop --exact --source winget
Start-Process "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
```

For **route B**, install Node 24 and PostgreSQL instead:

```powershell
winget install --id OpenJS.NodeJS.24 --exact --source winget
winget install --id PostgreSQL.PostgreSQL.16 --exact --source winget --interactive
```

Use PostgreSQL's interactive installer to set and record your own database password, keep port 5432 if free, and include command-line tools/pgAdmin. Node's installer includes npm. These IDs are listed in the [WinGet package catalog](https://github.com/microsoft/winget-pkgs); do not substitute an unversioned Node package without checking its major version. If a package is unavailable for your machine/architecture, use the corresponding official installer above. Close PowerShell and VS Code, reopen them, and run the version checks below. A terminal install may still require approval dialogs, Docker first-launch setup, or a restart.

```powershell
git --version
# Route A:
docker --version
docker compose version
docker info
# Route B:
node --version
npm.cmd --version
```

Route B should print `v24.x.x` and an npm version. We use `npm.cmd` and `npx.cmd` in Windows examples to avoid the PowerShell `npm.ps1` execution-policy restriction. No execution-policy change is required.

#### macOS

1. Run `git --version` in Terminal. If macOS prompts you to install Command Line Tools, finish that installation and run the command again.
2. Optionally install [VS Code](https://code.visualstudio.com/download). To enable `code .`, open its Command Palette with Cmd+Shift+P and run **Shell Command: Install 'code' command in PATH**.
3. For route A, install [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/), selecting Apple silicon or Intel to match your Mac. Open Docker Desktop and wait for the engine.
4. For route B, install **Node.js 24** using the macOS installer from [Node.js downloads](https://nodejs.org/en/download). Install PostgreSQL using one of the [macOS packages](https://www.postgresql.org/download/macosx/). With the interactive installer, include the server and pgAdmin, record the `postgres` password and port, and start the server. If using Postgres.app or Homebrew instead, use that installation's database role and service commands rather than assuming a `postgres` password exists.
5. Open a new Terminal and run the checks below after either the installers above or these terminal commands.

**Install from Terminal with Homebrew (alternative to the installers above).** If `brew --version` fails, run the [official Homebrew installer](https://brew.sh/) and follow its printed **Next steps** to add Homebrew to PATH:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

If Command Line Tools installation opens, complete it first. Open a new Terminal after setup; if `brew` is still missing, run the printed `brew shellenv` command for your installation. Homebrew normally uses `/opt/homebrew` on Apple silicon and `/usr/local` on Intel.

Install shared tools:

```sh
brew --version
brew install git
# Optional editor:
brew install --cask visual-studio-code
```

For **route A**:

```sh
brew install --cask docker-desktop
open -a Docker
```

Finish Docker's first-launch setup and wait for its engine. Installing only `brew install docker` provides a CLI without a running Docker Desktop engine.

For **route B**:

```sh
brew install node@24 postgresql@16
brew services start postgresql@16
export PATH="$(brew --prefix node@24)/bin:$(brew --prefix postgresql@16)/bin:$PATH"
node --version
npm --version
psql --version
```

The PATH command above affects the current terminal. For macOS's default zsh, persist it once:

```sh
printf '\nexport PATH="%s/bin:%s/bin:$PATH"\n' "$(brew --prefix node@24)" "$(brew --prefix postgresql@16)" >> ~/.zshrc
source ~/.zshrc
```

For bash, put the same export line in `~/.bash_profile` instead. Homebrew initializes PostgreSQL with a database administrator role matching your macOS username, rather than automatically creating a `postgres` role/password. On a **new Homebrew database installation**, connect locally:

```sh
psql -d postgres
```

Inside `psql`, run the following, entering a new password when asked:

```text
CREATE ROLE isp888 LOGIN CREATEDB;
\password isp888
CREATE DATABASE isanpower_local OWNER isp888;
\q
```

For B2, use username `isp888`, that password, and database `isanpower_local` in `DATABASE_URL`. B1 is already complete with this command sequence. If the role/database exists, use its original credentials instead of creating it again. If another PostgreSQL server uses 5432, resolve the service/port conflict before starting this one. Homebrew services run as your user; do not run `sudo brew`.

Package references: [Node 24](https://formulae.brew.sh/formula/node@24), [PostgreSQL 16](https://formulae.brew.sh/formula/postgresql@16), [Docker Desktop](https://formulae.brew.sh/cask/docker-desktop).

```sh
git --version
# Route A:
docker --version
docker compose version
docker info
# Route B:
node --version
npm --version
```

#### Linux

1. On Ubuntu/Debian, install Git and download tools:

```sh
sudo apt update
sudo apt install -y git curl ca-certificates
```

**Terminal installation for Docker on Ubuntu or Debian (route A, new machine).** Run this only if Docker is not already installed. If conflicting container packages are present, review the official distro guide before changing an existing installation. These commands add Docker's signed apt repository; they are for supported Ubuntu/Debian releases with systemd, not every Linux distribution:

```sh
. /etc/os-release
case "$ID" in
  ubuntu|debian) isp888_docker_distro="$ID" ;;
  *) printf 'Use the Docker guide for your distribution.\n'; exit 1 ;;
esac
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL "https://download.docker.com/linux/$isp888_docker_distro/gpg" -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
printf 'Types: deb\nURIs: https://download.docker.com/linux/%s\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' "$isp888_docker_distro" "$VERSION_CODENAME" "$(dpkg --print-architecture)" | sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker info
sudo docker compose version
```

Repository instructions: [Ubuntu](https://docs.docker.com/engine/install/ubuntu/) / [Debian](https://docs.docker.com/engine/install/debian/). On other distributions use their official Docker package instructions. A WSL shell without systemd needs its own service setup or Docker Desktop integration; do not run this host-service recipe there blindly.

2. For route A, follow the [Docker Engine installation guide for your distribution](https://docs.docker.com/engine/install/) and install the [Compose plugin](https://docs.docker.com/compose/install/linux/). Start Docker using your distribution's service manager. For systemd distributions:

```sh
sudo systemctl enable --now docker
sudo docker info
sudo docker compose version
```

Follow Docker's [Linux post-installation instructions](https://docs.docker.com/engine/install/linux-postinstall/) if you want to run Docker without `sudo`; Docker group membership grants privileged access. Until configured, prefix all route A Docker commands with `sudo`. If using `sudo`, use the same prefix for each command, including `exec` and `logs`.

3. For route B, install nvm and Node 24 using Terminal. These commands follow the [Node.js Linux download instructions](https://nodejs.org/en/download):

```sh
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.7/install.sh -o /tmp/isp888-install-nvm.sh
bash /tmp/isp888-install-nvm.sh
. "$HOME/.nvm/nvm.sh"
nvm install 24
nvm use 24
nvm alias default 24
node --version
npm --version
```

If `nvm` is not found, check whether the installer completed and reopen your shell or source the nvm script as above. Avoid installing an arbitrary distribution `nodejs` package without checking its major version.

4. Install and start PostgreSQL for route B. Ubuntu/Debian example:

```sh
sudo apt install -y postgresql postgresql-client
sudo systemctl enable --now postgresql
sudo -u postgres psql
```

Inside the `psql` prompt, set a password for TCP connections without putting it in a shell command:

```text
\password postgres
\q
```

Enter and confirm your own password when prompted; keep it for route B. For a specific supported PostgreSQL version or other Linux distributions, use the [official PostgreSQL packages](https://www.postgresql.org/download/linux/).

### 2. Download the repository once

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "$HOME\Downloads" | Out-Null
Set-Location "$HOME\Downloads"
git clone https://github.com/Inthat6810545999/ISANPOWER888.git
Set-Location ISANPOWER888
Get-ChildItem
```

macOS/Linux:

```sh
mkdir -p ~/Downloads
cd ~/Downloads
git clone https://github.com/Inthat6810545999/ISANPOWER888.git
cd ISANPOWER888
ls
```

You should see `README.md`, `docker-compose.yml`, and `apps`. This folder is the **repository root**. Optionally run `code .`; if `code` is unavailable, choose **File > Open Folder** in VS Code and select this folder. Open an integrated terminal through **Terminal > New Terminal**.

If the repository already exists, enter its existing root and run `git pull --ff-only` instead of cloning again. If Git reports local changes or diverged history, resolve those before updating; do not delete your work. A fork on GitHub does not download files or database records to your computer.

If you cloned inside another folder named `ISANPOWER888`, your real root may be `C:\Users\first\Downloads\ISANPOWER888\ISANPOWER888`. That is usable: choose the inner folder containing `apps`. Do not clone it again.

Run commands one line at a time and stop if one fails. Copy only commands, not terminal prompts such as `PS C:\...>` or `%`. Code blocks labelled `dotenv`, `dockerfile`, or `sql` contain file contents/SQL, not PowerShell commands. Continue with A or B below.

## Route A: Docker Compose

Use this route for a local review without installing Node.js or PostgreSQL directly on the host. The existing Compose configuration uses PostgreSQL inside Docker and runs API/web in development mode. Initial builds require internet access.

### A1. Create the root environment file

From the repository root, run **only on first setup**:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
notepad .env
```

```sh
# macOS/Linux
cp .env.example .env
# Open .env in your editor, or use: nano .env
```

Keep the defaults for an isolated local demo:

```dotenv
POSTGRES_USER=isp888
POSTGRES_PASSWORD=devpassword
POSTGRES_DB=isp888
POSTGRES_PORT=5432
API_PORT=4000
WEB_PORT=3000
```

`devpassword` is a local demonstration value. If choosing another password, use URL-safe letters/numbers for this Compose template because it interpolates credentials directly into a PostgreSQL URL. Keep your real `.env` private. Do not overwrite an existing `.env` on subsequent runs.

Compose supplies the API/web connection settings itself; the two `apps/*` environment files are for route B and are not needed here. If you previously created `apps/api/.env`, its `DATABASE_URL` is overridden by Compose. This Compose configuration does not consume a root Neon `DATABASE_URL`, and does not forward Google OAuth credentials. Use the local demo accounts for this route.

### A2. Build and start all three services

From the repository root:

```sh
docker compose up --build -d
docker compose ps
docker compose logs --tail=80 api web
```

Wait for PostgreSQL to become healthy and the API/frontend to finish startup. The API development Dockerfile applies Prisma migrations automatically at startup. A running container alone does not prove the database is connected: open [API health](http://localhost:4000/api/health) and require `"database":"connected"`. If startup fails, inspect the logs and the troubleshooting table before proceeding.

### A3. Create local demo accounts once

After the API is ready, from the repository root:

```sh
docker compose exec api npm run seed:demo
```

The API source bind mount writes the credentials to `apps/api/.demo-accounts.json` on your computer. Open that file privately in an editor. On Linux, if the container wrote it as root with mode `0600`, read it locally with `sudo cat apps/api/.demo-accounts.json`; do not loosen its permissions to make it public.

The seed creates these accounts with separate random passwords:

| Email | Role |
| --- | --- |
| `member@isanpower.test` | Lab Member |
| `ta@isanpower.test` | TA |
| `ta2@isanpower.test` | Second TA |
| `manager@isanpower.test` | Lab Manager |

Run the seed once per new database. It refuses to overwrite demo accounts or its credential file. Keep the credentials for future logins; there is no password recovery UI. A fresh database also needs a fresh credentials-file location: retain any old file privately with its matching database before preparing another demo.

### A4. Open, stop, and start again

Open [http://localhost:3000/login](http://localhost:3000/login), expand **Local demo account**, and enter an email/password from the generated file. Follow [Verify the application](#verify-the-application) below.

When finished:

```sh
docker compose stop
```

Start the same installation again:

```sh
docker compose up -d
```

After pulling updated source, read the migration notes first, then use `docker compose up --build -d`. For changes to dependency lockfiles, the existing anonymous dependency volumes may also need refreshing: stop the stack and run `docker compose up --build -d --renew-anon-volumes`. The named `postgres-data` volume holds database records; keep it. Do not use `docker compose down -v` unless you deliberately intend to delete this installation's database.

If another PostgreSQL service already uses host port 5432, set `POSTGRES_PORT=5433` in the root `.env` and recreate the stack. API-to-database traffic still uses `postgres:5432` inside Docker. For different web/API ports, update `WEB_PORT`/`API_PORT`, run `docker compose up -d`, and open the matching browser URLs. Keep web port 3000 for the standard development CORS allowlist; a different web port also requires reviewing the API CORS configuration.

## Route B: Native development

Install Node.js 24 and start PostgreSQL using the OS instructions above. Two terminals will remain running: one for API, one for web. All paths below start from the repository root. On Windows use `npm.cmd`/`npx.cmd`; macOS/Linux use `npm`/`npx`.

### B1. Create a local PostgreSQL database

Use a new database for the first review. With pgAdmin on Windows/macOS:

1. Open pgAdmin and connect to your local PostgreSQL server using the database username/password chosen during installation. A pgAdmin master password, if requested, is separate from the server's password.
2. If no server is registered, right-click **Servers > Register > Server**. Use any label, then set host `127.0.0.1`, port `5432` (or your installation's port), maintenance database `postgres`, and username `postgres` (or your installation's role).
3. Right-click **Databases > Create > Database**, enter `isanpower_local`, select your database role as owner, and save.
4. Verify the new database appears in the tree.

On Linux, or if using command-line PostgreSQL, connect to the maintenance database with a role allowed to create databases:

```sh
psql -h 127.0.0.1 -U postgres -d postgres
```

If `psql` is unavailable on Windows, use **SQL Shell (psql)** from the Start menu or pgAdmin. In the SQL prompt execute:

```sql
CREATE DATABASE isanpower_local;
```

Then exit with `\q`. If the database already exists, use it only if it is the intended installation and follow [Updating an existing database](#updating-an-existing-database). Git does not transfer database data between computers.

### B2. Create and edit the application environment files

Only copy examples on first setup; copying again can overwrite your configuration.

Windows PowerShell, from the repository root:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
notepad apps/api/.env
notepad apps/web/.env.local
```

macOS/Linux, from the repository root:

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Open both files in your editor, or use nano with each file path.
```

Set these values in `apps/api/.env`, keeping the optional Google entries:

```dotenv
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/isanpower_local
CORS_ORIGIN=http://127.0.0.1:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://127.0.0.1:3000/auth/google/callback
```

Replace `YOUR_PASSWORD` with your database password and adjust username/port as needed. Percent-encode reserved URL characters in the password, for example `@` as `%40`, `#` as `%23`, and `%` as `%25`. Do not copy the placeholder literally. API port 4000 and PostgreSQL port 5432 are different services.

Set `apps/web/.env.local` to:

```dotenv
API_BASE_URL=http://127.0.0.1:4000
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000
APP_BASE_URL=http://127.0.0.1:3000
```

| Variable | Purpose |
| --- | --- |
| `API_BASE_URL` | API address used by the Next.js server |
| `NEXT_PUBLIC_API_BASE_URL` | Browser-accessible API origin for public tracking |
| `APP_BASE_URL` | Frontend origin used by Google sign-in |

Native development reads `apps/api/.env` and `apps/web/.env.local`. The root `.env` is used by Compose; creating only that file does not configure route B. Keep real environment files and `.demo-accounts.json` out of Git. Restart servers after environment changes; public variables must be set before a production frontend build.

Google sign-in is optional for the local review. For Google registration, create your own Google OAuth Web application client and set the API Google ID/secret. Register `http://127.0.0.1:3000/auth/google/callback` as its authorized redirect URI and keep `APP_BASE_URL` consistent. OAuth secrets belong in the API environment. The core demo works with Google credentials blank.

### B3. Terminal 1: install and start the API

First confirm the current folder contains `README.md` and `apps`. On Windows:

```powershell
cd apps/api
npm.cmd ci
npx.cmd prisma generate
npx.cmd prisma migrate deploy
npm.cmd run seed:demo
npm.cmd run dev
```

On macOS/Linux:

```sh
cd apps/api
npm ci
npx prisma generate
npx prisma migrate deploy
npm run seed:demo
npm run dev
```

Run the commands one at a time. `npm ci` installs dependencies; `prisma generate` creates the database client; `migrate deploy` creates/updates tables; `seed:demo` creates four approved accounts; `dev` starts the API. Stop at the first error. These migration/seed commands are for a new local database; read the existing-database notes before using them with stored data.

Open `apps/api/.demo-accounts.json` privately for the generated Member, TA, second TA, and Manager passwords listed in route A. Seed only once per new database. Existing demo accounts or credentials cause the seed to refuse changes; use the original matching credentials.

Keep terminal 1 running and open [API health](http://127.0.0.1:4000/api/health). Require `"status":"ok"` and `"database":"connected"` before starting the walkthrough. An HTTP 200 alone does not confirm database connectivity.

### B4. Terminal 2: install and start the frontend

Open a **new** terminal at the repository root, not inside `apps/api`. In VS Code use **Terminal > New Terminal** and check the folder. If needed, `cd` to the root path identified in step 2.

Windows PowerShell:

```powershell
cd apps/web
npm.cmd ci
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

macOS/Linux:

```sh
cd apps/web
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Wait for Next.js to report ready. Open [Sign in](http://127.0.0.1:3000/login), expand **Local demo account**, and use your generated credentials. The local password form appears only in development. Keep both terminals open while using the application.

### B5. Stop and start again later

Press Ctrl+C in both terminals to stop API/web; database records remain. On Windows, if asked `Terminate batch job (Y/N)?`, enter `Y` to stop that process.

For the next session, start PostgreSQL, run `npm.cmd run dev` in `apps/api` on Windows (or `npm run dev` on macOS/Linux), then run the frontend dev command from B4 in a second terminal. Do not clone again, overwrite `.env`, or seed again. After dependency changes, stop the servers and run `npm ci` in each affected package (Windows: `npm.cmd ci`). After schema updates, follow the migration section below.

## Verify the application

Use the browser host for your chosen route consistently: route A defaults to `localhost`, route B uses `127.0.0.1`. They have separate browser cookies.

| Check | Expected result |
| --- | --- |
| `/api/health` on API port 4000 | `{"status":"ok","database":"connected",...}` |
| `/` on web port 3000 | ISANPOWER888 LAB landing page |
| `/login` | Google, Guest, and Local demo account options in development |
| Log in as `member@isanpower.test` | Redirect to `/workspace/my-requests` |
| Log in as `ta@isanpower.test` | Redirect to `/ta/queue` |
| Log in as `manager@isanpower.test` | Redirect to `/manager/approvals` |

A new database initially contains accounts after seeding, not the team's existing requests. Create a request using the presentation walkthrough below to populate demonstration data. If a check fails, use [Troubleshooting](#troubleshooting).


## Updating an existing database

Back up the intended database and review all pending migrations before applying them. Stop the API, then run from `apps/api`:

```sh
npm ci
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
npm run dev
```

On Windows, replace `npm`/`npx` in the block above with `npm.cmd`/`npx.cmd`, and stop the API before generating Prisma Client to avoid a locked query-engine DLL. This block is for route B; route A runs migrations from the API container on startup, so review migration effects before restarting it.

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
| `npm` / `npx` / `node` is not recognized | Install Node.js 24 with npm, then close and reopen PowerShell and VS Code. Run `node -v` and `npm.cmd -v`. On Windows inspect `Get-Command node` and `where.exe npm`; if missing, repair the Node installer/PATH. Do not continue migration commands until this works. |
| `npm.ps1 cannot be loaded` / scripts disabled | Use `npm.cmd` and `npx.cmd` for every Windows npm/npx command; no policy change is needed. |
| `git` / `code` is not recognized | Install Git and reopen the terminal. For VS Code, enable its PATH command or open the repository through File > Open Folder. |
| `destination path ... already exists` | The clone already exists. Enter the folder containing `apps` and README; do not clone inside it again. |
| `ENOENT ... package.json` | Check your current directory with `Get-Location` (Windows) or `pwd` (macOS/Linux). API commands belong in `apps/api`; frontend commands in `apps/web`. |
| `docker` is not recognized / daemon unavailable | Install Docker for the chosen OS, start its engine, reopen the terminal, and require `docker info` to succeed. On Linux check Docker permissions/service; on Windows check WSL 2 and Linux containers. |
| Database `isanpower_local` does not exist / Prisma P1003 | Create the database in B1 and use its exact name in `apps/api/.env`. Route A uses `isp888` by default. |
| Password authentication failed / Prisma P1000 | Use the database role/password, not the Windows or pgAdmin master password; check URL escaping. |
| Prisma P1001 / connection refused | Start PostgreSQL and verify the host/port. For Compose inspect `docker compose ps` and `docker compose logs --tail=80 postgres api`. |
| Prisma engine DLL locked / EPERM on Windows | Stop the API process using Ctrl+C before `npx.cmd prisma generate`; close any other process using that generated client, then retry. |
| Demo seed says accounts or credential file exist | Use the existing matching `.demo-accounts.json`; do not repeatedly seed or delete credentials for an existing database. Prepare a separate empty database if you need a fresh demo. |
| Docker dependency errors after pulling lockfile changes | Stop the stack, then `docker compose up --build -d --renew-anon-volumes`; preserve the named PostgreSQL volume. |
| `psql` is not recognized on Windows | Use SQL Shell (psql) from Start, or use pgAdmin's Query Tool. PostgreSQL command-line binaries may not be on PATH. |
| Linux `nvm` is not found | Complete the nvm installer linked by Node.js, reopen your shell, and select Node 24 before npm commands. |
| API cannot connect to PostgreSQL | Check the service, credentials, database name, and port in `apps/api/.env` |
| Missing tables or columns | Stop the API and apply pending migrations from `apps/api` |
| Invalid local login | Use the original generated credentials; do not reseed an existing database |
| Local demo account option is missing | Use `npm run dev`; the password form is hidden in production |
| Public tracking is unavailable | Check `NEXT_PUBLIC_API_BASE_URL`, API health, and CORS; restart/rebuild the web app after changing its public environment |
| Google sign-in fails | Check OAuth credentials, registered redirect URI, and matching frontend origin; use Local demo account for the core review |
| Redirected to another workspace | Check the account's current role and membership |
| Port already in use / EADDRINUSE | Identify the listener first: `Get-NetTCPConnection -LocalPort 3000` on Windows or `lsof -i :3000` on macOS/Linux (if installed). Stop the previous project process with Ctrl+C. For a Docker PostgreSQL port conflict, change root `POSTGRES_PORT` as described in A4. |
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
git switch -c codex/your-feature
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
