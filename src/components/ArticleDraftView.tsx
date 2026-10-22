import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { articlePlainText, wordCount as countWords } from "../format";
import type { ApprovedOutline, ArticleSectionContent } from "../types";

export type DraftDocumentSnapshot = {
  lede: string;
  closing: string;
  cta: string;
  sections: Array<{ id: string; heading: string; body: string }>;
};

export type ArticleDraftHandle = {
  /** Flush pending editor edits into storage before leaving the page. */
  flush: () => void;
};

type Suggestion = {
  id: string;
  label: string;
  detail: string;
  kind: "authority" | "readability" | "structure";
};

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  {
    id: "s1",
    label: "Simplify opening sentence",
    detail: "Lead with the buyer problem in one clear sentence.",
    kind: "readability",
  },
  {
    id: "s2",
    label: "Remove dated reference",
    detail: "Replace outdated examples with current language.",
    kind: "readability",
  },
  {
    id: "s3",
    label: "Replace overly whimsical language",
    detail: "Keep the tone specific and evidence-led.",
    kind: "readability",
  },
  {
    id: "s4",
    label: "Add supporting statistics",
    detail: "Cite a benchmark next to the primary claim.",
    kind: "authority",
  },
  {
    id: "s5",
    label: "Add industry data",
    detail: "Ground the framework in category context.",
    kind: "authority",
  },
  {
    id: "s6",
    label: "Add transition phrase",
    detail: "Bridge the last section into the next H2.",
    kind: "structure",
  },
  {
    id: "s7",
    label: "Clarify section headings",
    detail: "Make H2s skim-friendly and keyword-aligned.",
    kind: "structure",
  },
];

type Props = {
  outline: ApprovedOutline;
  sections: ArticleSectionContent[];
  authorLabel: string;
  lede?: string;
  closing?: string;
  cta?: string;
  seoScore?: number;
  /** Optional cover image (data URL) shown under the title. */
  coverImageSrc?: string;
  coverImageAlt?: string;
  /** Change this when a new draft is generated so the editor reloads. */
  documentKey?: string;
  onTitleChange: (title: string) => void;
  /** Single atomic save so Review always gets the full latest draft. */
  onDocumentChange: (doc: DraftDocumentSnapshot) => void;
  onBack?: () => void;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value.trim());
}

function plainBlockToHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "<p><br></p>";
  if (looksLikeHtml(trimmed)) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) return "";
      const asList = lines.every(
        (line) => line.startsWith("•") || line.startsWith("-"),
      );
      if (asList) {
        return `<ul>${lines
          .map(
            (line) =>
              `<li>${escapeHtml(line.replace(/^[•\-]\s*/, ""))}</li>`,
          )
          .join("")}</ul>`;
      }
      return `<p>${lines.map(escapeHtml).join("<br>")}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function headingToHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "<br>";
  if (looksLikeHtml(trimmed)) return trimmed;
  return escapeHtml(trimmed);
}

function buildDocumentHtml(input: {
  lede: string;
  sections: Array<{ id: string; heading: string; body: string }>;
  closing: string;
  cta: string;
}): string {
  const parts: string[] = [];
  parts.push(
    `<div data-part="lede" class="draft-doc-lede">${plainBlockToHtml(input.lede)}</div>`,
  );

  for (const section of input.sections) {
    parts.push(
      `<section data-part="section" data-section-id="${escapeHtml(section.id)}" id="draft-sec-${escapeHtml(section.id)}" class="draft-doc-section">` +
        `<h2 data-field="heading">${headingToHtml(section.heading)}</h2>` +
        `<div data-field="body">${plainBlockToHtml(section.body)}</div>` +
        `</section>`,
    );
  }

  parts.push(
    `<footer data-part="close" class="draft-doc-close">` +
      `<div data-field="closing">${plainBlockToHtml(input.closing)}</div>` +
      `<div data-field="cta" class="draft-doc-cta">${plainBlockToHtml(input.cta)}</div>` +
      `</footer>`,
  );

  return parts.join("");
}

/** Keep editor HTML so Review can show the same formatting. */
function nodeToStoredHtml(node: Element | null): string {
  if (!node) return "";
  return node.innerHTML
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

export const ArticleDraftView = forwardRef<ArticleDraftHandle, Props>(
  function ArticleDraftView(
  {
  outline,
  sections,
  authorLabel,
  lede = "",
  closing = "",
  cta = "",
  seoScore = 80,
  coverImageSrc,
  coverImageAlt,
  documentKey = "",
  onTitleChange,
  onDocumentChange,
  onBack,
}: Props,
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const blogRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const titleFocusedRef = useRef(false);
  const savedRangeRef = useRef<Range | null>(null);
  const syncingRef = useRef(false);
  const seededRef = useRef(false);
  const debounceRef = useRef<number | null>(null);
  const popupTimerRef = useRef<number | null>(null);

  const [pointedSuggestionId, setPointedSuggestionId] = useState<string | null>(
    null,
  );
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [blockType, setBlockType] = useState("p");
  const [fontName, setFontName] = useState("Arial");
  const [fontSize, setFontSize] = useState("3");
  const [lineHeight, setLineHeight] = useState("1.5");
  const [foreColor, setForeColor] = useState("#222433");
  const [hiliteColor, setHiliteColor] = useState("#f5bb48");
  const [liveWords, setLiveWords] = useState(0);

  const ordered = useMemo(() => {
    const byId = new Map(sections.map((s) => [s.sectionId, s]));
    return outline.sections.map((spec, index) => {
      const draft = byId.get(spec.id);
      return {
        id: spec.id,
        order: index,
        heading: draft?.heading ?? spec.heading,
        body: draft?.body ?? "",
      };
    });
  }, [outline.sections, sections]);

  const displayLede = lede;
  const displayClosing = closing;
  const displayCta = cta.trim() || outline.cta.trim();

  const contentKey = `${documentKey}::${ordered.map((s) => s.id).join("|")}`;

  const suggestions = DEFAULT_SUGGESTIONS.filter(
    (item) => !dismissed.includes(item.id),
  );
  const pointedSuggestion =
    suggestions.find((item) => item.id === pointedSuggestionId) ?? null;

  const baselineWords = useMemo(
    () =>
      countWords(
        articlePlainText({
          title: outline.title,
          lede: displayLede,
          sections: ordered.map((section) => ({
            heading: section.heading,
            body: section.body,
          })),
          closing: displayClosing,
          cta: displayCta,
        }),
      ),
    [outline.title, displayLede, displayClosing, displayCta, ordered],
  );

  useEffect(() => {
    setLiveWords(baselineWords);
  }, [baselineWords]);

  useEffect(() => {
    const node = titleRef.current;
    if (!node || titleFocusedRef.current) return;
    if (node.innerText.replace(/\n$/, "") !== outline.title) {
      node.innerText = outline.title || "";
    }
  }, [outline.title]);

  const seedEditor = useCallback(() => {
    const root = editorRef.current;
    if (!root) return;
    syncingRef.current = true;
    root.innerHTML = buildDocumentHtml({
      lede: displayLede,
      sections: ordered,
      closing: displayClosing,
      cta: displayCta,
    });
    seededRef.current = true;
    syncingRef.current = false;
  }, [displayLede, displayClosing, displayCta, ordered]);

  useEffect(() => {
    seedEditor();
    // Re-seed when section structure changes (new draft / regenerate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey]);

  useEffect(() => {
    return () => {
      if (popupTimerRef.current) window.clearTimeout(popupTimerRef.current);
    };
  }, []);

  function sectionIdForSuggestion(suggestionId: string): string {
    const indexById: Record<string, number> = {
      s1: 0,
      s2: 0,
      s3: 0,
      s4: 1,
      s5: 1,
      s6: Math.max(0, ordered.length - 1),
      s7: 0,
    };
    const index = indexById[suggestionId] ?? 0;
    return ordered[Math.min(index, Math.max(0, ordered.length - 1))]?.id ?? "";
  }

  function clearSuggestionTargetHighlight() {
    editorRef.current
      ?.querySelectorAll(".draft-doc-section.is-suggestion-target")
      .forEach((node) => node.classList.remove("is-suggestion-target"));
  }

  function clearSuggestionPopup() {
    if (popupTimerRef.current) {
      window.clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
    clearSuggestionTargetHighlight();
    setPointedSuggestionId(null);
    setPopupPos(null);
  }

  function placeSuggestionPopup(sectionId: string) {
    const section = document.getElementById(`draft-sec-${sectionId}`);
    const blog = blogRef.current;
    if (!section || !blog) return;

    clearSuggestionTargetHighlight();
    section.classList.add("is-suggestion-target");

    const blogRect = blog.getBoundingClientRect();
    const secRect = section.getBoundingClientRect();
    const top = Math.max(8, secRect.top - blogRect.top + 8);
    const left = Math.max(
      16,
      Math.min(secRect.left - blogRect.left + 20, blog.clientWidth - 336),
    );
    setPopupPos({ top, left });
  }

  function viewSuggestion(suggestionId: string) {
    const sectionId = sectionIdForSuggestion(suggestionId);
    if (pointedSuggestionId === suggestionId) {
      clearSuggestionPopup();
      return;
    }
    setPointedSuggestionId(suggestionId);
    setPopupPos(null);
    if (!sectionId) return;

    requestAnimationFrame(() => {
      const section = document.getElementById(`draft-sec-${sectionId}`);
      section?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (popupTimerRef.current) window.clearTimeout(popupTimerRef.current);
      popupTimerRef.current = window.setTimeout(() => {
        placeSuggestionPopup(sectionId);
        popupTimerRef.current = null;
      }, 320);
    });
  }

  function saveSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return;
    savedRangeRef.current = range.cloneRange();
  }

  function restoreSelection() {
    const range = savedRangeRef.current;
    const root = editorRef.current;
    if (!range || !root) {
      root?.focus();
      return;
    }
    root.focus();
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function run(command: string, value?: string) {
    restoreSelection();
    document.execCommand(command, false, value);
    saveSelection();
    editorRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function applyBlockType(next: string) {
    setBlockType(next);
    const map: Record<string, string> = {
      p: "P",
      h1: "H1",
      h2: "H2",
      h3: "H3",
      quote: "BLOCKQUOTE",
    };
    run("formatBlock", map[next] ?? "P");
  }

  function applyFont(next: string) {
    setFontName(next);
    run("fontName", next);
  }

  function applyFontSize(next: string) {
    setFontSize(next);
    run("fontSize", next);
  }

  function applyForeColor(next: string) {
    setForeColor(next);
    run("foreColor", next);
  }

  function applyHilite(next: string) {
    setHiliteColor(next);
    // hiliteColor works in Chromium; backColor as fallback
    restoreSelection();
    const ok = document.execCommand("hiliteColor", false, next);
    if (!ok) document.execCommand("backColor", false, next);
    saveSelection();
    editorRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function insertLink() {
    restoreSelection();
    const selection = window.getSelection();
    const hasSelection = Boolean(selection && !selection.isCollapsed);
    if (!hasSelection) {
      window.alert("Select text first, then add a link.");
      return;
    }
    const url = window.prompt("Link URL", "https://");
    if (!url) return;
    document.execCommand("createLink", false, url);
    saveSelection();
    editorRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function clearFormatting() {
    run("removeFormat");
    run("formatBlock", "P");
    setBlockType("p");
  }

  function bumpFontSize(delta: number) {
    const order = ["1", "2", "3", "4", "5", "6", "7"];
    const index = Math.max(0, Math.min(order.length - 1, order.indexOf(fontSize) + delta));
    applyFontSize(order[index]);
  }

  function applyLineHeight(next: string) {
    setLineHeight(next);
    const root = editorRef.current;
    if (root) root.style.lineHeight = next;
  }

  function readDocumentSnapshot(): DraftDocumentSnapshot | null {
    const root = editorRef.current;
    if (!root || syncingRef.current) return null;

    const ledeNode = root.querySelector('[data-part="lede"]');
    const closeNode = root.querySelector('[data-part="close"]');
    const nextSections: DraftDocumentSnapshot["sections"] = [];
    root.querySelectorAll('[data-part="section"]').forEach((sectionEl) => {
      const id = sectionEl.getAttribute("data-section-id");
      if (!id) return;
      nextSections.push({
        id,
        heading: nodeToStoredHtml(
          sectionEl.querySelector('[data-field="heading"]'),
        ),
        body: nodeToStoredHtml(sectionEl.querySelector('[data-field="body"]')),
      });
    });

    return {
      lede: nodeToStoredHtml(ledeNode as Element | null),
      closing: nodeToStoredHtml(
        closeNode?.querySelector('[data-field="closing"]') as Element | null,
      ),
      cta: nodeToStoredHtml(
        closeNode?.querySelector('[data-field="cta"]') as Element | null,
      ),
      sections: nextSections,
    };
  }

  function persistFromEditor() {
    const snapshot = readDocumentSnapshot();
    if (!snapshot) return;
    onDocumentChange(snapshot);
    const root = editorRef.current;
    const titleWords = countWords(outline.title);
    const bodyWords = countWords(root?.innerText || "");
    setLiveWords(titleWords + bodyWords);
  }

  function flushPendingEdits() {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    // Also commit title if still focused
    if (titleRef.current && titleFocusedRef.current) {
      const next = titleRef.current.innerText.replace(/\n$/, "");
      if (next !== outline.title) onTitleChange(next);
      titleFocusedRef.current = false;
    }
    persistFromEditor();
  }

  useImperativeHandle(ref, () => ({
    flush: flushPendingEdits,
  }));

  function schedulePersist() {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      persistFromEditor();
    }, 280);
  }

  function acceptSuggestion() {
    if (!pointedSuggestion) return;
    setDismissed((current) => [...current, pointedSuggestion.id]);
    clearSuggestionPopup();
  }

  function rejectSuggestion() {
    if (!pointedSuggestion) return;
    setDismissed((current) => [...current, pointedSuggestion.id]);
    clearSuggestionPopup();
  }

  const authority = suggestions.filter((s) => s.kind === "authority").length;
  const readability = suggestions.filter((s) => s.kind === "readability").length;
  const structure = suggestions.filter((s) => s.kind === "structure").length;
  const seoPct = Math.max(40, Math.min(99, seoScore));

  function ToolButton({
    title,
    onClick,
    children,
  }: {
    title: string;
    onClick: () => void;
    children: ReactNode;
  }) {
    return (
      <button
        type="button"
        title={title}
        aria-label={title}
        onMouseDown={(event) => {
          event.preventDefault();
          saveSelection();
        }}
        onClick={onClick}
      >
        {children}
      </button>
    );
  }

  return (
    <div className="draft-shell">
      <div className="draft-main">
        <div className="draft-toolbar" role="toolbar" aria-label="Formatting">
          <div className="gdocs-tool-cluster">
            <ToolButton title="Undo" onClick={() => run("undo")}>↶</ToolButton>
            <ToolButton title="Redo" onClick={() => run("redo")}>↷</ToolButton>
          </div>
          <span className="gdocs-sep" />
          <select
            className="gdocs-select"
            value={blockType}
            aria-label="Style"
            onMouseDown={() => saveSelection()}
            onChange={(event) => applyBlockType(event.target.value)}
          >
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="quote">Quote</option>
          </select>
          <select
            className="gdocs-select gdocs-select-font"
            value={fontName}
            aria-label="Font"
            onMouseDown={() => saveSelection()}
            onChange={(event) => applyFont(event.target.value)}
          >
            <option value="Arial">Arial</option>
            <option value="Figtree">Figtree</option>
            <option value="Sora">Sora</option>
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times New Roman</option>
          </select>
          <div className="gdocs-fontsize">
            <ToolButton title="Decrease font size" onClick={() => bumpFontSize(-1)}>−</ToolButton>
            <select
              className="gdocs-select gdocs-select-size"
              value={fontSize}
              aria-label="Font size"
              onMouseDown={() => saveSelection()}
              onChange={(event) => applyFontSize(event.target.value)}
            >
              <option value="1">10</option>
              <option value="2">13</option>
              <option value="3">16</option>
              <option value="4">18</option>
              <option value="5">24</option>
              <option value="6">32</option>
            </select>
            <ToolButton title="Increase font size" onClick={() => bumpFontSize(1)}>+</ToolButton>
          </div>
          <span className="gdocs-sep" />
          <div className="gdocs-tool-cluster">
            <ToolButton title="Bold" onClick={() => run("bold")}><strong>B</strong></ToolButton>
            <ToolButton title="Italic" onClick={() => run("italic")}><em>I</em></ToolButton>
            <ToolButton title="Underline" onClick={() => run("underline")}><u>U</u></ToolButton>
            <ToolButton title="Strikethrough" onClick={() => run("strikeThrough")}>
              <span className="gdocs-strike-icon" aria-hidden>
                S
              </span>
            </ToolButton>
            <label className="draft-toolbar-color" title="Text color">
              <span style={{ borderBottomColor: foreColor }}>A</span>
              <input
                type="color"
                value={foreColor}
                aria-label="Text color"
                onMouseDown={() => saveSelection()}
                onChange={(event) => applyForeColor(event.target.value)}
              />
            </label>
            <label className="draft-toolbar-color" title="Highlight">
              <span className="draft-toolbar-hilite" style={{ background: hiliteColor }} />
              <input
                type="color"
                value={hiliteColor}
                aria-label="Highlight color"
                onMouseDown={() => saveSelection()}
                onChange={(event) => applyHilite(event.target.value)}
              />
            </label>
          </div>
          <span className="gdocs-sep" />
          <div className="gdocs-tool-cluster">
            <ToolButton title="Align left" onClick={() => run("justifyLeft")}>☰</ToolButton>
            <ToolButton title="Align center" onClick={() => run("justifyCenter")}>≣</ToolButton>
            <ToolButton title="Align right" onClick={() => run("justifyRight")}>☰</ToolButton>
            <ToolButton title="Bulleted list" onClick={() => run("insertUnorderedList")}>•</ToolButton>
            <ToolButton title="Numbered list" onClick={() => run("insertOrderedList")}>1.</ToolButton>
            <ToolButton title="Link" onClick={insertLink}>↗</ToolButton>
            <ToolButton title="Clear formatting" onClick={clearFormatting}>Tx</ToolButton>
          </div>
          <select
            className="gdocs-select gdocs-select-spacing"
            value={lineHeight}
            aria-label="Line spacing"
            onChange={(event) => applyLineHeight(event.target.value)}
          >
            <option value="1.15">Tight</option>
            <option value="1.5">Normal</option>
            <option value="1.75">Relaxed</option>
            <option value="2">Double</option>
          </select>
          <div className="draft-toolbar-end">
            <span className="draft-wordcount">{liveWords} words</span>
          </div>
        </div>

        <div className="draft-canvas">
          <article className="draft-blog" ref={blogRef}>
            <header className="draft-blog-head">
              <div
                ref={titleRef}
                className="draft-title"
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="Draft title"
                data-placeholder="Untitled draft"
                onFocus={() => {
                  titleFocusedRef.current = true;
                }}
                onBlur={() => {
                  titleFocusedRef.current = false;
                  const next =
                    titleRef.current?.innerText.replace(/\n$/, "") ?? "";
                  if (next !== outline.title) onTitleChange(next);
                }}
                onInput={() => {
                  const next =
                    titleRef.current?.innerText.replace(/\n$/, "") ?? "";
                  onTitleChange(next);
                }}
              />
              <p className="draft-byline">{authorLabel}</p>
            </header>

            {coverImageSrc?.startsWith("data:image") ? (
              <figure className="draft-blog-cover">
                <img src={coverImageSrc} alt={coverImageAlt || "Cover image"} />
              </figure>
            ) : null}

            <div
              ref={editorRef}
              className="draft-doc-editor"
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline
              aria-label="Draft body"
              style={{ lineHeight }}
              onMouseUp={saveSelection}
              onKeyUp={saveSelection}
              onFocus={saveSelection}
              onInput={() => {
                saveSelection();
                const root = editorRef.current;
                if (root) {
                  setLiveWords(
                    countWords(outline.title) + countWords(root.innerText || ""),
                  );
                }
                schedulePersist();
              }}
              onBlur={() => {
                if (debounceRef.current) {
                  window.clearTimeout(debounceRef.current);
                  debounceRef.current = null;
                }
                persistFromEditor();
              }}
            />

            {pointedSuggestion && popupPos ? (
              <div
                className="draft-inline-card draft-inline-card-floating"
                role="dialog"
                aria-label={pointedSuggestion.label}
                style={{ top: popupPos.top, left: popupPos.left }}
              >
                <strong>{pointedSuggestion.label}</strong>
                <p>{pointedSuggestion.detail}</p>
                <div className="draft-inline-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={rejectSuggestion}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={acceptSuggestion}
                  >
                    Accept
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        </div>
      </div>

      <aside className="draft-side" aria-label="Optimization">
        <div className="draft-side-head">
          <h3 title={outline.title}>{outline.title || "Draft"}</h3>
        </div>

        <div className="draft-score-card">
          <div
            className="draft-gauge"
            style={{ "--pct": String(seoPct) } as CSSProperties}
          >
            <strong>{seoPct}%</strong>
          </div>
          <p className="draft-score-label">SEO optimization</p>
        </div>

        <div className="draft-metric-row">
          <div className="draft-metric draft-metric-authority">
            <strong>{authority}</strong>
            <span>Authority</span>
          </div>
          <div className="draft-metric draft-metric-readability">
            <strong>{readability}</strong>
            <span>Readability</span>
          </div>
          <div className="draft-metric draft-metric-structure">
            <strong>{structure}</strong>
            <span>Structure</span>
          </div>
        </div>

        <div className="draft-suggest-head">
          <h4>Active suggestions</h4>
          <span>{suggestions.length}</span>
        </div>
        <ul className="draft-suggest-list">
          {suggestions.map((item) => (
            <li key={item.id}>
              <div
                className={
                  item.id === pointedSuggestion?.id
                    ? "draft-suggest is-active"
                    : "draft-suggest"
                }
              >
                <span className={`draft-suggest-dot ${item.kind}`} />
                <span className="draft-suggest-label">{item.label}</span>
                <button
                  type="button"
                  className="draft-suggest-view"
                  onClick={() => viewSuggestion(item.id)}
                >
                  View
                </button>
              </div>
            </li>
          ))}
          {suggestions.length === 0 ? (
            <li className="muted draft-suggest-empty">All suggestions cleared.</li>
          ) : null}
        </ul>

        {onBack ? (
          <div className="draft-side-footer">
            <button type="button" className="btn btn-ghost" onClick={onBack}>
              Back
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
},
);
