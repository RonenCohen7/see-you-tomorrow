# DigitalOcean — SaaS משותף

שרת אחד. כל ארגון נרשם עם קוד משלו, והנתונים נשמרים במסדי Mongo נפרדים (`acme_syt_employees`, `beta_syt_schedules`, …). בקשה של ארגון אחד לא נפתחת על המסדים של ארגון אחר.

## לפני העלייה

1. Droplet Ubuntu (2 GB RAM לפחות, 4 GB נוח יותר).
2. דומיין עם רשומת A אל כתובת ה-IP של ה-droplet (`app.example.com`).
3. ב-firewall של DigitalOcean: פתוחים 22, 80, 443 בלבד. אל תפתחו 27017.

## על השרת

```bash
git clone <repo-url> seeYouTomorrow
cd seeYouTomorrow
cp deploy/digitalocean/.env.example deploy/digitalocean/.env
# ערכו DOMAIN, PUBLIC_APP_URL, JWT_SECRET, INTERNAL_SERVICE_SECRET
chmod +x deploy/digitalocean/bootstrap.sh
./deploy/digitalocean/bootstrap.sh
```

אחר כך פתחו `https://הדומיין/register`, בחרו «ארגון חדש», והמשתמש הראשון הוא מנהל הארגון.

נתונים שכבר קיימים במסדים `syt_*` (בלי קידומת) לא עוברים אוטומטית. כדי לאמץ ארגון קיים, העתיקו כל מסד ל-`{slug}_syt_*` והריצו `npm run provision:tenant`.
