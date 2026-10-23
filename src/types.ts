export type Stage = "awareness" | "consideration" | "decision";

export type DraftStatus = "draft" | "in_review" | "approved";

export type Format =
  | "Blog Post"
  | "Social Media Post"
  | "Whitepaper"
  | "Checklist"
  | "How-To Video"
  | "Kit or Tool"
  | "Ebook or Tip Sheet"
  | "Educational Webinar"
  | "Email nurturing sequence"
  | "Product comparison guide"
  | "Case study"
  | "Videos"
  | "Video demo"
  | "Original research and reports"
  | "Podcasts and webinars"
  | "Product brochures, data sheets"
  | "Service / support / implementation sheets"
  | "Pricing information"
  | "FAQs"
  | "Analyst reports"
  | "Free trial / live demo"
  | "Consultation";

export type DriveKind = "folder" | "doc" | "sheet" | "pdf" | "image";

export type UsageCategory = "llm" | "seo" | "research";

export type TopicMode = "manual" | "describe" | "auto";

export interface Client {
  id: string;
  name: string;
  website: string;
  industry: string;
  contact: string;
  city: string;
  summary: string;
  initials: string;
  color: string;
  proofPoints: string[];
  createdAt: string;
  /** Preferred brand voice for this client’s blog generation. */
  preferredToneId?: string;
}

export interface Brief {
  format: Format;
  persona: string;
  tone: string;
  goal: string;
  keywords: string;
  cta: string;
  instructions: string;
}

export interface DriveItem {
  id: string;
  clientId: string;
  parentId: string | null;
  name: string;
  kind: DriveKind;
  updatedAt: string;
  detail?: string;
  body?: string;
}

export interface TopicSuggestion {
  id: string;
  title: string;
  angle: string;
}

export interface Draft {
  id: string;
  clientId: string;
  title: string;
  body: string;
  status: DraftStatus;
  stage: Stage;
  topicId: string;
  topicTitle: string;
  topicAngle: string;
  brief: Brief;
  variant: number;
  createdAt: string;
  updatedAt: string;
}

export type DraftInput = Omit<Draft, "id" | "createdAt" | "updatedAt">;

export type ToneStatus = "approved" | "draft";

export type ToneIcon =
  | "hearts"
  | "diamonds"
  | "bolt"
  | "compass"
  | "spark"
  | "target";

export interface ToneOfVoice {
  id: string;
  name: string;
  summary: string;
  traits: string[];
  /** Short sample line shown on tone cards. */
  sample: string;
  /** Approved library tones vs work-in-progress profiles. */
  status?: ToneStatus;
  /** Display label for which client/brand this tone belongs to. */
  clientLabel?: string;
  icon?: ToneIcon;
  writingRules?: string[];
  preferredPhrases?: string[];
  avoidedPhrases?: string[];
  /** Longer sample paragraph for the detail panel and LLM style reference. */
  sampleCopy?: string;
  /**
   * When this tone fits best (writer-facing guidance).
   * Used in the UI; optional in the generation prompt.
   */
  bestFor?: string;
}

export interface UsageEvent {
  id: string;
  clientId: string;
  category: UsageCategory;
  provider: string;
  model: string;
  operation: string;
  runs: number;
  cost: number;
  tokens?: number;
  at: string;
}

export interface ActivityItem {
  id: string;
  clientId: string | null;
  /** Blog article id when this event is about a blog. */
  blogId?: string;
  kind: string;
  /** What happened (e.g. Generated draft, Sent to review). */
  action: string;
  title: string;
  detail: string;
  at: string;
  /** Calendar / due date for the blog when the event was logged (ISO). */
  dueDate?: string;
}

export interface QualityCheckItem {
  id: string;
  label: string;
  checked: boolean;
}

/** Lifecycle of one article record (same ID across outline → draft → review → export). */
export type ArticlePhase =
  | "outline"
  | "outline_approved"
  | "draft"
  | "in_review"
  | "approved"
  | "review_outdated";

export interface OutlineSectionSpec {
  id: string;
  order: number;
  heading: string;
  keyPoints: string[];
  evidenceRequired: string[];
  transitionToNext: string;
}

export interface ApprovedOutline {
  title: string;
  introductionPurpose: string;
  sections: OutlineSectionSpec[];
  conclusionPurpose: string;
  cta: string;
  approved: boolean;
  approvedAt: string | null;
}

export interface ArticleSectionContent {
  sectionId: string;
  order: number;
  heading: string;
  /** Plain text body for this section (bullets / paragraphs). */
  body: string;
  keyPointsCovered: string[];
}

export interface ArticleVersion {
  id: string;
  createdAt: string;
  label: string;
  title: string;
  body: string;
  sections: ArticleSectionContent[];
  seoTitle: string;
  seoMeta: string;
}

export type ConsistencySeverity = "error" | "warning";

export interface ConsistencyIssue {
  id: string;
  severity: ConsistencySeverity;
  code:
    | "missing_section"
    | "unexpected_heading"
    | "order_changed"
    | "missing_key_point"
    | "repetitive_section"
    | "unsupported_claim"
    | "weak_transition";
  message: string;
  sectionId?: string;
  action: string;
}

export interface DemoFaq {
  question: string;
  answer: string;
}

export interface DemoSeoCheck {
  id: string;
  label: string;
  done: boolean;
}

export interface BlogPost {
  id: string;
  clientId: string;
  title: string;
  body: string;
  toneId: string;
  toneName: string;
  topicMode: TopicMode;
  topic: string;
  targetAudience: string;
  ideaNotes: string;
  keywords: string[];
  primaryKeyword: string;
  secondaryKeywords: string[];
  research: string;
  /** Human-readable outline text (derived from structured outline). */
  outline: string;
  approvedOutline: ApprovedOutline | null;
  sections: ArticleSectionContent[];
  /** Opening blog paragraphs (not outline purpose meta). */
  lede: string;
  /** Closing blog paragraphs before the CTA. */
  closing: string;
  versions: ArticleVersion[];
  articlePhase: ArticlePhase;
  /** Bumps on each generate/save so stale async results cannot overwrite newer edits. */
  generationToken: number;
  outlineDirtyAfterDraft: boolean;
  targetWords: number;
  seoTitle: string;
  seoMeta: string;
  qualityChecks: QualityCheckItem[];
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  /** Date this article appears on the Content Calendar (past / today / upcoming). */
  calendarDate?: string;
  /**
   * When true, calendar seed re-anchoring must not overwrite calendarDate.
   * Set whenever the user places/saves a pin on the Content Calendar.
   */
  calendarPinned?: boolean;
  /** @deprecated Legacy flag; ignored by UI. */
  demoMode?: boolean;
  contentType?: string;
  urlSlug?: string;
  relatedKeywords?: string[];
  suggestedInternalLinks?: string[];
  seoChecklist?: DemoSeoCheck[];
  faqs?: DemoFaq[];
  linkedinPost?: string;
  featuredImageBrief?: string;
  featuredImageCaption?: string;
  /** Drive file id for an optional cover image (kind: image). */
  featuredImageId?: string;
  generationStatus?: string;
}

export type BlogPostInput = Omit<BlogPost, "id" | "createdAt" | "updatedAt">;

/** Campaign-level lifecycle (sending is never automatic in the MVP). */
export type EmailCampaignStatus =
  | "draft"
  | "review"
  | "approved"
  | "scheduled";

/** Per-email approval inside a nurture sequence. */
export type NurtureEmailStatus = "draft" | "review" | "approved";

export interface NurtureEmail {
  id: string;
  order: number;
  /** Days after campaign start when this email is meant to go out. */
  sendDayOffset: number;
  subject: string;
  previewText: string;
  body: string;
  cta: string;
  status: NurtureEmailStatus;
}

export interface EmailCampaign {
  id: string;
  clientId: string;
  name: string;
  objective: string;
  audience: string;
  emailCount: number;
  /** Human timing note, e.g. "Every 3 days". */
  timingNote: string;
  /** Days between emails used when generating offsets. */
  cadenceDays: number;
  toneId?: string;
  emails: NurtureEmail[];
  status: EmailCampaignStatus;
  createdAt: string;
  updatedAt: string;
}

export type EmailCampaignInput = Omit<
  EmailCampaign,
  "id" | "createdAt" | "updatedAt"
>;
