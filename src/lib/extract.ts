import type { Chapter } from "./types";
import { uid } from "./id";

async function readPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];
    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      if (typeof item.str !== "string") continue;
      const y = item.transform?.[5] ?? 0;
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line.trim());
        line = "";
      }
      line += item.str;
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join("\n"));
  }
  return pages.join("\n\n");
}

async function readDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser.js");
  const buf = await file.arrayBuffer();
  const result = await (
    mammoth as unknown as {
      extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    }
  ).extractRawText({ arrayBuffer: buf });
  return result.value;
}

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return readPdf(file);
  if (name.endsWith(".docx")) return readDocx(file);
  if (name.endsWith(".txt") || name.endsWith(".md")) return file.text();
  throw new Error("Unsupported file type. Upload a PDF, DOCX, or TXT file.");
}

const CHAPTER_RE =
  /^\s*(chapter|chap\.?|part|book|section|prologue|epilogue|interlude)\b[^.!?]{0,60}$/i;
const ROMAN_RE = /^\s*(?:[IVXLC]+|\d{1,3})\s*[.)]?\s*$/;

function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 80) return false;
  if (CHAPTER_RE.test(t)) return true;
  if (ROMAN_RE.test(t)) return true;
  // Short all-caps line with no terminal punctuation.
  if (t.length < 60 && t === t.toUpperCase() && /[A-Z]/.test(t) && !/[.!?]$/.test(t)) return true;
  return false;
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00ad/g, "")
    .replace(/([a-z])-\n([a-z])/g, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(s: string): number {
  return (s.match(/\S+/g) ?? []).length;
}

/** Split raw document text into chapters of paragraphs. */
export function buildChapters(raw: string): Chapter[] {
  const text = cleanText(raw);
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  const chapters: Chapter[] = [];
  let current: { title: string; paragraphs: string[] } | null = null;

  const push = () => {
    if (!current || current.paragraphs.length === 0) return;
    const words = current.paragraphs.reduce((n, p) => n + countWords(p), 0);
    chapters.push({
      id: uid("ch"),
      index: chapters.length,
      title: current.title,
      paragraphs: current.paragraphs,
      wordCount: words,
    });
  };

  for (const block of blocks) {
    const lines = block.split("\n");
    const firstLine = lines[0] ?? "";
    if (lines.length === 1 && looksLikeHeading(firstLine)) {
      push();
      current = { title: firstLine.trim(), paragraphs: [] };
      continue;
    }
    if (!current) current = { title: "Opening", paragraphs: [] };
    // Re-join wrapped lines inside a paragraph block.
    const para = lines.join(" ").replace(/\s+/g, " ").trim();
    if (para) current.paragraphs.push(para);
  }
  push();

  if (chapters.length === 0) {
    return [
      {
        id: uid("ch"),
        index: 0,
        title: "Full text",
        paragraphs: blocks,
        wordCount: countWords(text),
      },
    ];
  }
  return chapters;
}
