import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useClients } from "../context/ClientsContext";
import { useBlogs } from "../context/BlogsContext";
import { useTones } from "../context/TonesContext";
import {
  approveOutline,
  autoTopicFor,
  buildResearch,
  buildStructuredOutline,
  defaultQualityChecks,
  buildDraftClosing,
  buildDraftLede,
  generateDraftFromOutline,
  outlineToPlainText,
  sectionsToBody,
  suggestKeywords,
  suggestSeo,
} from "../services/blogGenerate";
import { getDriveItem, listClientFiles } from "../services/drive";
import { usePageTitle } from "../usePageTitle";
import type { ApprovedOutline, OutlineSectionSpec, TopicMode } from "../types";
import { DemoBadge, EmptyState, FileGlyph } from "../components/ui";
import { DropdownSelect } from "../components/DropdownSelect";
import { ArticleOutlineDraftView } from "../components/ArticleOutlineDraftView";
import {
  ArticleDraftView,
  type ArticleDraftHandle,
} from "../components/ArticleDraftView";
import { BlogCoverImagePicker } from "../components/BlogCoverImagePicker";
import {
  findReusableCalendarStub,
  todayPinDateIso,
} from "../services/blogCalendarSync";
import {
  resumeStepForBlog,
  type WizardStepId,
} from "../services/activityResume";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const steps = [
  { id: "topic", label: "Topic" },
  { id: "keywords", label: "Keywords" },
  { id: "research", label: "Research" },
  { id: "outline", label: "Outline" },
  { id: "blog", label: "Draft" },
] as const;

type StepId = (typeof steps)[number]["id"];

const CONTENT_OBJECTIVES = [
  { value: "awareness", label: "Build awareness" },
  { value: "consideration", label: "Support consideration" },
  { value: "decision", label: "Drive a decision / CTA" },
  { value: "thought-leadership", label: "Thought leadership" },
  { value: "seo-demand", label: "Capture search demand" },
] as const;

const MAX_REFERENCE_URLS = 4;

type TopicSuggestion = {
  id: string;
  title: string;
  why: string;
};

type KeywordIntent = "Informational" | "Commercial" | "Transactional";

type KeywordIdea = {
  id: string;
  phrase: string;
  volume: string;
  difficulty: string;
  intent: KeywordIntent;
};

type ResearchSourceKind = "client" | "external" | "seo";

type ResearchSource = {
  link: string;
  kind: ResearchSourceKind;
  snippet?: string;
};

type ResearchPack = {
  gaps: string[];
  opportunities: string[];
  /** Kept in notes pack; shown via Full research notes */
  clientExtract: string[];
  competitorExtract: string[];
  findings: string[];
  sources: ResearchSource[];
};

type ResearchListKey = "findings" | "gaps" | "opportunities";

function normalizeReferenceUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function BlogWizardPage() {
  const { clientId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getClient, setLastClientId, updateClient } = useClients();
  const client = getClient(clientId);
  usePageTitle(client ? `Generate Blog · ${client.name}` : "Generate Blog");
  const {
    addBlog,
    updateBlog,
    approveOutlineForArticle,
    getBlog,
    blogsForClient,
  } = useBlogs();
  const { tones, getTone } = useTones();
  const draftRef = useRef<ArticleDraftHandle>(null);

  const [step, setStep] = useState<StepId>("topic");
  /** describe = I have an idea; auto = Discover a topic */
  const [mode, setMode] = useState<TopicMode>("describe");
  const [toneId, setToneId] = useState("");
  const [targetWords, setTargetWords] = useState("1200");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [ideaNotes, setIdeaNotes] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [objective, setObjective] = useState("");
  const [language, setLanguage] = useState("");
  const [contextFileIds, setContextFileIds] = useState<string[]>([]);
  const [briefFileId, setBriefFileId] = useState("");
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [urlDraft, setUrlDraft] = useState("");
  const [topicSuggestions, setTopicSuggestions] = useState<TopicSuggestion[]>([]);
  const [suggestingTopics, setSuggestingTopics] = useState(false);
  const [pickedSuggestionId, setPickedSuggestionId] = useState<string | null>(null);
  const [primaryKeyword, setPrimaryKeyword] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>([]);
  const [secondaryDraft, setSecondaryDraft] = useState("");
  const [hasOwnKeywords, setHasOwnKeywords] = useState(false);
  const [keywordIdeas, setKeywordIdeas] = useState<KeywordIdea[]>([]);
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<string[]>([]);
  const [intentFilter, setIntentFilter] = useState<"All" | KeywordIntent>("All");
  const [suggestingKeywords, setSuggestingKeywords] = useState(false);
  const [research, setResearch] = useState("");
  const [researchPack, setResearchPack] = useState<ResearchPack | null>(null);
  const [, setResearchApproved] = useState(false);
  const [sourceDraft, setSourceDraft] = useState("");
  const [editingItem, setEditingItem] = useState<{
    key: ResearchListKey;
    index: number;
  } | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [addingKey, setAddingKey] = useState<ResearchListKey | null>(null);
  const [addDraft, setAddDraft] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [researching, setResearching] = useState(false);
  const [contextOpen, setContextOpen] = useState<Record<string, boolean>>({
    brand: true,
    audience: false,
    blogs: false,
  });
  const [structuredOutline, setStructuredOutline] = useState<ApprovedOutline | null>(
    null,
  );
  const [outlineApproved, setOutlineApproved] = useState(false);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [dirtyWarn, setDirtyWarn] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [generating, setGenerating] = useState(false);

  const tone =
    getTone(toneId) ??
    (toneId.trim()
      ? {
          id: toneId,
          name: toneId,
          summary: "Custom tone for this article.",
          traits: [] as string[],
          sample: "",
        }
      : undefined);
  const words = Math.max(200, Number(targetWords) || 800);
  const clientFiles = useMemo(
    () => (clientId ? listClientFiles(clientId) : []),
    [clientId],
  );
  const researchUsedFiles = useMemo(() => {
    const selected = contextFileIds
      .map((id) => getDriveItem(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (selected.length > 0) return selected.slice(0, 5);
    return clientFiles.slice(0, 3);
  }, [contextFileIds, clientFiles]);
  const briefFiles = useMemo(
    () =>
      clientFiles.filter((file) => {
        const name = file.name.toLowerCase();
        return (
          name.includes("brief") ||
          name.includes("guideline") ||
          name.includes("brand") ||
          name.includes("playbook") ||
          name.includes("presentation") ||
          file.kind === "doc" ||
          file.kind === "pdf"
        );
      }),
    [clientFiles],
  );
  const keywords = useMemo(
    () =>
      [primaryKeyword.trim(), ...secondaryKeywords.map((item) => item.trim())].filter(
        Boolean,
      ),
    [primaryKeyword, secondaryKeywords],
  );

  const filteredKeywordIdeas = useMemo(
    () =>
      intentFilter === "All"
        ? keywordIdeas
        : keywordIdeas.filter((idea) => idea.intent === intentFilter),
    [intentFilter, keywordIdeas],
  );

  useEffect(() => {
    if (clientId) setLastClientId(clientId);
  }, [clientId, setLastClientId]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  useEffect(() => {
    const resumeId = searchParams.get("article");
    const resumeStep = searchParams.get("step") as WizardStepId | null;
    if (!resumeId || !clientId) return;
    const existing = getBlog(resumeId);
    if (!existing || existing.clientId !== clientId) return;

    setArticleId(existing.id);
    setTopic(existing.topic || existing.title);
    setAudience(existing.targetAudience || audience);
    setIdeaNotes(existing.ideaNotes || "");
    setPrimaryKeyword(existing.primaryKeyword || "");
    setSecondaryKeywords(existing.secondaryKeywords || []);
    setResearch(existing.research || "");
    if (existing.toneId) setToneId(existing.toneId);
    if (existing.targetWords) setTargetWords(String(existing.targetWords));
    if (existing.approvedOutline) {
      setStructuredOutline(existing.approvedOutline);
      setOutlineApproved(Boolean(existing.approvedOutline.approved));
    }
    const allowed: WizardStepId[] = [
      "topic",
      "keywords",
      "research",
      "outline",
      "blog",
    ];
    const fromQuery =
      resumeStep && allowed.includes(resumeStep) ? resumeStep : null;
    setStep(fromQuery || resumeStepForBlog(existing));
    setSearchParams({}, { replace: true });
    // Resume once from deep link
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, searchParams, getBlog, setSearchParams]);

  if (!client) {
    return (
      <EmptyState
        title="Client not found"
        body="Open a client workspace before starting a blog post."
        action={
          <Link className="btn btn-primary" to="/clients">
            Client Hub
          </Link>
        }
      />
    );
  }

  const activeClient = client;
  const stepIndex = steps.findIndex((item) => item.id === step);
  const article = articleId ? getBlog(articleId) : undefined;

  const audienceOptions = [
    {
      value: `Buyers evaluating ${activeClient.industry.toLowerCase()} solutions`,
      label: `Buyers evaluating ${activeClient.industry.toLowerCase()} solutions`,
    },
    {
      value: `${activeClient.name} prospects and shortlisted buyers`,
      label: `${activeClient.name} prospects and shortlisted buyers`,
    },
    {
      value: "Executive buyers and decision-makers",
      label: "Executive buyers and decision-makers",
    },
    {
      value: "Marketing and demand-gen leaders",
      label: "Marketing and demand-gen leaders",
    },
    {
      value: "Technical evaluators and operators",
      label: "Technical evaluators and operators",
    },
    {
      value: "Existing customers considering expansion",
      label: "Existing customers considering expansion",
    },
  ];

  function contextNotesFromFiles(ids: string[]): string {
    const files = ids
      .map((id) => getDriveItem(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (files.length === 0) return "";
    return [
      `Context from ${files.length} selected Drive file${files.length === 1 ? "" : "s"}:`,
      ...files.map((file) => `- ${file.name}`),
      "",
      ...files.map((file) => {
        const excerpt = (file.body ?? file.detail ?? "").trim().slice(0, 900);
        return [
          `## ${file.name}`,
          excerpt || "(No extractable text yet - file used as a reference label.)",
        ].join("\n");
      }),
    ].join("\n");
  }

  function composeBriefNotes(): string {
    const parts: string[] = [];
    if (objective.trim()) {
      const objectiveLabel =
        CONTENT_OBJECTIVES.find((item) => item.value === objective)?.label ??
        objective;
      parts.push(`Content objective: ${objectiveLabel}`);
    }
    if (language.trim()) {
      parts.push(`Language: ${language}`);
    }
    if (extraInstructions.trim()) {
      parts.push(`Additional instructions: ${extraInstructions.trim()}`);
    }
    if (mode === "describe" && ideaNotes.trim()) {
      parts.push(`Coverage / brief:\n${ideaNotes.trim()}`);
    }
    if (briefFileId) {
      const brief = getDriveItem(briefFileId);
      if (brief) {
        parts.push(
          `Existing brief file: ${brief.name}`,
          (brief.body ?? brief.detail ?? "").trim().slice(0, 1200),
        );
      }
    }
    if (mode === "auto") {
      const fileNotes = contextNotesFromFiles(contextFileIds);
      if (fileNotes) parts.push(fileNotes);
      if (referenceUrls.length > 0) {
        parts.push(
          "Reference URLs for the LLM to visit:",
          ...referenceUrls.map((url) => `- ${url}`),
        );
      }
    }
    return parts.filter(Boolean).join("\n\n");
  }

  function toggleContextFile(id: string) {
    setContextFileIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    // Invalidate suggestions only — keep the chosen topic so progress isn't lost.
    setPickedSuggestionId(null);
    setTopicSuggestions([]);
  }

  function addReferenceUrl() {
    setError("");
    if (referenceUrls.length >= MAX_REFERENCE_URLS) {
      setError(`You can add up to ${MAX_REFERENCE_URLS} reference URLs.`);
      return;
    }
    const normalized = normalizeReferenceUrl(urlDraft);
    if (!normalized) {
      setError("Enter a valid URL (for example https://example.com/article).");
      return;
    }
    if (referenceUrls.includes(normalized)) {
      setError("That URL is already added.");
      return;
    }
    setReferenceUrls((current) => [...current, normalized]);
    setUrlDraft("");
    setPickedSuggestionId(null);
    setTopicSuggestions([]);
  }

  function removeReferenceUrl(url: string) {
    setReferenceUrls((current) => current.filter((item) => item !== url));
    setPickedSuggestionId(null);
    setTopicSuggestions([]);
  }

  async function handleSuggestTopics() {
    setError("");
    setNotice("");
    if (contextFileIds.length === 0 && referenceUrls.length === 0) {
      setError("Select client files and/or add at least one reference URL.");
      return;
    }
    setSuggestingTopics(true);
    setPickedSuggestionId(null);
    // Don't clear an existing topic — user may be regenerating suggestions.
    await delay(450);

    const files = contextFileIds
      .map((id) => getDriveItem(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const fromFiles = files.slice(0, 3).map((file, index) => {
      const lead = file.name.replace(/\.[^.]+$/, "");
      return {
        id: `file-${file.id}-${index}`,
        title: `How ${activeClient.name} applies “${lead}” for buyers`,
        why: `Based on client file “${file.name}”.`,
      };
    });

    const fromUrls = referenceUrls.slice(0, 3).map((url, index) => {
      let host = url;
      try {
        host = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        // keep raw
      }
      return {
        id: `url-${index}-${host}`,
        title: `What ${audience.trim() || "buyers"} can take from ${host}`,
        why: `Based on ${host}.`,
      };
    });

    const defaults: TopicSuggestion[] = [
      {
        id: "seed-proof",
        title: autoTopicFor(activeClient),
        why: `Uses ${activeClient.name} proof points and selected context.`,
      },
    ];

    const next = [...fromFiles, ...fromUrls, ...defaults].slice(0, 5);
    setTopicSuggestions(next);
    setSuggestingTopics(false);
    setNotice(
      `Suggested ${next.length} topics from ${files.length} file${files.length === 1 ? "" : "s"} and ${referenceUrls.length} URL${referenceUrls.length === 1 ? "" : "s"}.`,
    );
  }

  function applyMode(next: TopicMode) {
    if (next === mode) return;
    setMode(next);
    // Keep topic / notes / instructions when switching modes so going back
    // from Outline → Topic does not wipe work in progress.
    setUrlDraft("");
    setTopicSuggestions([]);
    setPickedSuggestionId(null);
    if (next === "describe") {
      // Discover-only pick state is cleared above; keep the written topic.
      return;
    }
    // Discover mode: keep files/URLs the user already chose; don't blank topic.
  }

  function pickSuggestion(id: string, title: string) {
    setPickedSuggestionId(id);
    setTopic(title);
  }

  function addSecondaryKeyword(raw: string) {
    const next = raw.trim().toLowerCase();
    if (!next) return;
    if (
      next === primaryKeyword.trim().toLowerCase() ||
      secondaryKeywords.some((item) => item.toLowerCase() === next)
    ) {
      setSecondaryDraft("");
      return;
    }
    setSecondaryKeywords((current) => [...current, raw.trim()]);
    setSecondaryDraft("");
  }

  function removeSecondaryKeyword(phrase: string) {
    setSecondaryKeywords((current) => current.filter((item) => item !== phrase));
  }

  function buildKeywordIdeas(): KeywordIdea[] {
    const industry = activeClient.industry.toLowerCase();
    const name = activeClient.name;
    const topicWords = topic
      .toLowerCase()
      .replace(/[^a-z0-9\s&]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 4);
    const seedPhrase = topicWords.slice(0, 2).join(" ") || industry;
    const phrases = Array.from(
      new Set([
        seedPhrase,
        `${seedPhrase} best practices`,
        `${seedPhrase} methods`,
        `${industry} strategy`,
        `${name.toLowerCase()} for buyers`,
        `how to evaluate ${industry}`,
        ...suggestKeywords(topic || ideaNotes || audience, activeClient).filter(
          (phrase) => phrase.trim().split(/\s+/).length >= 2,
        ),
      ]),
    ).slice(0, 6);
    const intents: KeywordIntent[] = [
      "Informational",
      "Commercial",
      "Informational",
      "Commercial",
      "Transactional",
      "Informational",
    ];
    return phrases.map((phrase, index) => ({
      id: `kw-${index}-${phrase.replace(/\s+/g, "-")}`,
      phrase,
      volume: "Not connected",
      difficulty: "Not connected",
      intent: intents[index % intents.length],
    }));
  }

  async function handleSuggestKeywords() {
    setError("");
    setNotice("");
    setSuggestingKeywords(true);
    await delay(400);
    const ideas = buildKeywordIdeas();
    setKeywordIdeas(ideas);
    setSelectedIdeaIds([]);
    setSuggestingKeywords(false);
  }

  function toggleKeywordIdea(idea: KeywordIdea) {
    const selected = selectedIdeaIds.includes(idea.id);
    if (selected) {
      setSelectedIdeaIds((current) => current.filter((id) => id !== idea.id));
      if (primaryKeyword.trim().toLowerCase() === idea.phrase.toLowerCase()) {
        setPrimaryKeyword("");
      } else {
        removeSecondaryKeyword(idea.phrase);
      }
      return;
    }
    setSelectedIdeaIds((current) => [...current, idea.id]);
    if (!primaryKeyword.trim()) {
      setPrimaryKeyword(idea.phrase);
      return;
    }
    addSecondaryKeyword(idea.phrase);
  }

  function clientSiteUrl(): string {
    if (!activeClient.website.trim()) return "";
    return activeClient.website.startsWith("http")
      ? activeClient.website
      : `https://${activeClient.website.replace(/^https?:\/\//, "")}`;
  }

  function buildResearchPack(nextKeywords: string[]): ResearchPack {
    const topicLabel = topic.trim() || autoTopicFor(activeClient);
    const selectedFiles = contextFileIds
      .map((id) => getDriveItem(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const primary = nextKeywords[0] || activeClient.industry.toLowerCase();
    const secondary = nextKeywords[1];
    const site = clientSiteUrl();
    const siteHost = site
      ? site.replace(/^https?:\/\//, "").replace(/\/$/, "")
      : `${activeClient.name.toLowerCase().replace(/\s+/g, "")}.com`;
    const audienceLabel =
      audience.trim() ||
      `Buyers evaluating ${activeClient.industry.toLowerCase()} solutions`;
    const briefSnippet = (composeBriefNotes() || ideaNotes).trim().slice(0, 140);

    const clientExtract: string[] = [
      `${activeClient.name} positions around ${activeClient.industry.toLowerCase()} for ${audienceLabel.toLowerCase()}.`,
      activeClient.summary.trim()
        ? `Site summary signal: ${activeClient.summary.trim()}`
        : `Homepage narrative emphasizes practical outcomes over abstract “transformation” claims.`,
      ...activeClient.proofPoints.map(
        (point) => `Proof reusable in draft: ${point}`,
      ),
      site
        ? `Website (${siteHost}) messaging cluster: problem → approach → proof → next step; CTA language is consultative, not hard-sell.`
        : `No website URL on file - voice and claims inferred from client profile and uploaded docs only.`,
      `Topic fit on-site: pages and copy that map to “${topicLabel}” should lead with buyer constraints, then ${activeClient.name}’s method.`,
      primary
        ? `Keyword alignment on client materials: “${primary}”${secondary ? ` / “${secondary}”` : ""} appears as an educational theme, not a product pitch alone.`
        : null,
      ...selectedFiles.slice(0, 4).map((file) => {
        const excerpt = (file.body || file.detail || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160);
        return excerpt
          ? `From ${file.name}: ${excerpt}${excerpt.length >= 160 ? "…" : ""}`
          : `From ${file.name}: use as brand/audience context (parsed; no long excerpt stored).`;
      }),
      selectedFiles.length === 0
        ? "No Drive files selected for this run - research leans on client profile, website, and open-web competitor scan."
        : null,
      briefSnippet ? `Brief / instructions carried in: ${briefSnippet}` : null,
    ].filter((item): item is string => Boolean(item));

    const competitorNames = [
      `leading ${activeClient.industry.toLowerCase()} platforms`,
      "category mid-market vendors",
      "niche specialists targeting the same buyer",
    ];
    const competitorExtract: string[] = [
      `Open-web scan for “${primary}” + ${activeClient.industry.toLowerCase()}: top results skew informational (guides, frameworks) with commercial intent in comparison / pricing pages.`,
      `Competitor cluster (${competitorNames[0]}): lead with feature matrices and ROI calculators; under-explain the buyer’s day-to-day workflow friction.`,
      `${competitorNames[1]}: heavy use of generic “AI-powered / all-in-one” claims with thin proof - opening for ${activeClient.name} to stay specific and evidence-led.`,
      `${competitorNames[2]}: strong thought-leadership posts on ${primary}, but weak internal linking and thin CTA paths from education → evaluation.`,
      `Common competitor angle on “${topicLabel}”: listicles and 5-step checklists; few pieces connect steps to measurable buyer outcomes.`,
      `Messaging gap vs competitors: rivals emphasize speed/automation; few address ${audienceLabel.toLowerCase()} objections around risk, change management, and proof quality.`,
      `SERP / content pattern: “what is / how to” pages rank; “vs / alternative” pages convert - draft should educate first, then invite a concrete next step with ${activeClient.name}.`,
      referenceUrls.length > 0
        ? `Reference URLs in brief scanned for takeaways: ${referenceUrls.join(", ")}`
        : `No extra reference URLs in brief - competitor notes drawn from category search patterns and typical vendor sites.`,
      secondary
        ? `Secondary theme “${secondary}” is under-covered in competitor blogs relative to demand - good supporting section or sidebar callout.`
        : `Long-tail variants of “${primary}” (for [role], for [industry], checklist, mistakes) are lightly contested in competitor content.`,
      `Citation opportunity: competitors rarely cite primary research; pairing ${activeClient.name} proof with one external benchmark strengthens trust.`,
    ];

    const gaps = [
      `Lack of recent data on ROI benchmarks for “${primary}”. Add statistics or research citations.`,
      `Limited coverage of implementation steps for “${topicLabel}”. Include a clear framework.`,
      "Few examples for different industries / buyer contexts. Add real-world use cases.",
      selectedFiles.length === 0
        ? "Client docs not selected for this run - brand and persona evidence may be thin."
        : `Competitor comparison angles for “${primary}” are under-covered in current materials.`,
      `Internal link targets related to “${primary}” are unclear - draft may need related-article placeholders.`,
    ].slice(0, 5);

    const opportunities = [
      `Target long-tail keywords like “${primary} for ${activeClient.industry.toLowerCase()}”.`,
      "Build topical authority with a cluster of related articles.",
      "Add internal links to existing high-performing pages.",
      `Include a clear CTA aligned to ${activeClient.name}’s service / next-step page.`,
      secondary
        ? `Extend coverage with supporting theme “${secondary}”.`
        : `Reuse ${activeClient.name} proof points as concrete examples in each major section.`,
    ].slice(0, 5);

    const findings = [
      `Primary audience: ${audienceLabel}.`,
      `Key drivers: ${
        activeClient.proofPoints[0]
          ? activeClient.proofPoints[0]
          : "ROI, measurable results, and integration with existing tools."
      }`,
      `Top performing content themes: ${primary}${secondary ? `, ${secondary}` : ""}, strategy, measurement, and examples.`,
      "Search intent: Informational (how-to and best practices).",
      `Winning angle: practical framework for “${topicLabel}”, grounded in ${activeClient.name} proof - not a feature tour.`,
    ].slice(0, 5);

    const fileSources: ResearchSource[] = selectedFiles.slice(0, 2).map((file) => ({
      link: file.name,
      kind: "client" as const,
      snippet:
        (file.body || file.detail || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 110) ||
        `Parsed from client Drive - use for brand voice and audience context.`,
    }));

    const sources: ResearchSource[] = [
      ...(site
        ? [
            {
              link: site,
              kind: "client" as const,
              snippet: `${activeClient.name} site messaging: problem → approach → proof → next step.`,
            },
          ]
        : []),
      ...fileSources,
      ...referenceUrls.slice(0, 2).map((url) => ({
        link: url,
        kind: "external" as const,
        snippet: "Reference URL from the brief - fold takeaways into evidence callouts.",
      })),
      {
        link: `Competitor analysis – Top results for “${primary}”`,
        kind: "seo" as const,
        snippet:
          "Competitors emphasize ease of setup and automation; weaker on buyer risk and proof quality.",
      },
      {
        link: `Industry search – ${activeClient.industry} + ${primary}`,
        kind: "external" as const,
        snippet:
          "Demand for data-driven, how-to content remains high; comparison pages convert later in the journey.",
      },
    ].slice(0, 5);

    return {
      gaps,
      opportunities,
      clientExtract,
      competitorExtract,
      findings,
      sources,
    };
  }

  function researchNotesFromPack(pack: ResearchPack, nextKeywords: string[]): string {
    return [
      buildResearch({
        client: activeClient,
        topic: topic.trim() || autoTopicFor(activeClient),
        notes: composeBriefNotes() || ideaNotes,
        keywords: nextKeywords,
      }),
      "",
      "Content gaps",
      ...pack.gaps.map((item) => `- ${item}`),
      "",
      "Content opportunities",
      ...pack.opportunities.map((item) => `- ${item}`),
      "",
      "From client website & docs",
      ...pack.clientExtract.map((item) => `- ${item}`),
      "",
      "From competitors & open web",
      ...pack.competitorExtract.map((item) => `- ${item}`),
      "",
      "Key findings",
      ...pack.findings.map((item) => `- ${item}`),
      "",
      "Sources used",
      ...pack.sources.map((item) => `- [${item.kind}] ${item.link}`),
    ].join("\n");
  }

  function applyResearchPack(pack: ResearchPack, nextKeywords: string[]) {
    setResearchPack(pack);
    setResearch(researchNotesFromPack(pack, nextKeywords));
    setResearchApproved(false);
  }

  async function proceedToResearch(options?: { skipKeywords?: boolean }) {
    setError("");
    const nextKeywords = options?.skipKeywords
      ? keywords.length > 0
        ? keywords
        : suggestKeywords(topic || ideaNotes, activeClient).slice(0, 3)
      : keywords;
    if (!options?.skipKeywords && !primaryKeyword.trim() && !hasOwnKeywords) {
      setError("Add a primary keyword, or check “I already have my keywords.”");
      return;
    }
    if (!options?.skipKeywords && nextKeywords.length === 0) {
      setError("Add at least one keyword, or skip keyword research.");
      return;
    }
    if (options?.skipKeywords && !primaryKeyword.trim() && nextKeywords[0]) {
      setPrimaryKeyword(nextKeywords[0]);
      setSecondaryKeywords(nextKeywords.slice(1));
    }
    persistInProgressArticle();
    // Returning from a later step — keep existing research instead of wiping it.
    if (researchPack && research.trim()) {
      setStep("research");
      setNotice("");
      return;
    }
    setResearching(true);
    setNotice("");
    setStep("research");
    await delay(700);
    const pack = buildResearchPack(nextKeywords);
    applyResearchPack(pack, nextKeywords);
    setSourceDraft("");
    setEditingItem(null);
    setEditDraft("");
    setAddingKey(null);
    setAddDraft("");
    setNotesOpen(false);
    setResearching(false);
  }

  function startEditListItem(key: ResearchListKey, index: number) {
    if (!researchPack) return;
    setAddingKey(null);
    setAddDraft("");
    setEditingItem({ key, index });
    setEditDraft(researchPack[key][index] ?? "");
  }

  function cancelEditListItem() {
    setEditingItem(null);
    setEditDraft("");
  }

  function saveEditListItem() {
    if (!researchPack || !editingItem) return;
    const next = editDraft.trim();
    if (!next) return;
    const nextList = researchPack[editingItem.key].map((item, i) =>
      i === editingItem.index ? next : item,
    );
    applyResearchPack(
      { ...researchPack, [editingItem.key]: nextList },
      keywords,
    );
    setEditingItem(null);
    setEditDraft("");
  }

  function removeResearchListItem(key: ResearchListKey | "sources", index: number) {
    if (!researchPack) return;
    if (editingItem?.key === key && editingItem.index === index) {
      cancelEditListItem();
    }
    applyResearchPack(
      {
        ...researchPack,
        [key]: researchPack[key].filter((_, i) => i !== index),
      },
      keywords,
    );
  }

  function startAddListItem(key: ResearchListKey) {
    setEditingItem(null);
    setEditDraft("");
    setAddingKey(key);
    setAddDraft("");
  }

  function cancelAddListItem() {
    setAddingKey(null);
    setAddDraft("");
  }

  function saveAddListItem() {
    if (!researchPack || !addingKey) return;
    const next = addDraft.trim();
    if (!next) return;
    applyResearchPack(
      {
        ...researchPack,
        [addingKey]: [...researchPack[addingKey], next],
      },
      keywords,
    );
    setAddingKey(null);
    setAddDraft("");
  }

  function addResearchSource() {
    if (!researchPack) return;
    const next = sourceDraft.trim();
    if (!next) return;
    if (
      researchPack.sources.some(
        (item) => item.link.toLowerCase() === next.toLowerCase(),
      )
    ) {
      setSourceDraft("");
      return;
    }
    const kind: ResearchSourceKind = /^https?:\/\//i.test(next)
      ? "external"
      : "client";
    applyResearchPack(
      {
        ...researchPack,
        sources: [
          ...researchPack.sources,
          { link: next, kind, snippet: "Added manually - verify before drafting." },
        ],
      },
      keywords,
    );
    setSourceDraft("");
  }

  function formatFileMeta(updatedAt: string): string {
    try {
      const date = new Date(updatedAt);
      if (Number.isNaN(date.getTime())) return updatedAt;
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return updatedAt;
    }
  }

  async function regenerateResearchSummary() {
    setResearching(true);
    setNotice("");
    await delay(700);
    const pack = buildResearchPack(keywords);
    applyResearchPack(pack, keywords);
    setResearching(false);
  }

  function approveResearchAndContinue() {
    if (!researchPack) {
      setError("Research pack is missing. Go back and continue from Keywords.");
      return;
    }
    if (researchPack.sources.length === 0) {
      setError("Add at least one source link before continuing.");
      return;
    }
    setResearchApproved(true);
    setError("");
    setNotice("");
    // Returning from Outline → keep the outline the user already edited.
    if (structuredOutline && structuredOutline.sections.length > 0) {
      ensureArticle(structuredOutline);
      setStep("outline");
      return;
    }
    const outline = buildStructuredOutline({
      topic: topic.trim() || autoTopicFor(activeClient),
      audience: audience.trim() || "B2B buyers",
      keywords,
      client: activeClient,
      notes: research || composeBriefNotes() || ideaNotes,
      sectionCount: 7,
    });
    setStructuredOutline(outline);
    setOutlineApproved(false);
    ensureArticle(outline);
    setStep("outline");
  }

  /**
   * Save mid-wizard progress so Activity shows this blog and click can resume.
   * Called when leaving a step or unmounting with work in progress.
   */
  function persistInProgressArticle(): string | null {
    const title =
      topic.trim() ||
      ideaNotes.trim().slice(0, 80) ||
      `${activeClient.name} draft`;
    if (!topic.trim() && !ideaNotes.trim() && !primaryKeyword.trim() && !articleId) {
      return null;
    }
    const syncedFields = {
      title,
      topic: topic.trim() || title,
      targetAudience: audience.trim() || "B2B buyers",
      ideaNotes,
      keywords,
      primaryKeyword: primaryKeyword.trim() || keywords[0] || "",
      secondaryKeywords:
        secondaryKeywords.length > 0 ? secondaryKeywords : keywords.slice(1),
      research,
      outline: structuredOutline
        ? outlineToPlainText(structuredOutline)
        : "",
      approvedOutline: structuredOutline,
      toneId: tone?.id ?? toneId,
      toneName: tone?.name ?? toneId,
      topicMode: mode,
      targetWords: words,
      articlePhase: "outline" as const,
      calendarPinned: true as const,
      generationStatus: "In progress" as const,
      status: "draft" as const,
      seoTitle: title.slice(0, 60),
    };

    if (articleId) {
      updateBlog(articleId, syncedFields);
      return articleId;
    }

    const reusable = findReusableCalendarStub(
      blogsForClient(activeClient.id),
      activeClient.id,
    );
    if (reusable) {
      updateBlog(reusable.id, {
        ...syncedFields,
        calendarDate: reusable.calendarDate,
        body: reusable.body || "",
        ideaNotes: ideaNotes || reusable.ideaNotes,
      });
      setArticleId(reusable.id);
      return reusable.id;
    }

    const created = addBlog({
      clientId: activeClient.id,
      body: "",
      sections: [],
      lede: "",
      closing: "",
      versions: [],
      generationToken: 0,
      outlineDirtyAfterDraft: false,
      seoMeta: "",
      qualityChecks: defaultQualityChecks(),
      calendarDate: todayPinDateIso(),
      ...syncedFields,
    });
    setArticleId(created.id);
    return created.id;
  }

  function ensureArticle(outline: ApprovedOutline): string {
    const syncedFields = {
      title: outline.title,
      topic: topic.trim() || outline.title,
      targetAudience: audience.trim() || "B2B buyers",
      ideaNotes,
      keywords,
      primaryKeyword: keywords[0] ?? "",
      secondaryKeywords: keywords.slice(1),
      research,
      outline: outlineToPlainText(outline),
      approvedOutline: outline,
      toneId: tone?.id ?? toneId,
      toneName: tone?.name ?? toneId,
      topicMode: mode,
      targetWords: words,
      articlePhase: outline.approved
        ? ("outline_approved" as const)
        : ("outline" as const),
      calendarPinned: true as const,
      generationStatus: "In progress" as const,
    };

    if (articleId) {
      updateBlog(articleId, syncedFields);
      return articleId;
    }

    // Reuse a calendar pin for this client so Generate does not create a second blog.
    const reusable = findReusableCalendarStub(
      blogsForClient(activeClient.id),
      activeClient.id,
    );
    if (reusable) {
      updateBlog(reusable.id, {
        ...syncedFields,
        seoTitle: outline.title.slice(0, 60),
        calendarDate: reusable.calendarDate,
        body: reusable.body || "",
        ideaNotes: ideaNotes || reusable.ideaNotes,
      });
      setArticleId(reusable.id);
      return reusable.id;
    }

    const created = addBlog({
      clientId: activeClient.id,
      body: "",
      sections: [],
      lede: "",
      closing: "",
      versions: [],
      generationToken: 0,
      outlineDirtyAfterDraft: false,
      seoTitle: outline.title.slice(0, 60),
      seoMeta: "",
      qualityChecks: defaultQualityChecks(),
      status: "draft",
      calendarDate: todayPinDateIso(),
      ...syncedFields,
    });
    setArticleId(created.id);
    return created.id;
  }

  function updateSection(sectionId: string, patch: Partial<OutlineSectionSpec>) {
    if (!structuredOutline) return;
    setOutlineApproved(false);
    setStructuredOutline({
      ...structuredOutline,
      approved: false,
      approvedAt: null,
      sections: structuredOutline.sections.map((section) =>
        section.id === sectionId ? { ...section, ...patch } : section,
      ),
    });
    if (article?.sections?.length) setDirtyWarn(true);
  }

  function updateOutlineMeta(
    patch: Partial<
      Pick<
        ApprovedOutline,
        "title" | "introductionPurpose" | "conclusionPurpose" | "cta"
      >
    >,
  ) {
    if (!structuredOutline) return;
    setOutlineApproved(false);
    setStructuredOutline({
      ...structuredOutline,
      ...patch,
      approved: false,
      approvedAt: null,
    });
    if (article?.sections?.length) setDirtyWarn(true);
  }

  function removeOutlineSection(sectionId: string) {
    if (!structuredOutline) return;
    if (structuredOutline.sections.length <= 1) return;
    setOutlineApproved(false);
    setStructuredOutline({
      ...structuredOutline,
      approved: false,
      approvedAt: null,
      sections: structuredOutline.sections
        .filter((section) => section.id !== sectionId)
        .map((section, index) => ({ ...section, order: index })),
    });
    if (article?.sections?.length) setDirtyWarn(true);
  }

  function saveDraftDocument(doc: {
    lede: string;
    closing: string;
    cta: string;
    sections: Array<{ id: string; heading: string; body: string }>;
  }) {
    if (!articleId || !structuredOutline) return;
    const current = getBlog(articleId);
    if (!current) return;

    const nextSections = (
      current.sections?.length
        ? current.sections
        : doc.sections.map((item, index) => ({
            sectionId: item.id,
            order: index,
            heading: item.heading,
            body: item.body,
            keyPointsCovered: [] as string[],
          }))
    ).map((section) => {
      const edited = doc.sections.find((item) => item.id === section.sectionId);
      if (!edited) return section;
      return {
        ...section,
        heading: edited.heading,
        body: edited.body,
      };
    });

    const nextOutline = {
      ...structuredOutline,
      title: structuredOutline.title || current.title,
      cta: doc.cta.trim() ? doc.cta : structuredOutline.cta,
      sections: structuredOutline.sections.map((spec) => {
        const edited = doc.sections.find((item) => item.id === spec.id);
        if (!edited) return spec;
        const plainHeading = edited.heading
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        return { ...spec, heading: plainHeading || spec.heading };
      }),
    };
    setStructuredOutline(nextOutline);

    const fullBody = [
      doc.lede,
      sectionsToBody(nextSections),
      doc.closing,
      doc.cta,
    ]
      .filter((part) => Boolean(part?.trim()))
      .join("\n\n");

    updateBlog(articleId, {
      lede: doc.lede,
      closing: doc.closing,
      sections: nextSections,
      body: fullBody,
      approvedOutline: nextOutline,
      title: nextOutline.title || current.title,
    });
  }

  function goToReview() {
    draftRef.current?.flush();
    if (!articleId) return;
    // Let the blog store commit before opening Review.
    window.setTimeout(() => {
      navigate(`/clients/${activeClient.id}/blog/${articleId}`);
    }, 0);
  }

  function goNext() {
    setError("");
    setNotice("");
    if (step === "topic") {
      if (!toneId.trim() || !tone) {
        setError("Choose a tone of voice.");
        return;
      }
      if (!audience.trim()) {
        setError("Enter a target audience.");
        return;
      }
      if (mode === "describe") {
        const hasIdea =
          topic.trim() ||
          ideaNotes.trim() ||
          briefFileId ||
          extraInstructions.trim();
        if (!hasIdea) {
          setError(
            "Add a topic, coverage notes, an existing brief file, or additional instructions.",
          );
          return;
        }
      }
      if (mode === "auto") {
        // If a topic is already set (e.g. returned from Outline), continue.
        if (!topic.trim()) {
          if (contextFileIds.length === 0 && referenceUrls.length === 0) {
            setError("Select client files and/or add at least one reference URL.");
            return;
          }
          if (topicSuggestions.length === 0) {
            setError("Click Suggest topics, then select one topic to continue.");
            return;
          }
          if (!pickedSuggestionId) {
            setError("Select one suggested topic to continue.");
            return;
          }
        }
      }
      if (!primaryKeyword.trim()) {
        const seeded = suggestKeywords(
          topic || ideaNotes || composeBriefNotes(),
          activeClient,
        ).filter((phrase) => phrase.trim().split(/\s+/).length >= 2);
        const fallback =
          seeded[0] ||
          `${activeClient.industry.toLowerCase()} strategy` ||
          activeClient.name.toLowerCase();
        setPrimaryKeyword(fallback);
        setSecondaryKeywords([]);
      }
      setKeywordIdeas([]);
      setSelectedIdeaIds([]);
      setIntentFilter("All");
      setNotice("");
      persistInProgressArticle();
      setStep("keywords");
      return;
    }
    if (step === "keywords") {
      proceedToResearch();
      return;
    }
    if (step === "research") {
      approveResearchAndContinue();
      return;
    }
    if (step === "outline") {
      void runGenerateDraft();
    }
  }

  async function runGenerateDraft() {
    if (!structuredOutline) {
      setError("Generate an outline first.");
      return;
    }
    let outline = structuredOutline;
    if (!outline.approved || !outlineApproved) {
      outline = approveOutline({
        ...outline,
        title:
          outline.title.trim() ||
          topic.trim() ||
          autoTopicFor(activeClient),
      });
      setStructuredOutline(outline);
      setOutlineApproved(true);
      const approveId = ensureArticle(outline);
      approveOutlineForArticle(approveId, outline);
    }
    if (dirtyWarn) {
      const ok = window.confirm(
        "The outline changed after a draft already exists. Generating will create a new draft version from this outline. Continue?",
      );
      if (!ok) return;
    }

    setGenerating(true);
    setError("");
    setNotice("Generating draft from the approved outline…");
    await delay(400);

    const id = ensureArticle(outline);
    if (!tone) {
      setGenerating(false);
      setError("Choose a tone of voice.");
      return;
    }
    const draft = generateDraftFromOutline({
      outline,
      client: activeClient,
      tone,
      audience: audience.trim(),
      keywords,
      notes: ideaNotes,
      research,
      targetWords: words,
    });
    const seo = suggestSeo({
      title: draft.title,
      client: activeClient,
      keywords,
      notes: ideaNotes,
    });
    if (getTone(tone.id)) {
      updateClient(activeClient.id, { preferredToneId: tone.id });
    }
    const fullBody = [draft.lede, draft.body, draft.closing, draft.cta]
      .filter(Boolean)
      .join("\n\n");
    const existing = getBlog(id);
    const keepStatus =
      existing?.status === "approved" || existing?.status === "in_review"
        ? existing.status
        : "draft";
    updateBlog(
      id,
      {
        title: draft.title,
        body: fullBody,
        sections: draft.sections,
        lede: draft.lede,
        closing: draft.closing,
        seoTitle: seo.seoTitle,
        seoMeta: seo.seoMeta,
        qualityChecks: defaultQualityChecks(),
        status: keepStatus,
        articlePhase:
          keepStatus === "approved"
            ? "approved"
            : keepStatus === "in_review"
              ? "in_review"
              : "draft",
        outlineDirtyAfterDraft: false,
        approvedOutline: outline,
        outline: outlineToPlainText(outline),
      },
      { snapshot: true, snapshotLabel: "Generated from approved outline" },
    );
    setDirtyWarn(false);
    setGenerating(false);
    setNotice("Draft generated from the approved outline and saved to this article.");
    setStep("blog");
  }

  function handleApproveOutline() {
    if (!structuredOutline) return;
    const approved = approveOutline({
      ...structuredOutline,
      title: structuredOutline.title.trim() || topic.trim() || autoTopicFor(activeClient),
    });
    setStructuredOutline(approved);
    setOutlineApproved(true);
    const id = ensureArticle(approved);
    approveOutlineForArticle(id, approved);
    setNotice("");
    setError("");
  }

  function regenerateOutline() {
    const outline = buildStructuredOutline({
      topic: topic.trim() || autoTopicFor(activeClient),
      audience: audience.trim() || "B2B buyers",
      keywords,
      client: activeClient,
      notes: research || composeBriefNotes() || ideaNotes,
      sectionCount: 7,
    });
    setStructuredOutline(outline);
    setOutlineApproved(false);
    ensureArticle(outline);
    setNotice("");
  }

  function restoreTopicFromArticle() {
    if (!articleId) return;
    const existing = getBlog(articleId);
    if (!existing) return;
    if (!topic.trim() && (existing.topic || existing.title)) {
      setTopic(existing.topic || existing.title);
    }
    if (!ideaNotes.trim() && existing.ideaNotes) {
      setIdeaNotes(existing.ideaNotes);
    }
    if (!audience.trim() && existing.targetAudience) {
      setAudience(existing.targetAudience);
    }
    if (!toneId.trim() && existing.toneId) {
      setToneId(existing.toneId);
    }
    if (!primaryKeyword.trim() && existing.primaryKeyword) {
      setPrimaryKeyword(existing.primaryKeyword);
    }
    if (secondaryKeywords.length === 0 && existing.secondaryKeywords?.length) {
      setSecondaryKeywords(existing.secondaryKeywords);
    }
    if (!research.trim() && existing.research) {
      setResearch(existing.research);
    }
    if (!structuredOutline && existing.approvedOutline) {
      setStructuredOutline(existing.approvedOutline);
      setOutlineApproved(Boolean(existing.approvedOutline.approved));
    }
  }

  function goToStep(next: StepId) {
    setError("");
    if (next === "topic") {
      restoreTopicFromArticle();
    }
    setStep(next);
  }

  function goBack() {
    setError("");
    const index = steps.findIndex((item) => item.id === step);
    if (index > 0) goToStep(steps[index - 1].id);
  }

  return (
    <div className="wizard-shell">
      <header className="page-head">
        <div>
          <p className="eyebrow">{client.name}</p>
          <h1>Generate Blog</h1>
        </div>
        <Link className="btn btn-secondary" to={`/clients/${client.id}`}>
          Back to files
        </Link>
      </header>


      <ol className="steps">
        {steps.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              className={[
                "step",
                item.id === step ? "current" : "",
                index < stepIndex ? "done" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={index > stepIndex}
              onClick={() => index <= stepIndex && goToStep(item.id)}
            >
              <span>{index + 1}</span>
              {item.label}
            </button>
          </li>
        ))}
      </ol>

      <section
        className={[
          "panel",
          "wizard-panel",
          step === "outline" || step === "blog" ? "wizard-panel-doc" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {notice ? <p className="drive-upload-msg">{notice}</p> : null}
        {dirtyWarn ? (
          <p className="field-error">
            Outline changed after a draft exists. Re-approve and regenerate, or
            reconcile manually in the editor.
          </p>
        ) : null}

        {step === "topic" ? (
          <>
            <div className="panel-head">
              <div>
                <h2>Content requirements</h2>
              </div>
              <DemoBadge>Step 1 of 5</DemoBadge>
            </div>

            <div className="form-grid">
              <DropdownSelect
                className="field"
                label="Content objective"
                value={objective}
                searchable
                allowCustom
                searchPlaceholder="Search or type an objective…"
                placeholder="Search or type an objective…"
                options={CONTENT_OBJECTIVES.map((item) => ({
                  value: item.value,
                  label: item.label,
                }))}
                onChange={setObjective}
              />
              <DropdownSelect
                className="field"
                label="Language"
                value={language}
                searchable
                allowCustom
                searchPlaceholder="Search or type a language…"
                placeholder="Search or type a language…"
                options={[
                  { value: "English", label: "English" },
                  { value: "Spanish", label: "Spanish" },
                  { value: "French", label: "French" },
                ]}
                onChange={setLanguage}
              />
              <DropdownSelect
                className="field field-wide"
                label="Target audience *"
                value={audience}
                searchable
                allowCustom
                searchPlaceholder="Search or type an audience…"
                placeholder="Search or type an audience…"
                options={audienceOptions}
                onChange={setAudience}
              />
              <DropdownSelect
                className="field"
                label="Tone of voice *"
                value={toneId}
                searchable
                allowCustom
                searchPlaceholder="Search or type a tone…"
                placeholder="Search or type a tone…"
                options={tones.map((item) => ({
                  value: item.id,
                  label: item.bestFor
                    ? `${item.name} - ${item.bestFor}`
                    : item.name,
                }))}
                onChange={(next) => {
                  setToneId(next);
                  if (getTone(next)) {
                    updateClient(activeClient.id, { preferredToneId: next });
                  }
                }}
              />
              {tone && getTone(tone.id) ? (
                <div className="tone-brief-preview field-wide">
                  <p className="field-label">Applied tone profile</p>
                  <p className="muted tone-brief-summary">{tone.summary}</p>
                  {tone.bestFor ? (
                    <p className="tone-brief-best">
                      <strong>Best for:</strong> {tone.bestFor}
                    </p>
                  ) : null}
                  <p className="muted tone-brief-note">
                    Blog generation will automatically use this tone’s writing
                    rules, preferred phrases, avoided phrases, and sample copy.
                    You don’t need to re-enter them in additional instructions.
                  </p>
                </div>
              ) : null}
              <label className="field">
                <span className="field-label">Target word count *</span>
                <input
                  type="number"
                  min={200}
                  step={50}
                  value={targetWords}
                  onChange={(e) => setTargetWords(e.target.value)}
                  placeholder="800"
                />
              </label>
              <label className="field field-wide">
                <span className="field-label">Additional instructions (optional)</span>
                <textarea
                  rows={3}
                  value={extraInstructions}
                  onChange={(e) => setExtraInstructions(e.target.value)}
                  placeholder="CTA, compliance notes, or special requirements"
                />
              </label>
            </div>

            <div className="brief-divider">
              <h3>What would you like to write?</h3>
            </div>

            <div className="mode-grid" role="group" aria-label="How to start">
              <button
                type="button"
                className={mode === "describe" ? "mode-card selected" : "mode-card"}
                onClick={() => applyMode("describe")}
              >
                <strong>I have a topic or idea</strong>
                <span>
                  Enter a topic, keywords, or instructions you already have.
                </span>
              </button>
              <button
                type="button"
                className={mode === "auto" ? "mode-card selected" : "mode-card"}
                onClick={() => applyMode("auto")}
              >
                <strong>Discover a topic for me</strong>
                <span>
                  Use client files and reference URLs to suggest relevant topics.
                </span>
              </button>
            </div>

            {mode === "describe" ? (
              <div className="form-grid" style={{ marginTop: 16 }}>
                <label className="field field-wide">
                  <span className="field-label">Topic or working title</span>
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Optional - leave blank if you only have a rough idea or brief"
                  />
                </label>
                <label className="field field-wide">
                  <span className="field-label">What should this blog cover?</span>
                  <textarea
                    rows={4}
                    value={ideaNotes}
                    onChange={(e) => setIdeaNotes(e.target.value)}
                    placeholder="Paste a client brief, rough idea, known keywords, or instructions"
                  />
                </label>
                <DropdownSelect
                  className="field field-wide"
                  label="Or use an existing brief file"
                  value={briefFileId}
                  searchable
                  searchPlaceholder="Search brief files…"
                  placeholder="Optional - select a Drive brief"
                  options={[
                    { value: "", label: "None" },
                    ...briefFiles.map((file) => ({
                      value: file.id,
                      label: file.name,
                    })),
                  ]}
                  onChange={setBriefFileId}
                />
              </div>
            ) : (
              <div className="form-grid" style={{ marginTop: 16 }}>
                <div className="field field-wide">
                  <span className="field-label">Where should we look for ideas?</span>
                </div>

                <div className="field field-wide">
                  <span className="field-label">
                    1. Client content files{" "}
                    <span className="muted">
                      ({contextFileIds.length} selected)
                    </span>
                  </span>
                  {clientFiles.length === 0 ? (
                    <EmptyState
                      title="No files in this client folder"
                      body="Upload files in the client workspace, then return here."
                      action={
                        <Link
                          className="btn btn-secondary"
                          to={`/clients/${activeClient.id}`}
                        >
                          Open workspace
                        </Link>
                      }
                    />
                  ) : (
                    <div
                      className="context-file-grid"
                      role="group"
                      aria-label="Client Drive files"
                    >
                      {clientFiles.map((file) => {
                        const selected = contextFileIds.includes(file.id);
                        return (
                          <button
                            key={file.id}
                            type="button"
                            className={
                              selected
                                ? "context-file-card selected"
                                : "context-file-card"
                            }
                            aria-pressed={selected}
                            onClick={() => toggleContextFile(file.id)}
                          >
                            <span className="context-file-check" aria-hidden>
                              {selected ? "✓" : ""}
                            </span>
                            <FileGlyph kind={file.kind} />
                            <span className="context-file-meta">
                              <strong>{file.name}</strong>
                              <em>
                                {file.kind.toUpperCase()}
                                {file.detail ? ` · ${file.detail}` : ""}
                              </em>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="field field-wide">
                  <span className="field-label">
                    2. Reference URLs{" "}
                    <span className="muted">
                      ({referenceUrls.length}/{MAX_REFERENCE_URLS})
                    </span>
                  </span>
                  <div className="url-add-row">
                    <input
                      type="url"
                      value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)}
                      placeholder="https://example.com/article"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addReferenceUrl();
                        }
                      }}
                      disabled={referenceUrls.length >= MAX_REFERENCE_URLS}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={addReferenceUrl}
                      disabled={referenceUrls.length >= MAX_REFERENCE_URLS}
                    >
                      Add
                    </button>
                  </div>
                  {referenceUrls.length > 0 ? (
                    <ul className="url-chip-list">
                      {referenceUrls.map((url) => (
                        <li key={url} className="url-chip">
                          <a href={url} target="_blank" rel="noreferrer">
                            {url}
                          </a>
                          <button
                            type="button"
                            className="url-chip-remove"
                            aria-label={`Remove ${url}`}
                            onClick={() => removeReferenceUrl(url)}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="field field-wide">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleSuggestTopics()}
                    disabled={suggestingTopics}
                  >
                    {suggestingTopics ? "Suggesting topics…" : "Suggest topics"}
                  </button>
                </div>

                {topicSuggestions.length > 0 ? (
                  <div className="field field-wide">
                    <span className="field-label">Suggested topics *</span>
                    <div className="topic-suggest-list" role="list">
                      {topicSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          role="listitem"
                          className={
                            pickedSuggestionId === suggestion.id
                              ? "topic-suggest-card selected"
                              : "topic-suggest-card"
                          }
                          onClick={() =>
                            pickSuggestion(suggestion.id, suggestion.title)
                          }
                        >
                          <strong>{suggestion.title}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

          </>
        ) : null}

        {step === "keywords" ? (
          <>
            <div className="panel-head">
              <div>
                <h2>Keyword strategy</h2>
              </div>
              <DemoBadge>Step 2 of 5</DemoBadge>
            </div>

            <div className="kw-context-bar" aria-label="Brief summary">
              <div>
                <span className="kw-context-label">Topic</span>
                <strong>{topic.trim() || "Not set"}</strong>
              </div>
              <div>
                <span className="kw-context-label">Audience</span>
                <strong>{audience.trim() || "Not set"}</strong>
              </div>
              <div>
                <span className="kw-context-label">Client context</span>
                <strong className="kw-context-loaded">
                  <span className="kw-context-dot" aria-hidden />
                  Loaded
                </strong>
              </div>
            </div>

            <div className="kw-layout">
              <section className="kw-panel" aria-label="Your keywords">
                <h3>Your keywords</h3>
                <label className="field">
                  <span className="field-label">Primary keyword *</span>
                  <input
                    value={primaryKeyword}
                    onChange={(e) => setPrimaryKeyword(e.target.value)}
                    placeholder="e.g. site assessments"
                  />
                </label>
                <div className="field">
                  <span className="field-label">Secondary keywords</span>
                  <div className="kw-tag-box">
                    {secondaryKeywords.map((phrase) => (
                      <span key={phrase} className="kw-tag">
                        {phrase}
                        <button
                          type="button"
                          aria-label={`Remove ${phrase}`}
                          onClick={() => removeSecondaryKeyword(phrase)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <div className="kw-tag-add">
                      <input
                        value={secondaryDraft}
                        onChange={(e) => setSecondaryDraft(e.target.value)}
                        placeholder="Add keyword…"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addSecondaryKeyword(secondaryDraft);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => addSecondaryKeyword(secondaryDraft)}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
                <label className="kw-own-check">
                  <input
                    type="checkbox"
                    checked={hasOwnKeywords}
                    onChange={(e) => setHasOwnKeywords(e.target.checked)}
                  />
                  I already have my keywords.
                </label>
              </section>

              <section
                className={
                  hasOwnKeywords ? "kw-panel kw-panel-muted" : "kw-panel"
                }
                aria-label="Discover keyword ideas"
              >
                <div className="kw-discover-head">
                  <div className="kw-discover-copy">
                    <div className="kw-discover-title-row">
                      <h3>Discover keyword ideas</h3>
                      <DemoBadge>SEO data: Demo data</DemoBadge>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleSuggestKeywords()}
                    disabled={suggestingKeywords || hasOwnKeywords}
                  >
                    {suggestingKeywords ? "Suggesting…" : "Suggest keywords"}
                  </button>
                </div>

                {filteredKeywordIdeas.length > 0 ? (
                  <div className="kw-table-wrap">
                    <table className="kw-table">
                      <thead>
                        <tr>
                          <th scope="col">Keyword phrase</th>
                          <th scope="col">Search volume</th>
                          <th scope="col">Difficulty</th>
                          <th scope="col">Intent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredKeywordIdeas.map((idea) => {
                          const checked = selectedIdeaIds.includes(idea.id);
                          return (
                            <tr key={idea.id} className={checked ? "is-selected" : ""}>
                              <td>
                                <label className="kw-phrase-check">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={hasOwnKeywords}
                                    onChange={() => toggleKeywordIdea(idea)}
                                  />
                                  <span>{idea.phrase}</span>
                                </label>
                              </td>
                              <td>
                                <span className="kw-metric">{idea.volume}</span>
                              </td>
                              <td>
                                <span className="kw-metric">{idea.difficulty}</span>
                              </td>
                              <td>
                                <span
                                  className={`kw-intent kw-intent-${idea.intent.toLowerCase()}`}
                                >
                                  {idea.intent}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : hasOwnKeywords ? (
                  <div className="kw-empty-ideas">
                    <p className="muted">Discovery paused.</p>
                  </div>
                ) : null}

                <div className="kw-discover-foot">
                  <DropdownSelect
                    className="field kw-intent-filter"
                    label="Search intent"
                    value={intentFilter}
                    options={[
                      { value: "All", label: "All intents" },
                      { value: "Informational", label: "Informational" },
                      { value: "Commercial", label: "Commercial" },
                      { value: "Transactional", label: "Transactional" },
                    ]}
                    onChange={(next) =>
                      setIntentFilter(next as "All" | KeywordIntent)
                    }
                    disabled={hasOwnKeywords}
                  />
                  <p className="muted kw-hint">
                    Suggestions are not added until you select them.
                  </p>
                </div>
              </section>
            </div>
          </>
        ) : null}

        {step === "research" ? (
          <>
            <div className="panel-head">
              <h2>
                <span className="rs-title-icon" aria-hidden>
                  ⌕
                </span>{" "}
                Research
              </h2>
            </div>

            {researching && !researchPack ? (
              <p className="muted rs-loading">Researching…</p>
            ) : null}

            {researchPack ? (
              <div className={`rs-layout${researching ? " is-busy" : ""}`}>
                <div className="rs-insights-row">
                  <section className="rs-card rs-card-findings">
                      <div className="rs-card-head">
                        <h3>
                          <span className="rs-head-icon rs-head-idea" aria-hidden>
                            ✦
                          </span>{" "}
                          Key findings
                        </h3>
                        <span className="rs-badge-soft">
                          From client context + SEO data
                        </span>
                      </div>
                      <ul className="rs-compact-list">
                        {researchPack.findings.map((item, index) => {
                          const editing =
                            editingItem?.key === "findings" &&
                            editingItem.index === index;
                          return (
                            <li key={`finding-${index}`} className="rs-compact-item">
                              <span className="rs-check" aria-hidden>
                                ✓
                              </span>
                              {editing ? (
                                <div className="rs-inline-edit">
                                  <input
                                    type="text"
                                    value={editDraft}
                                    autoFocus
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        saveEditListItem();
                                      }
                                    }}
                                  />
                                  <div className="rs-inline-actions">
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm"
                                      onClick={saveEditListItem}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={cancelEditListItem}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="rs-compact-text">{item}</p>
                                  <div className="rs-item-actions">
                                    <button
                                      type="button"
                                      className="rs-icon-btn"
                                      aria-label="Edit finding"
                                      onClick={() =>
                                        startEditListItem("findings", index)
                                      }
                                    >
                                      ✎
                                    </button>
                                    <button
                                      type="button"
                                      className="rs-icon-btn"
                                      aria-label="Remove finding"
                                      onClick={() =>
                                        removeResearchListItem("findings", index)
                                      }
                                    >
                                      ×
                                    </button>
                                  </div>
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  <section className="rs-card rs-card-gaps">
                      <div className="rs-card-head">
                        <h3>
                          <span className="rs-head-icon rs-head-warn" aria-hidden>
                            ⚠
                          </span>{" "}
                          Content gaps
                        </h3>
                        <span className="rs-count">
                          {researchPack.gaps.length} gaps identified
                        </span>
                      </div>
                      <ul className="rs-compact-list">
                        {researchPack.gaps.map((item, index) => {
                          const editing =
                            editingItem?.key === "gaps" &&
                            editingItem.index === index;
                          return (
                            <li key={`gap-${index}`} className="rs-compact-item">
                              <span className="rs-num">{index + 1}</span>
                              {editing ? (
                                <div className="rs-inline-edit">
                                  <input
                                    type="text"
                                    value={editDraft}
                                    autoFocus
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        saveEditListItem();
                                      }
                                    }}
                                  />
                                  <div className="rs-inline-actions">
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm"
                                      onClick={saveEditListItem}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={cancelEditListItem}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="rs-compact-text">{item}</p>
                                  <div className="rs-item-actions">
                                    <button
                                      type="button"
                                      className="rs-icon-btn"
                                      aria-label="Edit gap"
                                      onClick={() =>
                                        startEditListItem("gaps", index)
                                      }
                                    >
                                      ✎
                                    </button>
                                    <button
                                      type="button"
                                      className="rs-icon-btn"
                                      aria-label="Remove gap"
                                      onClick={() =>
                                        removeResearchListItem("gaps", index)
                                      }
                                    >
                                      ×
                                    </button>
                                  </div>
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  <section className="rs-card rs-card-ops">
                      <div className="rs-card-head">
                        <h3>
                          <span className="rs-head-icon rs-head-star" aria-hidden>
                            ★
                          </span>{" "}
                          Content opportunities
                        </h3>
                        <span className="rs-count rs-count-ops">
                          {researchPack.opportunities.length} opportunities
                        </span>
                      </div>
                      <ul className="rs-compact-list">
                        {researchPack.opportunities.map((item, index) => {
                          const editing =
                            editingItem?.key === "opportunities" &&
                            editingItem.index === index;
                          return (
                            <li key={`opp-${index}`} className="rs-compact-item">
                              <span className="rs-check" aria-hidden>
                                ✓
                              </span>
                              {editing ? (
                                <div className="rs-inline-edit">
                                  <input
                                    type="text"
                                    value={editDraft}
                                    autoFocus
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        saveEditListItem();
                                      }
                                    }}
                                  />
                                  <div className="rs-inline-actions">
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm"
                                      onClick={saveEditListItem}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={cancelEditListItem}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="rs-compact-text">{item}</p>
                                  <div className="rs-item-actions">
                                    <button
                                      type="button"
                                      className="rs-icon-btn"
                                      aria-label="Edit opportunity"
                                      onClick={() =>
                                        startEditListItem("opportunities", index)
                                      }
                                    >
                                      ✎
                                    </button>
                                    <button
                                      type="button"
                                      className="rs-icon-btn"
                                      aria-label="Remove opportunity"
                                      onClick={() =>
                                        removeResearchListItem(
                                          "opportunities",
                                          index,
                                        )
                                      }
                                    >
                                      ×
                                    </button>
                                  </div>
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                </div>


                <div className="rs-add-rail">
                  <div className="rs-add-cell">
                    {addingKey === "findings" ? (
                      <div className="rs-inline-edit">
                        <input
                          type="text"
                          value={addDraft}
                          autoFocus
                          placeholder="New finding…"
                          onChange={(e) => setAddDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveAddListItem();
                            }
                          }}
                        />
                        <div className="rs-inline-actions">
                          <button type="button" className="btn btn-primary btn-sm" onClick={saveAddListItem}>Save</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={cancelAddListItem}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="rs-add-btn" onClick={() => startAddListItem("findings")}>+ Add finding</button>
                    )}
                  </div>
                  <div className="rs-add-cell">
                    {addingKey === "gaps" ? (
                      <div className="rs-inline-edit">
                        <input
                          type="text"
                          value={addDraft}
                          autoFocus
                          placeholder="New gap…"
                          onChange={(e) => setAddDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveAddListItem();
                            }
                          }}
                        />
                        <div className="rs-inline-actions">
                          <button type="button" className="btn btn-primary btn-sm" onClick={saveAddListItem}>Save</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={cancelAddListItem}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="rs-add-btn" onClick={() => startAddListItem("gaps")}>+ Add gap</button>
                    )}
                  </div>
                  <div className="rs-add-cell">
                    {addingKey === "opportunities" ? (
                      <div className="rs-inline-edit">
                        <input
                          type="text"
                          value={addDraft}
                          autoFocus
                          placeholder="New opportunity…"
                          onChange={(e) => setAddDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveAddListItem();
                            }
                          }}
                        />
                        <div className="rs-inline-actions">
                          <button type="button" className="btn btn-primary btn-sm" onClick={saveAddListItem}>Save</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={cancelAddListItem}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="rs-add-btn" onClick={() => startAddListItem("opportunities")}>+ Add opportunity</button>
                    )}
                  </div>
                </div>

                <div className="rs-support-row">
                  <section className="rs-card">
                      <div className="rs-card-head">
                        <h3>Client context</h3>
                        <span className="rs-pill rs-pill-ok">Loaded</span>
                      </div>
                      <ul className="rs-context-list">
                        <li>
                          <button
                            type="button"
                            className="rs-context-row"
                            onClick={() =>
                              setContextOpen((c) => ({
                                ...c,
                                brand: !c.brand,
                              }))
                            }
                          >
                            <span className="rs-context-ico" aria-hidden>
                              ▦
                            </span>
                            <span className="rs-context-copy">
                              <strong>Brand guidelines</strong>
                              <span>Voice, tone, messaging, style guide</span>
                            </span>
                            <span className="rs-chevron" aria-hidden>
                              {contextOpen.brand ? "▾" : "▸"}
                            </span>
                          </button>
                          {contextOpen.brand ? (
                            <p className="rs-context-detail muted">
                              {activeClient.summary ||
                                `${activeClient.name} brand voice and messaging cues from Drive.`}
                            </p>
                          ) : null}
                        </li>
                        <li>
                          <button
                            type="button"
                            className="rs-context-row"
                            onClick={() =>
                              setContextOpen((c) => ({
                                ...c,
                                audience: !c.audience,
                              }))
                            }
                          >
                            <span className="rs-context-ico" aria-hidden>
                              ◎
                            </span>
                            <span className="rs-context-copy">
                              <strong>Audience documents</strong>
                              <span>Buyer personas, pain points, use cases</span>
                            </span>
                            <span className="rs-chevron" aria-hidden>
                              {contextOpen.audience ? "▾" : "▸"}
                            </span>
                          </button>
                          {contextOpen.audience ? (
                            <p className="rs-context-detail muted">
                              {audience.trim() ||
                                `Buyers evaluating ${activeClient.industry.toLowerCase()} solutions.`}
                            </p>
                          ) : null}
                        </li>
                        <li>
                          <button
                            type="button"
                            className="rs-context-row"
                            onClick={() =>
                              setContextOpen((c) => ({
                                ...c,
                                blogs: !c.blogs,
                              }))
                            }
                          >
                            <span className="rs-context-ico" aria-hidden>
                              ≡
                            </span>
                            <span className="rs-context-copy">
                              <strong>Previous blogs</strong>
                              <span>Internal links and content themes</span>
                            </span>
                            <span className="rs-chevron" aria-hidden>
                              {contextOpen.blogs ? "▾" : "▸"}
                            </span>
                          </button>
                          {contextOpen.blogs ? (
                            <p className="rs-context-detail muted">
                              Themes around {keywords[0] || activeClient.industry.toLowerCase()}{" "}
                              and related proof points for internal linking.
                            </p>
                          ) : null}
                        </li>
                      </ul>
                    </section>
                  <section className="rs-card rs-card-sources">
                      <div className="rs-card-head">
                        <h3>Sources &amp; evidence</h3>
                      </div>
                      <ul className="rs-evidence-list rs-evidence-links">
                        {researchPack.sources.map((item, index) => (
                          <li key={`source-${index}`}>
                            <a
                              className="rs-evidence-link"
                              href={
                                /^https?:\/\//i.test(item.link)
                                  ? item.link
                                  : undefined
                              }
                              target={
                                /^https?:\/\//i.test(item.link)
                                  ? "_blank"
                                  : undefined
                              }
                              rel={
                                /^https?:\/\//i.test(item.link)
                                  ? "noreferrer"
                                  : undefined
                              }
                              onClick={(e) => {
                                if (!/^https?:\/\//i.test(item.link)) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              {item.link}
                            </a>
                            <button
                              type="button"
                              className="rs-icon-btn"
                              aria-label="Remove source"
                              onClick={() =>
                                removeResearchListItem("sources", index)
                              }
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="kw-tag-add rs-source-add">
                        <input
                          type="text"
                          value={sourceDraft}
                          placeholder="Add a source URL or file name"
                          onChange={(e) => setSourceDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addResearchSource();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={addResearchSource}
                        >
                          Add
                        </button>
                      </div>
                    </section>
                  <div className="rs-flash-stack">
                    <section className="rs-card rs-flashcard">
                      <div className="rs-card-head">
                        <h3>Used files ({researchUsedFiles.length})</h3>
                      </div>
                      {researchUsedFiles.length === 0 ? (
                        <p className="muted rs-empty-files">
                          No client files selected. Add files on Topic to enrich
                          research.
                        </p>
                      ) : (
                        <ul className="rs-file-list">
                          {researchUsedFiles.map((file) => (
                            <li key={file.id}>
                              <span className="rs-file-glyph">
                                <FileGlyph kind={file.kind} />
                              </span>
                              <span className="rs-file-meta">
                                <strong>{file.name}</strong>
                                <span>
                                  {formatFileMeta(file.updatedAt)}
                                  {file.detail ? ` · ${file.detail}` : ""}
                                </span>
                              </span>
                              <span className="rs-pill rs-pill-ok">Parsed</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                    <section className="rs-card rs-card-seo rs-flashcard">
                      <div className="rs-card-head">
                        <h3>
                          <span className="rs-head-icon rs-head-idea" aria-hidden>
                            ▤
                          </span>{" "}
                          SEO data
                        </h3>
                        <span className="rs-pill rs-pill-ok">Connected</span>
                      </div>
                      <p className="muted rs-seo-copy">
                        Search console + keyword provider data
                      </p>
                    </section>
                  </div>
                </div>

                <details
                  className="rs-notes"
                  open={notesOpen}
                  onToggle={(e) =>
                    setNotesOpen((e.target as HTMLDetailsElement).open)
                  }
                >
                  <summary>Full research notes</summary>
                  <textarea
                    className="wizard-doc"
                    rows={10}
                    value={research}
                    onChange={(e) => {
                      setResearch(e.target.value);
                      setResearchApproved(false);
                    }}
                  />
                </details>
              </div>
            ) : !researching ? (
              <EmptyState
                title="No research pack yet"
                body="Go back to Keywords and continue to generate the research summary."
              />
            ) : null}
          </>
        ) : null}

        {step === "outline" && structuredOutline ? (
          <ArticleOutlineDraftView
            outline={structuredOutline}
            authorLabel={activeClient.name}
            outlineApproved={outlineApproved}
            onTitleChange={(title) => updateOutlineMeta({ title })}
            onIntroChange={(introductionPurpose) =>
              updateOutlineMeta({ introductionPurpose })
            }
            onConclusionChange={(conclusionPurpose) =>
              updateOutlineMeta({ conclusionPurpose })
            }
            onSectionChange={updateSection}
            onApproveOutline={handleApproveOutline}
            onRegenerateOutline={regenerateOutline}
            onGenerateDraft={() => void runGenerateDraft()}
            generatingDraft={generating}
            onBack={goBack}
            onRemoveSection={removeOutlineSection}
          />
        ) : null}

        {step === "blog" && structuredOutline && article?.sections?.length ? (
          <>
            <BlogCoverImagePicker
              clientId={activeClient.id}
              featuredImageId={article.featuredImageId}
              onChange={(imageId) => {
                if (!articleId) return;
                updateBlog(articleId, { featuredImageId: imageId });
              }}
            />
            <ArticleDraftView
              ref={draftRef}
              outline={structuredOutline}
              sections={article.sections}
              authorLabel={activeClient.name}
              documentKey={`${article.id}:${article.generationToken ?? article.updatedAt}`}
              coverImageSrc={
                article.featuredImageId
                  ? getDriveItem(article.featuredImageId)?.body
                  : undefined
              }
              coverImageAlt={
                article.featuredImageId
                  ? getDriveItem(article.featuredImageId)?.name
                  : undefined
              }
              lede={
                article.lede ||
                buildDraftLede({
                  outline: structuredOutline,
                  client: activeClient,
                  audience: audience.trim() || "B2B buyers",
                  keywords,
                })
              }
              closing={
                article.closing ||
                buildDraftClosing({
                  outline: structuredOutline,
                  client: activeClient,
                  audience: audience.trim() || "B2B buyers",
                }).closing
              }
              cta={structuredOutline.cta}
              onTitleChange={(title) => {
                updateOutlineMeta({ title });
                if (articleId) updateBlog(articleId, { title });
              }}
              onDocumentChange={saveDraftDocument}
              onBack={goBack}
            />
          </>
        ) : step === "blog" ? (
          <EmptyState
            title="No draft yet"
            body="Approve the outline, then generate a draft to open the editor."
          />
        ) : null}

        {error ? <p className="field-error">{error}</p> : null}

        <div className="form-actions wizard-footer">
          {step !== "outline" && step !== "blog" ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={goBack}
              disabled={step === "topic" || generating}
            >
              Back
            </button>
          ) : null}
          {step === "blog" && articleId ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void runGenerateDraft()}
                disabled={generating || !outlineApproved}
              >
                {generating ? "Generating…" : "Regenerate draft"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={goToReview}
              >
                Review
              </button>
            </>
          ) : step === "keywords" ? (
            <div className="kw-footer-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void proceedToResearch({ skipKeywords: true })}
                disabled={generating || researching}
              >
                Skip keyword research
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void proceedToResearch()}
                disabled={generating || researching}
              >
                Continue to Research →
              </button>
            </div>
          ) : step === "research" ? (
            <div className="kw-footer-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void regenerateResearchSummary()}
                disabled={generating || researching || !researchPack}
              >
                {researching ? "Researching…" : "Regenerate summary"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={approveResearchAndContinue}
                disabled={generating || researching || !researchPack}
              >
                Approve research & continue →
              </button>
            </div>
          ) : step === "outline" ? null : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={goNext}
              disabled={generating}
            >
              {generating
                ? "Generating…"
                : step === "topic"
                  ? "Next: Keywords"
                  : "Next"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
