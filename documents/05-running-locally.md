# 05 — הרצה מקומית (Local Development)

## דרישות

- **Node.js 22+**
- **npm** (workspaces)
- **Docker Desktop** (ל-Mongo, Redis, MailHog) — אופציונלי אך מומלץ
- **MongoDB 7+** — אם לא Docker

## התקנה ראשונית

```bash
cd /path/to/seeYouTomorrow
npm install
cp .env.example .env
```

**חשוב:** ערוך `.env` ולחץ **Save** (Cmd+S). השרת קורא מהדיסק, לא מ-buffer של העורך.

## משתני `.env` מינימליים ל-dev

```env
MONGO_URI=mongodb://127.0.0.1:27017
REDIS_URL=redis://localhost:6379
JWT_SECRET=local-dev-secret-change-me
INTERNAL_SERVICE_SECRET=local-dev-internal
CORS_ORIGIN=http://localhost:5173
ALLOW_PUBLIC_REGISTER=true
```

## שלב 1 — תשתית (Mongo, Redis, MailHog)

```bash
npm run docker:deps
```

| שירות | פורט |
|--------|------|
| MongoDB | 27017 |
| Redis | 6379 |
| MailHog UI | 8025 |
| MailHog SMTP | 1025 |

## שלב 2 — Build

```bash
npm run build -w @syt/shared
npm run build --workspaces --if-present
```

## שלב 3 — Seed (אופציונלי)

```bash
npm run seed
```

Admin אחרי seed: `admin@seeyoutomorrow.local` / `Admin123456!`

איפוס מלא: `SEED_RESET=true npm run seed`

## שלב 4 — הרצת האפליקציה

### אופציה A — מלא (מומלץ לפיתוח)

```bash
npm run dev
```

מריץ gateway, כל השירותים, shared watch, client.

פתח: **http://localhost:5173**

### אופציה B — מינימלי

```bash
npm run dev:core
```

רק gateway + auth + client (פיצ'רים מוגבלים).

### אופציה C — backend + client נפרד

```bash
# טרמינל 1
npm run dev:backend

# טרמינל 2
npm run dev:client
```

## בדיקת בריאות

```bash
curl http://localhost:4000/health
```

תשובה: `{"ok":true,"service":"gateway","mode":"tenant"}`

## dev user (אופציונלי)

```env
DEV_LOGIN_EMAIL=you@example.com
DEV_LOGIN_PASSWORD=yourpassword
```

```bash
npm run ensure:dev-user
```

## הרצת tenant Acme ב-dev

הוסף ל-`.env`:

```env
TENANT_DB_PREFIX=acme
TENANT_SLUG=acme
```

1. **שמור** `.env`
2. עצור `npm run dev` (Ctrl+C)
3. `npm run dev` מחדש
4. וודא בלוג: `Mongo connected: acme_syt_employees`
5. http://localhost:5173/register — admin ראשון ל-Acme

## כללים

- **terminal אחד** עם `npm run dev` — לא שניים (EADDRINUSE)
- `npm run kill:ports` לפני restart אם ports תפוסים
- `npm run docker:deps && npm run dev` — **לא** pipe `|`

## MailHog

מיילים ב-dev: http://localhost:8025

---

## English Summary

Local setup: `npm install`, copy `.env.example` to `.env` (save to disk), run `npm run docker:deps` for Mongo/Redis/MailHog, build workspaces, optionally `npm run seed`, then `npm run dev` and open http://localhost:5173. For multi-tenant testing, set `TENANT_DB_PREFIX` and `TENANT_SLUG`, restart, and confirm logs show `acme_syt_*` database names. Use one dev terminal only; run `npm run kill:ports` if ports are stuck.
