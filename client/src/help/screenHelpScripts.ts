import type { AppLocale } from "../locale/localeConstants";
import type { Role } from "../types/models";

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
    {
      text: "צבע השורה נקבע אך ורק לפי הסטטוס שבעמודה «סטטוס» (משרד / בית / חופשה / מחלקה / לא עובד / סטטוס מותאם), ולא לפי ההערה — לכן אותה הערה יכולה להופיע בשורות בצבעים שונים כשהסטטוס שונה.",
      highlight: "schedules-grid-host",
    },
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
    { text: "כאן מגדירים חוקי ארגון — בעיקר לאימות לפני אישור המלצות AI; חנייה אוטומטית פועלת בשמירת שיבוץ." },
    { text: "תארו חוק בשפה חופשית למעלה: אם אין סתירה הוא נשמר מיד; אם יש סתירה — נשלחת הצעה לאישור מנהלים." },
    { text: "סגירת מיקום: טווח תאריכים שבו לא מאושר משרד באותו אתר ב-AI." },
    { text: "מינימום מנהלים במשרד: ספירת מנהלים/אדמין במשרד ביום עבודה (לא שישי–שבת)." },
    { text: "חנייה אוטומטית למנהל במשרד: ניסיון להקצות חניית אורח כששומרים מנהל/אדמין במשרד עם מיקום." },
    { text: "ממתין לאישור: הצעות עם סתירה — אדמין מאשר או דוחה; המאשר מחליף חוקים סותרים." },
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
      text: "Row color comes solely from the «Status» column (office / home / vacation / sick / off / custom), not from the comment — so the same note can appear on rows in different colors when their status differs.",
      highlight: "schedules-grid-host",
    },
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
      text: "Organization rules mainly gate AI recommendation approval; auto-parking runs on schedule save.",
    },
    {
      text: "Describe a rule in plain language: saved immediately when there is no conflict; otherwise sent for manager approval.",
    },
    {
      text: "Location closure: date range where office at that site fails AI validation.",
    },
    {
      text: "Minimum managers in office: count managers/admins marked office per weekday (Fri–Sat excluded).",
    },
    {
      text: "Manager auto-parking: tries guest parking when a manager/admin is saved as office with a location.",
    },
    {
      text: "Pending approval: conflicting proposals — admin approves (replaces conflicting rules) or rejects.",
    },
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

/**
 * Per nav-key explanation for the menu tour. Phrased so that closely-related
 * items (AI vs notifications vs scheduling rules vs preference queue) are
 * clearly distinguished from one another.
 */
type MenuExplanation = { he: string; en: string };

const menuItemExplanations: Record<string, MenuExplanation> = {
  dashboard: {
    he: "לוח הבקרה — תצוגה אחת לכל מה שחשוב היום: נוכחות, חניות, התראות פעילות וקיצורי דרך לפעולה.",
    en: "Dashboard — one screen with today's essentials: attendance, parking, active alerts, and quick actions.",
  },
  calendar: {
    he: "יומן — תצוגה ויזואלית של ימי העבודה שלך והצוות (משרד / בית / חופשה). לחיצה על יום פותחת עריכת סטטוס.",
    en: "Calendar — visual view of your week and the team (office / home / vacation). Tap a day to edit its status.",
  },
  meetingRooms: {
    he: "חדרי ישיבות — הזמנת חדר לפגישה: בחירת חדר, יום ושעות. כאן גם רואים את ההזמנות הקיימות.",
    en: "Meeting rooms — book a room: pick room, day and hours. You can also see existing bookings here.",
  },
  attendancePrefs: {
    he: "העדפות שיבוץ — כאן עובד מסמן לאיזה יום הוא רוצה להגיע למשרד, להישאר בבית או לקחת חופשה. לאחר ההגשה ה-AI לוקח את ההעדפות ובונה הצעת לוח לאישור המנהל.",
    en: "Preferences — employees mark which days they want office, home, or vacation. After submit the AI builds a draft schedule for manager approval.",
  },
  employees: {
    he: "עובדים — ניהול כרטיסי עובדים: פרטים, מחלקה, תפקיד, מיקום וחנייה קבועה. אדמין בלבד.",
    en: "Employees — manage employee cards: details, department, role, location and permanent parking. Admin only.",
  },
  departments: {
    he: "מחלקות — מבנה הארגון: שיוך עובדים למחלקה ולמנהל אחראי. אדמין בלבד.",
    en: "Departments — org structure: tie employees to a department and its manager. Admin only.",
  },
  locations: {
    he: "מיקומים — המשרדים הפיזיים: קיבולת ומלאי חניות לכל אתר. אדמין בלבד.",
    en: "Locations — physical offices: capacity and parking inventory per site. Admin only.",
  },
  schedulingRules: {
    he: "חוקי שיבוץ — הגדרות מבניות שמשפיעות איך ה-AI בונה הצעות וכיצד שומרים שיבוצים: למשל סגירת מיקום בתאריכים, מינימום מנהלים במשרד או הקצאת חניית אורח אוטומטית למנהלים. שונה מ-«המלצות AI»: כאן זה החוקים הקבועים, שם זה ההצעה הספציפית.",
    en: "Scheduling rules — structural settings that shape AI proposals and saves: e.g. location closure dates, minimum managers in office, automatic guest parking for managers. Different from «AI recommendations»: here are the fixed rules; there is the concrete proposal.",
  },
  schedules: {
    he: "ניהול שיבוצים — הרשימה המלאה של כל המשמרות במערכת. כאן מוסיפים/עורכים/מוחקים שיבוצים, מחפשים עובד ומפיקים דוחות. שונה מ«יומן»: היומן הוא תצוגה ויזואלית של הצוות שלך, כאן רואים את כל הרשומות הגולמיות.",
    en: "Schedules — full list of every assignment row. Add/edit/delete shifts, search employees and run reports. Different from «Calendar»: the calendar is a visual team view; this is the raw assignment data.",
  },
  teamAttendancePrefs: {
    he: "העדפות צוות — מה הצוות שלך סימן כהעדפה לשבוע הקרוב. זה הקלט ל-AI לפני שהוא בונה הצעת לוח. שונה מ«תור אישור העדפות»: זה הסקירה הגולמית; שם זה כבר הצעה מוכנה לאישור.",
    en: "Team preferences — what your team marked for next week. This is the input the AI uses before building a proposal. Different from «Preference queue»: this is raw input; the queue is a ready-made proposal awaiting approval.",
  },
  preferenceAiQueueNav: {
    he: "תור אישור העדפות — אצוות AI שנוצרו אוטומטית מההעדפות של הצוות וממתינות לאישור המנהל. כאן רואים שורת בקשה לכל אצווה, לוחצים, סוקרים ומאשרים/דוחים.",
    en: "Preference approval queue — AI batches built automatically from team preferences, waiting for manager approval. Each pending batch is a clickable row — open it, review and approve or reject.",
  },
  parking: {
    he: "חניות — ניהול חניות קבועות ושיבוצים זמניים לפי יום ושעות. כשבעל החניה הקבוע לא במשרד אפשר לשבץ חלופי.",
    en: "Parking — manage permanent spots and temporary reservations by day/hours. Seat alternates when the permanent holder is off-site.",
  },
  reports: {
    he: "דוחות — סיכומי שיבוץ וחניה לטווח תאריכים: סינון, ייצוא CSV ושליחה במייל. שונה מ«לוח הבקרה»: דוחות הם פלט פורמלי לתקופה; הלוח הוא תצוגת מצב לרגע נתון.",
    en: "Reports — schedule and parking summaries across date ranges: filter, export CSV, email. Different from «Dashboard»: reports are formal output for a period; the dashboard is real-time status.",
  },
  ai: {
    he: "המלצות AI — שכבת ייעוץ פרואקטיבית: ה-AI סורק לוחות, חניות והעדפות וצף נקודות לתשומת לב («כיסוי חסר ביום שלישי», «יותר מדי בית באותו יום»). אינו משנה כלום אוטומטית. שונה מ«התראות»: ההתראות מציגות מה שכבר קרה (שיבוץ עודכן, חניה הוקצתה); כאן מקבלים תובנות לפעולה עתידית.",
    en: "AI recommendations — proactive advisory layer: scans schedules, parking and preferences and surfaces issues («low office coverage Tuesday», «too many home on the same day»). Nothing is changed automatically. Different from «Notifications»: notifications show what already happened (assignment edited, parking allocated); here you get forward-looking insights.",
  },
  notifications: {
    he: "התראות — היסטוריה ועדכונים שכבר התרחשו: שיבוץ נערך, הזמנת חדר ישיבות, אצווה ממתינה לאישור, וכו'. שונה מ«המלצות AI» שעוסקות במה כדאי לעשות, ומ«חוקי שיבוץ» שמגדירים מה מותר.",
    en: "Notifications — timeline of events that already happened: assignment edited, room booked, batch awaiting approval, etc. Different from «AI recommendations» (what you should do) and from «Scheduling rules» (what is allowed).",
  },
  profile: {
    he: "פרופיל — פרטי המשתמש שלך: שם, תמונה, פרטי קשר. שינויים כאן משפיעים על כל המקומות שבהם מופיע השם שלך.",
    en: "Profile — your own user info: name, photo, contact details. Changes here propagate everywhere your name appears.",
  },
  settings: {
    he: "הגדרות — מצב כהה/בהיר, שפה, והעדפות ממשק כלליות. לאדמין יש כאן גם הגדרות ארגוניות (משלוח מיילים, ימי תזכורת וכו').",
    en: "Settings — light/dark mode, language, general UI preferences. Admins also get organization-level settings (mail, reminder cadence, etc.).",
  },
};

/** Lead-in segments for the menu tour, localized. */
const menuTourIntro: Record<AppLocale, HelpSegment[]> = {
  he: [
    {
      text:
        "זהו סיור קצר של התפריט הראשי. בכל שלב יוצג איזה פריט מוגדר לאיזה תפקיד, ומה ההבדל בינו לבין פריטים דומים (כמו המלצות AI / התראות / חוקי שיבוץ).",
      highlight: "app-nav",
    },
  ],
  en: [
    {
      text:
        "This is a short tour of the main menu. Each step explains what an item does and how it differs from similar ones (e.g. AI recommendations vs notifications vs scheduling rules).",
      highlight: "app-nav",
    },
  ],
};

/** Item that may live outside the visible nav list — defaults applied when role permits. */
const menuTourOutro: Record<AppLocale, HelpSegment[]> = {
  he: [
    {
      text:
        "בנוסף לפריטי התפריט יש בכל מסך כפתורים צפים (FAB): התראות שלא נקראו, ימי הולדת, תובנות AI והעוזר החכם. עובד רגיל אינו רואה אותם.",
    },
  ],
  en: [
    {
      text:
        "Beyond the menu, each screen has floating buttons (FABs): unread notifications, birthdays, AI insights, and the smart assistant. Regular employees do not see them.",
    },
  ],
};

/**
 * Build a menu tour for the given visible nav keys (in display order). The
 * "key" matches the existing nav `key` field which is also used to set
 * `data-help-target="nav-${key}"` on each ListItemButton.
 */
export function getMenuTourSegments(
  locale: AppLocale,
  visibleNavKeys: ReadonlyArray<string>,
  _role: Role | null | undefined
): HelpSegment[] {
  const intro = menuTourIntro[locale] ?? menuTourIntro.he;
  const outro = menuTourOutro[locale] ?? menuTourOutro.he;

  const perItem: HelpSegment[] = [];
  for (const key of visibleNavKeys) {
    const exp = menuItemExplanations[key];
    if (!exp) continue;
    perItem.push({
      text: locale === "en" ? exp.en : exp.he,
      highlight: `nav-${key}`,
    });
  }

  if (perItem.length === 0) return intro;
  return [...intro, ...perItem, ...outro];
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
