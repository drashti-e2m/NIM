import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDefaultBrief } from "../data/briefs";
import { useDrafts } from "../context/DraftsContext";
import { useClients } from "../context/ClientsContext";
import { generateDraft, suggestTopics } from "../services/generate";
import { readWizard, writeWizard, type WizardSnapshot } from "../services/wizard";
import { usePageTitle } from "../usePageTitle";
import { STAGES, TONES, formatsForStage, stageLabel } from "../labels";
import type { Brief, DraftStatus, Format, Stage, TopicSuggestion } from "../types";
import { DemoBadge, EmptyState } from "../components/ui";
import { DropdownSelect } from "../components/DropdownSelect";
import { DraftEditor, useCopyFeedback } from "../components/DraftEditor";

const steps = [
  { id: "stage", label: "Stage" },
  { id: "brief", label: "Brief" },
  { id: "topics", label: "Topics" },
  { id: "draft", label: "Draft" },
] as const;

type StepId = (typeof steps)[number]["id"];

export function GeneratePage() {
  const { clientId = "" } = useParams();
  const { getClient } = useClients();
  const client = getClient(clientId);
  usePageTitle(client ? `Generate · ${client.name}` : "Generate content");
  const { addDraft, updateDraft } = useDrafts();
  const { copied, copy } = useCopyFeedback();

  const [wizardClient, setWizardClient] = useState(clientId);
  const [step, setStep] = useState<StepId>(() => readWizard(clientId).step);
  const [brief, setBrief] = useState<Brief>(() => readWizard(clientId).brief);
  const [errors, setErrors] = useState<Partial<Record<keyof Brief, string>>>({});
  const [stage, setStage] = useState<Stage | null>(() => readWizard(clientId).stage);
  const [topics, setTopics] = useState<TopicSuggestion[]>(() => readWizard(clientId).topics);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    () => readWizard(clientId).selectedTopicId,
  );
  const [title, setTitle] = useState(() => readWizard(clientId).title);
  const [body, setBody] = useState(() => readWizard(clientId).body);
  const [status, setStatus] = useState<DraftStatus>(() => readWizard(clientId).status);
  const [variant, setVariant] = useState(() => readWizard(clientId).variant);
  const [savedId, setSavedId] = useState<string | null>(() => readWizard(clientId).savedId);
  const [snapshot, setSnapshot] = useState(() => readWizard(clientId).snapshot);
  const [undo, setUndo] = useState<{ body: string; variant: number } | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (clientId === wizardClient) return;
    applyWizard(readWizard(clientId));
    setWizardClient(clientId);
    setErrors({});
    setUndo(null);
    setNotice("");
  }, [clientId, wizardClient]);

  useEffect(() => {
    if (!client || wizardClient !== clientId) return;
    const record: WizardSnapshot = {
      step,
      brief,
      stage,
      topics,
      selectedTopicId,
      title,
      body,
      status,
      variant,
      savedId,
      snapshot,
    };
    writeWizard(clientId, record);
  }, [
    client,
    wizardClient,
    clientId,
    step,
    brief,
    stage,
    topics,
    selectedTopicId,
    title,
    body,
    status,
    variant,
    savedId,
    snapshot,
  ]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  function applyWizard(next: WizardSnapshot) {
    setStep(next.step);
    setBrief(next.brief);
    setStage(next.stage);
    setTopics(next.topics);
    setSelectedTopicId(next.selectedTopicId);
    setTitle(next.title);
    setBody(next.body);
    setStatus(next.status);
    setVariant(next.variant);
    setSavedId(next.savedId);
    setSnapshot(next.snapshot);
  }

  if (!client) {
    return (
      <EmptyState
        title="Client not found"
        body="Choose a client before generating content."
        action={
          <Link className="btn btn-primary" to="/clients">
            Back to Client Hub
          </Link>
        }
      />
    );
  }

  const activeClient = client;
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId) ?? null;
  const dirty = `${title}\n${body}\n${status}` !== snapshot;

  function updateBrief<K extends keyof Brief>(key: K, value: Brief[K]) {
    setBrief((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validateBrief() {
    const next: Partial<Record<keyof Brief, string>> = {};
    if (!brief.persona.trim()) next.persona = "Add a persona.";
    if (!brief.goal.trim()) next.goal = "Add a goal.";
    if (!brief.cta.trim()) next.cta = "Add a call to action.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function startBriefWith(nextStage: Stage, format: Format) {
    setStage(nextStage);
    setBrief((current) => ({ ...current, format }));
    setErrors({});
    setStep("brief");
  }

  const stageFormats = formatsForStage(stage);

  function goToTopics(nextStage: Stage) {
    setStage(nextStage);
    const nextTopics = suggestTopics(activeClient.id, nextStage, brief);
    setTopics(nextTopics);
    if (!nextTopics.some((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId(null);
    }
    setStep("topics");
  }

  function continueFromBrief() {
    if (!validateBrief() || !stage) return;
    goToTopics(stage);
  }

  function goToDraft(topic: TopicSuggestion, nextVariant = 0) {
    if (!stage) return;
    const generated = generateDraft({
      client: activeClient,
      stage,
      brief,
      topic,
      variant: nextVariant,
    });
    setTitle(generated.title);
    setBody(generated.body);
    setVariant(nextVariant);
    setUndo(null);
    setSavedId(null);
    setSnapshot("");
    setNotice("");
    setStep("draft");
  }

  function regenerate() {
    if (!stage || !selectedTopic) return;
    const nextVariant = variant + 1;
    const generated = generateDraft({
      client: activeClient,
      stage,
      brief,
      topic: selectedTopic,
      variant: nextVariant,
    });
    setUndo({ body, variant });
    setBody(generated.body);
    setVariant(nextVariant);
    setNotice("Regenerated from the local template. Save to keep this version.");
  }

  function save() {
    if (!stage || !selectedTopic) return;
    if (!title.trim() || !body.trim()) {
      setNotice("Add a title and body before saving.");
      return;
    }
    const record = {
      title: title.trim(),
      body,
      status,
      variant,
    };
    if (savedId) {
      updateDraft(savedId, record);
      setSnapshot(`${record.title}\n${record.body}\n${record.status}`);
      setNotice("Changes saved in this browser.");
      return;
    }
    const created = addDraft({
      clientId: activeClient.id,
      ...record,
      stage,
      topicId: selectedTopic.id,
      topicTitle: selectedTopic.title,
      topicAngle: selectedTopic.angle,
      brief,
    });
    setSavedId(created.id);
    setSnapshot(`${record.title}\n${record.body}\n${record.status}`);
    setNotice("Draft saved in this browser.");
  }

  function openStep(next: StepId) {
    if (next === "stage") setStep("stage");
    if (next === "brief" && stage) {
      const allowed = formatsForStage(stage);
      if (!allowed.includes(brief.format)) {
        setBrief((current) => ({ ...current, format: allowed[0] }));
      }
      setStep("brief");
    }
    if (next === "topics" && stage && !errorsBlocking()) goToTopics(stage);
    if (next === "draft" && body) setStep("draft");
  }

  function errorsBlocking() {
    return !brief.persona.trim() || !brief.goal.trim() || !brief.cta.trim();
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{client.name}</p>
          <h1>Generate content</h1>
          <p className="lede">
            Use the B2B Marketing Content Kit: choose a buyer-journey stage,
            pick the matching content type, then brief, topics, and draft.
          </p>
        </div>
        <Link className="btn btn-secondary" to={`/clients/${client.id}`}>
          Back to files
        </Link>
      </header>

      <ol className="steps">
        {steps.map((item, index) => {
          const current = item.id === step;
          const stepIndex = steps.findIndex((entry) => entry.id === step);
          const reached =
            item.id === "stage" ||
            (item.id === "brief" && stage !== null) ||
            (item.id === "topics" && stage !== null && !errorsBlocking()) ||
            (item.id === "draft" && body.length > 0);
          const className = [
            "step",
            current ? "current" : "",
            !current && index < stepIndex ? "done" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li key={item.id}>
              <button
                type="button"
                className={className}
                aria-current={current ? "step" : undefined}
                disabled={!reached && !current}
                onClick={() => openStep(item.id)}
              >
                <span>{index + 1}</span>
                {item.label}
              </button>
            </li>
          );
        })}
      </ol>

      {step === "stage" ? (
        <section className="panel">
          <h2>Choose a stage</h2>
          <p className="muted">
            Create the right content to move ideal clients through each phase of
            the buyer journey.
          </p>
          <div className="stage-grid">
            {STAGES.map((item) => {
              const selected = stage === item.id;
              return (
                <div
                  key={item.id}
                  className={selected ? "stage-card selected" : "stage-card"}
                >
                  <button
                    type="button"
                    className="stage-card-main"
                    aria-pressed={selected}
                    onClick={() => setStage(item.id)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                    <span className="stage-focus">{item.contentFocus}</span>
                  </button>
                  {selected ? (
                    <div className="stage-formats">
                      <h3>Type of content</h3>
                      <p className="stage-formats-hint">
                        Choose a type to open the brief form.
                      </p>
                      <ul>
                        {formatsForStage(item.id).map((format) => (
                          <li key={format}>
                            <button
                              type="button"
                              className="stage-format-link"
                              onClick={() => startBriefWith(item.id, format)}
                            >
                              {format}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === "brief" ? (
        <form
          className="panel brief-form"
          onSubmit={(event) => {
            event.preventDefault();
            continueFromBrief();
          }}
        >
          <div className="form-grid">
            <DropdownSelect
              className="field"
              label={`Type of content${stage ? ` · ${stageLabel(stage)}` : ""}`}
              value={
                stageFormats.includes(brief.format)
                  ? brief.format
                  : stageFormats[0]
              }
              options={stageFormats.map((format) => ({
                value: format,
                label: format,
              }))}
              onChange={(next) => updateBrief("format", next as Format)}
            />
            <DropdownSelect
              className="field"
              label="Tone"
              value={brief.tone}
              options={TONES.map((tone) => ({ value: tone, label: tone }))}
              onChange={(next) => updateBrief("tone", next)}
            />
            <label className="field field-wide">
              <span className="field-label">Persona</span>
              <input
                value={brief.persona}
                onChange={(event) => updateBrief("persona", event.target.value)}
              />
              {errors.persona ? <span className="field-error">{errors.persona}</span> : null}
            </label>
            <label className="field field-wide">
              <span className="field-label">Goal</span>
              <input
                value={brief.goal}
                onChange={(event) => updateBrief("goal", event.target.value)}
              />
              {errors.goal ? <span className="field-error">{errors.goal}</span> : null}
            </label>
            <label className="field">
              <span className="field-label">Keywords</span>
              <input
                value={brief.keywords}
                onChange={(event) => updateBrief("keywords", event.target.value)}
                placeholder="Comma-separated"
              />
            </label>
            <label className="field">
              <span className="field-label">Call to action</span>
              <input
                value={brief.cta}
                onChange={(event) => updateBrief("cta", event.target.value)}
              />
              {errors.cta ? <span className="field-error">{errors.cta}</span> : null}
            </label>
            <label className="field field-wide">
              <span className="field-label">Instructions</span>
              <textarea
                rows={4}
                value={brief.instructions}
                onChange={(event) => updateBrief("instructions", event.target.value)}
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setStep("stage")}>
              Back
            </button>
            <div className="form-actions-end">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setBrief(getDefaultBrief(client.id));
                  setErrors({});
                }}
              >
                Reset sample brief
              </button>
              <button type="submit" className="btn btn-primary">
                Show topic suggestions
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {step === "topics" ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Four topic suggestions</h2>
            <DemoBadge>Simulated suggestions</DemoBadge>
          </div>
          <p className="muted">
            {stage ? `${stageLabel(stage)} ideas for ${client.name}. ` : ""}
            The last idea picks up the keywords from your brief.
          </p>
          <div className="topic-grid">
            {topics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                className={selectedTopicId === topic.id ? "topic-card selected" : "topic-card"}
                aria-pressed={selectedTopicId === topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
              >
                <strong>{topic.title}</strong>
                <span>{topic.angle}</span>
              </button>
            ))}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setStep("brief")}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedTopic}
              onClick={() => selectedTopic && goToDraft(selectedTopic)}
            >
              Generate draft
            </button>
          </div>
        </section>
      ) : null}

      {step === "draft" && selectedTopic && stage ? (
        <>
          <DraftEditor
            clientName={client.name}
            stage={stage}
            format={brief.format}
            topicTitle={selectedTopic.title}
            persona={brief.persona}
            tone={brief.tone}
            goal={brief.goal}
            keywords={brief.keywords}
            cta={brief.cta}
            instructions={brief.instructions}
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
            saveLabel={savedId ? (dirty ? "Save changes" : "Saved") : "Save draft"}
            copied={copied}
            notice={notice}
          />
          {savedId ? (
            <p className="after-save">
              <Link to={`/library/${savedId}`}>Open in Content Library</Link>
              <span className="muted">Drafts for other clients stay separate.</span>
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
}
