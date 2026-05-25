# 09 — משתני סביבה (Environment Variables)

מקור: [`.env.example`](../.env.example).  
**אזהרה:** אל תעלה `.env` ל-Git. ב-production — secrets ארוכים ואקראיים.

## MongoDB ו-Redis

| משתנה | תיאור | Dev | Prod |
|--------|--------|-----|------|
| `MONGO_URI` | חיבור MongoDB | `mongodb://127.0.0.1:27017` (host) | Atlas URI או `mongodb://mongo:27017` (Docker network) |
| `REDIS_URL` | BullMQ (notifications, AI pipeline) | `redis://localhost:6379` | Redis managed / ElastiCache |

## JWT ואבטחה

| משתנה | תיאור | Dev | Prod |
|--------|--------|-----|------|
| `JWT_SECRET` | חתימת access/refresh tokens | ערך dev קצר | **חובה** — מחרוזת ארוכה ואקראית |
| `JWT_EXPIRES_IN` | תוקף access token | `15m` | לפי policy |
| `JWT_REFRESH_EXPIRES_IN` | תוקף refresh | `7d` | לפי policy |
| `INTERNAL_SERVICE_SECRET` | קריאות service-to-service | ערך dev | **שונה** מ-JWT_SECRET |
| `RATE_LIMIT_TRUST_PROXY` | `req.ip` מאחורי proxy | — | `1` עם Traefik/Caddy/ngrok |

## URLs בין שירותים

| משתנה | פורט | Dev (host) | Docker |
|--------|------|------------|--------|
| `SCHEDULE_SERVICE_URL` | 4005 | `http://127.0.0.1:4005` | `http://schedule-service:4005` |
| `EMPLOYEE_SERVICE_URL` | 4002 | `http://127.0.0.1:4002` | `http://employee-service:4002` |
| `LOCATION_SERVICE_URL` | 4004 | `http://127.0.0.1:4004` | `http://location-service:4004` |
| `NOTIFICATION_SERVICE_URL` | 4006 | `http://127.0.0.1:4006` | `http://notification-service:4006` |
| `REPORT_SERVICE_URL` | 4008 | `http://127.0.0.1:4008` | `http://report-service:4008` |
| `AI_SERVICE_URL` | 4007 | `http://127.0.0.1:4007` | `http://ai-service:4007` |
| `DEPARTMENT_SERVICE_URL` | 4003 | `http://127.0.0.1:4003` | `http://department-service:4003` |

## CORS ו-URLs ציבוריים

| משתנה | תיאור |
|--------|--------|
| `CORS_ORIGIN` | Origin מותר לדפדפן (dev: `http://localhost:5173`) |
| `PUBLIC_APP_URL` | בסיס לקישורים במייל (reset password); ברירת מחדל: `CORS_ORIGIN` |
| `PASSWORD_RESET_TTL_MS` | תוקף token לאיפוס סיסמה (ms, default 3600000) |

## Auth bootstrap

| משתנה | תיאור |
|--------|--------|
| `ALLOW_PUBLIC_REGISTER` | `true` — הרשמה פתוחה; `false` — רק DB ריק או invite (production default) |
| `DEV_LOGIN_EMAIL` / `DEV_LOGIN_PASSWORD` | ל-`npm run ensure:dev-user` (dev בלבד) |

## AI ו-Automation

| משתנה | תיאור |
|--------|--------|
| `OPENAI_API_KEY` | AI recommendations (אופציונלי — mock בלי key) |
| `OPENAI_MODEL` | ברירת מחדל: `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` | Virtual assistant chat (server only) |
| `CLAUDE_MODEL` | ברירת מחדל: `claude-sonnet-4-6` |
| `ASSISTANT_CHAT_RATE_MAX` | rate limit לדקה למשתמש |
| `PREFERENCE_AI_DEBOUNCE_MS` | debounce לפני ריצת AI על preferences |
| `PREFERENCE_AI_MIN_OFFICE_PER_DAY` | מינימום office ביום (automation) |
| `PREFERENCE_AI_MAX_OFFICE_CAPACITY` | מקסימום קapacity |
| `SYSTEM_ACTOR_EMPLOYEE_ID` | employee ID ל-`createdBy` בהמלצות AI |

## התראות ו-SMTP

| משתנה | תיאור |
|--------|--------|
| `INCLUDE_ADMINS_IN_SCHEDULE_NOTIFICATIONS` | כלול admins בהתראות schedule |
| `PREFERENCE_REMINDER_INTERVAL_MS` | interval ל-worker תזכורות |
| `PREFERENCE_REMINDER_COOLDOWN_HOURS` | cooldown בין תזכורות |
| `SMTP_HOST` | dev: `localhost` (MailHog) |
| `SMTP_PORT` | dev: `1025` |
| `SMTP_SECURE` | `false` ל-MailHog |
| `SMTP_FROM` | כתובת From במיילים |

## Client (Vite)

| משתנה | תיאור |
|--------|--------|
| `VITE_API_BASE` | בסיס API (ריק = same-origin / proxy) |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile (client) |
| `TURNSTILE_SECRET` | אימות Turnstile (server) |
| `VITE_CENTRAL_LOGIN` | `true` — דף login מרכזי SaaS |
| `VITE_DASHBOARD_BG_VIDEO_URL` | וידאו רקע dashboard |
| `VITE_SITE_BG_VIDEO_URL` | alias ל-home + dashboard |
| `VITE_API_TIMEOUT_MS` | timeout axios (default 45000) |
| `VITE_SCHEDULE_SAVE_TIMEOUT_MS` | timeout מהיר ל-save shift |
| `VITE_SCHEDULE_SAVE_HEALTH_CHECK` | `0` לדלג על health לפני save |

## Multi-tenant SaaS

| משתנה | תיאור |
|--------|--------|
| `TENANT_DB_PREFIX` | prefix ל-DBs: `acme` → `acme_syt_employees` |
| `TENANT_SLUG` | מזהה tenant ב-registry |
| `GATEWAY_MODE` | `central` — gateway login מרכזי |
| `TENANT_BASE_DOMAIN` | דומיין בסis ל-subdomains |
| `CENTRAL_GATEWAY_HOST` | host של gateway מרכזי |

**חשוב:** אחרי שינוי `TENANT_DB_PREFIX` — **שמור `.env` ו-restart**. ודא בלוג: `Mongo connected: acme_syt_*`.

## Provision tenant (CLI)

לא env — דרך script:

```bash
npm run provision:tenant -- \
  --slug acme \
  --name "Acme Ltd" \
  --email-domains acme.co.il \
  --gateway-url https://acme.example.com \
  --auth-url http://auth-acme:4001
```

---

## English Summary

Environment variables are defined in `.env.example`. Core groups: Mongo/Redis, JWT and internal service secrets, inter-service URLs (hostnames differ between local Node and Docker), CORS/public URLs, auth bootstrap, AI keys (server-only), SMTP, Vite client flags, and optional SaaS tenant prefix/slug/central gateway mode. Never commit `.env`; use strong secrets in production. After changing `TENANT_DB_PREFIX`, save the file and restart services, verifying `acme_syt_*` in connection logs.
