# 04 — מסד נתונים ו-SaaS

## MongoDB — מבנה כללי

מקור: [`server/shared/src/config/dbNames.ts`](../server/shared/src/config/dbNames.ts)

כל **tenant** (חברה) מחזיק **7 databases לוגיים**:

| מפתח בקוד | שם DB (ללא prefix) | תוכן עיקרי |
|-----------|---------------------|------------|
| auth | `syt_auth` | refresh tokens, password reset tokens |
| employees | `syt_employees` | עובדים (login + HR) |
| departments | `syt_departments` | מחלקות |
| locations | `syt_locations` | מיקומים, חניה, חדרי ישיבות |
| schedules | `syt_schedules` | לוחות, חוקים, העדפות |
| notifications | `syt_notifications` | התראות |
| settings | `syt_settings` | OrganizationSettings |

## Prefix per חברה (SaaS)

משתנה: `TENANT_DB_PREFIX=acme` → DBs: `acme_syt_employees`, `acme_syt_schedules`, ...

**אין `companyId` בכל document** — ההפרדה **פיזית** ברמת DB.

## DB מרכזי — `syt_platform`

לא tenant-prefixed. משמש routing ו-registry (login מרכזי):

| Collection | תפקיד |
|------------|--------|
| TenantRegistry | slug, name, emailDomains, authServiceUrl, gatewayUrl |
| TenantEmailMembership | email + tenantSlug + isActive |
| TenantInvite | invite tokens ל-Gmail / register |

מודלים: [`server/shared/src/models/tenant*.ts`](../server/shared/src/models/)

## איך לראות נתונים

### MongoDB Compass

1. התחבר ל-`mongodb://127.0.0.1:27017`
2. בחר database — למשל `acme_syt_employees`
3. collection `employees`

### mongosh

```bash
# רשימת DBs
mongosh --eval "db.adminCommand('listDatabases').databases.map(d=>d.name).filter(n=>n.includes('syt'))"

# עובדי Acme
mongosh acme_syt_employees --eval "db.employees.find({}, {email:1, role:1, isActive:1}).pretty()"
```

## Single-tenant vs multi-tenant

| מצב | `.env` | DBs |
|-----|--------|-----|
| ישן / default | ללא prefix | `syt_employees`, ... |
| Acme | `TENANT_DB_PREFIX=acme` | `acme_syt_*` |
| Beta | `TENANT_DB_PREFIX=beta` | `beta_syt_*` |

**אותו email** יכול להופיע ב-DBs שונים — `isActive` נפרד.

## isActive ו-sessions

- Login חסום אם `isActive=false`
- Refresh token חסום
- Deactivation → revoke refresh tokens + sync ל-`TenantEmailMembership`

## וידוא שה-prefix פעיל

אחרי restart, בלוג השירותים חייב להופיע:

```
Mongo connected: acme_syt_employees
```

**לא** `syt_employees`.

אם רואים `syt_*`:
1. וודא ש-`.env` **נשמר לדיסק** (`grep TENANT .env`)
2. restart מלא ל-`npm run dev`

## seed

```bash
npm run seed
```

- `SEED_RESET=true` — מוחק DBs לפני seed
- `MONGO_URI` על host: `mongodb://127.0.0.1:27017` (לא `mongo` hostname)

Admin אחרי seed: `admin@seeyoutomorrow.local` / `Admin123456!`

---

## English Summary

MongoDB uses **seven logical databases per tenant** (auth, employees, departments, locations, schedules, notifications, settings). With `TENANT_DB_PREFIX=acme`, names become `acme_syt_*`. A central **`syt_platform`** database holds tenant registry, email membership, and invites for optional central login. There is no `companyId` field—isolation is by separate databases. Verify tenant prefix in service logs (`Mongo connected: acme_syt_employees`). Save `.env` to disk and restart after changing prefix.
