import type { BlogPost, DraftStatus } from "../types";
import { defaultQualityChecks } from "../services/blogGenerate";
import { readRemovedBlogIds } from "../services/storage";

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
  body?: string;
}): BlogPost {
  const at = dayOffsetIso(input.calendarOffset);
  const keywords = input.keywords ?? ["content calendar", "blog"];
  return {
    id: input.id,
    clientId: input.clientId,
    title: input.title,
    body:
      input.body ??
      `${input.title}\n\nCalendar entry for ${input.clientId}. Scheduled relative to today so past, current, and future months stay populated.`,
    toneId: "authoritative-plain",
    toneName: "Authoritative & Plain-Spoken",
    topicMode: "manual",
    topic: input.topic,
    targetAudience: input.audience ?? "B2B buyers",
    ideaNotes: "Calendar seed content.",
    keywords,
    primaryKeyword: keywords[0] ?? "",
    secondaryKeywords: keywords.slice(1),
    research: "Research pack for calendar planning.",
    outline: `Outline - ${input.title}`,
    approvedOutline: null,
    sections: [],
    lede: "",
    closing: "",
    versions: [],
    articlePhase:
      input.status === "approved"
        ? "approved"
        : input.status === "in_review"
          ? "in_review"
          : "draft",
    generationToken: 1,
    outlineDirtyAfterDraft: false,
    targetWords: 800,
    seoTitle: input.title.slice(0, 60),
    seoMeta: `Calendar item: ${input.topic}`,
    qualityChecks: defaultQualityChecks(),
    status: input.status,
    createdAt: at,
    updatedAt: at,
    calendarDate: at,
    contentType: "SEO blog post",
    generationStatus: input.calendarOffset <= 0 ? "Completed" : "Scheduled",
  };
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
      status: "draft",
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

/** Merge calendar seed articles into stored blogs without wiping user work. */
export function withCalendarSeeds(existing: BlogPost[]): BlogPost[] {
  const removed = new Set(readRemovedBlogIds());
  const seeds = createCalendarSeedArticles().filter(
    (seed) => !removed.has(seed.id),
  );
  const merged = existing
    .filter(
      (blog) => !OBSOLETE_DEMO_IDS.has(blog.id) && !removed.has(blog.id),
    )
    .map(stripDemoMode);
  const byId = new Map(merged.map((blog) => [blog.id, blog]));

  for (const seed of seeds) {
    if (removed.has(seed.id)) continue;
    if (!byId.has(seed.id)) {
      merged.unshift(seed);
      byId.set(seed.id, seed);
      continue;
    }
    const index = merged.findIndex((blog) => blog.id === seed.id);
    if (index < 0) continue;
    const current = merged[index];
    // Always re-anchor seed schedule to the current local day so
    // "Due today" / calendar buckets move forward every day.
    if (!current.body || current.body.length < 200) {
      merged[index] = seed;
    } else {
      merged[index] = {
        ...current,
        calendarDate: seed.calendarDate,
        generationStatus: seed.generationStatus,
      };
    }
  }

  return merged;
}
