import type { AppLocale } from "../locale/localeConstants";

export type HelpSegment = { text: string };

const defaultHelpHe: HelpSegment[] = [
  { text: "ברוכים הבאים. כאן תמצאו הסבר קצר על המסך הנוכחי ומה אפשר לעשות בו." },
  { text: "אפשר להפעיל או להשתיק את הקריינות בכל רגע." },
];

const defaultHelpEn: HelpSegment[] = [
  { text: "Welcome. Here is a short overview of this screen and what you can do." },
  { text: "You can mute or unmute narration at any time." },
];

const scriptsHe: Record<string, HelpSegment[]> = {
  "/dashboard": [
    { text: "לוח הבקרה נותן תמונת מצב מהירה: נוכחות, חניות והתראות רלוונטיות לצוות שלכם." },
    { text: "עברו על הכרטיסים וההתראות. לחיצה על פריט מובילה לעמוד המתאים כדי להמשיך משם." },
    { text: "מומלץ לבדוק את המסך בתחילת יום העבודה, כדי לתאם בין נוכחות לחניות." },
  ],
  "/calendar": [
    { text: "בלשונית שבעה ימים קרובים מוצגים שבעת הימים בשלוש שורות, שלושה בעמודה." },
    { text: "הפריסה מפנה מקום לתוכן בלי לצמצם את גודל הכרטיסים." },
    { text: "בלשונית החודש יש כפתור לפתיחת לוח חודש מלא. לחיצה על יום בכל לשונית פותחת חלון לעריכת סטטוסים." },
    { text: "בחירת חודש בשדה ליד הלשוניות משפיעה על שתי התצוגות." },
  ],
  "/employees": [
    { text: "כאן מנהלים את כרטיסי העובדים: פרטים, תפקיד, מחלקה ומיקום." },
    { text: "אפשר לחפש, לסנן לפעילים בלבד, ולפתוח עריכה לעדכון פרטים או תמונה." },
    { text: "שינויים כאן משפיעים על ההרשאות ועל התצוגה בשאר חלקי המערכת." },
  ],
  "/departments": [
    { text: "מסך המחלקות משמש לארגון צוותים ולקישור עובדים למבנה הארגוני." },
    { text: "ניתן ליצור מחלקה חדשה, לערוך תיאור ותמונה, ולשמור על סדר ברור לניהול." },
  ],
  "/locations": [
    { text: "מיקומים מגדירים אתרים פיזיים של הארגון, כולל קיבולת וחניות." },
    { text: "מכאן מקשרים עובדים ומחלקות למשרד הנכון, ומנהלים את רשימת החניות לכל אתר." },
  ],
  "/schedules": [
    { text: "לוחות הזמנים הם רשימת כל השיבוצים: עובד, תאריך, סטטוס ושעות אופציונליות." },
    { text: "מנהלים יכולים להוסיף משמרת, לערוך או למחוק. חיפוש עוזר למצוא עובד במהירות." },
    { text: "לחיצה כפולה על שורת שיבוץ פותחת את דף הדוחות עם אותו עובד, תאריך וסטטוס." },
    { text: "זה שימושי להפקת קובץ PDF או לשליחה במייל." },
  ],
  "/parking": [
    { text: "עמוד החניות מנהל חניות קבועות והקצאות זמניות לפי יום ושעות." },
    { text: "כשבעל החניה הקבוע לא במשרד, אפשר לשבץ חלופי לפי יום מתוך ההקצאות." },
  ],
  "/reports": [
    { text: "דוחות מאפשרים להפיק סיכום שיבוץ לפי סטטוס לטווח תאריכים, ודוח חניה." },
    { text: "בחרו טווח תאריכים שתואם ללוח הזמנים. אפשר לסנן לפי עובד, להוריד PDF או לשלוח למייל המחובר." },
    { text: "בסביבת פיתוח, מיילים נאספים בכלי MailHog אלא אם הוגדר שרת דואר אמיתי." },
  ],
  "/ai": [
    { text: "המלצות הבינה המלאכותית מנתחות לוחות, חניות ותאריכים קרובים, ומציעות נקודות לתשומת לב." },
    { text: "השתמשו ברשימה כהצעה בלבד. עדכון השיבוצים נשאר באחריות המנהלים." },
  ],
  "/notifications": [
    { text: "ציר ההתראות מציג עדכוני שיבוץ ושינויים שבוצעו במערכת." },
    { text: "אפשר לסמן התראה כנקראה, ולעבור ללוחות הזמנים לפי ההקשר של ההתראה." },
  ],
  "/profile": [
    { text: "בפרופיל מעדכנים פרטים אישיים ודרכי קשר של המשתמש המחובר." },
    { text: "שמירה כאן משפיעה על האופן שבו השם מוצג בשאר המסכים." },
  ],
  "/settings": [
    { text: "ההגדרות כוללות מצב תצוגה בהיר או כהה, והעדפות כלליות של הממשק." },
    { text: "שינויים נשמרים מקומית בדפדפן או בחשבון, לפי סוג ההגדרה." },
  ],
};

const scriptsEn: Record<string, HelpSegment[]> = {
  "/dashboard": [
    {
      text: "The dashboard summarizes attendance, parking and alerts relevant to your team.",
    },
    {
      text: "Browse tiles and alerts — tapping an item jumps to the matching page.",
    },
    { text: "Check here at the start of the day to align attendance with parking." },
  ],
  "/calendar": [
    { text: "The seven-day tab shows one week across three rows with three columns." },
    { text: "This layout frees space without shrinking cards." },
    {
      text: "The month tab has a button for the full calendar; tapping any day opens status editing.",
    },
    { text: "The month picker beside the tabs affects both views." },
  ],
  "/employees": [
    { text: "Manage employee cards — details, role, department and location." },
    { text: "Search, filter active-only, open edit to update profile text or photo." },
    { text: "Changes here affect permissions and what appears elsewhere." },
  ],
  "/departments": [
    { text: "Organize teams and attach employees to the org chart." },
    { text: "Create departments, edit descriptions and photos, keep structure tidy." },
  ],
  "/locations": [
    { text: "Locations describe physical sites including capacity and parking inventory." },
    { text: "Link people and departments to the right office and maintain spots per site." },
  ],
  "/schedules": [
    { text: "Schedules lists every assignment — employee, date, status and optional hours." },
    { text: "Managers add, edit or delete shifts; search finds employees quickly." },
    {
      text: "Double-click a row to open Reports prefilled with employee, date and status.",
    },
    { text: "Use that flow for PDF export or email delivery." },
  ],
  "/parking": [
    { text: "Parking manages permanent assignments and temporary reservations by day and hours." },
    {
      text: "When the permanent holder is off-site you can seat alternates via reservations.",
    },
  ],
  "/reports": [
    {
      text: "Reports summarize assignments by status across a date range plus parking allocations.",
    },
    {
      text: "Pick dates aligned with Schedules, optionally filter by employee, download PDF or email.",
    },
    { text: "In development mail lands in MailHog unless SMTP is configured." },
  ],
  "/ai": [
    {
      text: "AI recommendations analyze schedules, parking and upcoming dates for risk signals.",
    },
    { text: "Treat suggestions as guidance — managers remain responsible for assignments." },
  ],
  "/notifications": [
    { text: "The timeline lists assignment updates and other changes." },
    { text: "Mark items read and jump into Schedules using notification context." },
  ],
  "/profile": [
    { text: "Update personal info and contact paths for the signed-in user." },
    { text: "Saving updates how names render across the product." },
  ],
  "/settings": [
    { text: "Settings cover light/dark mode plus general UI preferences." },
    { text: "Some values persist locally or with your account depending on type." },
  ],
};

function fullMonthHelp(locale: AppLocale): HelpSegment[] {
  if (locale === "en") {
    return [
      { text: "Every day of the month appears in this grid with weekday headers." },
      { text: "Tapping a day opens the same editor as the main calendar." },
      {
        text: "Switch months from the picker or return to the shorter calendar via the button above.",
      },
    ];
  }
  return [
    { text: "כאן מוצגים כל ימי החודש בלוח מלא, לפי ימי השבוע." },
    { text: "לחיצה על יום פותחת את אותו חלון עריכה כמו ביומן הראשי." },
    { text: "אפשר לעבור חודש בשדה בחירת החודש, או לחזור ליומן המקוצר בכפתור למעלה." },
  ];
}

export function getHelpSegments(pathname: string, locale: AppLocale): HelpSegment[] {
  const key = pathname.replace(/\/+$/, "") || "/";
  if (key.startsWith("/calendar/month")) {
    return fullMonthHelp(locale);
  }
  const bank = locale === "en" ? scriptsEn : scriptsHe;
  const fallback = locale === "en" ? defaultHelpEn : defaultHelpHe;
  return bank[key] ?? fallback;
}

/** i18n key for screen title (matches nav). */
export function helpScreenTitleKey(pathname: string): string | null {
  const key = pathname.replace(/\/+$/, "") || "/";
  if (key.startsWith("/calendar/month")) return "calendar";
  const map: Record<string, string> = {
    "/dashboard": "dashboard",
    "/calendar": "calendar",
    "/employees": "employees",
    "/departments": "departments",
    "/locations": "locations",
    "/schedules": "schedules",
    "/parking": "parking",
    "/reports": "reports",
    "/ai": "ai",
    "/notifications": "notifications",
    "/profile": "profile",
    "/settings": "settings",
  };
  return map[key] ?? null;
}
