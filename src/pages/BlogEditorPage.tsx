import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useClients } from "../context/ClientsContext";
import { useBlogs } from "../context/BlogsContext";
import { usePageTitle } from "../usePageTitle";
import { wordCount } from "../format";
import { STATUS_OPTIONS } from "../labels";
import {
  hydrateSectionsFromBody,
  sectionsToBody,
} from "../services/blogGenerate";
import type { DraftStatus } from "../types";
import { EmptyState, StatusBadge } from "../components/ui";
import { DropdownSelect } from "../components/DropdownSelect";
import { blogStatusPatch } from "../services/blogStatus";

type Align = "left" | "center" | "right" | "justify";
type SaveState = "idle" | "saving" | "saved" | "error";

export function BlogEditorPage() {
  const { clientId = "", blogId = "" } = useParams();
  const navigate = useNavigate();
  const { getClient, setLastClientId } = useClients();
  const { getBlog, saveArticleContent, updateBlog } = useBlogs();
  const client = getClient(clientId);
  const blog = getBlog(blogId);
  const matched = blog && blog.clientId === clientId ? blog : undefined;
  usePageTitle(matched ? `Edit · ${matched.title}` : "Edit blog");

  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(matched?.title ?? "");
  const [seoTitle, setSeoTitle] = useState(matched?.seoTitle ?? "");
  const [seoMeta, setSeoMeta] = useState(matched?.seoMeta ?? "");
  const [status, setStatus] = useState<DraftStatus>(matched?.status ?? "draft");
  const [fontSize, setFontSize] = useState("3");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [words, setWords] = useState(0);
  const [ready, setReady] = useState(false);
  const [tokenAtLoad, setTokenAtLoad] = useState(matched?.generationToken ?? 0);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (clientId) setLastClientId(clientId);
  }, [clientId, setLastClientId]);

  useEffect(() => {
    if (!matched || !editorRef.current) return;
    setTitle(matched.title);
    setSeoTitle(matched.seoTitle || matched.title);
    setSeoMeta(matched.seoMeta || "");
    setStatus(matched.status);
    setTokenAtLoad(matched.generationToken);
    const source =
      matched.sections?.length > 0
        ? sectionsToBody(matched.sections)
        : matched.body;
    editorRef.current.innerHTML = plainToHtml(source);
    setWords(wordCount(editorRef.current.innerText));
    setReady(true);
    dirtyRef.current = false;
    setSaveState("idle");
  }, [matched?.id, matched?.generationToken]);

  // Keep editor status in sync when status changes elsewhere (Calendar, Library, Review).
  useEffect(() => {
    if (!matched) return;
    setStatus(matched.status);
  }, [matched?.status, matched?.id]);

  if (!client || !matched) {
    return (
      <EmptyState
        title="Article not found"
        body="Return to the client workspace and open a saved article."
        action={
          <Link className="btn btn-primary" to={client ? `/clients/${client.id}` : "/clients"}>
            Back
          </Link>
        }
      />
    );
  }

  const activeClient = client;
  const activeBlog = matched;

  function run(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    dirtyRef.current = true;
    setSaveState("idle");
    refreshWordCount();
  }

  function refreshWordCount() {
    if (!editorRef.current) return;
    setWords(wordCount(editorRef.current.innerText));
  }

  function applyAlign(align: Align) {
    const map: Record<Align, string> = {
      left: "justifyLeft",
      center: "justifyCenter",
      right: "justifyRight",
      justify: "justifyFull",
    };
    run(map[align]);
  }

  function save() {
    setSaveState("saving");
    setNotice("");
    try {
      const plain = editorRef.current?.innerText ?? "";
      const html = editorRef.current?.innerHTML ?? "";
      const bodyText = plain.trim() ? plain : html;
      const sections = hydrateSectionsFromBody(
        bodyText,
        activeBlog.approvedOutline,
      );
      const saved = saveArticleContent({
        id: activeBlog.id,
        title: title.trim() || activeBlog.title,
        body: sectionsToBody(sections) || bodyText,
        sections,
        seoTitle: seoTitle.trim(),
        seoMeta: seoMeta.trim(),
        status,
        expectedToken: tokenAtLoad,
        snapshot: true,
        snapshotLabel: "Editor save",
        markReviewOutdated:
          activeBlog.articlePhase === "in_review" ||
          activeBlog.articlePhase === "approved",
      });
      if (!saved) {
        setSaveState("error");
        setNotice("Save failed.");
        return;
      }
      if (saved.generationToken === activeBlog.generationToken && dirtyRef.current) {
        // Stale token rejection left content unchanged
        setSaveState("error");
        setNotice(
          "A newer version was already saved. Reload the article before editing again.",
        );
        return;
      }
      setTokenAtLoad(saved.generationToken);
      dirtyRef.current = false;
      setSaveState("saved");
      setNotice(
        saved.articlePhase === "review_outdated"
          ? "Saved. Review is marked outdated - reopen Review to rerun checks."
          : "Saved. Outline association and article ID retained.",
      );
    } catch {
      setSaveState("error");
      setNotice("Save failed. Try again.");
    }
  }

  function saveAndReview() {
    save();
    navigate(`/clients/${activeClient.id}/blog/${activeBlog.id}`);
  }

  return (
    <>
      <header className="page-head reader-head">
        <div>
          <p className="eyebrow">
            {activeClient.name} · Article {activeBlog.id.slice(0, 8)}…
          </p>
          <h1>Draft editor</h1>
          <p className="muted">
            Edits update this article record. Review always loads the latest
            saved version - it never regenerates.
          </p>
          <div className="reader-status">
            <StatusBadge status={status} />
            <span className="muted">{words} words</span>
            <span className={`save-pill save-${saveState}`}>
              {saveState === "idle" && (dirtyRef.current ? "Unsaved changes" : "Ready")}
              {saveState === "saving" && "Saving…"}
              {saveState === "saved" && "Saved"}
              {saveState === "error" && "Save error"}
            </span>
          </div>
        </div>
        <div className="reader-actions">
          <Link
            className="btn btn-ghost"
            to={`/clients/${activeClient.id}/blog/${activeBlog.id}`}
          >
            Review
          </Link>
          <button type="button" className="btn btn-secondary" onClick={save}>
            Save
          </button>
          <button type="button" className="btn btn-primary" onClick={saveAndReview}>
            Save & review
          </button>
        </div>
      </header>

      {notice ? <p className="drive-upload-msg">{notice}</p> : null}
      {activeBlog.outlineDirtyAfterDraft ? (
        <p className="field-error">
          Outline was changed after this draft. Reconcile in the wizard or
          regenerate from the approved outline.
        </p>
      ) : null}

      <div className="editor-layout word-editor-layout">
        <section className="doc-sheet word-sheet">
          <div className="word-ribbon" role="toolbar" aria-label="Formatting">
            <div className="word-group">
              <button type="button" className="word-btn" onClick={() => run("undo")}>
                Undo
              </button>
              <button type="button" className="word-btn" onClick={() => run("redo")}>
                Redo
              </button>
            </div>
            <div className="word-group">
              <button type="button" className="word-btn" onClick={() => run("bold")}>
                <strong>B</strong>
              </button>
              <button type="button" className="word-btn" onClick={() => run("italic")}>
                <em>I</em>
              </button>
              <button type="button" className="word-btn" onClick={() => run("underline")}>
                <span className="word-u">U</span>
              </button>
            </div>
            <div className="word-group">
              <DropdownSelect
                className="word-select"
                label="Font size"
                labelHidden
                value={fontSize}
                options={[
                  { value: "2", label: "Small" },
                  { value: "3", label: "Normal" },
                  { value: "4", label: "Large" },
                  { value: "5", label: "Heading" },
                ]}
                onChange={(next) => {
                  setFontSize(next);
                  run("fontSize", next);
                }}
              />
              <button type="button" className="word-btn" onClick={() => run("formatBlock", "H2")}>
                H2
              </button>
              <button type="button" className="word-btn" onClick={() => run("insertUnorderedList")}>
                • List
              </button>
              <button type="button" className="word-btn" onClick={() => applyAlign("left")}>
                Left
              </button>
            </div>
          </div>

          <textarea
            id="blog-edit-title"
            className="doc-title"
            rows={1}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              dirtyRef.current = true;
              setSaveState("idle");
            }}
          />

          <div
            ref={editorRef}
            className={`word-canvas${ready ? "" : " word-canvas-loading"}`}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="Blog body"
            onInput={() => {
              dirtyRef.current = true;
              setSaveState("idle");
              refreshWordCount();
            }}
          />
        </section>

        <aside className="editor-meta">
          <h2>Article</h2>
          <div className="meta-block">
            <span>Client</span>
            <strong>{activeClient.name}</strong>
          </div>
          <div className="meta-block">
            <span>Outline</span>
            <strong>
              {activeBlog.approvedOutline?.approved
                ? `${activeBlog.approvedOutline.sections.length} sections approved`
                : "Not approved"}
            </strong>
          </div>
          <DropdownSelect
            className="field"
            label="Status"
            value={status}
            options={STATUS_OPTIONS.map((option) => ({
              value: option.id,
              label: option.label,
            }))}
            onChange={(next) => {
              const value = next as DraftStatus;
              setStatus(value);
              updateBlog(activeBlog.id, blogStatusPatch(value));
              setNotice(`Status updated to ${value.replace("_", " ")}.`);
            }}
          />
          <div className="meta-block">
            <span>Versions</span>
            <strong>{activeBlog.versions?.length ?? 0} snapshots</strong>
          </div>
          <label className="field">
            <span className="field-label">SEO title</span>
            <input
              value={seoTitle}
              onChange={(e) => {
                setSeoTitle(e.target.value);
                dirtyRef.current = true;
                setSaveState("idle");
              }}
              maxLength={60}
            />
          </label>
          <label className="field">
            <span className="field-label">Meta description</span>
            <textarea
              rows={4}
              value={seoMeta}
              onChange={(e) => {
                setSeoMeta(e.target.value);
                dirtyRef.current = true;
                setSaveState("idle");
              }}
              maxLength={155}
            />
          </label>
        </aside>
      </div>
    </>
  );
}

function plainToHtml(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "<p></p>";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;

  const blocks = trimmed.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) return "";
      const first = lines[0];
      const looksHeading =
        lines.length === 1 &&
        first.length < 90 &&
        !first.startsWith("•") &&
        !first.startsWith("-");
      if (looksHeading) return `<h2>${escapeHtml(first)}</h2>`;
      const asList = lines.every((line) => line.startsWith("•") || line.startsWith("-"));
      if (asList) {
        return `<ul>${lines
          .map((line) => `<li>${escapeHtml(line.replace(/^[•\-]\s*/, ""))}</li>`)
          .join("")}</ul>`;
      }
      return `<p>${lines.map(escapeHtml).join("<br>")}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
