# 06 — פריסה ב-Docker

## סקירה

- **Image אחד** לכל שירותי backend ([`Dockerfile`](../Dockerfile))
- [`docker-compose.yml`](../docker-compose.yml) — infra + stack מלא
- [`deploy/`](../deploy/) — SaaS multi-tenant (platform + per-tenant template)

## Infra בלבד (כמו dev)

```bash
npm run docker:deps
# או
docker compose up -d mongo redis mailhog
```

## Stack מלא (production-like)

```bash
docker compose build
docker compose up -d mongo redis mailhog
docker compose up -d gateway auth-service employee-service department-service \
  location-service schedule-service notification-service ai-service report-service
```

## Seed מ-host

Mongo exposed על `localhost:27017`:

```bash
MONGO_URI=mongodb://127.0.0.1:27017 npm run seed
```

## משתני סביבה ב-Docker

ב-`docker-compose.yml` כל service מקבל:

- `MONGO_URI=mongodb://mongo:27017` (hostname `mongo` בתוך network)
- `JWT_SECRET`, `INTERNAL_SERVICE_SECRET`
- `*_SERVICE_URL` — hostnames פנימיים (`http://auth-service:4001`)

**Client** — בדרך כלל נבנה בנפרד (Vite) ומוגש static או dev proxy.

## SaaS — platform + tenants

### 1. רשת משותפת

```bash
docker network create syt_platform
```

### 2. Platform (mongo, redis, traefik, central gateway)

```bash
docker compose -f deploy/docker-compose.platform.yml --project-directory . up -d
```

### 3. Tenant compose

```bash
chmod +x deploy/render-tenant-compose.sh
./deploy/render-tenant-compose.sh acme acme.yourdomain.com
docker compose -f deploy/generated/docker-compose.acme.yml --project-directory . up -d
```

Template: [`deploy/docker-compose.tenant.yml.template`](../deploy/docker-compose.tenant.yml.template)

מגדיר אוטומטית:

```yaml
TENANT_SLUG: acme
TENANT_DB_PREFIX: acme_
CORS_ORIGIN: https://acme.yourdomain.com
```

### 4. Provision DB + registry

```bash
npm run build -w @syt/shared
npm run provision:tenant -- \
  --slug acme \
  --name "Acme Ltd" \
  --email-domains acme.co.il \
  --gateway-url https://acme.yourdomain.com \
  --auth-url http://auth-acme:4001
```

## Reverse proxy

דוגמאות:

- [`deploy/Caddyfile`](../deploy/Caddyfile)
- Traefik labels ב-tenant template

## Production tips

- `NODE_ENV=production` על gateway — הודעות שגיאה גנéric למשתמש
- JWT secrets חזקים (לא ברירת מחדל)
- SMTP אמיתי (SendGrid, SES) במקום MailHog
- MongoDB Atlas / Redis managed מומלץ

---

## English Summary

Docker deployment uses a single backend image with per-service commands in `docker-compose.yml`. Run `docker:deps` for Mongo/Redis/MailHog only, or bring up the full microservice stack. For SaaS, use `deploy/docker-compose.platform.yml` plus rendered per-tenant compose files from `render-tenant-compose.sh`, then `provision:tenant` to create databases and registry entries. Configure Caddy or Traefik for HTTPS and subdomain routing.
