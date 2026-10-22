import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useClients } from "../context/ClientsContext";
import { useTones } from "../context/TonesContext";
import { useEmailCampaigns } from "../context/EmailCampaignsContext";
import { useBlogs } from "../context/BlogsContext";
import { listClientFiles } from "../services/drive";
import {
  defaultCampaignName,
  generateNurtureSequence,
  generateSingleEmail,
  regenerateNurtureEmail,
  subjectVariants,
} from "../services/emailGenerate";
import { logActivity } from "../services/activityLog";
import { usePageTitle } from "../usePageTitle";
import { DropdownSelect } from "../components/DropdownSelect";
import { DemoBadge, EmptyState } from "../components/ui";
import { useCopyFeedback } from "../components/DraftEditor";
import type { NurtureEmail } from "../types";

type ContentType = "single" | "nurture" | "blog_to_email" | "newsletter";
type PreviewTab = "preview" | "edit" | "variants";

const CONTENT_TYPES: {
  id: ContentType;
  title: string;
  body: string;
}[] = [
  {
    id: "single",
    title: "Single email",
    body: "One email with subject, body and CTA.",
  },
  {
    id: "nurture",
    title: "Email nurture sequence",
    body: "A series of emails (3–5).",
  },
  {
    id: "blog_to_email",
    title: "Blog-to-email",
    body: "Turn an existing blog into an email.",
  },
  {
    id: "newsletter",
    title: "Newsletter",
    body: "Share updates and latest content.",
  },
];

const GOAL_OPTIONS = [
  { value: "educate", label: "Educate and build trust" },
  { value: "nurture", label: "Nurture toward a conversation" },
  { value: "announce", label: "Announce an update" },
  { value: "convert", label: "Drive a specific CTA" },
];

const SOURCE_OPTIONS = [
  { value: "client", label: "Use client context" },
  { value: "nurture-doc", label: "Email nurture Drive doc" },
  { value: "blog", label: "Latest client blog" },
];

export function EmailWizardPage() {
  const { clientId = "" } = useParams();
  const { clients, getClient, setLastClientId } = useClients();
  const { tones, getTone } = useTones();
  const { blogs } = useBlogs();
  const { addCampaign, updateCampaign, campaignsForClient } =
    useEmailCampaigns();
  const { copied, copy } = useCopyFeedback();
  const client = getClient(clientId);

  usePageTitle(client ? `Generate Email · ${client.name}` : "Generate Email");

  useEffect(() => {
    if (clientId) setLastClientId(clientId);
  }, [clientId, setLastClientId]);

  const [formClientId, setFormClientId] = useState("");
  const [contentType, setContentType] = useState<ContentType | "">("");
  const [contentSource, setContentSource] = useState("");
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [toneId, setToneId] = useState("");
  const [cta, setCta] = useState("");
  const [instructions, setInstructions] = useState("");
  const [emailCount, setEmailCount] = useState("");
  const [cadenceDays, setCadenceDays] = useState("");
  const [emails, setEmails] = useState<NurtureEmail[]>([]);
  const [activeEmailId, setActiveEmailId] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("preview");
  const [variants, setVariants] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");

  const activeClient = getClient(formClientId);
  const tone = getTone(toneId) ?? null;
  const activeEmail =
    emails.find((email) => email.id === activeEmailId) ?? emails[0] ?? null;

  const nurtureDoc = useMemo(() => {
    if (!activeClient) return undefined;
    return listClientFiles(activeClient.id).find((file) =>
      /email.*nurture|nurture.*email/i.test(file.name),
    );
  }, [activeClient]);

  const latestBlog = useMemo(() => {
    if (!activeClient) return undefined;
    return blogs
      .filter((blog) => blog.clientId === activeClient.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }, [blogs, activeClient]);

  useEffect(() => {
    // Prefill Client when opened from the client hub; leave other fields empty.
    setFormClientId(clientId);
    setContentType("");
    setContentSource("");
    setGoal("");
    setAudience("");
    setToneId("");
    setCta("");
    setInstructions("");
    setEmailCount("");
    setCadenceDays("");
    setEmails([]);
    setActiveEmailId(null);
    setCampaignId(null);
    setVariants([]);
    setNotice("");
    setPreviewTab("preview");
  }, [clientId]);

  if (!clients.length) {
    return (
      <EmptyState
        title="No clients yet"
        body="Add a client in the hub, then open Generate Email."
        action={
          <Link className="btn btn-primary" to="/clients">
            Client Hub
          </Link>
        }
      />
    );
  }

  const audienceLabel = audience.trim();
  const goalLabel =
    GOAL_OPTIONS.find((item) => item.value === goal)?.label ?? "";
  const charCount = activeEmail?.body.length ?? 0;
  const savedCount = activeClient
    ? campaignsForClient(activeClient.id).length
    : 0;

  function programNotes(): string | undefined {
    if (!activeClient) return undefined;
    if (contentSource === "nurture-doc") return nurtureDoc?.body;
    if (contentSource === "blog" && latestBlog) {
      return `${latestBlog.title}\n${latestBlog.body.slice(0, 400)}`;
    }
    if (contentSource === "client") return activeClient.summary;
    return undefined;
  }

  function validateForm(): string | null {
    if (!activeClient) return "Select a client.";
    if (!contentType) return "Select an email type.";
    if (!contentSource) return "Select a content source.";
    if (!goal) return "Select a primary goal.";
    if (!audience.trim()) return "Enter a target audience.";
    if (!toneId) return "Select a tone of voice.";
    if (!cta.trim()) return "Enter a call to action.";
    if (contentType === "nurture") {
      const count = Number(emailCount);
      if (!emailCount || count < 3 || count > 5) {
        return "Enter 3–5 emails for the nurture sequence.";
      }
      if (!cadenceDays || Number(cadenceDays) < 1) {
        return "Enter days between emails.";
      }
    }
    return null;
  }

  function runGenerate() {
    const error = validateForm();
    if (error || !activeClient || !contentType) {
      setNotice(error ?? "Complete the form before generating.");
      return;
    }
    const count = Number(emailCount) || 4;
    const cadence = Number(cadenceDays) || 3;
    const resolvedAudience = audienceLabel || "Prospects";
    const resolvedGoal = goalLabel || "Educate and build trust";
    setGenerating(true);
    setNotice("");
    window.setTimeout(() => {
      if (contentType === "nurture") {
        const next = generateNurtureSequence({
          client: activeClient,
          tone,
          brief: {
            name: defaultCampaignName(activeClient, resolvedGoal),
            objective: resolvedGoal,
            audience: resolvedAudience,
            emailCount: count,
            cadenceDays: cadence,
            timingNote: `Every ${cadence} days`,
          },
          programNotes: programNotes(),
        });
        setEmails(next);
        setActiveEmailId(next[0]?.id ?? null);
        setVariants(
          subjectVariants(
            activeClient,
            resolvedAudience,
            next[0]?.subject ?? "",
          ),
        );
      } else {
        const one = generateSingleEmail({
          client: activeClient,
          tone,
          brief: {
            goal: resolvedGoal,
            audience: resolvedAudience,
            cta,
            instructions,
            contentType:
              contentType === "blog_to_email"
                ? "blog_to_email"
                : contentType === "newsletter"
                  ? "newsletter"
                  : "single",
          },
          programNotes: programNotes(),
        });
        setEmails([one]);
        setActiveEmailId(one.id);
        setVariants(
          subjectVariants(activeClient, resolvedAudience, one.subject),
        );
      }
      setPreviewTab("preview");
      setGenerating(false);
      setNotice("Generated. Review on the right - nothing is sent.");
    }, 260);
  }

  function patchActive(patch: Partial<NurtureEmail>) {
    if (!activeEmail) return;
    setEmails((current) =>
      current.map((email) =>
        email.id === activeEmail.id ? { ...email, ...patch } : email,
      ),
    );
  }

  function regenerateActive() {
    if (!activeEmail || !activeClient) {
      runGenerate();
      return;
    }
    if (contentType === "nurture") {
      const cadence = Number(cadenceDays) || 3;
      const resolvedAudience = audienceLabel || "Prospects";
      const resolvedGoal = goalLabel || "Educate and build trust";
      const next = regenerateNurtureEmail(
        {
          client: activeClient,
          tone,
          brief: {
            name: defaultCampaignName(activeClient, resolvedGoal),
            objective: resolvedGoal,
            audience: resolvedAudience,
            emailCount: emails.length,
            cadenceDays: cadence,
            timingNote: `Every ${cadence} days`,
          },
          programNotes: programNotes(),
        },
        activeEmail,
        emails.length,
      );
      setEmails((current) =>
        current.map((email) => (email.id === activeEmail.id ? next : email)),
      );
      setActiveEmailId(next.id);
      setNotice(`Email ${activeEmail.order} regenerated.`);
      return;
    }
    runGenerate();
  }

  function persist(status: "draft" | "review" | "approved" = "draft") {
    if (!emails.length || !activeEmail || !activeClient) {
      setNotice("Generate an email before saving.");
      return;
    }
    const resolvedAudience = audienceLabel || "Prospects";
    const resolvedGoal = goalLabel || "Educate and build trust";
    const cadence = Number(cadenceDays) || 3;
    const name =
      contentType === "nurture"
        ? defaultCampaignName(activeClient, resolvedGoal)
        : activeEmail.subject.slice(0, 72);
    const payload = {
      clientId: activeClient.id,
      name,
      objective: resolvedGoal,
      audience: resolvedAudience,
      emailCount: emails.length,
      timingNote:
        contentType === "nurture"
          ? `Every ${cadence} days`
          : "Single send (not connected)",
      cadenceDays: contentType === "nurture" ? cadence : 0,
      toneId: tone?.id,
      emails,
      status,
    };
    if (campaignId) {
      updateCampaign(campaignId, payload);
      setNotice(`Updated “${name}” as ${status}.`);
    } else {
      const created = addCampaign(payload);
      setCampaignId(created.id);
      setNotice(`Saved “${name}” under ${activeClient.name}.`);
    }
    logActivity({
      clientId: activeClient.id,
      kind: "email",
      action: status === "draft" ? "Saved email draft" : "Saved email campaign",
      title: name,
      detail: `${emails.length} email(s) · ${contentType}`,
    });
  }

  return (
    <div className="email-workspace">
      <section className="email-panel email-panel-config" aria-label="Email setup">
        <header className="email-panel-head">
          <p className="email-eyebrow">Content</p>
          <h1>Generate Email</h1>
        </header>

        <div className="email-form-scroll">
          <DropdownSelect
            className="field email-field"
            label="Client"
            value={formClientId}
            placeholder="Select client…"
            options={clients.map((item) => ({
              value: item.id,
              label: `${item.name} · ${item.website}`,
            }))}
            onChange={setFormClientId}
          />

          <div
            className="email-type-grid"
            role="radiogroup"
            aria-label="Email type"
          >
            {CONTENT_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                role="radio"
                aria-checked={contentType === type.id}
                className={
                  contentType === type.id
                    ? "email-type-card active"
                    : "email-type-card"
                }
                onClick={() => setContentType(type.id)}
              >
                <strong>{type.title}</strong>
                <span>{type.body}</span>
              </button>
            ))}
          </div>

          <DropdownSelect
            className="field email-field"
            label="Content source"
            value={contentSource}
            placeholder="Select content source…"
            options={SOURCE_OPTIONS}
            onChange={setContentSource}
          />
          <DropdownSelect
            className="field email-field"
            label="Primary goal"
            value={goal}
            placeholder="Select primary goal…"
            options={GOAL_OPTIONS}
            onChange={setGoal}
          />
          <DropdownSelect
            className="field email-field"
            label="Tone of voice"
            value={toneId}
            placeholder="Select tone of voice…"
            options={tones.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            onChange={setToneId}
          />

          <div className="email-nurture-row">
            <label className="field email-field">
              <span className="field-label">Target audience</span>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. Prospects"
              />
            </label>
            <label className="field email-field">
              <span className="field-label">Call to action</span>
              <input
                type="text"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="e.g. Book a call"
              />
            </label>
          </div>

          {contentType === "nurture" ? (
            <div className="email-nurture-row">
              <label className="field email-field">
                <span className="field-label">Emails in sequence</span>
                <input
                  type="number"
                  min={3}
                  max={5}
                  value={emailCount}
                  placeholder="e.g. 4"
                  onChange={(e) => setEmailCount(e.target.value)}
                />
              </label>
              <label className="field email-field">
                <span className="field-label">Days between</span>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={cadenceDays}
                  placeholder="e.g. 3"
                  onChange={(e) => setCadenceDays(e.target.value)}
                />
              </label>
            </div>
          ) : null}

          <label className="field email-field email-field-instructions">
            <span className="field-label">
              Additional instructions
              <em>{instructions.length}/500</em>
            </span>
            <textarea
              maxLength={500}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Optional AI guidance…"
            />
          </label>

          {notice ? <p className="email-inline-notice">{notice}</p> : null}
        </div>

        <div className="email-generate-block">
          <button
            type="button"
            className="btn btn-primary email-generate-btn"
            disabled={generating}
            onClick={runGenerate}
          >
            {generating ? "Generating…" : "Generate Email"}
          </button>
          <p className="email-helper">
            Draft only - review before saving
            {savedCount > 0 && activeClient
              ? ` · ${savedCount} saved for ${activeClient.name}`
              : ""}
            .
          </p>
        </div>
      </section>

      <section
        className="email-panel email-panel-preview"
        aria-label="Email preview"
      >
        <div className="email-preview-tabs">
          {(
            [
              ["preview", "Preview"],
              ["edit", "Edit"],
              ["variants", "Variants"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={previewTab === id ? "email-tab active" : "email-tab"}
              onClick={() => setPreviewTab(id)}
            >
              {label}
            </button>
          ))}
          <DemoBadge>Simulated data</DemoBadge>
        </div>

        <div className="email-preview-scroll">
          {!activeEmail ? (
            <div className="email-preview-empty">
              <span className="email-empty-icon" aria-hidden>
                ✉
              </span>
              <p className="email-empty-title">
                Your email preview will appear here
              </p>
              <p className="email-helper">
                Configure the brief, then generate. Nothing is sent from this
                screen.
              </p>
            </div>
          ) : (
            <>
              {contentType === "nurture" && emails.length > 1 ? (
                <div
                  className="email-seq-pills"
                  role="tablist"
                  aria-label="Sequence"
                >
                  {emails.map((email) => (
                    <button
                      key={email.id}
                      type="button"
                      role="tab"
                      aria-selected={email.id === activeEmail.id}
                      className={
                        email.id === activeEmail.id
                          ? "email-seq-pill active"
                          : "email-seq-pill"
                      }
                      onClick={() => setActiveEmailId(email.id)}
                    >
                      Email {email.order}
                      <span>Day {email.sendDayOffset}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {previewTab === "variants" ? (
                <div className="email-variants-panel">
                  <h2>Subject variants</h2>
                  <ul>
                    {(variants.length
                      ? variants
                      : activeClient
                        ? subjectVariants(
                            activeClient,
                            audienceLabel,
                            activeEmail.subject,
                          )
                        : []
                    ).map((variant) => (
                      <li key={variant}>
                        <button
                          type="button"
                          className="email-variant-btn"
                          onClick={() => {
                            patchActive({
                              subject: variant,
                              previewText: `${variant} - open for the short version.`,
                            });
                            setPreviewTab("edit");
                            setNotice("Subject applied.");
                          }}
                        >
                          {variant}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="email-preview-fields">
                  <label className="field email-field">
                    <span className="field-label">
                      Subject line
                      <span className="email-field-tools">
                        <button
                          type="button"
                          className="btn-text"
                          onClick={() => void copy(activeEmail.subject)}
                        >
                          {copied ? "Copied" : "Copy"}
                        </button>
                        <button
                          type="button"
                          className="btn-text"
                          onClick={() => {
                            if (!activeClient) return;
                            setVariants(
                              subjectVariants(
                                activeClient,
                                audienceLabel,
                                activeEmail.subject,
                              ),
                            );
                            setPreviewTab("variants");
                          }}
                        >
                          Generate variants
                        </button>
                      </span>
                    </span>
                    <input
                      value={activeEmail.subject}
                      readOnly={previewTab === "preview"}
                      onChange={(e) =>
                        patchActive({ subject: e.target.value })
                      }
                    />
                  </label>

                  <label className="field email-field">
                    <span className="field-label">Preview text</span>
                    <input
                      value={activeEmail.previewText}
                      readOnly={previewTab === "preview"}
                      onChange={(e) =>
                        patchActive({ previewText: e.target.value })
                      }
                    />
                  </label>

                  <div className="email-body-block">
                    <div className="field-label">
                      Email body
                      <em>{charCount} characters</em>
                    </div>
                    {previewTab === "preview" ? (
                      <div className="email-body-preview">
                        {activeEmail.body.split("\n").map((line, index) =>
                          line.trim() ? (
                            <p key={`${index}-${line.slice(0, 12)}`}>
                              {line}
                            </p>
                          ) : (
                            <br key={`br-${index}`} />
                          ),
                        )}
                        <button type="button" className="email-cta-chip">
                          {activeEmail.cta}
                        </button>
                      </div>
                    ) : (
                      <textarea
                        className="email-body-input"
                        value={activeEmail.body}
                        onChange={(e) =>
                          patchActive({ body: e.target.value })
                        }
                      />
                    )}
                  </div>

                  {previewTab === "edit" ? (
                    <label className="field email-field">
                      <span className="field-label">CTA</span>
                      <input
                        value={activeEmail.cta}
                        onChange={(e) =>
                          patchActive({ cta: e.target.value })
                        }
                      />
                    </label>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>

        {activeEmail ? (
          <div className="email-preview-footer">
            <aside className="email-demo-note">
              Simulated demo email. Connect HubSpot or Mailchimp later to send
              or schedule - generating never sends.
            </aside>
            <div className="email-preview-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => persist("draft")}
              >
                Save draft
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  void copy(
                    `${activeEmail.subject}\n\n${activeEmail.body}\n\nCTA: ${activeEmail.cta}`,
                  )
                }
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={generating}
                onClick={regenerateActive}
              >
                Regenerate
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => persist("review")}
              >
                Save &amp; Continue
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
