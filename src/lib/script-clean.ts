/**
 * Rule-based "clean up for speech" pass run after a file is read and before chapters are built.
 * Never touches voice tags, chapter headings or paragraph breaks.
 */
import { looksLikeHeading } from "./extract";
import { VOICE_TAG_REGEX } from "./voice-tags";

export interface CleanChange {
  id: string;
  rule: string;
  before: string;
  after: string;
}

export interface CleanResult {
  text: string;
  changes: CleanChange[];
}

const ONES = (
  "शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस " +
  "बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस " +
  "चालीस इकतालीस बयालीस तैंतालीस चौवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ " +
  "साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सरसठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी " +
  "अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानबे बानबे तिरानबे चौरानबे पंचानबे छियानबे सत्तानबे अट्ठानबे निन्यानबे"
).split(" ");

/** Whole number to spoken Hindi (Indian grouping: hazaar, lakh, crore). */
export function hindiNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  n = Math.floor(n);
  if (n < 100) return ONES[n] as string;
  const parts: string[] = [];
  const take = (unit: number, word: string) => {
    if (n >= unit) {
      parts.push(`${hindiNumber(Math.floor(n / unit))} ${word}`);
      n %= unit;
    }
  };
  take(10_000_000, "करोड़");
  take(100_000, "लाख");
  take(1000, "हज़ार");
  take(100, "सौ");
  if (n > 0) parts.push(ONES[n] as string);
  return parts.join(" ");
}

/** Years like 1947 are read "उन्नीस सौ सैंतालीस". */
export function hindiYear(y: number): string {
  if (y >= 1100 && y < 2000) {
    const hi = Math.floor(y / 100);
    const lo = y % 100;
    return `${ONES[hi]} सौ${lo ? ` ${ONES[lo]}` : ""}`;
  }
  return hindiNumber(y);
}

const DEVA_DIGITS = "०१२३४५६७८९";

function isMostlyHindi(text: string): boolean {
  const deva = (text.match(/[\u0900-\u097F]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return deva > 0 && deva >= latin;
}

type Rule = { rule: string; re: RegExp; fn: (m: string, ...g: string[]) => string; hindiOnly?: boolean };

const num = (s: string) => Number(s.replace(/,/g, ""));

const LINE_RULES: Rule[] = [
  { rule: "Hindi digits", re: /[०-९]+/g, fn: (m) => [...m].map((c) => String(DEVA_DIGITS.indexOf(c))).join("") },
  { rule: "Bullet marks", re: /^\s*[•●▪◦■*#]+\s*/g, fn: () => "" },
  { rule: "Formatting marks", re: /([*_]{1,3})([^*_\n]+?)\1/g, fn: (_m, _d, inner) => inner ?? "" },
  { rule: "Abbreviation", re: /डॉ\.\s*/g, fn: () => "डॉक्टर " },
  { rule: "Abbreviation", re: /स्व\.\s*/g, fn: () => "स्वर्गीय " },
  { rule: "Abbreviation", re: /पं\.\s*/g, fn: () => "पंडित " },
  { rule: "Abbreviation", re: /प्रो\.\s*/g, fn: () => "प्रोफेसर " },
  { rule: "Abbreviation", re: /श्री\.\s*/g, fn: () => "श्री " },
  { rule: "Abbreviation", re: /\bDr\.\s*/g, fn: () => "Doctor " },
  { rule: "Abbreviation", re: /\bMrs\.\s*/g, fn: () => "Missus " },
  { rule: "Abbreviation", re: /\bMr\.\s*/g, fn: () => "Mister " },
  { rule: "Abbreviation", re: /\bProf\.\s*/g, fn: () => "Professor " },
  { rule: "Money", re: /₹\s*(\d[\d,]*)/g, fn: (_m, d) => `${hindiNumber(num(d ?? "0"))} रुपये`, hindiOnly: true },
  { rule: "Time", re: /\b(\d{1,2}):(\d{2})\b/g, fn: (_m, h, mm) => `${hindiNumber(num(h ?? "0"))} बजकर ${hindiNumber(num(mm ?? "0"))} मिनट`, hindiOnly: true },
  { rule: "Percent", re: /(\d[\d,]*)\s*%/g, fn: (_m, d) => `${hindiNumber(num(d ?? "0"))} प्रतिशत`, hindiOnly: true },
  { rule: "Percent", re: /(\d)\s*%/g, fn: (_m, d) => `${d} percent` },
  { rule: "Year", re: /\b(1[1-9]\d\d)\b/g, fn: (_m, y) => hindiYear(num(y ?? "0")), hindiOnly: true },
  { rule: "Number", re: /\b\d[\d,]*\b/g, fn: (m) => hindiNumber(num(m)), hindiOnly: true },
  { rule: "Symbol", re: /\s*&\s*/g, fn: () => " और ", hindiOnly: true },
  { rule: "Symbol", re: /\s*&\s*/g, fn: () => " and " },
  { rule: "Symbol", re: /([\p{L}\p{M}]+)\s*\/\s*([\p{L}\p{M}]+)/gu, fn: (_m, a, b) => `${a} या ${b}`, hindiOnly: true },
  { rule: "Ellipsis", re: /\.{3,}|…+/g, fn: () => "…" },
  { rule: "Doubled punctuation", re: /।{2,}|([!?])\1+|,{2,}/g, fn: (m) => m[0] as string },
  { rule: "Quotes", re: /``|''/g, fn: () => '"' },
  { rule: "Missing space", re: /([।?!])(?=[\p{L}\p{N}])/gu, fn: (_m, p) => `${p} ` },
];

/** Run the cleanup. `disabled` holds change ids the user reverted. */
export function cleanForSpeech(raw: string, disabled: Set<string> = new Set()): CleanResult {
  const changes: CleanChange[] = [];
  const counters = new Map<string, number>();
  const nextId = (rule: string) => {
    const n = counters.get(rule) ?? 0;
    counters.set(rule, n + 1);
    return `${rule}:${n}`;
  };
  const hindi = isMostlyHindi(raw);

  let text = raw.replace(/\r\n?/g, "\n");
  // Whole-text fixes first: broken words from PDFs.
  text = text.replace(/\u00ad/g, "").replace(/([\p{L}\p{M}])-\n([\p{Ll}\u0900-\u097F])/gu, (m, a, b) => {
    const id = nextId("Broken word");
    if (disabled.has(id)) return m;
    changes.push({ id, rule: "Broken word", before: m.replace("\n", "⏎"), after: `${a}${b}` });
    return `${a}${b}`;
  });

  const lines = text.split("\n");
  // Lines repeated 3+ times (running headers/footers) and bare page numbers are dropped.
  const freq = new Map<string, number>();
  for (const l of lines) {
    const t = l.trim();
    if (t && t.length < 60) freq.set(t, (freq.get(t) ?? 0) + 1);
  }

  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || VOICE_TAG_REGEX.test(t) && t.replace(VOICE_TAG_REGEX, "").trim() === "" || looksLikeHeading(t) && !/^\s*[\d०-९]+\s*$/.test(t)) {
      out.push(line);
      continue;
    }
    const isPageNo = /^(?:page|पृष्ठ|पेज)?\s*[\d०-९]{1,4}$/i.test(t);
    const isRepeat = (freq.get(t) ?? 0) >= 3 && !/[।.!?"”]$/.test(t);
    if (isPageNo || isRepeat) {
      const id = nextId(isPageNo ? "Page number" : "Repeated header");
      if (!disabled.has(id)) {
        changes.push({ id, rule: isPageNo ? "Page number" : "Repeated header", before: t, after: "(removed)" });
        continue;
      }
    }
    // Keep a leading voice tag untouched.
    const tag = VOICE_TAG_REGEX.exec(line)?.[0] ?? "";
    let body = line.slice(tag.length);
    for (const r of LINE_RULES) {
      if (r.hindiOnly && !hindi) continue;
      if (!hindi && r.rule === "Percent" && r.fn("", "1").includes("प्रतिशत")) continue;
      r.re.lastIndex = 0;
      body = body.replace(r.re, (m: string, ...g: unknown[]) => {
        const groups = g.filter((x): x is string => typeof x === "string" || x === undefined) as string[];
        const after = r.fn(m, ...groups);
        if (after === m) return m;
        const id = nextId(r.rule);
        if (disabled.has(id)) return m;
        changes.push({ id, rule: r.rule, before: m.trim() || m, after: after.trim() || "(removed)" });
        return after;
      });
    }
    out.push(tag + body.replace(/[ \t]{2,}/g, " "));
  }
  return { text: out.join("\n"), changes };
}
