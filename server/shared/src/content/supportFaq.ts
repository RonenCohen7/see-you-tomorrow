export type SupportFaqCategory = "login" | "password" | "registration" | "account" | "access" | "technical";

export type SupportFaqEntry = {
  id: string;
  category: SupportFaqCategory;
  questionHe: string;
  questionEn: string;
  answerHe: string;
  answerEn: string;
  keywords: string[];
  actionLink?: string;
  /** Shown as quick-pick chip on support page */
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

export const SUPPORT_FAQ_ENTRIES: SupportFaqEntry[] = [
  {
    id: "login-wrong-password",
    category: "login",
    quickPick: true,
    questionHe: "לא מצליח/ה להתחבר — סיסמה או אימייל שגויים",
    questionEn: "I can't sign in — wrong email or password",
    answerHe:
      "ודאו שהאימייל והסיסמה נכונים (רגיש לאותיות גדולות/קטנות). אם שכחתם סיסמה — השתמשו ב«שכחתי סיסמה». אם עדיין לא עובד — פנו למנהל/IT בארגון שלכם.",
    answerEn:
      "Check email and password (case-sensitive). Use Forgot password if needed. If it still fails, contact your company admin or IT.",
    keywords: ["login", "password", "sign in", "התחברות", "סיסמה", "אימייל"],
    actionLink: "/login",
  },
  {
    id: "login-turnstile",
    category: "login",
    questionHe: "אימות אבטחה (Turnstile) נכשל או לא מופיע",
    questionEn: "Security check (Turnstile) fails or doesn't appear",
    answerHe:
      "רעננו את העמוד. נסו דפדפן אחר או חלון incognito. בטלו חוסמי פרסומות/תוכן על הדומיין. אם הבעיה נמשכת — פנו למנהל המערכת.",
    answerEn:
      "Refresh the page. Try another browser or incognito. Disable ad blockers for this site. Contact your admin if it persists.",
    keywords: ["turnstile", "captcha", "אימות", "אבטחה"],
    actionLink: "/login",
  },
  {
    id: "password-forgot",
    category: "password",
    quickPick: true,
    questionHe: "שכחתי סיסמה — איך מאפסים?",
    questionEn: "I forgot my password — how do I reset it?",
    answerHe:
      "בעמוד ההתחברות לחצו «שכחתי סיסמה», הזינו את האימייל ושלחו. תקבלו קישור למייל (בפיתוח — MailHog). הקישור תקף לזמן מוגבל.",
    answerEn:
      "On the sign-in page click Forgot password, enter your email, and submit. You'll receive a reset link by email (MailHog in dev). The link expires after a limited time.",
    keywords: ["forgot", "reset", "password", "שכחתי", "איפוס"],
    actionLink: "/forgot-password",
  },
  {
    id: "password-no-email",
    category: "password",
    questionHe: "לא הגיע מייל לאיפוס סיסמה",
    questionEn: "Password reset email never arrived",
    answerHe:
      "בדקו תיקיית spam. ודאו שהאימייל זהה לזה שבו נרשמתם. ב-production — ודאו ש-SMTP מוגדר. אחרת פנו למנהל לאיפוס ידני.",
    answerEn:
      "Check spam. Confirm the email matches your account. In production, SMTP must be configured. Otherwise ask your admin for a manual reset.",
    keywords: ["email", "mail", "spam", "מייל", "לא הגיע"],
    actionLink: "/forgot-password",
  },
  {
    id: "registration-closed",
    category: "registration",
    quickPick: true,
    questionHe: "ההרשמה חסומה / לא מצליח להירשם",
    questionEn: "Registration is blocked / I can't register",
    answerHe:
      "ב-production הרשמה פתוחה רק כשאין עובדים במערכת, או עם קישור הזמנה מהמנהל. בקשו invite link או שמנהל יוסיף אתכם ידנית.",
    answerEn:
      "In production, registration is open only for an empty org or via an admin invite link. Ask your admin for an invite or to add you manually.",
    keywords: ["register", "signup", "הרשמה", "invite", "הזמנה"],
    actionLink: "/register",
  },
  {
    id: "registration-company-code",
    category: "registration",
    questionHe: "קוד חברה / subdomain — לאן נכנסים?",
    questionEn: "Company code / subdomain — which URL do I use?",
    answerHe:
      "כל חברה נכנסת דרך כתובת ייעודית (למשל acme.yourdomain.com) או עם קוד חברה בדף login מרכזי. שאלו את המנהל מה ה-URL של הארגון שלכם.",
    answerEn:
      "Each company uses its own URL (e.g. acme.yourdomain.com) or a company code on central login. Ask your admin for your organization's URL.",
    keywords: ["tenant", "company", "subdomain", "חברה", "קוד"],
    actionLink: "/login",
  },
  {
    id: "registration-invite",
    category: "registration",
    questionHe: "קישור הזמנה — איך משתמשים?",
    questionEn: "How do I use an invite link?",
    answerHe:
      "פתחו את הקישור מהמייל או מהמנהל. הוא יוביל ל«הרשמה» עם אימייל ממולא מראש. השלימו פרטים וסיסמה.",
    answerEn:
      "Open the link from your admin. It opens Register with your email pre-filled. Complete your details and password.",
    keywords: ["invite", "הזמנה", "link", "קישור"],
    actionLink: "/register",
  },
  {
    id: "account-deactivated",
    category: "account",
    quickPick: true,
    questionHe: "החשבון שלי מושבת / לא פעיל",
    questionEn: "My account is deactivated / inactive",
    answerHe:
      "מנהל הארגון יכול להשבית עובד (isActive=false). פנו למנהל HR/IT בארגון שלכם. אותו אימייל יכול להיות פעיל בחברה אחרת ב-SaaS.",
    answerEn:
      "Your org admin can deactivate employees (isActive=false). Contact your HR/IT admin. The same email may be active in another company on SaaS.",
    keywords: ["deactivated", "inactive", "isActive", "מושבת", "לא פעיל"],
  },
  {
    id: "account-wrong-company",
    category: "account",
    questionHe: "נכנסתי לחברה הלא נכונה / רואה נתונים לא שלי",
    questionEn: "I'm in the wrong company / see someone else's data",
    answerHe:
      "ודאו שאתם ב-URL הנכון של החברה. התנתקו והתחברו דרך כתובת הארגון שלכם. אם חשד לבעיית אבטחה — פנו מיד למנהל.",
    answerEn:
      "Confirm you're on your company's URL. Sign out and sign in via your org address. If you suspect a security issue, contact your admin immediately.",
    keywords: ["wrong", "tenant", "company", "חברה", "נתונים"],
    actionLink: "/login",
  },
  {
    id: "access-employee-vs-manager",
    category: "access",
    questionHe: "מה עובד רגיל רואה לעומת מנהל?",
    questionEn: "What can an employee see vs a manager?",
    answerHe:
      "עובד: יומן, חדרי ישיבות, העדפות נוכחות. מנהל/אדמין: לוח בקרה, לוחות, חניה, דוחות, AI (מנהלים), ועוד. העוזר החכם ב-app מיועד למנהלים בלבד.",
    answerEn:
      "Employee: calendar, meeting rooms, attendance preferences. Manager/admin: dashboard, schedules, parking, reports, AI tools, and more. The in-app smart assistant is for managers only.",
    keywords: ["employee", "manager", "role", "תפקיד", "הרשאות"],
  },
  {
    id: "access-who-to-contact",
    category: "access",
    questionHe: "למי פונים לעזרה בארגון?",
    questionEn: "Who do I contact for help at my company?",
    answerHe:
      "שאלות על סיסמה, הרשאות, מחלקה או לוח עבודה — מנהל/HR/IT בארגון שלכם. שאלות על המוצר הכללי — דף זה או sales@seeyoutomorrow.local.",
    answerEn:
      "Password, permissions, department, or schedule — your company admin/HR/IT. General product questions — this page or sales@seeyoutomorrow.local.",
    keywords: ["contact", "admin", "מנהל", "תמיכה"],
  },
  {
    id: "technical-browser",
    category: "technical",
    questionHe: "האתר לא נטען / שגיאות בדפדפן",
    questionEn: "Site won't load / browser errors",
    answerHe:
      "רענון מלא (Ctrl+Shift+R). נקו cache. נסו Chrome/Edge/Firefox. בדקו חיבור אינטרנט. מפתחים: ודאו ש-npm run dev רץ ו-gateway על פורט 4000.",
    answerEn:
      "Hard refresh (Ctrl+Shift+R). Clear cache. Try Chrome/Edge/Firefox. Check internet. Developers: ensure npm run dev is running and gateway is on port 4000.",
    keywords: ["browser", "cache", "502", "error", "דפדפן"],
  },
  {
    id: "technical-first-admin",
    category: "registration",
    questionHe: "איך נרשם אדמין ראשון?",
    questionEn: "How does the first admin register?",
    answerHe:
      "כשמסד העובדים ריק (או ALLOW_PUBLIC_REGISTER=true ב-dev), גשו ל«הרשמה» והירשמו — המשתמש הראשון יהיה admin. אחרת — invite מהמנהל.",
    answerEn:
      "When the employee DB is empty (or ALLOW_PUBLIC_REGISTER=true in dev), use Register — the first user becomes admin. Otherwise use an admin invite.",
    keywords: ["admin", "first", "register", "אדמין", "ראשון"],
    actionLink: "/register",
  },
];

export type SupportLocale = "he" | "en";

export function getFaqQuestion(entry: SupportFaqEntry, locale: SupportLocale): string {
  return locale === "en" ? entry.questionEn : entry.questionHe;
}

export function getFaqAnswer(entry: SupportFaqEntry, locale: SupportLocale): string {
  return locale === "en" ? entry.answerEn : entry.answerHe;
}

export function getQuickPickEntries(): SupportFaqEntry[] {
  return SUPPORT_FAQ_ENTRIES.filter((e) => e.quickPick);
}

export function serializeFaqForPrompt(locale: SupportLocale): string {
  const lines = SUPPORT_FAQ_ENTRIES.map(
    (e, i) =>
      `${i + 1}. Q: ${getFaqQuestion(e, locale)}\n   A: ${getFaqAnswer(e, locale)}${e.actionLink ? `\n   Link: ${e.actionLink}` : ""}`
  );
  return lines.join("\n\n");
}
