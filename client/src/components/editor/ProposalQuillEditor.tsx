import { useEffect, useRef, useCallback } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";

/** Decode common HTML entities so backend-sent "&lt;strong&gt;" is treated as HTML. */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function looksLikeHtml(str: string): boolean {
  const t = str.trim();
  if (t.startsWith("<") && t.endsWith(">")) return true;
  // Content may have HTML tags in the middle (e.g. "<strong>Budget:</strong> $21,323") - treat as HTML so tags render
  if (/<[a-z][a-z0-9]*[\s>]|<\/[a-z][a-z0-9]*>/i.test(t)) return true;
  // Backend might send entity-encoded tags
  const decoded = decodeHtmlEntities(t);
  return /<[a-z][a-z0-9]*[\s>]|<\/[a-z][a-z0-9]*>/i.test(decoded);
}

/** Wrap in a root element so Quill's parser interprets inner tags (e.g. <strong>) as HTML, not plain text. */
function wrapHtmlForQuill(html: string): string {
  const decoded = decodeHtmlEntities(html.trim());
  if (!decoded) return "";
  const trimmed = decoded.trim();
  if (/^<\s*(?:div|p|section|article|main|h[1-6]|ul|ol|!DOCTYPE)/i.test(trimmed)) return trimmed;
  const hasInlineTags = /<(?:\/?(?:strong|em|b|i|u|span|a)\b)/i.test(trimmed);
  if (hasInlineTags) {
    const withBreaks = trimmed.replace(/\n/g, "<br>");
    return "<div>" + withBreaks + "</div>";
  }
  return trimmed;
}

/** Replace literal <strong>...</strong> and <em>...</em> in text with markdown ** and *, so we always render bold/italic. */
function literalTagsToMarkdown(str: string): string {
  return str
    .replace(/<strong\s*>(.*?)<\/strong>/gis, "**$1**")
    .replace(/<b\s*>(.*?)<\/b>/gis, "**$1**")
    .replace(/<em\s*>(.*?)<\/em>/gis, "*$1*")
    .replace(/<i\s*>(.*?)<\/i>/gis, "*$1*");
}

/** Normalize value for Quill: decode entities, convert literal tags to markdown, then to HTML. */
function valueToHtml(str: string): string {
  const t = str.trim();
  if (!t) return "";
  const decoded = decodeHtmlEntities(t);
  const noLiteralTags = literalTagsToMarkdown(decoded);
  if (looksLikeHtml(noLiteralTags)) {
    const wrapped = wrapHtmlForQuill(noLiteralTags);
    if (wrapped) return wrapped;
  }
  return markdownToHtml(noLiteralTags);
}

/** Convert markdown-like content to HTML so Quill renders headings, bold, lists properly. */
function markdownToHtml(text: string): string {
  if (!text.trim()) return "";
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  let listTag = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        out.push(listTag === "ul" ? "</ul>" : "</ol>");
        inList = false;
      }
      out.push("<p><br></p>");
      continue;
    }
    const h2 = /^##\s+(.+)$/.exec(trimmed);
    const h3 = /^###\s+(.+)$/.exec(trimmed);
    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    const numbered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (h2) {
      if (inList) {
        out.push(listTag === "ul" ? "</ul>" : "</ol>");
        inList = false;
      }
      out.push("<h2>" + inlineToHtml(h2[1]) + "</h2>");
      continue;
    }
    if (h3) {
      if (inList) {
        out.push(listTag === "ul" ? "</ul>" : "</ol>");
        inList = false;
      }
      out.push("<h3>" + inlineToHtml(h3[1]) + "</h3>");
      continue;
    }
    if (bullet) {
      if (!inList || listTag !== "ul") {
        if (inList) out.push(listTag === "ul" ? "</ul>" : "</ol>");
        out.push("<ul>");
        listTag = "ul";
        inList = true;
      }
      out.push("<li>" + inlineMarkdown(bullet[1]) + "</li>");
      continue;
    }
    if (numbered) {
      if (!inList || listTag !== "ol") {
        if (inList) out.push(listTag === "ul" ? "</ul>" : "</ol>");
        out.push("<ol>");
        listTag = "ol";
        inList = true;
      }
      out.push("<li>" + inlineMarkdown(numbered[1]) + "</li>");
      continue;
    }
    if (inList) {
      out.push(listTag === "ul" ? "</ul>" : "</ol>");
      inList = false;
    }
    out.push("<p>" + inlineMarkdown(trimmed) + "</p>");
  }
  if (inList) out.push(listTag === "ul" ? "</ul>" : "</ol>");
  return out.join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>");
}

/** Use for inline content: if it already has HTML tags, decode and use; otherwise escape + markdown. */
function inlineToHtml(s: string): string {
  if (/<[a-z][a-z0-9]*[\s>]|<\/[a-z][a-z0-9]*>/i.test(s)) return decodeHtmlEntities(s);
  return escapeHtml(inlineMarkdown(s));
}

export interface ProposalQuillEditorProps {
  value: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function ProposalQuillEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = "Write your proposal content...",
  className = "",
  minHeight = "280px",
}: ProposalQuillEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const lastValueRef = useRef<string>(value);
  const isInternalChangeRef = useRef(false);

  const emitChange = useCallback(() => {
    if (!quillRef.current || !onChange) return;
    const html = quillRef.current.root.innerHTML;
    if (html === "<p><br></p>" || html === "<p><br/></p>") {
      onChange("");
      return;
    }
    onChange(html);
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;
    const quill = new Quill(containerRef.current, {
      theme: "snow",
      placeholder,
      readOnly,
      modules: {
        // Always show toolbar so it clearly looks like an editor; when readOnly we disable it via CSS
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ align: "" }, { align: "center" }, { align: "right" }, { align: "justify" }],
          [{ list: "ordered" }, { list: "bullet" }],
          ["blockquote", "link"],
          ["clean"],
        ],
      },
    });
    quillRef.current = quill;

    quill.on("text-change", () => {
      if (isInternalChangeRef.current) return;
      lastValueRef.current = quill.root.innerHTML;
      emitChange();
    });

    const initial = (value || "").trim();
    if (initial) {
      isInternalChangeRef.current = true;
      const html = valueToHtml(initial);
      if (html) {
        try {
          const delta = quill.clipboard.convert({ html });
          quill.setContents(delta, "silent");
        } catch {
          quill.root.innerHTML = html;
        }
      } else {
        quill.setText(initial);
      }
      isInternalChangeRef.current = false;
      lastValueRef.current = quill.root.innerHTML;
    }

    return () => {
      quill.off("text-change");
      quillRef.current = null;
    };
  }, []);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    quill.enable(!readOnly);
    // Toolbar stays visible; wrapper class used to disable toolbar buttons when read-only
    const wrapper = containerRef.current?.closest(".proposal-quill-wrapper");
    if (wrapper) wrapper.classList.toggle("is-read-only", readOnly);
  }, [readOnly]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    const str = (value ?? "").trim();
    const currentHtml = quill.root.innerHTML;
    const currentEmpty = !currentHtml || currentHtml === "<p><br></p>" || currentHtml === "<p><br/></p>";
    const sameAsLast = lastValueRef.current === value;
    if (sameAsLast && !currentEmpty) return;
    if (str === "" && currentEmpty) return;
    const normalizedCurrent = currentHtml.replace(/\s+/g, " ").trim();
    const normalizedValue = str.replace(/\s+/g, " ").trim();
    if (normalizedCurrent === normalizedValue) return;
      if (value !== undefined && value !== lastValueRef.current) {
      isInternalChangeRef.current = true;
      lastValueRef.current = value;
      if (!str) {
        quill.setContents([{ insert: "\n" }], "silent");
      } else {
        const html = valueToHtml(str);
        if (html) {
          try {
            const delta = quill.clipboard.convert({ html });
            quill.setContents(delta, "silent");
          } catch {
            quill.root.innerHTML = html;
          }
        } else {
          quill.setText(str);
        }
      }
      isInternalChangeRef.current = false;
    }
  }, [value]);

  return (
    <div className={`proposal-quill-wrapper ${readOnly ? "is-read-only" : ""} ${className}`.trim()} style={{ minHeight }}>
      <style>{`
        .proposal-quill-wrapper .ql-toolbar.ql-snow {
          border: 1px solid var(--border);
          border-bottom: none;
          border-radius: 6px 6px 0 0;
          background: var(--muted);
          color: var(--foreground);
        }
        .proposal-quill-wrapper .ql-toolbar.ql-snow .ql-stroke { stroke: var(--foreground); }
        .proposal-quill-wrapper .ql-toolbar.ql-snow .ql-fill { fill: var(--foreground); }
        .proposal-quill-wrapper .ql-toolbar.ql-snow .ql-picker,
        .proposal-quill-wrapper .ql-toolbar.ql-snow .ql-picker-label { color: var(--foreground); }
        .proposal-quill-wrapper .ql-toolbar.ql-snow button:hover .ql-stroke,
        .proposal-quill-wrapper .ql-toolbar.ql-snow .ql-picker:hover .ql-stroke { stroke: var(--primary); }
        .proposal-quill-wrapper .ql-toolbar.ql-snow button:hover .ql-fill,
        .proposal-quill-wrapper .ql-toolbar.ql-snow .ql-picker:hover .ql-fill { fill: var(--primary); }
        .proposal-quill-wrapper .ql-toolbar.ql-snow button.ql-active .ql-stroke,
        .proposal-quill-wrapper .ql-toolbar.ql-snow .ql-picker.ql-active .ql-stroke { stroke: var(--primary); }
        .proposal-quill-wrapper .ql-toolbar.ql-snow button.ql-active .ql-fill,
        .proposal-quill-wrapper .ql-toolbar.ql-snow .ql-picker.ql-active .ql-fill { fill: var(--primary); }
        .proposal-quill-wrapper .ql-toolbar.ql-snow .ql-picker.ql-active .ql-picker-label { color: var(--primary); }
        .proposal-quill-wrapper .ql-container.ql-snow {
          border: 1px solid var(--border);
          border-radius: 0 0 6px 6px;
          min-height: 200px;
          background: var(--background);
        }
        .proposal-quill-wrapper .ql-editor {
          text-align: left;
          line-height: 1.65;
          min-height: 200px;
          font-size: 1.0625rem;
          color: var(--foreground);
          background: var(--background);
        }
        .proposal-quill-wrapper .ql-editor.ql-blank::before { color: var(--muted-foreground); }
        .proposal-quill-wrapper .ql-editor.ql-align-left { text-align: left; }
        .proposal-quill-wrapper .ql-editor.ql-align-center { text-align: center; }
        .proposal-quill-wrapper .ql-editor.ql-align-right { text-align: right; }
        .proposal-quill-wrapper .ql-editor.ql-align-justify { text-align: justify; }
        .proposal-quill-wrapper .ql-editor h1 { font-size: 1.75rem; margin-top: 0.75em; margin-bottom: 0.5em; line-height: 1.3; color: var(--foreground); }
        .proposal-quill-wrapper .ql-editor h2 { font-size: 1.5rem; margin-top: 0.75em; margin-bottom: 0.5em; line-height: 1.3; color: var(--foreground); }
        .proposal-quill-wrapper .ql-editor h3 { font-size: 1.25rem; margin-top: 0.75em; margin-bottom: 0.5em; line-height: 1.3; color: var(--foreground); }
        .proposal-quill-wrapper .ql-editor p { margin-bottom: 0.5em; color: var(--foreground); }
        .proposal-quill-wrapper .ql-editor li { color: var(--foreground); }
        .proposal-quill-wrapper .ql-editor strong { color: var(--foreground); font-weight: 700; }
        .proposal-quill-wrapper .ql-editor ul, .proposal-quill-wrapper .ql-editor ol { padding-left: 1.5em; }
        .proposal-quill-wrapper.is-read-only .ql-toolbar .ql-formats button { pointer-events: none; opacity: 0.6; }
      `}</style>
      <div ref={containerRef} className="proposal-quill-editor bg-background text-foreground rounded-md border border-input shadow-sm" style={{ minHeight: "320px" }} />
    </div>
  );
}
