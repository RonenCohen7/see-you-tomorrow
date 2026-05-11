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

4. Start MongoDB and Redis (or `docker compose up -d mongo redis mailhog`).

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
