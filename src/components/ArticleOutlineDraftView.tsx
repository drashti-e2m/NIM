import { useEffect, useState } from "react";
import type { ApprovedOutline, OutlineSectionSpec } from "../types";

type Props = {
  outline: ApprovedOutline;
  authorLabel: string;
  outlineApproved: boolean;
  onTitleChange: (title: string) => void;
  onIntroChange: (value: string) => void;
  onConclusionChange: (value: string) => void;
  onSectionChange: (sectionId: string, patch: Partial<OutlineSectionSpec>) => void;
  onApproveOutline?: () => void;
  onRegenerateOutline?: () => void;
  onGenerateDraft?: () => void;
  generatingDraft?: boolean;
  onBack?: () => void;
  onRemoveSection?: (sectionId: string) => void;
};

type EditTarget = "title" | "intro" | "conclusion" | string | null;

export function ArticleOutlineDraftView({
  outline,
  authorLabel,
  outlineApproved,
  onTitleChange,
  onIntroChange,
  onConclusionChange,
  onSectionChange,
  onApproveOutline,
  onRegenerateOutline,
  onGenerateDraft,
  generatingDraft = false,
  onBack,
  onRemoveSection,
}: Props) {
  const [activeId, setActiveId] = useState<string>("intro");
  const [editing, setEditing] = useState<EditTarget>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>(() =>
    outline.sections.map((s) => s.id),
  );

  useEffect(() => {
    setExpandedIds((current) => {
      const ids = outline.sections.map((s) => s.id);
      const kept = current.filter((id) => ids.includes(id));
      return kept.length > 0 ? kept : ids;
    });
  }, [outline.sections]);

  function sectionComplete(section: OutlineSectionSpec): boolean {
    return section.keyPoints.length > 0 && section.heading.trim().length > 0;
  }

  function toggleExpand(id: string) {
    setExpandedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
    setActiveId(id);
  }

  function scrollTo(id: string) {
    setActiveId(id);
    if (id !== "intro" && id !== "conclusion") {
      setExpandedIds((current) =>
        current.includes(id) ? current : [...current, id],
      );
    }
    document
      .getElementById(`doc-block-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startEdit(target: EditTarget) {
    setEditing(target);
    if (typeof target === "string" && target !== "title") {
      setActiveId(target === "intro" || target === "conclusion" ? target : target);
      if (target !== "intro" && target !== "conclusion" && target !== "title") {
        setExpandedIds((current) =>
          current.includes(target) ? current : [...current, target],
        );
      }
    }
  }

  return (
    <div className="doc-shell doc-shell-outline">
      <aside className="doc-toc" aria-label="Table of contents">
        <button
          type="button"
          className="doc-toc-action"
          onClick={() => scrollTo("intro")}
        >
          <span aria-hidden>✎</span> Introduction
        </button>

        <ol className="doc-toc-list">
          {outline.sections.map((section, index) => {
            const done = sectionComplete(section);
            const active = activeId === section.id;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  className={[
                    "doc-toc-item",
                    active ? "is-active" : "",
                    done ? "is-done" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => scrollTo(section.id)}
                >
                  <span className="doc-toc-status" aria-hidden>
                    {done ? "✓" : ""}
                  </span>
                  <span className="doc-toc-label">
                    {index + 1}. {section.heading || "Untitled section"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          className="doc-toc-action"
          onClick={() => scrollTo("conclusion")}
        >
          <span aria-hidden>✎</span> Conclusion
        </button>

        {onBack ? (
          <div className="doc-toc-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onBack}
              disabled={generatingDraft}
            >
              Back
            </button>
          </div>
        ) : null}
      </aside>

      <div className="doc-main">
        <article className="doc-canvas">
          <header className="doc-canvas-head">
            {editing === "title" ? (
              <div className="doc-inline-edit">
                <input
                  className="doc-title-input"
                  value={outline.title}
                  autoFocus
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Article title"
                  aria-label="Article title"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditing(null)}
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="doc-read-title">
                <h1>{outline.title || "Untitled outline"}</h1>
                <button
                  type="button"
                  className="doc-icon-btn"
                  aria-label="Edit title"
                  onClick={() => startEdit("title")}
                >
                  ✎
                </button>
              </div>
            )}
            <p className="doc-author">Author: {authorLabel}</p>
          </header>

          <section
            id="doc-block-intro"
            className={`doc-block${activeId === "intro" ? " is-active" : ""}`}
          >
            <div className="doc-block-bar">
              <span className="doc-drag" aria-hidden>
                ⠿
              </span>
              <strong>Introduction</strong>
              <div className="doc-block-actions">
                {editing === "intro" ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditing(null)}
                  >
                    Done
                  </button>
                ) : (
                  <button
                    type="button"
                    className="doc-icon-btn"
                    aria-label="Edit introduction"
                    onClick={() => startEdit("intro")}
                  >
                    ✎
                  </button>
                )}
              </div>
            </div>
            {editing === "intro" ? (
              <textarea
                className="doc-block-field"
                rows={3}
                value={outline.introductionPurpose}
                autoFocus
                onChange={(e) => onIntroChange(e.target.value)}
                placeholder="What the introduction should accomplish…"
              />
            ) : (
              <p className="doc-read-text">
                {outline.introductionPurpose || "No introduction purpose yet."}
              </p>
            )}
          </section>

          {outline.sections.map((section, index) => {
            const expanded = expandedIds.includes(section.id);
            const isEditing = editing === section.id;
            return (
              <section
                key={section.id}
                id={`doc-block-${section.id}`}
                className={`doc-block${activeId === section.id ? " is-active" : ""}`}
              >
                <div className="doc-block-bar">
                  <span className="doc-drag" aria-hidden>
                    ⠿
                  </span>
                  <button
                    type="button"
                    className="doc-block-toggle"
                    onClick={() => toggleExpand(section.id)}
                    aria-expanded={expanded}
                  >
                    <span className="doc-block-num">{index + 1}.</span>
                    <span className="doc-block-heading">
                      {section.heading || "Untitled section"}
                    </span>
                    <span className="doc-chevron" aria-hidden>
                      {expanded ? "▾" : "▸"}
                    </span>
                  </button>
                  <div className="doc-block-actions">
                    {isEditing ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditing(null)}
                      >
                        Done
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="doc-icon-btn"
                        aria-label="Edit section"
                        onClick={() => startEdit(section.id)}
                      >
                        ✎
                      </button>
                    )}
                    {onRemoveSection && outline.sections.length > 1 ? (
                      <button
                        type="button"
                        className="doc-icon-btn"
                        aria-label="Remove section"
                        onClick={() => onRemoveSection(section.id)}
                      >
                        ⌫
                      </button>
                    ) : null}
                  </div>
                </div>

                {expanded ? (
                  <div className="doc-block-body">
                    {isEditing ? (
                      <>
                        <label className="doc-field">
                          <span>Heading</span>
                          <input
                            value={section.heading}
                            autoFocus
                            onChange={(e) =>
                              onSectionChange(section.id, {
                                heading: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label className="doc-field">
                          <span>Key points (one per line)</span>
                          <textarea
                            rows={4}
                            value={section.keyPoints.join("\n")}
                            onChange={(e) =>
                              onSectionChange(section.id, {
                                keyPoints: e.target.value
                                  .split("\n")
                                  .map((line) => line.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </label>
                        <label className="doc-field">
                          <span>Evidence required</span>
                          <textarea
                            rows={2}
                            value={section.evidenceRequired.join("\n")}
                            onChange={(e) =>
                              onSectionChange(section.id, {
                                evidenceRequired: e.target.value
                                  .split("\n")
                                  .map((line) => line.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </label>
                        <label className="doc-field">
                          <span>Transition to next</span>
                          <input
                            value={section.transitionToNext}
                            onChange={(e) =>
                              onSectionChange(section.id, {
                                transitionToNext: e.target.value,
                              })
                            }
                          />
                        </label>
                      </>
                    ) : (
                      <div className="doc-read-stack">
                        {section.keyPoints.length > 0 ? (
                          <ul className="doc-read-list">
                            {section.keyPoints.map((point) => (
                              <li key={point}>{point}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="doc-read-text muted">No key points yet.</p>
                        )}
                        {section.evidenceRequired.length > 0 ? (
                          <p className="doc-read-meta">
                            <span>Evidence:</span>{" "}
                            {section.evidenceRequired.join(" · ")}
                          </p>
                        ) : null}
                        {section.transitionToNext ? (
                          <p className="doc-read-meta">
                            <span>Next:</span> {section.transitionToNext}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}

          <section
            id="doc-block-conclusion"
            className={`doc-block${activeId === "conclusion" ? " is-active" : ""}`}
          >
            <div className="doc-block-bar">
              <span className="doc-drag" aria-hidden>
                ⠿
              </span>
              <strong>Conclusion</strong>
              <div className="doc-block-actions">
                {editing === "conclusion" ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditing(null)}
                  >
                    Done
                  </button>
                ) : (
                  <button
                    type="button"
                    className="doc-icon-btn"
                    aria-label="Edit conclusion"
                    onClick={() => startEdit("conclusion")}
                  >
                    ✎
                  </button>
                )}
              </div>
            </div>
            {editing === "conclusion" ? (
              <label className="doc-field">
                <span>Conclusion purpose</span>
                <textarea
                  rows={3}
                  value={outline.conclusionPurpose}
                  autoFocus
                  onChange={(e) => onConclusionChange(e.target.value)}
                />
              </label>
            ) : (
              <div className="doc-read-stack">
                <p className="doc-read-text">
                  {outline.conclusionPurpose || "No conclusion purpose yet."}
                </p>
              </div>
            )}
          </section>
        </article>

        <div className="doc-outline-actions">
          {onRegenerateOutline ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onRegenerateOutline}
              disabled={generatingDraft}
            >
              Regenerate
            </button>
          ) : null}
          {onApproveOutline ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onApproveOutline}
              disabled={generatingDraft || outlineApproved}
            >
              {outlineApproved ? "Approved" : "Approve"}
            </button>
          ) : null}
          {onGenerateDraft ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onGenerateDraft}
              disabled={generatingDraft}
            >
              {generatingDraft ? "Generating…" : "Generate draft"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
