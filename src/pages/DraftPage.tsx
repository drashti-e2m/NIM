import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDrafts } from "../context/DraftsContext";
import { useClients } from "../context/ClientsContext";
import { generateDraft } from "../services/generate";
import { usePageTitle } from "../usePageTitle";
import type { DraftStatus, TopicSuggestion } from "../types";
import { EmptyState } from "../components/ui";
import { DraftEditor, useCopyFeedback } from "../components/DraftEditor";

export function DraftPage() {
  const { draftId = "" } = useParams();
  const { drafts, updateDraft } = useDrafts();
  const { getClient } = useClients();
  const draft = drafts.find((item) => item.id === draftId);
  const client = draft ? getClient(draft.clientId) : undefined;
  usePageTitle(draft?.title ?? "Draft");
  const { copied, copy } = useCopyFeedback();

  const [title, setTitle] = useState(draft?.title ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [status, setStatus] = useState<DraftStatus>(draft?.status ?? "draft");
  const [variant, setVariant] = useState(draft?.variant ?? 0);
  const [snapshot, setSnapshot] = useState(
    draft ? `${draft.title}\n${draft.body}\n${draft.status}` : "",
  );
  const [undo, setUndo] = useState<{ body: string; variant: number } | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!draft) return;
    setTitle(draft.title);
    setBody(draft.body);
    setStatus(draft.status);
    setVariant(draft.variant);
    setSnapshot(`${draft.title}\n${draft.body}\n${draft.status}`);
    setUndo(null);
    setNotice("");
  }, [draft?.id]);

  if (!draft || !client) {
    return (
      <EmptyState
        title="Draft not found"
        body="It may have been saved in a different browser. The library lists drafts stored here."
        action={
          <Link className="btn btn-primary" to="/library">
            Back to Content Library
          </Link>
        }
      />
    );
  }

  const activeDraft = draft;
  const activeClient = client;
  const topic: TopicSuggestion = {
    id: draft.topicId,
    title: draft.topicTitle,
    angle: draft.topicAngle,
  };
  const dirty = `${title}\n${body}\n${status}` !== snapshot;

  function save() {
    if (!title.trim() || !body.trim()) {
      setNotice("Add a title and body before saving.");
      return;
    }
    updateDraft(activeDraft.id, {
      title: title.trim(),
      body,
      status,
      variant,
    });
    setSnapshot(`${title.trim()}\n${body}\n${status}`);
    setNotice("Changes saved in this browser.");
  }

  function regenerate() {
    const nextVariant = variant + 1;
    const generated = generateDraft({
      client: activeClient,
      stage: activeDraft.stage,
      brief: activeDraft.brief,
      topic,
      variant: nextVariant,
    });
    setUndo({ body, variant });
    setBody(generated.body);
    setVariant(nextVariant);
    setNotice("Regenerated from the local template. Save to keep this version.");
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{client.name}</p>
          <h1>Edit draft</h1>
          <p className="lede">
            Changes stay with {client.name}. Other clients keep their own drafts.
          </p>
        </div>
        <Link className="btn btn-secondary" to={`/library?client=${client.id}`}>
          Back to library
        </Link>
      </header>
      <DraftEditor
        clientName={client.name}
        stage={draft.stage}
        format={draft.brief.format}
        topicTitle={draft.topicTitle}
        persona={draft.brief.persona}
        tone={draft.brief.tone}
        goal={draft.brief.goal}
        keywords={draft.brief.keywords}
        cta={draft.brief.cta}
        instructions={draft.brief.instructions}
        title={title}
        body={body}
        status={status}
        onTitle={(value) => {
          setTitle(value);
          setNotice("");
        }}
        onBody={(value) => {
          setBody(value);
          setUndo(null);
          setNotice("");
        }}
        onStatus={setStatus}
        onCopy={() => {
          void copy(`${title}\n\n${body}`).then((ok) => {
            if (!ok) setNotice("Copy failed. Select the draft and copy it manually.");
          });
        }}
        onRegenerate={regenerate}
        onUndo={() => {
          if (!undo) return;
          setBody(undo.body);
          setVariant(undo.variant);
          setUndo(null);
          setNotice("Restored the previous body.");
        }}
        canUndo={undo !== null}
        onSave={save}
        saveLabel={dirty ? "Save changes" : "Saved"}
        copied={copied}
        notice={notice}
      />
    </>
  );
}
