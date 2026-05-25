# 07 — SaaS: חברות (Tenants)

## עקרון

**חברה = subdomain + stack + env + DB prefix**

| רכיב | דוגמה Acme |
|------|------------|
| Subdomain | `acme.yourdomain.com` |
| Env | `TENANT_DB_PREFIX=acme`, `TENANT_SLUG=acme` |
| MongoDB | `acme_syt_employees`, ... |

העובד **לא** בוחר חברה ב-register — ה-URL/instance קובע.

## מה לא קורה אוטומטית

deployment **אחד** בלי prefix = **חברה אחת** (`syt_*`).  
הפרדה בין לקוחות דורשת **provisioning** לכל לקוח.

## Dev — חברה אחת בכל פעם

```env
TENANT_DB_PREFIX=acme
TENANT_SLUG=acme
```

Restart → register → נתונים ב-`acme_syt_*`.

לעבור ל-Beta: החלף ל-`beta`, restart, register מחדש.

## Production — לקוח חדש (checklist)

- [ ] קנה/הקצה subdomain: `gamma.yourdomain.com`
- [ ] DNS A record → IP השרver
- [ ] `./deploy/render-tenant-compose.sh gamma gamma.yourdomain.com`
- [ ] `npm run provision:tenant -- --slug gamma --name "Gamma" ...`
- [ ] `docker compose -f deploy/generated/docker-compose.gamma.yml --project-directory . up -d`
- [ ] admin נרשם ב-URL של Gamma
- [ ] admin מוסיף עובדים / import CSV
- [ ] (אופציונלי) `--email-domains gamma.co.il` ל-login מרכזי

## Provision script

```bash
npm run provision:tenant -- \
  --slug acme \
  --name "Acme Ltd" \
  --email-domains acme.co.il,acme.com \
  --gateway-url https://acme.yourdomain.com \
  --auth-url http://auth-acme:4001
```

**Invite ל-Gmail:**

```bash
  --invite-email user@gmail.com
```

מדפיס קישור: `/register?invite=TOKEN&email=...`

## Login מרכזי (אופציונלי)

דף login אחד לכל החברות:

**Gateway:**
```env
GATEWAY_MODE=central
```

**Client:**
```env
VITE_CENTRAL_LOGIN=true
```

**Routing:** email domain → tenant; Gmail → קוד חברה או invite.

API: `GET /api/platform/tenants/resolve?email=...`

אחרי login מ-central → redirect ל-subdomain עם tokens (`/login/callback`).

## isActive בין חברות

- `john@gmail.com` ב-Acme `isActive=false`
- אותו email ב-Beta `isActive=true`  
→ login ל-Acme חסום, ל-Beta מותר.

## sync membership

כש-`TENANT_SLUG` מוגדר, employee-service מעדכן `syt_platform.TenantEmailMembership` ב-create/update/deactivate.

---

## English Summary

Multi-tenant SaaS assigns each company a **subdomain**, **Docker stack**, **environment prefix**, and **separate MongoDB databases** (`acme_syt_*`). New customers require explicit provisioning (`render-tenant-compose.sh`, `provision:tenant`, DNS). A single deployment without `TENANT_DB_PREFIX` is single-tenant only. Optional central login uses `GATEWAY_MODE=central` and routes auth by email domain or company code. Employee `isActive` is per-tenant; the same email can exist in multiple tenants independently.
