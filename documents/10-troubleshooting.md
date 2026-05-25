# 10 — פתרון בעיות (Troubleshooting)

## EADDRINUSE על פורטים 4000–4008

**סימptom:** `listen EADDRINUSE` ב-gateway או microservices.

**סיבה:** שני `npm run dev` במקביל, או Node ישן שלא נסגר.

**פתרון:**

```bash
# Ctrl+C ב-terminal הישן, או:
npm run kill:ports
npm run dev
```

**מניעה:** terminal **אחד** בלבד עם `npm run dev`.  
אל תשתמש ב-`|` בין פקודות — `npm run docker:deps && npm run dev`.

---

## Redis ECONNREFUSED (127.0.0.1:6379)

**סימptom:** לוגים מ-`[notif]` — BullMQ לא מתחבר.

**סיבה:** Redis לא רץ.

**פתרון:**

```bash
npm run docker:deps
```

ודא Docker Desktop פעיל. פורט **6379** פתוח.

---

## Mongo: `syt_*` במקום `acme_syt_*`

**סימptom:** הגדרת `TENANT_DB_PREFIX=acme` אבל בלוג: `Mongo connected: syt_employees`.

**סיבה:** `.env` לא **נשמר לדיסק**, או לא restart אחרי שינוי.

**פתרון:**

1. פתח `.env`, ודא `TENANT_DB_PREFIX=acme`
2. **Save** (Cmd+S)
3. Restart כל השירותים
4. חפש בלוג: `Mongo connected: acme_syt_employees`

---

## Seed: `ENOTFOUND mongo`

**סימptom:** `npm run seed` נכשל עם `getaddrinfo ENOTFOUND mongo`.

**סיבה:** `MONGO_URI=mongodb://mongo:27017` — hostname `mongo` קיים רק **בתוך** Docker network.

**פתרון (seed מה-host):**

```env
MONGO_URI=mongodb://127.0.0.1:27017
```

```bash
npm run seed
```

---

## Admin רואה עובדים "ישנים" / חברה לא נכונה

**סיבה:** prefix לא פעיל — נתונים ב-`syt_*` במקום `acme_syt_*`.

**פתרון:** ראו סעיף prefix למעלה. ב-Compass/mongosh — בדוק איזה DB בשימוש.

---

## Vite על פורט 5174 במקום 5173

**סיבה:** 5173 תפוס.

**פתרון:**

```bash
npm run kill:ports
npm run dev
```

פתח `http://localhost:5173` (או את הפורט ש-Vite מדווח).

---

## ngrok 502 / ERR_NGROK_8012

**סיבה:** ngrok מצביע ל-5173 אבל Vite לא רץ, או רץ על פורט אחר.

**פתרון:**

1. Terminal A: `npm run dev` — המתן ל-Vite
2. בדוק locally: `http://localhost:5173`
3. Terminal B: `ngrok http 5173` (או הפורט האמיתי)

---

## הרשמה חסומה ב-production

**סיבה:** `ALLOW_PUBLIC_REGISTER=false` ו-DB לא ריק.

**פתרון:** admin ראשון רק כש-employees DB ריק; או `ALLOW_PUBLIC_REGISTER=true` (זהירות); או invite link מ-`provision:tenant`.

---

## מיילים לא מגיעים ב-dev

**בדיקה:** MailHog UI — `http://localhost:8025`

**פתרון:** `npm run docker:deps`. SMTP default: `localhost:1025`.

---

## Turnstile / CAPTCHA

אם widget לא מופיע — `VITE_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET` לא מוגדרים (ב-dev זה תקין — דילוג).

---

## Build נכשל

```bash
npm run build -w @syt/shared
npm run build --workspaces --if-present
```

shared חייב להיבנות לפני services.

---

## קישורים

- [05 — הרצה מקומית](05-running-locally.md)
- [09 — משתני env](09-environment-variables.md)
- [README troubleshooting](../README.md#troubleshooting)

---

## English Summary

Common issues: port conflicts (`kill:ports`, single `npm run dev`), missing Redis (`docker:deps`), tenant prefix not applied (save `.env` and restart — verify `acme_syt_*` in logs), seed failing with `ENOTFOUND mongo` (use `127.0.0.1` from host), wrong tenant data (check DB prefix), ngrok 502 (Vite must run on the tunneled port), blocked registration in production, MailHog for dev email, and build order (`@syt/shared` first).
