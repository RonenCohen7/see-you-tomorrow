export type SupportFaqCategory = "login" | "password" | "registration" | "account" | "access" | "technical";

export type SupportFaqEntry = {
  id: string;
  category: SupportFaqCategory;
  question: string;
  answer: string;
  keywords: string[];
  quickPick?: boolean;
};

export const SUPPORT_FAQ_CATEGORIES: SupportFaqCategory[] = [
  "login",
  "password",
  "registration",
  "account",
  "access",
  "technical",
];

export const SUPPORT_CATEGORY_LABEL: Record<SupportFaqCategory, string> = {
  login: "התחברות",
  password: "סיסמה",
  registration: "הרשמה",
  account: "חשבון",
  access: "הרשאות וגישה",
  technical: "טכני",
};

/** Same Hebrew answers as the website help center. */
export const SUPPORT_FAQ_ENTRIES: SupportFaqEntry[] = [
  {
    id: "login-wrong-password",
    category: "login",
    quickPick: true,
    question: "לא מצליח/ה להתחבר — סיסמה או אימייל שגויים",
    answer:
      "ודאו שהאימייל והסיסמה נכונים (רגיש לאותיות גדולות/קטנות). אם שכחתם סיסמה — השתמשו ב«שכחתי סיסמה». אם עדיין לא עובד — פנו למנהל/IT בארגון שלכם.",
    keywords: ["login", "password", "sign in", "התחברות", "סיסמה", "אימייל"],
  },
  {
    id: "login-turnstile",
    category: "login",
    question: "אימות אבטחה (Turnstile) נכשל או לא מופיע",
    answer:
      "רעננו את העמוד. נסו דפדפן אחר או חלון incognito. בטלו חוסמי פרסומות/תוכן על הדומיין. אם הבעיה נמשכת — פנו למנהל המערכת.",
    keywords: ["turnstile", "captcha", "אימות", "אבטחה"],
  },
  {
    id: "password-forgot",
    category: "password",
    quickPick: true,
    question: "שכחתי סיסמה — איך מאפסים?",
    answer:
      "בעמוד ההתחברות לחצו «שכחתי סיסמה», הזינו את האימייל ושלחו. תקבלו קישור למייל (בפיתוח — MailHog). הקישור תקף לזמן מוגבל.",
    keywords: ["forgot", "reset", "password", "שכחתי", "איפוס"],
  },
  {
    id: "password-no-email",
    category: "password",
    question: "לא הגיע מייל לאיפוס סיסמה",
    answer:
      "בדקו תיקיית spam. ודאו שהאימייל זהה לזה שבו נרשמתם. ב-production — ודאו ש-SMTP מוגדר. אחרת פנו למנהל לאיפוס ידני.",
    keywords: ["email", "mail", "spam", "מייל", "לא הגיע"],
  },
  {
    id: "registration-closed",
    category: "registration",
    quickPick: true,
    question: "ההרשמה חסומה / לא מצליח להירשם",
    answer:
      "ב-production הרשמה פתוחה רק כשאין עובדים במערכת, או עם קישור הזמנה מהמנהל. בקשו invite link או שמנהל יוסיף אתכם ידנית.",
    keywords: ["register", "signup", "הרשמה", "invite", "הזמנה"],
  },
  {
    id: "registration-company-code",
    category: "registration",
    question: "קוד חברה / subdomain — לאן נכנסים?",
    answer:
      "כל חברה נכנסת דרך כתובת ייעודית (למשל acme.yourdomain.com) או עם קוד חברה בדף login מרכזי. שאלו את המנהל מה ה-URL של הארגון שלכם.",
    keywords: ["tenant", "company", "subdomain", "חברה", "קוד"],
  },
  {
    id: "registration-invite",
    category: "registration",
    question: "קישור הזמנה — איך משתמשים?",
    answer: "פתחו את הקישור מהמייל או מהמנהל. הוא יוביל ל«הרשמה» עם אימייל ממולא מראש. השלימו פרטים וסיסמה.",
    keywords: ["invite", "הזמנה", "link", "קישור"],
  },
  {
    id: "account-deactivated",
    category: "account",
    quickPick: true,
    question: "החשבון שלי מושבת / לא פעיל",
    answer:
      "מנהל הארגון יכול להשבית עובד (isActive=false). פנו למנהל HR/IT בארגון שלכם. אותו אימייל יכול להיות פעיל בחברה אחרת ב-SaaS.",
    keywords: ["deactivated", "inactive", "isActive", "מושבת", "לא פעיל"],
  },
  {
    id: "account-wrong-company",
    category: "account",
    question: "נכנסתי לחברה הלא נכונה / רואה נתונים לא שלי",
    answer:
      "ודאו שאתם ב-URL הנכון של החברה. התנתקו והתחברו דרך כתובת הארגון שלכם. אם חשד לבעיית אבטחה — פנו מיד למנהל.",
    keywords: ["wrong", "tenant", "company", "חברה", "נתונים"],
  },
  {
    id: "access-employee-vs-manager",
    category: "access",
    question: "מה עובד רגיל רואה לעומת מנהל?",
    answer:
      "עובד: יומן, חדרי ישיבות, העדפות נוכחות. מנהל/אדמין: לוח בקרה, לוחות, חניה, דוחות, AI (מנהלים), ועוד. העוזר החכם ב-app מיועד למנהלים בלבד.",
    keywords: ["employee", "manager", "role", "תפקיד", "הרשאות"],
  },
  {
    id: "access-who-to-contact",
    category: "access",
    question: "למי פונים לעזרה בארגון?",
    answer:
      "שאלות על סיסמה, הרשאות, מחלקה או לוח עבודה — מנהל/HR/IT בארגון שלכם. שאלות על המוצר הכללי — דף זה או sales@seeyoutomorrow.local.",
    keywords: ["contact", "admin", "מנהל", "תמיכה"],
  },
  {
    id: "technical-browser",
    category: "technical",
    question: "האתר לא נטען / שגיאות בדפדפן",
    answer:
      "רענון מלא (Ctrl+Shift+R). נקו cache. נסו Chrome/Edge/Firefox. בדקו חיבור אינטרנט. מפתחים: ודאו ש-npm run dev רץ ו-gateway על פורט 4000.",
    keywords: ["browser", "cache", "502", "error", "דפדפן"],
  },
  {
    id: "technical-first-admin",
    category: "registration",
    question: "איך נרשם אדמין ראשון?",
    answer:
      "כשמסד העובדים ריק (או ALLOW_PUBLIC_REGISTER=true ב-dev), גשו ל«הרשמה» והירשמו — המשתמש הראשון יהיה admin. אחרת — invite מהמנהל.",
    keywords: ["admin", "first", "register", "אדמין", "ראשון"],
  },
];

export function quickPickEntries(): SupportFaqEntry[] {
  return SUPPORT_FAQ_ENTRIES.filter((entry) => entry.quickPick);
}
