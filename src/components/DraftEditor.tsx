import { useEffect, useMemo, useRef, useState } from "react";
import type { Draft, DraftStatus } from "../types";
import { stageLabel } from "../labels";
import { wordCount } from "../format";
import { DemoBadge, StatusBadge } from "./ui";
import { DropdownSelect } from "./DropdownSelect";

interface DraftEditorProps {
  clientName: string;
  stage: Draft["stage"];
  format: string;
  topicTitle: string;
  persona: string;
  tone: string;
  goal: string;
  keywords: string;
  cta: string;
  instructions: string;
  title: string;
  body: string;
  status: DraftStatus;
  onTitle: (value: string) => void;
  onBody: (value: string) => void;
  onStatus: (value: DraftStatus) => void;
  onCopy: () => void;
  onRegenerate: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onSave: () => void;
  saveLabel: string;
  copied: boolean;
  notice: string;
}

export function DraftEditor(props: DraftEditorProps) {
  const words = useMemo(() => wordCount(props.body), [props.body]);

  return (
    <div className="editor-layout">
      <section className="doc-sheet">
        <div className="doc-toolbar">
          <DemoBadge>Mock generation · local template</DemoBadge>
          <StatusBadge status={props.status} />
          <span className="muted">{words} words</span>
        </div>
        <TitleField value={props.title} onChange={props.onTitle} />
        <label className="sr-only" htmlFor="draft-body">
          Draft body
        </label>
        <textarea
          id="draft-body"
          className="doc-body"
          value={props.body}
          onChange={(event) => props.onBody(event.target.value)}
        />
        <div className="doc-actions">
          <button type="button" className="btn btn-secondary" onClick={props.onCopy}>
            {props.copied ? "Copied" : "Copy"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={props.onRegenerate}>
            Regenerate
          </button>
          {props.canUndo ? (
            <button type="button" className="btn btn-ghost" onClick={props.onUndo}>
              Undo regenerate
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={props.onSave}>
            {props.saveLabel}
          </button>
        </div>
        <p className="notice" role="status" aria-live="polite">
          {props.notice}
        </p>
      </section>
      <aside className="editor-meta">
        <h2>Draft record</h2>
        <Meta label="Client" value={props.clientName} />
        <DropdownSelect
          className="field"
          label="Status"
          value={props.status}
          options={[
            { value: "draft", label: "Draft" },
            { value: "in_review", label: "In Review" },
            { value: "approved", label: "Approved" },
          ]}
          onChange={(next) => props.onStatus(next as DraftStatus)}
        />
        <Meta label="Stage" value={stageLabel(props.stage)} />
        <Meta label="Format" value={props.format} />
        <Meta label="Topic" value={props.topicTitle} />
        <Meta label="Persona" value={props.persona || "-"} />
        <Meta label="Tone" value={props.tone || "-"} />
        <Meta label="Goal" value={props.goal || "-"} />
        <Meta label="Keywords" value={props.keywords || "-"} />
        <Meta label="Call to action" value={props.cta || "-"} />
        <Meta label="Instructions" value={props.instructions || "-"} />
      </aside>
    </div>
  );
}

function TitleField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [value]);

  return (
    <>
      <label className="sr-only" htmlFor="draft-title">
        Draft title
      </label>
      <textarea
        ref={ref}
        id="draft-title"
        className="doc-title"
        rows={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-block">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function useCopyFeedback() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      return true;
    } catch {
      setCopied(false);
      return false;
    }
  }

  return { copied, copy };
}
