import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FONT_HE = "SytHebrew";
const FONT_LAT = "SytLatin";

function fontHebrewPath(): string {
  return path.join(__dirname, "../../assets/NotoSansHebrew-Regular.ttf");
}

function fontLatinPath(): string {
  return path.join(__dirname, "../../assets/NotoSans-Regular.ttf");
}

const PDF_CTRL = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u00AD]/g;

/** Normalize and strip invisible / bidi controls that often break PDFKit/fontkit shaping. */
export function sanitizeTextForPdf(s: string): string {
  return s.normalize("NFC").replace(PDF_CTRL, "").trim();
}

function* iterChars(s: string): Generator<string> {
  for (let i = 0; i < s.length; ) {
    const cp = s.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    yield ch;
    i += cp > 0xffff ? 2 : 1;
  }
}

/** Hebrew + Hebrew presentation forms (letters / niqqud / punctuation in those blocks). */
function isHebrewScript(cp: number): boolean {
  return (cp >= 0x0590 && cp <= 0x05ff) || (cp >= 0xfb1d && cp <= 0xfb4f);
}

type ScriptRun = { hebrew: boolean; text: string };

function toScriptRuns(raw: string): ScriptRun[] {
  const s = sanitizeTextForPdf(raw);
  const runs: ScriptRun[] = [];
  for (const ch of iterChars(s)) {
    const cp = ch.codePointAt(0)!;
    const hebrew = isHebrewScript(cp);
    const last = runs[runs.length - 1];
    if (!last || last.hebrew !== hebrew) runs.push({ hebrew, text: ch });
    else last.text += ch;
  }
  return runs;
}

function contentWidth(doc: InstanceType<typeof PDFDocument>): number {
  const { width, margins } = doc.page;
  const left = margins.left;
  const right = margins.right;
  return width - left - right;
}

function registerFonts(doc: InstanceType<typeof PDFDocument>): void {
  doc.registerFont(FONT_HE, fontHebrewPath());
  doc.registerFont(FONT_LAT, fontLatinPath());
}

type Doc = InstanceType<typeof PDFDocument>;

/**
 * Right-aligned line mixing Hebrew (Noto Sans Hebrew) with Latin/digits/punctuation (Noto Sans).
 * `NotoSans-Regular` in this repo has no Hebrew; `NotoSansHebrew` has no Latin digits — both are required.
 */
function mixedRightLine(doc: Doc, text: string, options: { size: number; color?: string }): void {
  const runs = toScriptRuns(text);
  if (runs.length === 0) return;
  const width = contentWidth(doc);
  const color = options.color ?? "#000000";
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    doc.font(r.hebrew ? FONT_HE : FONT_LAT).fontSize(options.size).fillColor(color);
    doc.text(r.text, {
      width,
      align: "right",
      continued: i < runs.length - 1,
    });
  }
}

export function renderDailyStatusPdf(
  title: string,
  subtitle: string,
  rows: { fullName: string; workDate: string }[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      registerFonts(doc);
    } catch (e) {
      reject(e);
      return;
    }
    mixedRightLine(doc, title, { size: 18 });
    doc.moveDown(0.3);
    mixedRightLine(doc, subtitle, { size: 11, color: "#444444" });
    doc.moveDown(1);
    mixedRightLine(doc, "שם מלא", { size: 12 });
    doc.moveDown(0.25);
    mixedRightLine(doc, "תאריך", { size: 12 });
    doc.moveDown(0.5);
    for (const r of rows) {
      mixedRightLine(doc, r.fullName, { size: 11 });
      doc.moveDown(0.15);
      mixedRightLine(doc, `תאריך: ${r.workDate}`, { size: 10, color: "#333333" });
      doc.moveDown(0.35);
    }
    doc.end();
  });
}

export function renderParkingPdf(
  title: string,
  subtitle: string,
  rows: {
    spotLabel: string;
    locationName: string;
    ownerName: string;
    assigneeName: string;
    workDate: string;
    hoursText: string;
  }[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      registerFonts(doc);
    } catch (e) {
      reject(e);
      return;
    }
    mixedRightLine(doc, title, { size: 18 });
    doc.moveDown(0.3);
    mixedRightLine(doc, subtitle, { size: 11, color: "#444444" });
    doc.moveDown(1);
    for (const r of rows) {
      const loc = r.locationName ? ` · ${r.locationName}` : "";
      const line = `${r.workDate} | ${r.hoursText} | מוקצה ל: ${r.assigneeName} | בעלים: ${r.ownerName} | ${r.spotLabel}${loc}`;
      mixedRightLine(doc, line, { size: 10 });
      doc.moveDown(0.4);
    }
    doc.end();
  });
}
