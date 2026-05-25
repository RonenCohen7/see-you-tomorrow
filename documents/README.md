# תיעוד מערכת See You Tomorrow

מסמכים מלאים בעברית, עם **English Summary** בסוף כל קובץ.  
Quick-start באנגלית: [README.md](../README.md).

## למי מיועד

| קהל | מסמכים מומלצים |
|-----|----------------|
| מפתח חדש בפרויקט | [01](01-system-overview.md) → [02](02-architecture.md) → [05](05-running-locally.md) |
| מפתח / Product | [03](03-modules-and-flows.md) |
| DevOps / Backend | [06](06-docker-deployment.md), [09](09-environment-variables.md), [10](10-troubleshooting.md) |
| מפעיל SaaS | [04](04-database-and-saas.md), [07](07-saas-tenants.md), [08](08-production-and-dns.md) |

## מפת מסמכים

| # | קובץ | תוכן |
|---|------|------|
| 01 | [system-overview](01-system-overview.md) | מה המערכת, תפקידים, single vs multi-tenant |
| 02 | [architecture](02-architecture.md) | Microservices, Gateway, JWT, Redis, Socket.IO |
| 03 | [modules-and-flows](03-modules-and-flows.md) | כל מודול וזרימה עסקית |
| 04 | [database-and-saas](04-database-and-saas.md) | MongoDB, הפרדה בין חברות |
| 05 | [running-locally](05-running-locally.md) | הרצה מקומית צעד-אחר-צעד |
| 06 | [docker-deployment](06-docker-deployment.md) | Docker Compose, build, seed |
| 07 | [saas-tenants](07-saas-tenants.md) | Subdomain, env, provision, לקוח חדש |
| 08 | [production-and-dns](08-production-and-dns.md) | AWS, דומיין, DNS, SSL |
| 09 | [environment-variables](09-environment-variables.md) | מילון משתני `.env` |
| 10 | [troubleshooting](10-troubleshooting.md) | בעיות נפוצות ופתרונות |

## קישורים חיצוניים ל-repo

- [`.env.example`](../.env.example) — תבנית משתני סביבה
- [`deploy/`](../deploy/) — תבניות Docker, Caddy, Traefik
- [`server/scripts/provision-tenant.ts`](../server/scripts/provision-tenant.ts) — provisioning לקוח SaaS

---

## English Summary

This folder contains the full **See You Tomorrow** documentation in Hebrew, with an English summary at the end of each document. Use **01–05** for onboarding developers, **04–08** for SaaS operators, and **09–10** as reference. The root [README.md](../README.md) remains the English quick-start guide.
