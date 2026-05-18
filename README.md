# See You Tomorrow – Microservices System Overview

The **See You Tomorrow** project is a full-stack microservices-based web application for hybrid workforce coordination: office/home schedules, departments, locations, parking allocations, real-time notifications (Socket.IO and email), and AI-assisted recommendations (admin-approved only). The system uses a microservices architecture where each service owns a domain and communicates via REST behind an API gateway. Services can run locally with Node or in containers via Docker Compose.

## Tech Stack

**Frontend:** React, TypeScript, MUI, RTL / Hebrew, React Query, Axios, Socket.IO client  

**Backend:** Node.js, Express, TypeScript, MongoDB + Mongoose, Zod, JWT + refresh tokens, BullMQ + Redis (email queue), Nodemailer, OpenAI (optional)  

**DevOps:** Docker Compose (MongoDB, Redis, MailHog; single backend image with per-service `command` entries), npm workspaces  

**Environment:** `.env` from `.env.example` (never commit `.env`)

## Microservices

The system is built using multiple microservices:

- **Gateway** – Single browser-facing API; proxies to internal services with JWT forwarding  
- **Auth Service** – Authentication, JWT and refresh tokens  
- **Employee Service** – Employees, profiles, birthdays  
- **Department Service** – Departments and org structure  
- **Location Service** – Locations and parking (spots, reservations)  
- **Schedule Service** – Work schedules and internal hooks to notifications  
- **Notification Service** – Notifications, email queue (BullMQ), Socket.IO fan-out  
- **AI Recommendation Service** – Suggestions; changes apply only after admin approval  

Each backend service runs as its own Node process (or container). The **React client** (`client/`) talks only to the gateway.

## Repository layout

```
see-you-tomorrow/
├── client/                 # React + Vite SPA
├── server/
│   ├── gateway/            # API gateway
│   ├── shared/             # Shared models and utilities
│   ├── scripts/            # Seed and dev helpers
│   └── services/
│       ├── auth-service/
│       ├── employee-service/
│       ├── department-service/
│       ├── location-service/
│       ├── schedule-service/
│       ├── notification-service/
│       └── ai-recommendation-service/
├── docker-compose.yml
├── package.json            # npm workspaces root
├── .env.example
└── README.md
```

## End users vs. developers

Anyone who **only uses** the product in the browser does **not** run commands from this repository (no Docker, no `npm run dev`). Those flows are **for developers** building or self-hosting the stack. Hosted deployments operate databases and services on behalf of end users.

Production tip: run the gateway with **`NODE_ENV=production`** so generic messages are shown in the UI when upstream services fail; omitting production mode may expose brief developer-oriented hints.

## Prerequisites

- Node 22+  
- MongoDB 7+ (or use Docker)  
- Redis (for notification email queue; or use Docker)

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment template:

   ```bash
   cp .env.example .env
   ```

3. Build shared library and all services / client:

   ```bash
   npm run build -w @syt/shared
   npm run build --workspaces --if-present
   ```

4. Start MongoDB and Redis (and MailHog for mail testing), **on your dev machine only**: `npm run docker:deps` (same as `docker compose up -d mongo redis mailhog`). Requires Docker (e.g. Docker Desktop). End users of a deployed app never run this.

5. Seed demo data (250 employees, departments, locations, sample schedules):

   Ensure MongoDB is running locally (or port-forwarded), then from the repo root:

   ```bash
   npm run seed
   ```

   The default URI is `mongodb://127.0.0.1:27017`. If your `.env` sets `MONGO_URI=mongodb://mongo:27017` (Docker-only hostname), seeding **on your Mac/PC will fail** with `ENOTFOUND mongo` — use `mongodb://127.0.0.1:27017` or `mongodb://localhost:27017` instead.

   First-run admin (after seed):

   - **Email:** `admin@seeyoutomorrow.local`  
   - **Password:** `Admin123456!`

   To reset DBs and re-seed: `SEED_RESET=true MONGO_URI=... npm run seed`

6. Start the app (recommended — **one terminal**):

   ```bash
   npm run dev
   ```

   This runs **gateway (4000)**, **auth-service (4001)**, and the **Vite client (5173)** together. Open `http://localhost:5173`.

   For **all** microservices (employees, schedules, notifications, …), use:

   ```bash
   npm run dev:backend
   ```

   in one terminal **and** `npm run dev:client` in another, or run client separately after `dev:backend`.

   Default ports: gateway **4000**, auth **4001**, employee **4002**, department **4003**, location **4004**, schedule **4005**, notification **4006**, AI **4007**.

   Use separate commands only if you prefer multiple terminals; **do not** paste them without spaces (for example `npm run dev:gatewaynpm run dev:auth` is invalid).

### Shell gotcha — **`|` vs `&&`**, and duplicate `npm run dev`

**Wrong:** `npm run docker:deps | npm run dev` — a **pipe (`|`) does not mean “run both”** here; Compose output is wired to stdin of the next command. Prefer:

```bash
npm run docker:deps && npm run dev
```

(or **two terminals**: run `docker:deps` once, then in another terminal `npm run dev`).

**Wrong:** starting **`npm run dev` twice** (two terminals). Every service listens on fixed ports (**4000**–**4008**); the second copy crashes with **`EADDRINUSE`** on all of them — exactly what your logs show.

**Fix:** Ctrl+C the other dev session **or**:

```bash
npm run kill:ports
npm run dev
```

`npm run dev` normally runs **`predev` → kill:ports** first; stuck ports can still happen if something outside that list grabbed a port — run **`kill:ports`** manually. If Vite chooses **5174** because **5173** is in use, use **`http://localhost:5174`** (and matching ngrok port).

## Troubleshooting

### `listen EADDRINUSE` on ports `4000`–`4008`

Another **`npm run dev`** (or leftover Node) still holds gateway / microservice ports. Stop it or run **`npm run kill:ports`** from the repo root — it checks each port separately (macOS `lsof` does not accept comma lists). Then **one** `npm run dev`. Only a **single** full-stack dev fan-out should run.

### Redis `ECONNREFUSED` on `127.0.0.1:6379` or `::1:6379` (`[notif]` logs)

The **notification service** uses **BullMQ** with Redis. If Redis is not running, the service may still listen on HTTP, but logs will spam connection failures for the worker/queue — this is **not** the root cause of a browser `502` via ngrok, but dev is much simpler with Redis up.

**Fix:**

1. Start Docker (Daemon / Docker Desktop).
2. From the repo root:

   ```bash
   npm run docker:deps
   ```

3. Confirm **6379** (Redis) and **27017** (MongoDB) are reachable on localhost.

### ngrok `502`, `ERR_NGROK_8012`, or unreachable tunnel URL

ngrok forwards HTTPS to **`http://localhost:5173`** (the Vite dev server). Nothing can answer correctly if only ngrok runs, or Vite listens on another port.

**Always use two processes on the same machine:**

1. **Terminal A** — wait until Vite reports it is listening:

   ```bash
   npm run dev
   ```

2. Verify **`http://localhost:5173`** loads locally in the browser.

3. **Terminal B**:

   ```bash
   ngrok http 5173
   ```

   Or: `ngrok http 127.0.0.1:5173`.

If you changed the Vite port in `client/vite.config.ts`, use that port with ngrok. If another process holds **5173**, Vite may pick **5174** or higher — tunnel **that** port. You can clear listeners with **`npm run kill:ports`** (covers **5173**–**5175**) before retrying.

## Docker Compose (backend)

From the repository root:

```bash
docker compose build
docker compose up -d mongo redis mailhog
docker compose up gateway auth-service employee-service department-service location-service notification-service schedule-service ai-service
```

Then seed against the exposed Mongo port (`mongodb://localhost:27017`) using the same `npm run seed` command as above (from the host with Node installed).

## Architecture notes

- The **API gateway** exposes a single origin to the browser and proxies to internal services.  
- JWT validation runs on each service that receives proxied `Authorization` headers.  
- Schedule changes call the **notification service** internally to persist notifications, queue emails, and emit Socket.IO events (`schedule:updated`, `notification:new`, `dashboard:refresh`).  
- AI recommendations **never auto-apply**; admins approve via `POST /api/ai/approve-recommendations`.

## GitHub backup and change log

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to push updates and write commit messages. Release-style summaries live in [CHANGELOG.md](CHANGELOG.md).

## License

Proprietary / internal use unless otherwise stated.
