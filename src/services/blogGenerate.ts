import type {
  ApprovedOutline,
  ArticleSectionContent,
  Client,
  ConsistencyIssue,
  OutlineSectionSpec,
  QualityCheckItem,
  TopicMode,
  ToneOfVoice,
} from "../types";
import { formatToneInstructions } from "../data/tones";
import { wordCount } from "../format";

export { formatToneInstructions };

export const WORD_TARGETS = [500, 800, 1200, 1500, 2000] as const;

export const DEFAULT_QUALITY_CHECKS: Omit<QualityCheckItem, "checked">[] = [
  { id: "brief-fit", label: "Draft matches the topic, keywords, and brief notes" },
  { id: "no-repetition", label: "Sections serve distinct purposes (little repetition)" },
  { id: "claims-check", label: "Claims are supportable; no invented facts or guarantees" },
  { id: "tone-fit", label: "Voice matches the selected brand tone profile" },
  { id: "seo-basics", label: "SEO title and meta description are clear and accurate" },
  { id: "cta-clear", label: "Next step / CTA is explicit and client-appropriate" },
];

export function defaultQualityChecks(): QualityCheckItem[] {
  return DEFAULT_QUALITY_CHECKS.map((item) => ({ ...item, checked: false }));
}

export function suggestSeo(input: {
  title: string;
  client: Client;
  keywords: string[];
  notes: string;
}): { seoTitle: string; seoMeta: string } {
  const primary = input.keywords[0] ?? input.client.industry;
  const seoTitle = `${input.title} | ${input.client.name}`.slice(0, 60);
  const angle =
    input.notes.trim().slice(0, 90) ||
    `Practical guidance on ${primary} for ${input.client.industry.toLowerCase()} buyers.`;
  const seoMeta = `${angle} From ${input.client.name}.`.slice(0, 155);
  return { seoTitle, seoMeta };
}

export function autoTopicFor(client: Client): string {
  return `How ${client.name} helps buyers move from problem to a clear next step`;
}

export function suggestKeywords(topic: string, client: Client): string[] {
  const base = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 4);
  return Array.from(
    new Set([
      ...base,
      client.name.toLowerCase(),
      "buyer journey",
      "b2b content",
      `${client.industry.toLowerCase()} strategy`,
    ]),
  ).slice(0, 8);
}

export function buildResearch(input: {
  client: Client;
  topic: string;
  notes: string;
  keywords: string[];
}): string {
  return [
    `Research pack — ${input.topic}`,
    "",
    `Client: ${input.client.name}`,
    `Industry: ${input.client.industry}`,
    "",
    "Audience signals",
    `- Buyers evaluating ${input.client.industry.toLowerCase()} options`,
    "- They want concrete proof, not vague transformation language",
    input.notes.trim()
      ? `- Brief notes: ${input.notes.trim()}`
      : "- No extra notes provided",
    "",
    "Keyword themes",
    ...input.keywords.map((keyword) => `- ${keyword}`),
    "",
    "Proof to reuse",
    ...input.client.proofPoints.map((point) => `- ${point}`),
    "",
    "Sources (simulated)",
    "- Client Drive materials",
    "- Category search demand patterns",
    "- Competitor messaging gaps",
  ].join("\n");
}

function sectionId(order: number): string {
  return `sec-${order + 1}`;
}

function defaultSectionBlueprints(
  keywords: string[],
  count = 7,
): Omit<OutlineSectionSpec, "id" | "order">[] {
  const primary = keywords[0] || "the buyer journey";
  const secondary = keywords[1] || "proof";
  const tertiary = keywords[2] || "evaluation criteria";
  const all: Omit<OutlineSectionSpec, "id" | "order">[] = [
    {
      heading: "Name the buyer situation",
      keyPoints: [
        "Open on the live constraint the buyer already feels",
        `Connect the topic directly to ${primary}`,
        "State why this matters now — not in a vague future",
      ],
      evidenceRequired: ["Buyer situation framed without invented ROI claims"],
      transitionToNext: "Move from the situation into why generic approaches stall.",
    },
    {
      heading: "Why the usual approach stalls",
      keyPoints: [
        "Call out generic category advice that fails in practice",
        "Show where vague claims lose trust mid-evaluation",
        `Explain how ${secondary} is usually mishandled`,
      ],
      evidenceRequired: ["Contrast with category noise, not competitor smears"],
      transitionToNext: "Introduce the constraints that actually shape the decision.",
    },
    {
      heading: "Buyer constraints that shape the decision",
      keyPoints: [
        "List the operational, risk, and change-management constraints",
        "Separate must-haves from nice-to-haves",
        `Map constraints back to ${tertiary}`,
      ],
      evidenceRequired: ["Constraints stay qualitative unless client proof provides numbers"],
      transitionToNext: "Turn constraints into a checkable framework.",
    },
    {
      heading: "A practical evaluation framework",
      keyPoints: [
        "Give a step-by-step sequence the buyer can run",
        "Keep each step concrete and owner-clear",
        `Anchor every step to ${primary}`,
      ],
      evidenceRequired: ["Process language only — no fabricated case metrics"],
      transitionToNext: "Show how proof is applied inside the framework.",
    },
    {
      heading: "Proof that earns trust",
      keyPoints: [
        "Lead with verifiable proof, not slogans",
        "Show how proof maps to each framework step",
        "Reject unsupported guarantees in plain language",
      ],
      evidenceRequired: ["Client-approved proof points only"],
      transitionToNext: "Translate proof into implementation guidance.",
    },
    {
      heading: "How to put the framework to work",
      keyPoints: [
        "Give a first-week implementation checklist",
        "Call out common failure modes and how to avoid them",
        `Tie the checklist to ${secondary} and ${primary}`,
      ],
      evidenceRequired: ["Implementation steps stay actionable and non-metric unless proven"],
      transitionToNext: "Help the buyer compare options without a feature dump.",
    },
    {
      heading: "How to compare options without noise",
      keyPoints: [
        "Offer a short vendor / approach comparison lens",
        "Prioritize fit, risk, and proof quality over feature count",
        "Leave the reader with one clear decision question",
      ],
      evidenceRequired: ["Comparison language stays fair and non-defamatory"],
      transitionToNext: "Close with the decision restatement and CTA.",
    },
  ];
  return all.slice(0, Math.max(3, Math.min(count, all.length)));
}

/** Build a structured, editable outline (source of truth before draft generation). */
export function buildStructuredOutline(input: {
  topic: string;
  audience: string;
  keywords: string[];
  client: Client;
  notes: string;
  sectionCount?: number;
}): ApprovedOutline {
  const title = input.topic.trim() || autoTopicFor(input.client);
  const blueprints = defaultSectionBlueprints(
    input.keywords,
    input.sectionCount ?? 7,
  );
  const sections: OutlineSectionSpec[] = blueprints.map((spec, index) => ({
    ...spec,
    id: sectionId(index),
    order: index,
  }));

  const primary = input.keywords[0] || input.client.industry.toLowerCase();
  return {
    title,
    introductionPurpose: `Open by naming the live constraint behind “${title}” for ${input.audience || "the buyer"}. Set expectations that this piece will move from problem → framework → proof → next step in ${input.client.name}’s voice, centered on ${primary}.`,
    sections,
    conclusionPurpose: `Restate the decision in plain language for ${input.audience || "the reader"}, remind them what to check before they commit, and leave one clear next step.`,
    cta: `Book a conversation with ${input.client.name} to apply this framework to your ${primary} evaluation.`,
    approved: false,
    approvedAt: null,
  };
}

export function outlineToPlainText(outline: ApprovedOutline): string {
  return [
    `Outline — ${outline.title}`,
    `Introduction: ${outline.introductionPurpose}`,
    "",
    ...outline.sections.flatMap((section, index) => [
      `${index + 1}. ${section.heading} [${section.id}]`,
      ...section.keyPoints.map((point) => `   - ${point}`),
      ...section.evidenceRequired.map((item) => `   · Evidence: ${item}`),
      section.transitionToNext
        ? `   → Transition: ${section.transitionToNext}`
        : "",
      "",
    ]),
    `Conclusion: ${outline.conclusionPurpose}`,
    `CTA: ${outline.cta}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** @deprecated Prefer buildStructuredOutline + outlineToPlainText */
export function buildOutline(input: {
  topic: string;
  keywords: string[];
  targetWords: number;
  audience?: string;
  client?: Client;
  notes?: string;
}): string {
  const client =
    input.client ??
    ({
      id: "tmp",
      name: "Client",
      website: "",
      industry: "General",
      contact: "",
      city: "",
      summary: "",
      initials: "CL",
      color: "#555672",
      proofPoints: [],
      createdAt: "",
    } satisfies Client);
  const structured = buildStructuredOutline({
    topic: input.topic,
    audience: input.audience || "B2B buyers",
    keywords: input.keywords,
    client,
    notes: input.notes || "",
    sectionCount: input.targetWords >= 1500 ? 7 : 6,
  });
  return outlineToPlainText(structured);
}

export function sectionsToBody(sections: ArticleSectionContent[]): string {
  return [...sections]
    .sort((a, b) => a.order - b.order)
    .map((section) => `${section.heading}\n\n${section.body.trim()}\n`)
    .join("\n")
    .trim();
}

export function bodyFromArticle(sections: ArticleSectionContent[]): string {
  return sectionsToBody(sections);
}

function preferredCue(tone: ToneOfVoice, index: number): string {
  const phrases = (tone.preferredPhrases ?? []).filter(Boolean);
  if (!phrases.length) return "";
  return phrases[index % phrases.length];
}

function coverKeyPoint(input: {
  point: string;
  client: Client;
  tone: ToneOfVoice;
  keyword: string;
  notes: string;
  index: number;
}): string {
  const proof =
    input.client.proofPoints[input.index % Math.max(input.client.proofPoints.length, 1)] ||
    `${input.client.name} stays specific about buyer constraints.`;
  const cue = preferredCue(input.tone, input.index);
  if (input.point.toLowerCase().includes("proof") || input.point.toLowerCase().includes("evidence")) {
    return `${cue ? `${cue} ` : ""}Evidence belongs next to the claim. ${input.point.replace(/\.$/, "")} — and ${proof} Label examples as illustration, not a guarantee buyers can paste into a business case.`;
  }
  if (input.index === 0 && input.notes.trim()) {
    return `${input.point.replace(/\.$/, "")}. ${input.notes.trim().slice(0, 140)} That framing keeps the section useful for buyers evaluating ${input.keyword}.`;
  }
  if (input.index === 0) {
    const sample = (input.tone.sampleCopy || input.tone.sample).trim();
    return `${input.point.replace(/\.$/, "")}. ${sample} Readers should leave this beat with a clearer sense of the problem, not a feature tour.`;
  }
  return `${cue ? `${cue} ` : ""}${input.point.replace(/\.$/, "")}. For teams weighing ${input.keyword}, ${input.client.name} keeps the guidance practical: ${proof}`;
}

/** Opening paragraphs for the draft blog (derived from the approved outline). */
export function buildDraftLede(input: {
  outline: ApprovedOutline;
  client: Client;
  audience: string;
  keywords: string[];
  tone?: ToneOfVoice;
}): string {
  const keyword = input.keywords[0] || input.client.industry.toLowerCase();
  const audience = input.audience.trim() || "buyers";
  const firstHeading = input.outline.sections[0]?.heading || keyword;
  const cue = input.tone ? preferredCue(input.tone, 0) : "";
  const open = cue
    ? `${cue} ${audience} evaluating “${input.outline.title}” rarely need another abstract overview.`
    : `${audience} evaluating “${input.outline.title}” rarely need another abstract overview.`;
  return [
    `${open} They need a clear read on the constraint they are already living with — and a path that ${input.client.name} can stand behind without invented ROI claims.`,
    `This piece walks from the live buyer situation through a practical framework, proof you can check, and one next step. We start with ${firstHeading.toLowerCase()}, stay centered on ${keyword}, and keep every claim specific enough to defend internally.`,
  ].join("\n\n");
}

/** Closing paragraphs + CTA for the draft blog. */
export function buildDraftClosing(input: {
  outline: ApprovedOutline;
  client: Client;
  audience: string;
  tone?: ToneOfVoice;
}): { closing: string; cta: string } {
  const audience = input.audience.trim() || "readers";
  const closing = [
    `If you take one thing from this article, let it be this: ${audience} decide faster when the problem, the proof, and the next step sit in the same plain language. ${input.client.name} would rather leave you with a checkable decision than a longer checklist of vague promises.`,
    input.outline.conclusionPurpose.trim()
      ? `Before you commit, restate the decision in your own words and confirm what must be true in the next 30 days. ${input.outline.conclusionPurpose.trim().replace(/^Restate[^.]*\.\s*/i, "")}`
      : `Before you commit, restate the decision in your own words and confirm what must be true in the next 30 days.`,
  ].join("\n\n");
  return {
    closing,
    cta: input.outline.cta.trim() || `Talk with ${input.client.name} about applying this framework to your evaluation.`,
  };
}

/**
 * Generate draft sections strictly from an approved outline.
 * Preserves section IDs and order; covers every key point with blog prose.
 */
export function generateDraftFromOutline(input: {
  outline: ApprovedOutline;
  client: Client;
  tone: ToneOfVoice;
  audience: string;
  keywords: string[];
  notes: string;
  research: string;
  targetWords: number;
}): {
  title: string;
  sections: ArticleSectionContent[];
  body: string;
  lede: string;
  closing: string;
  cta: string;
} {
  if (!input.outline.approved) {
    throw new Error("Cannot generate draft: outline is not approved.");
  }

  const toneBrief = formatToneInstructions(input.tone);
  const keyword = input.keywords[0] || input.client.industry.toLowerCase();
  const secondary = input.keywords[1] || "practical proof";
  const ordered = [...input.outline.sections].sort((a, b) => a.order - b.order);
  const target = Math.max(1100, input.targetWords);
  const perSection = Math.max(
    130,
    Math.floor((target - 120) / Math.max(ordered.length, 1)),
  );
  const ruleHint =
    (input.tone.writingRules ?? []).find(Boolean)?.replace(/\.$/, "") ||
    "Lead with the point, then support it";
  const openCue = preferredCue(input.tone, 0);

  const lede = buildDraftLede({
    outline: input.outline,
    client: input.client,
    audience: input.audience,
    keywords: input.keywords,
    tone: input.tone,
  });
  const { closing, cta } = buildDraftClosing({
    outline: input.outline,
    client: input.client,
    audience: input.audience,
    tone: input.tone,
  });

  const sections: ArticleSectionContent[] = ordered.map((spec, index) => {
    const proof =
      input.client.proofPoints[index % Math.max(input.client.proofPoints.length, 1)] ||
      `${input.client.name} stays specific about buyer constraints.`;
    const sectionCue = preferredCue(input.tone, index + 1);
    const paragraphs: string[] = [
      `${openCue && index === 0 ? `${openCue} ` : ""}${spec.heading} is where ${input.audience || "buyers"} usually get stuck — not because they lack options, but because most advice stays generic. ${input.client.name} starts here on purpose: name the real constraint, then move.`,
      `${sectionCue ? `${sectionCue} ` : ""}When teams evaluate ${keyword}, the conversation often drifts into feature lists and vague transformation language. ${ruleHint}. Ask what must be true in the next 30 days, then test every claim against that bar.`,
    ];

    for (const [pointIndex, point] of spec.keyPoints.entries()) {
      paragraphs.push(
        coverKeyPoint({
          point,
          client: input.client,
          tone: input.tone,
          keyword,
          notes: [input.notes, toneBrief].filter(Boolean).join("\n\n"),
          index: pointIndex,
        }),
      );
    }

    paragraphs.push(
      `In practice, ${secondary} only helps when it is concrete enough to check. ${proof} That is the difference between a polished narrative and a decision buyers can defend internally.`,
    );

    if (spec.transitionToNext) {
      paragraphs.push(spec.transitionToNext);
    }

    let i = 0;
    const maxExpand = Math.max(8, Math.ceil(perSection / 36));
    while (wordCount(paragraphs.join(" ")) < perSection - 16 && i < maxExpand) {
      const point =
        spec.keyPoints[i % Math.max(spec.keyPoints.length, 1)] || spec.heading;
      const expandCue = preferredCue(input.tone, i + index);
      paragraphs.push(
        i % 2 === 0
          ? `${expandCue ? `${expandCue} ` : ""}A useful check for “${point}” is whether ${input.audience || "the buyer"} can explain it to a peer without slides. If they cannot, the section is still too abstract.`
          : `${input.client.name}’s stance on ${keyword} is simple: prefer one clear next step over five optional ideas. Revisit “${point}” until that bar is met.`,
      );
      i += 1;
    }

    return {
      sectionId: spec.id,
      order: spec.order,
      heading: spec.heading,
      body: paragraphs.join("\n\n"),
      keyPointsCovered: [...spec.keyPoints],
    };
  });

  let guard = 0;
  while (wordCount(sectionsToBody(sections)) < target * 0.85 && guard < 90) {
    const index = guard % sections.length;
    const spec = ordered[index];
    const point =
      spec.keyPoints[guard % Math.max(spec.keyPoints.length, 1)] || spec.heading;
    const proof =
      input.client.proofPoints[guard % Math.max(input.client.proofPoints.length, 1)] ||
      `${input.client.name} stays concrete.`;
    sections[index] = {
      ...sections[index],
      body: `${sections[index].body}\n\nOne more pass on “${point}”: ${proof} Write it so ${input.audience || "buyers"} can act this week without inventing numbers or guarantees.`,
    };
    guard += 1;
  }

  const title = input.outline.title;
  const body = sectionsToBody(sections);
  return { title, sections, body, lede, closing, cta };
}

/** Legacy wrapper used by older wizard paths — still requires outline text. */
export function buildBlogDraft(input: {
  client: Client;
  tone: ToneOfVoice;
  topic: string;
  notes: string;
  keywords: string[];
  research: string;
  outline: string;
  targetWords: number;
  mode: TopicMode;
  audience?: string;
  approvedOutline?: ApprovedOutline | null;
}): {
  title: string;
  body: string;
  sections: ArticleSectionContent[];
  lede: string;
  closing: string;
  cta: string;
} {
  const outline =
    input.approvedOutline?.approved
      ? input.approvedOutline
      : approveOutline(
          buildStructuredOutline({
            topic: input.topic,
            audience: input.audience || "B2B buyers",
            keywords: input.keywords,
            client: input.client,
            notes: input.notes,
          }),
        );

  return generateDraftFromOutline({
    outline,
    client: input.client,
    tone: input.tone,
    audience: input.audience || "B2B buyers",
    keywords: input.keywords,
    notes: input.notes,
    research: input.research,
    targetWords: input.targetWords,
  });
}

export function approveOutline(outline: ApprovedOutline): ApprovedOutline {
  return {
    ...outline,
    approved: true,
    approvedAt: new Date().toISOString(),
  };
}

export function buildBlogPackage(input: {
  client: Client;
  tone: ToneOfVoice;
  topic: string;
  notes: string;
  keywords: string[];
  research: string;
  outline: string;
  targetWords: number;
  mode: TopicMode;
  audience?: string;
  approvedOutline?: ApprovedOutline | null;
}) {
  const draft = buildBlogDraft(input);
  const seo = suggestSeo({
    title: draft.title,
    client: input.client,
    keywords: input.keywords,
    notes: input.notes,
  });
  return {
    ...draft,
    ...seo,
    qualityChecks: defaultQualityChecks(),
  };
}

export function checkOutlineConsistency(
  outline: ApprovedOutline | null | undefined,
  sections: ArticleSectionContent[],
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  if (!outline || !outline.sections.length) {
    issues.push({
      id: "no-outline",
      severity: "error",
      code: "missing_section",
      message: "No approved outline is linked to this article.",
      action: "Return to the wizard, generate an outline, and approve it before drafting.",
    });
    return issues;
  }

  const expected = [...outline.sections].sort((a, b) => a.order - b.order);
  const actual = [...sections].sort((a, b) => a.order - b.order);
  const actualById = new Map(actual.map((s) => [s.sectionId, s]));

  for (const spec of expected) {
    const found = actualById.get(spec.id);
    if (!found) {
      issues.push({
        id: `missing-${spec.id}`,
        severity: "error",
        code: "missing_section",
        sectionId: spec.id,
        message: `Missing outline section “${spec.heading}” (${spec.id}).`,
        action: "Regenerate the draft from the approved outline or restore this section.",
      });
      continue;
    }
    if (found.heading.trim() !== spec.heading.trim()) {
      issues.push({
        id: `heading-${spec.id}`,
        severity: "warning",
        code: "unexpected_heading",
        sectionId: spec.id,
        message: `Heading changed from “${spec.heading}” to “${found.heading}”.`,
        action: "Revert the heading or explicitly approve the editorial change.",
      });
    }
    for (const point of spec.keyPoints) {
      const covered =
        found.keyPointsCovered.some((p) => p.toLowerCase() === point.toLowerCase()) ||
        found.body.toLowerCase().includes(point.toLowerCase().slice(0, 24));
      if (!covered) {
        issues.push({
          id: `point-${spec.id}-${point.slice(0, 12)}`,
          severity: "warning",
          code: "missing_key_point",
          sectionId: spec.id,
          message: `Key point not clearly covered in “${spec.heading}”: ${point}`,
          action: "Add a bullet or paragraph that addresses this outline point.",
        });
      }
    }
    if (!found.body.toLowerCase().includes("transition") && spec.transitionToNext) {
      issues.push({
        id: `transition-${spec.id}`,
        severity: "warning",
        code: "weak_transition",
        sectionId: spec.id,
        message: `Weak or missing transition out of “${spec.heading}”.`,
        action: `Add a bridge toward: ${spec.transitionToNext}`,
      });
    }
  }

  for (let i = 0; i < Math.min(expected.length, actual.length); i++) {
    if (actual[i].sectionId !== expected[i].id) {
      issues.push({
        id: `order-${i}`,
        severity: "error",
        code: "order_changed",
        message: `Section order diverges at position ${i + 1}: expected “${expected[i].heading}”, found “${actual[i].heading}”.`,
        action: "Reorder sections to match the approved outline.",
      });
      break;
    }
  }

  for (const section of actual) {
    if (!expected.some((s) => s.id === section.sectionId)) {
      issues.push({
        id: `unexpected-${section.sectionId}`,
        severity: "warning",
        code: "unexpected_heading",
        sectionId: section.sectionId,
        message: `Unexpected section “${section.heading}” is not in the approved outline.`,
        action: "Remove it or update and re-approve the outline.",
      });
    }
  }

  // Repetition: near-identical openings across sections
  for (let i = 0; i < actual.length; i++) {
    for (let j = i + 1; j < actual.length; j++) {
      const a = actual[i].body.slice(0, 80).toLowerCase();
      const b = actual[j].body.slice(0, 80).toLowerCase();
      if (a && a === b) {
        issues.push({
          id: `rep-${actual[i].sectionId}-${actual[j].sectionId}`,
          severity: "warning",
          code: "repetitive_section",
          message: `Sections “${actual[i].heading}” and “${actual[j].heading}” open with the same copy.`,
          action: "Differentiate the openings so each section advances the argument.",
        });
      }
    }
  }

  // Unsupported claims heuristic
  const claimPattern =
    /\b(\d+\s*%|guarantee[ds]?|always works|#1|fastest|best-in-class|proven to)\b/i;
  for (const section of actual) {
    if (claimPattern.test(section.body)) {
      issues.push({
        id: `claim-${section.sectionId}`,
        severity: "warning",
        code: "unsupported_claim",
        sectionId: section.sectionId,
        message: `Possible unsupported claim language in “${section.heading}”.`,
        action: "Remove invented metrics/guarantees or cite an approved source document.",
      });
    }
  }

  return issues;
}

/** Parse plain body back into sections using approved outline IDs when possible. */
export function hydrateSectionsFromBody(
  body: string,
  outline: ApprovedOutline | null,
): ArticleSectionContent[] {
  if (!outline?.sections.length) {
    return [
      {
        sectionId: "sec-1",
        order: 0,
        heading: "Article",
        body: body.trim(),
        keyPointsCovered: [],
      },
    ];
  }

  const ordered = [...outline.sections].sort((a, b) => a.order - b.order);
  const lines = body.split(/\n/);
  const headingIndex = new Map<string, number>();
  ordered.forEach((spec) => {
    const idx = lines.findIndex((line) => line.trim() === spec.heading.trim());
    if (idx >= 0) headingIndex.set(spec.id, idx);
  });

  return ordered.map((spec) => {
    const start = headingIndex.get(spec.id);
    if (start === undefined) {
      return {
        sectionId: spec.id,
        order: spec.order,
        heading: spec.heading,
        body: "",
        keyPointsCovered: [],
      };
    }
    let end = lines.length;
    for (const other of ordered) {
      if (other.order <= spec.order) continue;
      const otherStart = headingIndex.get(other.id);
      if (otherStart !== undefined && otherStart > start) {
        end = Math.min(end, otherStart);
      }
    }
    const sectionBody = lines
      .slice(start + 1, end)
      .join("\n")
      .trim();
    return {
      sectionId: spec.id,
      order: spec.order,
      heading: spec.heading,
      body: sectionBody,
      keyPointsCovered: spec.keyPoints.filter((point) =>
        sectionBody.toLowerCase().includes(point.toLowerCase().slice(0, 20)),
      ),
    };
  });
}

export function emptyArticleDefaults(): Pick<
  import("../types").BlogPost,
  | "targetAudience"
  | "primaryKeyword"
  | "secondaryKeywords"
  | "approvedOutline"
  | "sections"
  | "lede"
  | "closing"
  | "versions"
  | "articlePhase"
  | "generationToken"
  | "outlineDirtyAfterDraft"
> {
  return {
    targetAudience: "B2B buyers",
    primaryKeyword: "",
    secondaryKeywords: [],
    approvedOutline: null,
    sections: [],
    lede: "",
    closing: "",
    versions: [],
    articlePhase: "outline",
    generationToken: 0,
    outlineDirtyAfterDraft: false,
  };
}
