/**
 * Export proposal/RFP to PDF, Word (.docx), and Excel (.xlsx).
 * Formatting mirrors the frontend: same section order, headings, and lists.
 */

import { jsPDF } from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
} from "docx";
import * as XLSX from "xlsx";

export type ExportPayload = {
  title: string;
  description?: string | null;
  industry?: string | null;
  budgetRange?: string | null;
  timeline?: string | null;
  dueDate?: string | null;
  status?: string | null;
  content?: Record<string, unknown> | null;
  clientName?: string | null;
  clientContact?: string | null;
  clientEmail?: string | null;
  questions?: { question: string; answer?: string }[];
};

function safeStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Strip HTML to plain text, preserving line breaks (e.g. from Quill fullDocument). */
function stripHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  const div = typeof document !== "undefined" ? document.createElement("div") : null;
  if (div) {
    div.innerHTML = html;
    const text = div.textContent || div.innerText || "";
    return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const HTML_LIKE = /<\/?[a-z][^>]*>/i;

/** Parse **bold** into runs for rich text. */
function parseBoldRuns(text: string): { bold?: boolean; text: string }[] {
  const runs: { bold?: boolean; text: string }[] = [];
  let remaining = text;
  let bold = false;
  while (remaining.length > 0) {
    const idx = remaining.indexOf("**");
    if (idx === -1) {
      if (remaining) runs.push({ ...(bold ? { bold: true } : {}), text: remaining });
      break;
    }
    if (remaining.slice(0, idx)) {
      runs.push({ ...(bold ? { bold: true } : {}), text: remaining.slice(0, idx) });
    }
    bold = !bold;
    remaining = remaining.slice(idx + 2);
  }
  return runs.filter((r) => r.text.length > 0);
}

/** Parse proposal body (markdown-style) into sections: headings, paragraphs with bold, bullet and numbered lists. */
function parseProposalContent(htmlOrMarkdown: string): ExportSection[] {
  const out: ExportSection[] = [];
  const raw = htmlOrMarkdown?.trim() || "";
  if (!raw) return out;

  const isHtml = HTML_LIKE.test(raw);

  if (isHtml && typeof document !== "undefined") {
    const div = document.createElement("div");
    div.innerHTML = raw;
    const getRunsFromElement = (node: Node): { bold?: boolean; text: string }[] => {
      const runs: { bold?: boolean; text: string }[] = [];
      const walk = (n: Node, bold: boolean) => {
        if (n.nodeType === Node.TEXT_NODE && n.textContent) {
          runs.push(bold ? { bold: true, text: n.textContent } : { text: n.textContent });
          return;
        }
        if (n.nodeType !== Node.ELEMENT_NODE) return;
        const el = n as Element;
        const tag = el.tagName.toUpperCase();
        const isBold = tag === "STRONG" || tag === "B";
        for (const child of Array.from(el.childNodes)) walk(child, bold || isBold);
      };
      for (const child of Array.from(node.childNodes)) walk(child, false);
      return runs.filter((r) => r.text.length > 0);
    };
    for (const el of Array.from(div.children)) {
      const tag = el.tagName.toUpperCase();
      const text = (el.textContent || "").trim();
      if (!text) continue;
      if (tag === "H1" || tag === "H2" || tag === "H3") {
        out.push({ type: "heading", title: text });
        continue;
      }
      if (tag === "UL") {
        const items = Array.from(el.querySelectorAll("li")).map((li) => (li.textContent || "").trim()).filter(Boolean);
        if (items.length) out.push({ type: "list", items });
        continue;
      }
      if (tag === "OL") {
        const items = Array.from(el.querySelectorAll("li")).map((li) => (li.textContent || "").trim()).filter(Boolean);
        if (items.length) out.push({ type: "orderedList", items });
        continue;
      }
      if (tag === "P" || tag === "DIV") {
        const runs = getRunsFromElement(el);
        const hasBold = runs.some((r) => r.bold);
        if (hasBold && runs.length > 0) {
          out.push({ type: "richText", runs });
        } else if (text) {
          out.push({ type: "text", value: text });
        }
      }
    }
    return out;
  }

  // Markdown-style: split by ## Heading
  const sections = raw.split(/(?:^|\n)\s*##\s+/).map((s) => s.trim()).filter(Boolean);
  for (const block of sections) {
    const firstNewline = block.indexOf("\n");
    const firstLine = firstNewline === -1 ? block : block.slice(0, firstNewline);
    const body = firstNewline === -1 ? "" : block.slice(firstNewline + 1).trim();
    const headingTitle = firstLine.replace(/^#+\s*/, "").trim();
    if (headingTitle) out.push({ type: "heading", title: headingTitle });

    if (!body) continue;

    const paragraphs = body.split(/\n\n+/);
    let i = 0;
    while (i < paragraphs.length) {
      const para = paragraphs[i];
      const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
      const bulletItems = lines.filter((l) => /^[-*•]\s+/.test(l) || /^\*\s+/.test(l));
      const numberedItems = lines.filter((l) => /^\d+\.\s+/.test(l));
      const allBullet = lines.length > 0 && bulletItems.length === lines.length;
      const allNumbered = lines.length > 0 && numberedItems.length === lines.length;

      if (allBullet && bulletItems.length > 0) {
        out.push({
          type: "list",
          items: bulletItems.map((l) => l.replace(/^[-*•]\s+/, "").replace(/^\*\s+/, "").trim()),
        });
        i++;
        continue;
      }
      if (allNumbered && numberedItems.length > 0) {
        out.push({
          type: "orderedList",
          items: numberedItems.map((l) => l.replace(/^\d+\.\s+/, "").trim()),
        });
        i++;
        continue;
      }

      const hasBold = /\*\*[^*]+\*\*/.test(para);
      if (hasBold) {
        const runs = parseBoldRuns(para);
        if (runs.length) out.push({ type: "richText", runs });
      } else if (para) {
        out.push({ type: "text", value: para });
      }
      i++;
    }
  }
  return out;
}

export type ExportSection =
  | { type: "heading"; title: string }
  | { type: "text"; value: string }
  | { type: "list"; items: string[] }
  | { type: "orderedList"; items: string[] }
  | { type: "keyValue"; label: string; value: string }
  | { type: "richText"; runs: { bold?: boolean; text: string }[] }
  | { type: "basicInfoBox"; items: { label: string; value: string }[] };

/** Build sections in the same order and structure as the frontend (Overview + Content + Q&A). */
function buildOrderedSections(payload: ExportPayload): ExportSection[] {
  const out: ExportSection[] = [];
  const c = payload.content && typeof payload.content === "object" ? payload.content as Record<string, unknown> : null;
  const hasFullDocument = c && typeof (c as { fullDocument?: string }).fullDocument === "string";
  const fullDoc = hasFullDocument ? stripHtml((c as { fullDocument: string }).fullDocument) : "";

  // --- Overview (Basic Information as a 2-col box only; Description section omitted from export) ---
  const basicItems: { label: string; value: string }[] = [];
  if (payload.industry) basicItems.push({ label: "Industry", value: safeStr(payload.industry) });
  if (payload.budgetRange) basicItems.push({ label: "Budget Range", value: safeStr(payload.budgetRange) });
  if (payload.timeline) basicItems.push({ label: "Timeline", value: safeStr(payload.timeline) });
  if (payload.dueDate) basicItems.push({ label: "Due Date", value: safeStr(payload.dueDate) });
  if (payload.status) basicItems.push({ label: "Status", value: safeStr(payload.status) });
  if (basicItems.length > 0) {
    out.push({ type: "heading", title: "Basic Information" });
    out.push({ type: "basicInfoBox", items: basicItems });
  }

  if (payload.clientName || payload.clientContact || payload.clientEmail) {
    out.push({ type: "heading", title: "Client" });
    if (payload.clientName) out.push({ type: "keyValue", label: "Client Name", value: safeStr(payload.clientName) });
    if (payload.clientContact) out.push({ type: "keyValue", label: "Primary Contact", value: safeStr(payload.clientContact) });
    if (payload.clientEmail) out.push({ type: "keyValue", label: "Contact Email", value: safeStr(payload.clientEmail) });
  }

  // --- Proposal Content (mirror frontend: parse fullDocument for headings, bold, lists) ---
  if (hasFullDocument) {
    const rawContent = (c as { fullDocument: string }).fullDocument;
    const parsed = parseProposalContent(rawContent);
    if (parsed.length > 0) {
      out.push(...parsed);
    } else {
      out.push({ type: "heading", title: "Proposal Content" });
      out.push({ type: "text", value: stripHtml(rawContent) });
    }
  } else if (c && !hasFullDocument) {
    const content = c as Record<string, unknown>;

    if (content.executiveSummary) {
      const es = content.executiveSummary;
      const text = typeof es === "string" ? es : (typeof es === "object" && es !== null && "description" in es ? safeStr((es as { description?: unknown }).description) : safeStr(es));
      if (text) {
        out.push({ type: "heading", title: "Executive Summary" });
        out.push({ type: "text", value: text });
      }
    }
    if (content.introduction) {
      const intro = content.introduction;
      const text = typeof intro === "string" ? intro : (typeof intro === "object" && intro !== null && "description" in intro ? safeStr((intro as { description?: unknown }).description) : safeStr(intro));
      if (text) {
        out.push({ type: "heading", title: "Introduction" });
        out.push({ type: "text", value: text });
      }
    }
    if (content.projectOverview && typeof content.projectOverview === "object") {
      const po = content.projectOverview as Record<string, unknown>;
      out.push({ type: "heading", title: "Project Overview" });
      if (po.industry) out.push({ type: "keyValue", label: "Industry", value: safeStr(po.industry) });
      if (po.timeline) out.push({ type: "keyValue", label: "Timeline", value: safeStr(po.timeline) });
      if (po.budget) out.push({ type: "keyValue", label: "Budget", value: safeStr(po.budget) });
      if (po.description) out.push({ type: "keyValue", label: "Description", value: safeStr(po.description) });
      if (Array.isArray(po.projectScope) && po.projectScope.length > 0) {
        out.push({ type: "heading", title: "Scope" });
        out.push({
          type: "list",
          items: po.projectScope.map((s: unknown) => safeStr(s)),
        });
      }
    }
    if (Array.isArray(content.requirements) && content.requirements.length > 0) {
      out.push({ type: "heading", title: "Requirements" });
      out.push({
        type: "list",
        items: content.requirements.map((r: unknown) =>
          typeof r === "object" && r !== null && "description" in r
            ? safeStr((r as { description?: unknown }).description)
            : safeStr(r)
        ),
      });
    }
    if (content.solutionApproach) {
      out.push({ type: "heading", title: "Solution Approach" });
      out.push({ type: "text", value: safeStr(content.solutionApproach) });
    }
    if (Array.isArray(content.technicalSpecifications) && content.technicalSpecifications.length > 0) {
      out.push({ type: "heading", title: "Technical Specifications" });
      out.push({ type: "list", items: content.technicalSpecifications.map((s: unknown) => safeStr(s)) });
    }
    if (Array.isArray(content.deliverables) && content.deliverables.length > 0) {
      out.push({ type: "heading", title: "Deliverables" });
      out.push({ type: "list", items: content.deliverables.map((d: unknown) => safeStr(d)) });
    }
    if (content.timeline !== undefined && content.timeline !== null) {
      out.push({ type: "heading", title: "Timeline" });
      if (typeof content.timeline === "string") {
        out.push({ type: "text", value: content.timeline });
      } else if (typeof content.timeline === "object") {
        const lines = Object.entries(content.timeline as Record<string, unknown>).map(
          ([k, v]) => `${k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}: ${safeStr(v)}`
        );
        out.push({ type: "text", value: lines.join("\n") });
      }
    }
    if (content.team !== undefined && content.team !== null) {
      out.push({ type: "heading", title: "Team" });
      if (typeof content.team === "string") {
        out.push({ type: "text", value: content.team });
      } else if (typeof content.team === "object") {
        const lines = Object.entries(content.team as Record<string, unknown>).map(
          ([k, v]) => `${k.replace(/([A-Z])/g, " $1").trim()}: ${safeStr(v)}`
        );
        out.push({ type: "text", value: lines.join("\n") });
      }
    }
    if (content.pricing !== undefined && content.pricing !== null) {
      out.push({ type: "heading", title: "Pricing" });
      if (typeof content.pricing === "string") {
        out.push({ type: "text", value: content.pricing });
      } else if (typeof content.pricing === "object") {
        const lines = Object.entries(content.pricing as Record<string, unknown>).map(
          ([k, v]) => `${k.replace(/([A-Z])/g, " $1").trim()}: ${safeStr(v)}`
        );
        out.push({ type: "text", value: lines.join("\n") });
      }
    }
    if (content.nextSteps !== undefined && content.nextSteps !== null) {
      out.push({ type: "heading", title: "Next Steps" });
      if (typeof content.nextSteps === "string") {
        out.push({ type: "text", value: content.nextSteps });
      } else if (Array.isArray(content.nextSteps)) {
        out.push({ type: "list", items: content.nextSteps.map((s: unknown) => safeStr(s)) });
      } else if (typeof content.nextSteps === "object") {
        out.push({ type: "list", items: Object.values(content.nextSteps as Record<string, unknown>).map((s) => safeStr(s)) });
      }
    }
  }

  // --- Questions & Answers ---
  if (payload.questions?.length) {
    out.push({ type: "heading", title: "Questions & Answers" });
    payload.questions.forEach((q) => {
      out.push({ type: "keyValue", label: q.question, value: safeStr(q.answer) });
    });
  }

  return out;
}

/** Flatten to section/label/value rows for XLSX so structure matches frontend. */
function buildFlatRows(payload: ExportPayload): { section: string; label: string; value: string }[] {
  const sections = buildOrderedSections(payload);
  const rows: { section: string; label: string; value: string }[] = [];
  let currentSection = "";
  for (const s of sections) {
    if (s.type === "heading") currentSection = s.title;
    else if (s.type === "basicInfoBox") {
      for (const it of s.items) rows.push({ section: currentSection, label: it.label, value: it.value });
    } else if (s.type === "text" && s.value) rows.push({ section: currentSection, label: "", value: s.value });
    else if (s.type === "list") rows.push({ section: currentSection, label: "", value: s.items.map((i) => `• ${i}`).join("\n") });
    else if (s.type === "orderedList") rows.push({ section: currentSection, label: "", value: s.items.map((i, idx) => `${idx + 1}. ${i}`).join("\n") });
    else if (s.type === "richText") rows.push({ section: currentSection, label: "", value: s.runs.map((r) => r.text).join("") });
    else if (s.type === "keyValue") rows.push({ section: currentSection, label: s.label, value: s.value });
  }
  return rows;
}

function sanitizeFilename(title: string): string {
  return title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 80) || "proposal";
}

/** PDF layout aligned with website document view (ProposalQuillEditor: h1 1.75rem, h2 1.5rem, body 1.0625rem, line-height 1.65). */
const PDF = {
  margin: 22,
  pageW: 210,
  pageH: 297,
  lineHeight: 6,
  sectionGap: 6,
  headingGapBefore: 5,
  headingGapAfter: 3,
  titleFontSize: 22,
  headingFontSize: 16,
  bodyFontSize: 11,
  listIndent: 6,
  /** Safe distance from bottom so content never overflows or is cut off */
  bottomBuffer: 14,
} as const;

/** Normalize text for export: straight quotes, dashes, collapse spaces, so wrapping and display are consistent. */
function normalizeTextForExport(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Break long words so splitTextToSize doesn't overflow (jsPDF can fail on very long tokens). Use conservative length so lines wrap cleanly. */
function breakLongWords(text: string, maxCharsPerWord: number = 24): string {
  return text.split(/\s+/).map((word) => {
    if (word.length <= maxCharsPerWord) return word;
    const parts: string[] = [];
    for (let i = 0; i < word.length; i += maxCharsPerWord) {
      parts.push(word.slice(i, i + maxCharsPerWord));
    }
    return parts.join(" ");
  }).join(" ");
}

/** Export proposal data to PDF with frontend-matching structure (headings, lists). No overflow. Matches website doc view inch-by-inch. */
export function downloadProposalPdf(payload: ExportPayload, filename?: string): void {
  const name = filename || sanitizeFilename(payload.title);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { margin, pageW, pageH, lineHeight, sectionGap, headingGapBefore, headingGapAfter, titleFontSize, headingFontSize, bodyFontSize, listIndent, bottomBuffer } = PDF;
  const maxW = Math.max(10, pageW - margin * 2 - 2);
  /** Narrower width for body/description so text never overflows or gets cut off at the right edge. */
  const textMaxW = Math.max(10, maxW - 8);
  const listContentW = Math.max(10, textMaxW - listIndent);
  const bottomY = pageH - margin - bottomBuffer;
  let y = margin;

  const sections = buildOrderedSections(payload);

  const ensureSpace = (neededLines: number = 1): void => {
    const needed = neededLines * lineHeight;
    if (y + needed > bottomY) {
      doc.addPage();
      y = margin;
    }
  };

  const addHorizontalRule = () => {
    ensureSpace(1.5);
    if (y + 4 > bottomY) {
      doc.addPage();
      y = margin;
    }
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(margin, y, margin + maxW, y);
    y += 4;
  };

  /** Draw Basic Information as a bordered 2-column grid (2 cols, multiple rows). */
  const addBasicInfoBox = (items: { label: string; value: string }[]) => {
    if (items.length === 0) return;
    const cols = 2;
    const pad = 3;
    const rowHeight = lineHeight * 2.2;
    const rows = Math.ceil(items.length / cols);
    const boxHeight = rows * rowHeight;
    const colW = (maxW - 1) / cols;
    ensureSpace(rows * 2 + 1);
    if (y + boxHeight > bottomY) {
      doc.addPage();
      y = margin;
    }
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(margin, y, maxW, boxHeight);
    doc.line(margin + colW, y, margin + colW, y + boxHeight);
    for (let r = 1; r < rows; r++) {
      doc.line(margin, y + r * rowHeight, margin + maxW, y + r * rowHeight);
    }
    doc.setFontSize(bodyFontSize);
    for (let i = 0; i < items.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = margin + pad + col * colW;
      const cellY = y + row * rowHeight + pad + lineHeight * 0.4;
      const cellW = colW - pad * 2;
      doc.setFont("helvetica", "bold");
      const labelLine = items[i].label + ": ";
      const safeLabel = breakLongWords(labelLine);
      doc.text(safeLabel, x, cellY);
      const labelW = doc.getTextWidth(safeLabel);
      doc.setFont("helvetica", "normal");
      const safeVal = breakLongWords(items[i].value);
      const valLines = doc.splitTextToSize(safeVal, Math.max(5, cellW - labelW));
      doc.text(valLines[0] ?? "", x + labelW, cellY);
      for (let L = 1; L < (valLines.length ?? 0); L++) {
        doc.text(valLines[L] ?? "", x, cellY + L * lineHeight);
      }
    }
    y += boxHeight + sectionGap;
  };

  const addHeading = (title: string) => {
    ensureSpace(2);
    y += headingGapBefore;
    doc.setFontSize(headingFontSize);
    doc.setFont("helvetica", "bold");
    const safeTitle = breakLongWords(title);
    const lines = doc.splitTextToSize(safeTitle, maxW);
    for (const line of lines) {
      if (y + lineHeight > bottomY) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += headingGapAfter;
  };

  const addBody = (text: string) => {
    const normalized = normalizeTextForExport(text);
    if (!normalized) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodyFontSize);
    const paragraphs = normalized.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    for (let i = 0; i < paragraphs.length; i++) {
      const safeText = breakLongWords(paragraphs[i]);
      const valueLines = doc.splitTextToSize(safeText, textMaxW);
      for (const line of valueLines) {
        if (y + lineHeight > bottomY) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      }
      if (i < paragraphs.length - 1) y += lineHeight * 0.4;
    }
    y += sectionGap;
  };

  const addRichText = (runs: { bold?: boolean; text: string }[], addGapAfter = true, textLeft: number = margin, bodyWidth: number = textMaxW) => {
    if (!runs.length) return;
    doc.setFontSize(bodyFontSize);
    for (const run of runs) {
      doc.setFont("helvetica", run.bold ? "bold" : "normal");
      const safeText = breakLongWords(normalizeTextForExport(run.text));
      const valueLines = doc.splitTextToSize(safeText, bodyWidth);
      for (const line of valueLines) {
        if (y + lineHeight > bottomY) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, textLeft, y);
        y += lineHeight;
      }
    }
    doc.setFont("helvetica", "normal");
    if (addGapAfter) y += sectionGap;
  };

  // Document title (match website h1 – large, bold)
  ensureSpace(3);
  doc.setFontSize(titleFontSize);
  doc.setFont("helvetica", "bold");
  const safeTitle = breakLongWords(payload.title);
  const titleLines = doc.splitTextToSize(safeTitle, maxW);
  for (const line of titleLines) {
    if (y + lineHeight + 2 > bottomY) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight + 2;
  }
  y += sectionGap;

  for (const s of sections) {
    if (s.type === "heading") {
      if (s.title === "Requirements") addHorizontalRule();
      addHeading(s.title);
    } else if (s.type === "basicInfoBox") {
      addBasicInfoBox(s.items);
    } else if (s.type === "text") {
      addBody(s.value);
    } else if (s.type === "richText") {
      addRichText(s.runs);
    } else if (s.type === "list") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodyFontSize);
      for (const item of s.items) {
        ensureSpace(1);
        if (/\*\*[^*]*\*\*/.test(item)) {
          doc.text("• ", margin, y);
          addRichText(parseBoldRuns(item), false, margin + listIndent, listContentW);
        } else {
          doc.text("• ", margin, y);
          const safeItem = breakLongWords(item);
          const lines = doc.splitTextToSize(safeItem, listContentW);
          for (const line of lines) {
            if (y + lineHeight > bottomY) {
              doc.addPage();
              y = margin;
            }
            doc.text(line, margin + listIndent, y);
            y += lineHeight;
          }
        }
      }
      y += sectionGap;
    } else if (s.type === "orderedList") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodyFontSize);
      s.items.forEach((item, idx) => {
        ensureSpace(1);
        const num = `${idx + 1}. `;
        doc.text(num, margin, y);
        if (/\*\*[^*]*\*\*/.test(item)) {
          addRichText(parseBoldRuns(item), false, margin + listIndent, listContentW);
        } else {
          const safeItem = breakLongWords(item);
          const lines = doc.splitTextToSize(safeItem, listContentW);
          for (const line of lines) {
            if (y + lineHeight > bottomY) {
              doc.addPage();
              y = margin;
            }
            doc.text(line, margin + listIndent, y);
            y += lineHeight;
          }
        }
      });
      y += sectionGap;
    } else if (s.type === "keyValue") {
      ensureSpace(1);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(bodyFontSize);
      const labelLine = `${s.label}:`;
      const safeLabel = breakLongWords(labelLine);
      const labelLines = doc.splitTextToSize(safeLabel, textMaxW);
      for (const line of labelLines) {
        if (y + lineHeight > bottomY) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      }
      doc.setFont("helvetica", "normal");
      const safeVal = breakLongWords(normalizeTextForExport(s.value));
      const valueLines = doc.splitTextToSize(safeVal, textMaxW);
      for (const line of valueLines) {
        if (y + lineHeight > bottomY) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      }
      y += sectionGap;
    }
  }

  doc.save(`${name}.pdf`);
}

/** Export proposal data to Word (.docx) matching PDF/website layout: same structure, Basic Info as 2-col table, horizontal rule before Requirements. */
export async function downloadProposalDocx(payload: ExportPayload, filename?: string): Promise<void> {
  const name = filename || sanitizeFilename(payload.title);
  const sections = buildOrderedSections(payload);

  const titleSize = 32;
  const headingSize = 26;
  const bodySize = 22;
  const lineSpacing = 276;
  const afterSpacing = 120;
  const headingAfter = 80;
  const headingBefore = 160;

  type DocChild = Paragraph | Table;
  const children: DocChild[] = [
    new Paragraph({
      children: [new TextRun({ text: payload.title, bold: true, size: titleSize })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 240, line: lineSpacing },
    }),
  ];

  for (const s of sections) {
    if (s.type === "heading") {
      if (s.title === "Requirements") {
        children.push(
          new Paragraph({
            text: "",
            spacing: { after: 80, before: 40 },
            border: { bottom: { color: "000000", space: 1, style: "single", size: 6 } },
          })
        );
      }
      children.push(
        new Paragraph({
          children: [new TextRun({ text: s.title, bold: true, size: headingSize })],
          heading: HeadingLevel.HEADING_2,
          spacing: { after: headingAfter, before: headingBefore, line: lineSpacing },
        })
      );
    } else if (s.type === "basicInfoBox") {
      const cols = 2;
      const tableRows: TableRow[] = [];
      for (let r = 0; r < Math.ceil(s.items.length / cols); r++) {
        const cells: TableCell[] = [];
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const it = s.items[i];
          if (it) {
            cells.push(
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${it.label}: `, bold: true, size: bodySize }),
                      new TextRun({ text: normalizeTextForExport(it.value), size: bodySize }),
                    ],
                    spacing: { after: 60, line: lineSpacing },
                  }),
                ],
              })
            );
          } else {
            cells.push(new TableCell({ children: [new Paragraph({ text: "" })] }));
          }
        }
        tableRows.push(new TableRow({ children: cells }));
      }
      children.push(
        new Table({
          rows: tableRows,
          width: { size: 100, type: "pct" },
        })
      );
    } else if (s.type === "text") {
      const normalized = normalizeTextForExport(s.value);
      if (normalized) {
        const paragraphs = normalized.split(/\n+/).map((p) => p.trim()).filter(Boolean);
        for (let i = 0; i < paragraphs.length; i++) {
          const isLast = i === paragraphs.length - 1;
          children.push(
            new Paragraph({
              children: [new TextRun({ text: paragraphs[i], size: bodySize })],
              spacing: {
                after: paragraphs.length > 1 && !isLast ? 80 : afterSpacing,
                line: lineSpacing,
              },
            })
          );
        }
      }
    } else if (s.type === "richText") {
      const runChildren = s.runs.map((r) => new TextRun({ text: normalizeTextForExport(r.text), bold: r.bold, size: bodySize }));
      children.push(
        new Paragraph({
          children: runChildren,
          spacing: { after: afterSpacing, line: lineSpacing },
        })
      );
    } else if (s.type === "list") {
      for (const item of s.items) {
        const normalizedItem = normalizeTextForExport(item);
        const hasBold = /\*\*[^*]*\*\*/.test(normalizedItem);
        const childRuns = hasBold
          ? parseBoldRuns(normalizedItem).map((r) => new TextRun({ text: r.text, bold: r.bold, size: bodySize }))
          : [new TextRun({ text: normalizedItem, size: bodySize })];
        children.push(
          new Paragraph({
            children: childRuns,
            bullet: { level: 0 },
            spacing: { after: 60, line: lineSpacing },
          })
        );
      }
    } else if (s.type === "orderedList") {
      s.items.forEach((item, idx) => {
        const normalizedItem = normalizeTextForExport(item);
        const num = `${idx + 1}. `;
        const hasBold = /\*\*[^*]*\*\*/.test(normalizedItem);
        const childRuns = hasBold
          ? [new TextRun({ text: num, size: bodySize }), ...parseBoldRuns(normalizedItem).map((r) => new TextRun({ text: r.text, bold: r.bold, size: bodySize }))]
          : [new TextRun({ text: num + normalizedItem, size: bodySize })];
        children.push(
          new Paragraph({
            children: childRuns,
            spacing: { after: 60, line: lineSpacing },
          })
        );
      });
    } else if (s.type === "keyValue") {
      const normalizedVal = normalizeTextForExport(s.value);
      const valueLines = normalizedVal.split("\n").filter(Boolean);
      const firstLine = valueLines[0] ?? " ";
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${s.label}: `, bold: true, size: bodySize }),
            new TextRun({ text: firstLine, size: bodySize }),
          ],
          spacing: { after: valueLines.length > 1 ? 80 : afterSpacing, line: lineSpacing },
        })
      );
      for (let i = 1; i < valueLines.length; i++) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: valueLines[i] || " ", size: bodySize })],
            spacing: { after: i === valueLines.length - 1 ? afterSpacing : 80, line: lineSpacing },
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export proposal data to Excel (.xlsx) with same section order as frontend. */
export function downloadProposalXlsx(payload: ExportPayload, filename?: string): void {
  const name = filename || sanitizeFilename(payload.title);
  const rows = buildFlatRows(payload);
  const withTitle = [
    { Section: "Proposal", Field: "Title", Value: payload.title },
    ...rows.map((r) => ({ Section: r.section, Field: r.label || "\u00A0", Value: r.value })),
  ];
  const ws = XLSX.utils.json_to_sheet(withTitle);
  ws["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 60 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Proposal");
  XLSX.writeFile(wb, `${name}.xlsx`);
}

/** Export proposal as JSON and trigger download (for admin/list). */
export function downloadProposalJson(payload: ExportPayload | Record<string, unknown>, filename?: string): void {
  const title = "title" in payload && typeof payload.title === "string" ? payload.title : "proposal";
  const name = filename || sanitizeFilename(title);
  const dataStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Build export payload from proposal (and optional form/content). Used by rfp-detail and admin proposal detail. */
export function buildExportPayload(
  proposal: Record<string, unknown> | null,
  formData?: Record<string, unknown> | null,
  contentData?: Record<string, unknown> | null
): ExportPayload {
  const p = proposal || {};
  const f = formData || {};
  const c = contentData ?? (p.content as Record<string, unknown> | undefined) ?? {};
  return {
    title: (f.title as string) ?? (p.title as string) ?? "Untitled",
    description: (f.description as string) ?? (p.description as string) ?? null,
    industry: (f.industry as string) ?? (p.industry as string) ?? null,
    budgetRange: (f.budgetRange as string) ?? (p.budgetRange as string) ?? null,
    timeline: (f.timeline as string) ?? (p.timeline as string) ?? null,
    dueDate: (f.dueDate as string) ?? (p.dueDate as string) ?? null,
    status: (f.status as string) ?? (p.status as string) ?? null,
    content: c && typeof c === "object" ? c : null,
    clientName: (f.clientName as string) ?? (p.clientName as string) ?? null,
    clientContact: (f.clientContact as string) ?? (p.clientContact as string) ?? null,
    clientEmail: (f.clientEmail as string) ?? (p.clientEmail as string) ?? null,
    questions: (p as { questions?: { question: string; answer?: string }[] }).questions,
  };
}

/** Build export payload from list-item proposal (admin/projects) – no contentData. */
export function buildExportPayloadFromProposal(proposal: Record<string, unknown> | null): ExportPayload {
  const p = proposal || {};
  return {
    title: (p.title as string) ?? "Untitled",
    description: (p.description as string) ?? null,
    industry: (p.industry as string) ?? null,
    budgetRange: (p.budgetRange as string) ?? null,
    timeline: (p.timeline as string) ?? null,
    dueDate: (p.dueDate as string) ?? null,
    status: (p.status as string) ?? null,
    content: (p.content as Record<string, unknown>) ?? null,
    clientName: (p.clientName as string) ?? null,
    clientContact: (p.clientContact as string) ?? null,
    clientEmail: (p.clientEmail as string) ?? null,
    questions: (p as { questions?: { question: string; answer?: string }[] }).questions,
  };
}
