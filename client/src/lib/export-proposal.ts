/**
 * Export proposal/RFP to PDF, Word (.docx), and Excel (.xlsx).
 * Uses proposal + optional form/content overrides; works with any object that has title, description, etc.
 */

import { jsPDF } from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
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

function buildSections(payload: ExportPayload): { label: string; value: string }[] {
  const sections: { label: string; value: string }[] = [
    { label: "Title", value: payload.title },
    { label: "Description", value: safeStr(payload.description) },
    { label: "Industry", value: safeStr(payload.industry) },
    { label: "Budget Range", value: safeStr(payload.budgetRange) },
    { label: "Timeline", value: safeStr(payload.timeline) },
    { label: "Due Date", value: safeStr(payload.dueDate) },
    { label: "Status", value: safeStr(payload.status) },
    { label: "Client Name", value: safeStr(payload.clientName) },
    { label: "Client Contact", value: safeStr(payload.clientContact) },
    { label: "Client Email", value: safeStr(payload.clientEmail) },
  ];
  const content = payload.content;
  if (content && typeof content === "object") {
    for (const [key, val] of Object.entries(content)) {
      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      sections.push({ label, value: safeStr(val) });
    }
  }
  if (payload.questions?.length) {
    payload.questions.forEach((q, i) => {
      sections.push({ label: `Q${i + 1}: ${q.question}`, value: safeStr(q.answer) });
    });
  }
  return sections;
}

function sanitizeFilename(title: string): string {
  return title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 80) || "proposal";
}

const PDF = {
  margin: 18,
  pageW: 210,
  pageH: 297,
  lineHeight: 5,
  sectionGap: 3,
  titleFontSize: 14,
  bodyFontSize: 10,
  labelFontSize: 10,
} as const;

/** Export proposal data to PDF and trigger download. */
export function downloadProposalPdf(payload: ExportPayload, filename?: string): void {
  const name = filename || sanitizeFilename(payload.title);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { margin, pageW, pageH, lineHeight, sectionGap, titleFontSize, bodyFontSize, labelFontSize } = PDF;
  const maxW = pageW - margin * 2;
  const bottomY = pageH - margin;
  let y = margin;

  const sections = buildSections(payload);

  // Title: bold, wrapped, no overflow
  doc.setFontSize(titleFontSize);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(payload.title, maxW);
  for (const line of titleLines) {
    if (y > bottomY) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight + 1;
  }
  y += sectionGap;

  for (const { label, value } of sections) {
    if (value === "" || label === "Title") continue; // Title already printed above
    // Label: bold, single line or wrapped
    doc.setFontSize(labelFontSize);
    doc.setFont("helvetica", "bold");
    const labelLines = doc.splitTextToSize(`${label}:`, maxW);
    for (const line of labelLines) {
      if (y > bottomY) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    // Value: normal, wrapped
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodyFontSize);
    const valueLines = doc.splitTextToSize(value, maxW);
    for (const line of valueLines) {
      if (y > bottomY) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += sectionGap;
  }

  doc.save(`${name}.pdf`);
}

/** Export proposal data to Word (.docx) and trigger download. */
export async function downloadProposalDocx(payload: ExportPayload, filename?: string): Promise<void> {
  const name = filename || sanitizeFilename(payload.title);
  const sections = buildSections(payload);

  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: payload.title, bold: true, size: 28 })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 180, line: 276 },
    }),
  ];

  for (const { label, value } of sections) {
    if (value === "" || label === "Title") continue;
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: 22 }),
          new TextRun({ text: value, size: 22 }),
        ],
        spacing: { after: 100, line: 240 },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
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

/** Export proposal data to Excel (.xlsx) and trigger download. */
export function downloadProposalXlsx(payload: ExportPayload, filename?: string): void {
  const name = filename || sanitizeFilename(payload.title);
  const sections = buildSections(payload);
  const rows = sections.map(({ label, value }) => ({ Field: label, Value: value }));
  const ws = XLSX.utils.json_to_sheet(rows);
  // Column widths: Field narrow, Value wider so text wraps in cell
  ws["!cols"] = [{ wch: 22 }, { wch: 70 }];
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

/** Build export payload from proposal (and optional form/content). Used by rfp-detail. */
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

/** Build export payload from list-item proposal (admin/projects). */
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
  };
}
