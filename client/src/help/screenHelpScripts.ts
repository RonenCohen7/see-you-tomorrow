import type { AppLocale } from "../locale/localeConstants";

/** Optional `highlight` is the value of `data-help-target` on a DOM node (not a free-form selector). */
export type HelpSegment = { text: string; highlight?: string };

const defaultHelpHe: HelpSegment[] = [
  {
    text: "ברוכים הבאים. כאן תמצאו הסבר קצר על המסך הנוכחי ומה אפשר לעשות בו.",
  },
  {
    text: "הקריינות כבויה כברירת מחדל — אפשר להפעיל אותה בכפתור הרמקול. בכל שלב מופיע חץ לאזור הרלוונטי במסך (כשהוא זמין).",
  },
];

const defaultHelpEn: HelpSegment[] = [
  {
    text: "Welcome. Here is a short overview of this screen and what you can do.",
  },
  {
    text: "Voice narration is off by default — use the speaker button to turn it on. Each step highlights the relevant area with an arrow when available.",
  },
];

const scriptsHe: Record<string, HelpSegment[]> = {
  "/dashboard": [
    { text: "לוח הבקרה נותן תמונת מצב מהירה: נוכחות, חניות והתראות רלוונטיות לצוות שלכם.", highlight: "dashboard-root" },
    { text: "עברו על הכרטיסים וההתראות. לחיצה על פריט מובילה לעמוד המתאים כדי להמשיך משם.", highlight: "dashboard-stats" },
    { text: "מומלץ לבדוק את המסך בתחילת יום העבודה, כדי לתאם בין נוכחות לחניות.", highlight: "dashboard-go-tiles" },
    {
      text: "כשיש התראות שלא נקראו, מוצג בתחתית כפתור צף בולט — אפשר להיכנס לגרסה מהירה או לציר המלא.",
      highlight: "dashboard-today-panel",
    },
  ],
  "/calendar": [
    { text: "בלשונית שבעה ימים קרובים מוצגים שבעת הימים בשלוש שורות, שלושה בעמודה.", highlight: "calendar-tabs" },
    { text: "הפריסה מפנה מקום לתוכן בלי לצמצם את גודל הכרטיסים.", highlight: "calendar-seven-grid" },
    {
      text: "בלשונית החודש יש כפתור לפתיחת לוח חודש מלא. לחיצה על יום בכל לשונית פותחת חלון לעריכת סטטוסים.",
      highlight: "calendar-full-month-btn",
    },
    { text: "בחירת חודש בשדה ליד הלשוניות משפיעה על שתי התצוגות.", highlight: "calendar-month-picker" },
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
    { text: "לוחות הזמנים הם רשימת כל השיבוצים: עובד, תאריך, סטטוס ושעות אופציונליות.", highlight: "schedules-info-banner" },
    { text: "מנהלים יכולים להוסיף משמרת, לערוך או למחוק. חיפוש עוזר למצוא עובד במהירות.", highlight: "schedules-toolbar-row" },
    { text: "לחיצה כפולה על שורת שיבוץ פותחת את דף הדוחות עם אותו עובד, תאריך וסטטוס.", highlight: "schedules-grid-host" },
    { text: "זה שימושי להפקת קובץ CSV או לשליחתו במייל.", highlight: "schedules-grid-host" },
  ],
  "/parking": [
    { text: "עמוד החניות מנהל חניות קבועות והקצאות זמניות לפי יום ושעות." },
    { text: "כשבעל החניה הקבוע לא במשרד, אפשר לשבץ חלופי לפי יום מתוך ההקצאות." },
  ],
  "/reports": [
    { text: "דוחות מאפשרים להפיק סיכום שיבוץ לפי סטטוס לטווח תאריכים, ודוח חניה." },
    { text: "בחרו טווח תאריכים שתואם ללוח הזמנים. אפשר לסנן לפי עובד, להוריד CSV או לשלוח למייל המחובר. לכל סטטוס פעיל יש לשונית משלו." },
    { text: "בסביבת פיתוח, מיילים נאספים בכלי MailHog אלא אם הוגדר שרת דואר אמיתי." },
  ],
  "/ai": [
    { text: "המלצות הבינה המלאכותית מנתחות לוחות, חניות ותאריכים קרובים, ומציעות נקודות לתשומת לב." },
    { text: "השתמשו ברשימה כהצעה בלבד. עדכון השיבוצים נשאר באחריות המנהלים." },
  ],
  "/notifications": [
    { text: "ציר ההתראות מציג עדכוני שיבוץ ושינויים שבוצעו במערכת." },
    { text: "אפשר לסמן התראה כנקראה, ולעבור ללוחות הזמנים לפי ההקשר של ההתראה." },
    {
      text: "מתוך כל מסך, כשלא קראתם התראות, מוצג בתחתית כפתור צף בולט (בדומה ליום הולדת) לפתיחה מהירה ולטיפול.",
    },
  ],
  "/profile": [
    { text: "בפרופיל מעדכנים פרטים אישיים ודרכי קשר של המשתמש המחובר." },
    { text: "שמירה כאן משפיעה על האופן שבו השם מוצג בשאר המסכים." },
  ],
  "/settings": [
    { text: "ההגדרות כוללות מצב תצוגה בהיר או כהה, והעדפות כלליות של הממשק." },
    { text: "שינויים נשמרים מקומית בדפדפן או בחשבון, לפי סוג ההגדרה." },
  ],
  "/scheduling-rules": [
    { text: "כאן מגדירים חוקי ארגון שמשפיעים על אימות לפני אישור המלצות AI ועל פרסום שינויים." },
    { text: "סגירת מיקום מגדירה טווח תאריכים שבהם משבצות משרד באותו אתר לא עוברות אימות." },
    {
      text: "חוק מנהלים ביום מגדיר מינימום שורות של מנהלים במשרד לכל יום — אפשר להפעיל או לכבות כל חוק בנפרד.",
    },
    { text: "מחיקה מסירה חוק מהמערכת; הפעלה מחודשת אפשרית רק בהוספת חוק חדש." },
  ],
};

const scriptsEn: Record<string, HelpSegment[]> = {
  "/dashboard": [
    {
      text: "The dashboard summarizes attendance, parking and alerts relevant to your team.",
      highlight: "dashboard-root",
    },
    {
      text: "Browse tiles and alerts — tapping an item jumps to the matching page.",
      highlight: "dashboard-stats",
    },
    { text: "Check here at the start of the day to align attendance with parking.", highlight: "dashboard-go-tiles" },
    {
      text: "Unread notifications show a prominent floating control at the bottom — open a quick review or the full timeline.",
      highlight: "dashboard-today-panel",
    },
  ],
  "/calendar": [
    { text: "The seven-day tab shows one week across three rows with three columns.", highlight: "calendar-tabs" },
    { text: "This layout frees space without shrinking cards.", highlight: "calendar-seven-grid" },
    {
      text: "The month tab has a button for the full calendar; tapping any day opens status editing.",
      highlight: "calendar-full-month-btn",
    },
    { text: "The month picker beside the tabs affects both views.", highlight: "calendar-month-picker" },
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
    { text: "Schedules lists every assignment — employee, date, status and optional hours.", highlight: "schedules-info-banner" },
    { text: "Managers add, edit or delete shifts; search finds employees quickly.", highlight: "schedules-toolbar-row" },
    {
      text: "Double-click a row to open Reports prefilled with employee, date and status.",
      highlight: "schedules-grid-host",
    },
    { text: "Use that flow for CSV export or email delivery.", highlight: "schedules-grid-host" },
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
      text: "Pick dates aligned with Schedules, optionally filter by employee, download CSV or email. Each active status has its own tab.",
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
    {
      text: "From any screen, unread items trigger a prominent floating banner (similar to birthdays) for quick review and action.",
    },
  ],
  "/profile": [
    { text: "Update personal info and contact paths for the signed-in user." },
    { text: "Saving updates how names render across the product." },
  ],
  "/settings": [
    { text: "Settings cover light/dark mode plus general UI preferences." },
    { text: "Some values persist locally or with your account depending on type." },
  ],
  "/scheduling-rules": [
    {
      text: "Define organization rules that affect validation before approving AI batches and publishing changes.",
    },
    {
      text: "Location closure blocks validating office shifts at that site across the dates you pick.",
    },
    {
      text: "Managers-per-day sets a minimum of managers marked office — toggle each rule on or off independently.",
    },
    { text: "Delete removes a rule permanently; recreate if you need it again." },
  ],
};

function fullMonthHelp(locale: AppLocale): HelpSegment[] {
  if (locale === "en") {
    return [
      { text: "Every day of the month appears in this grid with weekday headers.", highlight: "calendar-full-month-grid" },
      { text: "Tapping a day opens the same editor as the main calendar.", highlight: "calendar-full-month-grid" },
      {
        text: "Switch months from the picker or return to the shorter calendar via the button above.",
        highlight: "calendar-full-month-picker",
      },
    ];
  }
  return [
    { text: "כאן מוצגים כל ימי החודש בלוח מלא, לפי ימי השבוע.", highlight: "calendar-full-month-grid" },
    { text: "לחיצה על יום פותחת את אותו חלון עריכה כמו ביומן הראשי.", highlight: "calendar-full-month-grid" },
    { text: "אפשר לעבור חודש בשדה בחירת החודש, או לחזור ליומן המקוצר בכפתור למעלה.", highlight: "calendar-full-month-picker" },
  ];
}

/** Resolve segment highlight token to a safe attribute selector. */
export function helpHighlightSelector(token: string | undefined): string | null {
  if (!token || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(token)) return null;
  return `[data-help-target="${token}"]`;
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
    "/scheduling-rules": "schedulingRules",
  };
  return map[key] ?? null;
}
