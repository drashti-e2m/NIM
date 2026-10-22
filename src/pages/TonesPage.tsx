import { useEffect, useMemo, useState } from "react";
import { useTones } from "../context/TonesContext";
import { usePageTitle } from "../usePageTitle";
import { SearchField } from "../components/ui";
import type { ToneOfVoice } from "../types";

type ToneDraft = Omit<ToneOfVoice, "id">;

const ICON_GLYPH: Record<NonNullable<ToneOfVoice["icon"]>, string> = {
  hearts: "♥",
  diamonds: "◆",
  bolt: "⚡",
  compass: "◎",
  spark: "✦",
  target: "◉",
};

function toneIcon(tone: Pick<ToneOfVoice, "icon">): string {
  return ICON_GLYPH[tone.icon ?? "spark"] ?? "✦";
}

function toDraft(tone: ToneOfVoice): ToneDraft {
  return {
    name: tone.name,
    summary: tone.summary,
    traits: [...tone.traits],
    sample: tone.sample,
    status: tone.status ?? "draft",
    clientLabel: tone.clientLabel ?? "Custom",
    icon: tone.icon ?? "spark",
    writingRules: [...(tone.writingRules ?? [])],
    preferredPhrases: [...(tone.preferredPhrases ?? [])],
    avoidedPhrases: [...(tone.avoidedPhrases ?? [])],
    sampleCopy: tone.sampleCopy ?? tone.sample,
    bestFor: tone.bestFor ?? "",
  };
}

export function TonesPage() {
  usePageTitle("Voice & Tone");
  const { tones, updateTone, addTone, deleteTone } = useTones();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ToneDraft | null>(null);
  const [metaOpen, setMetaOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [preferredDraft, setPreferredDraft] = useState("");
  const [avoidedDraft, setAvoidedDraft] = useState("");
  const [ruleDraft, setRuleDraft] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tones;
    return tones.filter((tone) => {
      const haystack = [
        tone.name,
        tone.summary,
        tone.sample,
        ...(tone.traits ?? []),
        tone.clientLabel ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [tones, query]);

  const selected = selectedId
    ? tones.find((tone) => tone.id === selectedId)
    : undefined;

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft(toDraft(selected));
    setMetaOpen(false);
    setPreferredDraft("");
    setAvoidedDraft("");
    setRuleDraft("");
  }, [
    selected?.id,
    selected?.name,
    selected?.summary,
    selected?.sample,
    selected?.sampleCopy,
    selected?.bestFor,
    selected?.clientLabel,
    selected?.traits?.join("|"),
    selected?.writingRules?.join("|"),
    selected?.preferredPhrases?.join("|"),
    selected?.avoidedPhrases?.join("|"),
  ]);

  function selectTone(id: string) {
    setSelectedId(id);
    setNotice("");
    const tone = tones.find((item) => item.id === id);
    if (tone) setDraft(toDraft(tone));
  }

  function closeDetail() {
    setSelectedId(null);
    setDraft(null);
    setMetaOpen(false);
  }

  function startCreate() {
    const tone = addTone({
      name: "New tone",
      summary: "Describe how this voice should sound for client content.",
      traits: ["Clear", "Specific"],
      sample: "Write one sentence that sounds like this voice.",
      status: "draft",
      clientLabel: "Custom",
      icon: "spark",
      writingRules: [
        "Stay consistent with the tone traits",
        "Prefer concrete language over vague claims",
      ],
      preferredPhrases: ["Here's how…", "The point is…"],
      avoidedPhrases: ["Obviously", "Basically"],
      sampleCopy: "Write a short paragraph that demonstrates this voice.",
      bestFor: "General blog and email content for this brand voice.",
    });
    setSelectedId(tone.id);
    setNotice("New tone created — details opened so you can edit and save.");
  }

  function saveDraft() {
    if (!selected || !draft) return;
    if (!draft.name.trim()) {
      setNotice("Tone name is required.");
      return;
    }
    const patch = {
      name: draft.name.trim(),
      summary: draft.summary.trim(),
      traits: draft.traits.map((trait) => trait.trim()).filter(Boolean),
      sample: draft.sample.trim(),
      status: draft.status,
      clientLabel: draft.clientLabel?.trim() || "Custom",
      icon: draft.icon,
      writingRules: (draft.writingRules ?? [])
        .map((rule) => rule.trim())
        .filter(Boolean),
      preferredPhrases: (draft.preferredPhrases ?? [])
        .map((phrase) => phrase.trim())
        .filter(Boolean),
      avoidedPhrases: (draft.avoidedPhrases ?? [])
        .map((phrase) => phrase.trim())
        .filter(Boolean),
      sampleCopy: draft.sampleCopy?.trim() || draft.sample.trim(),
      bestFor: draft.bestFor?.trim() || "",
    };
    updateTone(selected.id, patch);
    setMetaOpen(false);
    setNotice("Tone saved.");
    closeDetail();
  }

  function removeSelected() {
    if (!selected) return;
    if (tones.length <= 1) {
      setNotice("Keep at least one tone profile.");
      return;
    }
    if (!window.confirm(`Delete tone “${selected.name}”?`)) return;
    const id = selected.id;
    deleteTone(id);
    closeDetail();
    setNotice(`Deleted “${selected.name}”.`);
  }

  function addPhrase(
    field: "preferredPhrases" | "avoidedPhrases",
    value: string,
    clear: () => void,
  ) {
    if (!draft) return;
    const next = value.trim();
    if (!next) return;
    const current = draft[field] ?? [];
    if (current.some((item) => item.toLowerCase() === next.toLowerCase())) {
      clear();
      return;
    }
    setDraft({ ...draft, [field]: [...current, next] });
    clear();
  }

  function removePhrase(
    field: "preferredPhrases" | "avoidedPhrases",
    phrase: string,
  ) {
    if (!draft) return;
    setDraft({
      ...draft,
      [field]: (draft[field] ?? []).filter((item) => item !== phrase),
    });
  }

  function addRule() {
    if (!draft) return;
    const next = ruleDraft.trim();
    if (!next) return;
    setDraft({
      ...draft,
      writingRules: [...(draft.writingRules ?? []), next],
    });
    setRuleDraft("");
  }

  return (
    <div className="voice-tone-page">
      <header className="voice-tone-hero">
        <div className="voice-tone-hero-copy">
          <p className="eyebrow">Brand system</p>
          <h1>Voice &amp; Tone</h1>
          <aside className="voice-tone-tip" aria-label="Tip">
            <span className="voice-tone-tip-icon" aria-hidden>
              ✦
            </span>
            <p>
              The right tone builds trust. Choose a voice that matches your
              audience, brand and goal — and make every word count.
            </p>
          </aside>
        </div>
        <div className="voice-tone-hero-actions">
          <button type="button" className="btn btn-primary" onClick={startCreate}>
            + Create tone
          </button>
        </div>
      </header>

      {notice ? <p className="drive-upload-msg">{notice}</p> : null}

      <div className="voice-tone-section-label">Tone Library</div>

      <div className={`voice-tone-layout${selected ? " has-detail" : ""}`}>
        <div className="voice-tone-main">
          <div className="voice-tone-toolbar">
            <SearchField
              label="Search tones"
              value={query}
              onChange={setQuery}
              placeholder="Search tones..."
            />
          </div>

          {filtered.length === 0 ? (
            <p className="muted voice-tone-empty">
              No tones match. Clear search or create a new tone.
            </p>
          ) : (
            <ul className="voice-tone-grid">
              {filtered.map((tone) => {
                const active = selected?.id === tone.id;
                return (
                  <li key={tone.id}>
                    <article
                      className={
                        active ? "voice-tone-card is-selected" : "voice-tone-card"
                      }
                      role="button"
                      tabIndex={0}
                      onClick={() => selectTone(tone.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectTone(tone.id);
                        }
                      }}
                    >
                      <header className="voice-tone-card-head">
                        <span
                          className={`voice-tone-avatar icon-${tone.icon ?? "spark"}`}
                          aria-hidden
                        >
                          {toneIcon(tone)}
                        </span>
                        <h2>{tone.name}</h2>
                      </header>
                      <ul
                        className={`voice-tone-tags icon-${tone.icon ?? "spark"}`}
                      >
                        {tone.traits.map((trait) => (
                          <li key={trait}>{trait}</li>
                        ))}
                      </ul>
                      <p className="voice-tone-card-scope">
                        {tone.clientLabel || "Custom"}
                      </p>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected && draft ? (
          <aside className="voice-tone-detail" aria-label="Tone details">
            <header className="voice-tone-detail-head">
              <span
                className={`voice-tone-avatar icon-${draft.icon ?? "spark"}`}
                aria-hidden
              >
                {toneIcon(draft)}
              </span>
              <div>
                <div className="voice-tone-card-title">
                  <h2>{draft.name}</h2>
                </div>
                <p className="muted">{draft.clientLabel || "Custom"}</p>
              </div>
              <button
                type="button"
                className="voice-tone-detail-close"
                aria-label="Close details"
                onClick={closeDetail}
              >
                ×
              </button>
            </header>

            <button
              type="button"
              className="voice-tone-meta-toggle"
              aria-expanded={metaOpen}
              onClick={() => setMetaOpen((open) => !open)}
            >
              {metaOpen ? "Hide name & summary" : "Edit name & summary"}
            </button>

            {metaOpen ? (
              <div className="voice-tone-meta-fields">
                <label className="field">
                  <span className="field-label">Name</span>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field-label">Category label</span>
                  <input
                    value={draft.clientLabel ?? ""}
                    onChange={(event) =>
                      setDraft({ ...draft, clientLabel: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field-label">Summary</span>
                  <textarea
                    rows={3}
                    value={draft.summary}
                    onChange={(event) =>
                      setDraft({ ...draft, summary: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field-label">Traits (comma-separated)</span>
                  <input
                    value={draft.traits.join(", ")}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        traits: event.target.value
                          .split(",")
                          .map((part) => part.trim()),
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field-label">Sample line (card quote)</span>
                  <textarea
                    rows={2}
                    value={draft.sample}
                    onChange={(event) =>
                      setDraft({ ...draft, sample: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field-label">Best for</span>
                  <textarea
                    rows={2}
                    value={draft.bestFor ?? ""}
                    placeholder="When should a writer pick this tone?"
                    onChange={(event) =>
                      setDraft({ ...draft, bestFor: event.target.value })
                    }
                  />
                </label>
              </div>
            ) : null}

            {draft.bestFor?.trim() ? (
              <section className="voice-tone-detail-section">
                <h3>Best for</h3>
                <p className="voice-tone-best-for-detail">{draft.bestFor}</p>
              </section>
            ) : null}

            <section className="voice-tone-detail-section">
              <h3>Writing rules</h3>
              <ul className="voice-tone-rules">
                {(draft.writingRules ?? []).map((rule, index) => (
                  <li key={`rule-${index}`}>
                    <span className="voice-tone-rule-icon" aria-hidden>
                      ✓
                    </span>
                    <span className="voice-tone-rule-text">{rule}</span>
                  </li>
                ))}
              </ul>
              <div className="voice-tone-add-row">
                <input
                  value={ruleDraft}
                  placeholder="Add a writing rule…"
                  onChange={(event) => setRuleDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addRule();
                    }
                  }}
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={addRule}>
                  Add
                </button>
              </div>
            </section>

            <section className="voice-tone-detail-section">
              <h3>Preferred phrases</h3>
              <ul className="voice-tone-phrase-cloud preferred is-editable">
                {(draft.preferredPhrases ?? []).map((phrase) => (
                  <li key={phrase}>
                    <span>{phrase}</span>
                    <button
                      type="button"
                      className="voice-tone-chip-remove"
                      aria-label={`Remove ${phrase}`}
                      onClick={() => removePhrase("preferredPhrases", phrase)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className="voice-tone-add-row">
                <input
                  value={preferredDraft}
                  placeholder="Add preferred phrase…"
                  onChange={(event) => setPreferredDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addPhrase("preferredPhrases", preferredDraft, () =>
                        setPreferredDraft(""),
                      );
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    addPhrase("preferredPhrases", preferredDraft, () =>
                      setPreferredDraft(""),
                    )
                  }
                >
                  Add
                </button>
              </div>
            </section>

            <section className="voice-tone-detail-section">
              <h3>Avoided phrases</h3>
              <ul className="voice-tone-phrase-cloud avoided is-editable">
                {(draft.avoidedPhrases ?? []).map((phrase) => (
                  <li key={phrase}>
                    <span>{phrase}</span>
                    <button
                      type="button"
                      className="voice-tone-chip-remove"
                      aria-label={`Remove ${phrase}`}
                      onClick={() => removePhrase("avoidedPhrases", phrase)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className="voice-tone-add-row">
                <input
                  value={avoidedDraft}
                  placeholder="Add phrase to avoid…"
                  onChange={(event) => setAvoidedDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addPhrase("avoidedPhrases", avoidedDraft, () =>
                        setAvoidedDraft(""),
                      );
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    addPhrase("avoidedPhrases", avoidedDraft, () =>
                      setAvoidedDraft(""),
                    )
                  }
                >
                  Add
                </button>
              </div>
            </section>

            <section className="voice-tone-detail-section">
              <h3>Sample copy</h3>
              <textarea
                className="voice-tone-sample-input"
                rows={5}
                value={draft.sampleCopy ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, sampleCopy: event.target.value })
                }
              />
            </section>

            <div className="voice-tone-detail-actions">
              <button type="button" className="btn btn-primary" onClick={saveDraft}>
                Save tone
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={removeSelected}
                disabled={tones.length <= 1}
              >
                Delete
              </button>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
