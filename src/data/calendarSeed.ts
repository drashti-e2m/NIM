import type { BlogPost, DraftStatus } from "../types";
import {
  approveOutline,
  buildStructuredOutline,
  defaultQualityChecks,
  generateDraftFromOutline,
  outlineToPlainText,
  suggestSeo,
} from "../services/blogGenerate";
import { readRemovedBlogIds } from "../services/storage";
import {
  dedupeSyncedBlogs,
  ensureCalendarFields,
  shouldSkipSeed,
} from "../services/blogCalendarSync";
import { getClient } from "./clients";
import { getTone } from "./tones";

/** Start of local day as ISO, offset by whole days from today. */
export function dayOffsetIso(offsetDays: number, hour = 12): string {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

function stubArticle(input: {
  id: string;
  clientId: string;
  title: string;
  topic: string;
  status: DraftStatus;
  calendarOffset: number;
  audience?: string;
  keywords?: string[];
}): BlogPost {
  const at = dayOffsetIso(input.calendarOffset);
  const keywords = input.keywords ?? ["content calendar", "blog"];
  const client = getClient(input.clientId);
  const tone =
    getTone("authoritative-plain") ??
    ({
      id: "authoritative-plain",
      name: "Authoritative & Plain-Spoken",
      status: "draft" as const,
      summary: "Clear and concrete B2B writing.",
      traits: [],
      sample: "",
    });
  const audience = input.audience ?? "B2B buyers";
  const fallbackClient = client ?? {
    id: input.clientId,
    name: input.clientId,
    website: "",
    industry: "Professional services",
    contact: "",
    city: "",
    summary: "",
    initials: input.clientId.slice(0, 2).toUpperCase(),
    color: "#555672",
    proofPoints: [
      "Buyers want concrete next steps, not vague transformation language.",
      "Proof beats promises when decisions are reviewed internally.",
      "A clear framework helps teams align before they commit.",
    ],
    createdAt: at,
  };

  const outline = approveOutline(
    buildStructuredOutline({
      topic: input.title,
      audience,
      keywords,
      client: fallbackClient,
      notes: input.topic,
      sectionCount: 6,
    }),
  );

  const draft = generateDraftFromOutline({
    outline,
    client: fallbackClient,
    tone,
    audience,
    keywords,
    notes: input.topic,
    research: `${fallbackClient.name} research notes for “${input.title}”. Focus on buyer constraints, proof, and a practical next step.`,
    targetWords: 900,
  });

  const seo = suggestSeo({
    title: draft.title || input.title,
    client: fallbackClient,
    keywords,
    notes: input.topic,
  });

  const fullBody = [draft.lede, draft.body, draft.closing, draft.cta]
    .filter(Boolean)
    .join("\n\n");

  return {
    id: input.id,
    clientId: input.clientId,
    title: draft.title || input.title,
    body: fullBody,
    toneId: tone.id,
    toneName: tone.name,
    topicMode: "manual",
    topic: input.topic,
    targetAudience: audience,
    ideaNotes: "Showcase seed article with full draft content.",
    keywords,
    primaryKeyword: keywords[0] ?? "",
    secondaryKeywords: keywords.slice(1),
    research: `${fallbackClient.name} · ${input.topic}\n\nKey angles: buyer constraint, practical framework, proof points, clear CTA.`,
    outline: outlineToPlainText(outline),
    approvedOutline: {
      ...outline,
      cta: draft.cta || outline.cta,
    },
    sections: draft.sections,
    lede: draft.lede,
    closing: draft.closing,
    versions: [],
    articlePhase:
      input.status === "approved"
        ? "approved"
        : input.status === "in_review"
          ? "in_review"
          : "draft",
    generationToken: 1,
    outlineDirtyAfterDraft: false,
    targetWords: 900,
    seoTitle: seo.seoTitle || input.title.slice(0, 60),
    seoMeta: seo.seoMeta || `Practical guidance on ${input.topic} from ${fallbackClient.name}.`,
    qualityChecks: defaultQualityChecks(),
    status: input.status,
    createdAt: at,
    updatedAt: at,
    calendarDate: at,
    calendarPinned: false,
    contentType: "SEO blog post",
    generationStatus: input.calendarOffset <= 0 ? "Completed" : "Scheduled",
  };
}

/** True when a stored seed is still the old thin calendar placeholder. */
export function isThinSeedArticle(blog: BlogPost): boolean {
  if (!(blog.id.startsWith("cal-") || blog.id.startsWith("demo-"))) return false;
  if ((blog.sections?.length ?? 0) > 0 && (blog.lede?.trim()?.length ?? 0) > 40) {
    return false;
  }
  const body = blog.body ?? "";
  return (
    body.length < 500 ||
    body.includes("Calendar entry for") ||
    body.includes("Scheduled relative to today")
  );
}

/** Stable calendar seed IDs - past, today, and upcoming. */
export const CALENDAR_SEED_IDS = [
  "cal-past-powerup-leadership",
  "cal-past-wbe-certification",
  "cal-past-crosscap-operators",
  "cal-past-pggc-networking",
  "cal-past-function-point",
  "cal-today-function-point",
  "cal-today-powerup-retention",
  "cal-today-wbe-members",
  "cal-future-wbe-buyers",
  "cal-future-crosscap-assoc",
  "cal-future-pggc-nurture",
  "cal-future-powerup-structure",
  "cal-future-function-point",
] as const;

export function createCalendarSeedArticles(): BlogPost[] {
  return [
    stubArticle({
      id: "cal-past-powerup-leadership",
      clientId: "powerup",
      title: "Is Your Leadership Team Ready to Scale?",
      topic: "Leadership readiness for growing private companies",
      status: "approved",
      calendarOffset: -9,
      audience:
        "Founders, executives, and leaders of fast-growing private companies",
      keywords: [
        "leadership team development",
        "leadership development for growing companies",
        "management development",
      ],
    }),
    stubArticle({
      id: "cal-past-wbe-certification",
      clientId: "wbe",
      title: "Certification Visibility Before the Buyer Meeting",
      topic: "Using certification as proof in supplier conversations",
      status: "approved",
      calendarOffset: -14,
      audience: "Certified women-owned suppliers",
      keywords: ["supplier diversity", "certification", "buyer introductions"],
    }),
    stubArticle({
      id: "cal-past-crosscap-operators",
      clientId: "crosscap",
      title: "Operator Outcomes Before the Capital Ask",
      topic: "Operator credibility before capital asks",
      status: "approved",
      calendarOffset: -6,
      audience: "Operators evaluating capital partners",
      keywords: ["operators", "capital", "advisory"],
    }),
    stubArticle({
      id: "cal-past-pggc-networking",
      clientId: "pggc",
      title: "Event Follow-Up That Actually Books Conversations",
      topic: "Networking playbook for association events",
      status: "in_review",
      calendarOffset: -3,
      audience: "Association and event contacts",
      keywords: ["networking", "associations", "events"],
    }),
    stubArticle({
      id: "cal-past-function-point",
      clientId: "function-point",
      title: "Why Buyers Push Back on Vague Estimates",
      topic: "Estimation education before the product conversation",
      status: "approved",
      calendarOffset: -10,
      audience: "Delivery leads evaluating estimation tools",
      keywords: ["estimation", "delivery", "predictability"],
    }),
    stubArticle({
      id: "cal-today-function-point",
      clientId: "function-point",
      title: "From Education Sequence to Demo Request",
      topic: "Predictable delivery without false guarantees",
      status: "in_review",
      calendarOffset: 0,
      audience: "Delivery leads evaluating estimation tools",
      keywords: ["estimation", "delivery", "predictability"],
    }),
    stubArticle({
      id: "cal-today-powerup-retention",
      clientId: "powerup",
      title: "Keeping High Performers When Teams Scale Fast",
      topic: "Talent retention for growing leadership teams",
      status: "draft",
      calendarOffset: 0,
      audience:
        "Founders, executives, and leaders of fast-growing private companies",
      keywords: [
        "talent retention",
        "leadership team development",
        "manager readiness",
      ],
    }),
    stubArticle({
      id: "cal-today-wbe-members",
      clientId: "wbe",
      title: "Quarterly Touchpoints That Keep Members Engaged",
      topic: "Member re-engagement without a hard sell",
      status: "in_review",
      calendarOffset: 0,
      audience: "Women-owned suppliers seeking introductions",
      keywords: ["member growth", "buyer introductions", "events"],
    }),
    stubArticle({
      id: "cal-future-wbe-buyers",
      clientId: "wbe",
      title: "How Members Prepare for the Next Buyer Window",
      topic: "Quarterly buyer introduction cadence",
      status: "draft",
      calendarOffset: 5,
      audience: "Women-owned suppliers seeking introductions",
      keywords: ["buyer introductions", "member growth", "networking"],
    }),
    stubArticle({
      id: "cal-future-crosscap-assoc",
      clientId: "crosscap",
      title: "Association Presence That Reaches Named Accounts",
      topic: "Tracking association events against target accounts",
      status: "draft",
      calendarOffset: 11,
      audience: "Operators evaluating capital and advisory partners",
      keywords: ["associations", "target accounts", "nurture"],
    }),
    stubArticle({
      id: "cal-future-pggc-nurture",
      clientId: "pggc",
      title: "From First Touch to a Booked Intro Call",
      topic: "Email nurture for association leads",
      status: "draft",
      calendarOffset: 18,
      audience: "Association contacts who can open warm introductions",
      keywords: ["email nurture", "associations", "intro calls"],
    }),
    stubArticle({
      id: "cal-future-powerup-structure",
      clientId: "powerup",
      title: "Has Your Leadership Structure Kept Pace With Growth?",
      topic: "Leadership structure review after expansion or acquisition",
      status: "draft",
      calendarOffset: 24,
      audience:
        "Founders, executives, and leaders of fast-growing private companies",
      keywords: [
        "leadership structure",
        "post-acquisition leadership",
        "team alignment",
      ],
    }),
    stubArticle({
      id: "cal-future-function-point",
      clientId: "function-point",
      title: "A Short Education Path Into Product Conversations",
      topic: "Blog and email into estimation conversations",
      status: "draft",
      calendarOffset: 16,
      audience: "Delivery leads evaluating estimation tools",
      keywords: ["buyer education", "product conversation", "estimation"],
    }),
  ];
}

const OBSOLETE_DEMO_IDS = new Set([
  "demo-powerup-leadership-scale",
  "demo-wbe-certification-conversations",
  "demo-crosscap-operator-credibility",
  "demo-function-point-estimation-clarity",
  "demo-pggc-networking-playbook",
]);

function stripDemoMode(blog: BlogPost): BlogPost {
  if (!blog.demoMode) return blog;
  const { demoMode: _removed, ...rest } = blog;
  return rest;
}

/**
 * Merge calendar seed articles into stored blogs, then dedupe so Library and
 * Calendar always share one synced BlogPost per piece of work.
 */
export function withCalendarSeeds(existing: BlogPost[]): BlogPost[] {
  const removed = new Set(readRemovedBlogIds());
  const seeds = createCalendarSeedArticles().filter(
    (seed) => !removed.has(seed.id),
  );
  const merged = existing
    .filter(
      (blog) => !OBSOLETE_DEMO_IDS.has(blog.id) && !removed.has(blog.id),
    )
    .map(stripDemoMode)
    .map(ensureCalendarFields);
  const byId = new Map(merged.map((blog) => [blog.id, blog]));

  for (const seed of seeds) {
    if (removed.has(seed.id)) continue;
    if (shouldSkipSeed(seed, merged)) continue;

    if (!byId.has(seed.id)) {
      const next = ensureCalendarFields(seed);
      merged.unshift(next);
      byId.set(seed.id, next);
      continue;
    }

    const index = merged.findIndex((blog) => blog.id === seed.id);
    if (index < 0) continue;
    const current = merged[index];

    // Upgrade old thin stubs to full showcase articles (keep date/status edits).
    if (isThinSeedArticle(current)) {
      merged[index] = ensureCalendarFields({
        ...seed,
        calendarDate: current.calendarPinned
          ? current.calendarDate || seed.calendarDate
          : seed.calendarDate,
        calendarPinned: current.calendarPinned,
        status: current.status,
        articlePhase:
          current.status === "approved"
            ? "approved"
            : current.status === "in_review"
              ? "in_review"
              : seed.articlePhase,
      });
      continue;
    }

    // Never wipe rich user edits. Only re-anchor the schedule when unpinned.
    if (current.calendarPinned) continue;
    merged[index] = ensureCalendarFields({
      ...current,
      calendarDate: seed.calendarDate,
      generationStatus: seed.generationStatus,
    });
  }

  return dedupeSyncedBlogs(merged);
}
