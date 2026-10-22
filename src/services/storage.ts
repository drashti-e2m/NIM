import type {
  BlogPost,
  Client,
  Draft,
  DriveItem,
  EmailCampaign,
  NurtureEmail,
} from "../types";
import { scheduleSharedPush } from "./sharedStore";
export {
  BLOGS_KEY,
  CLIENT_OVERRIDES_KEY,
  CUSTOM_CLIENTS_KEY,
  DRAFTS_KEY,
  DRIVE_REMOVED_KEY,
  DRIVE_UPLOADS_KEY,
  EMAIL_CAMPAIGNS_KEY,
  LAST_CLIENT_KEY,
  REMOVED_BLOGS_KEY,
  TONES_KEY,
} from "./storageKeys";
import {
  BLOGS_KEY,
  CLIENT_OVERRIDES_KEY,
  CUSTOM_CLIENTS_KEY,
  DRAFTS_KEY,
  DRIVE_REMOVED_KEY,
  DRIVE_UPLOADS_KEY,
  EMAIL_CAMPAIGNS_KEY,
  LAST_CLIENT_KEY,
  REMOVED_BLOGS_KEY,
  TONES_KEY,
} from "./storageKeys";

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    scheduleSharedPush();
  } catch {
    // Session still works if storage is blocked.
  }
}

function isDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<Draft>;
  return (
    typeof draft.id === "string" &&
    typeof draft.clientId === "string" &&
    typeof draft.title === "string" &&
    typeof draft.body === "string" &&
    (draft.status === "draft" ||
      draft.status === "in_review" ||
      draft.status === "approved") &&
    (draft.stage === "awareness" ||
      draft.stage === "consideration" ||
      draft.stage === "decision") &&
    typeof draft.topicTitle === "string" &&
    !!draft.brief &&
    typeof draft.brief === "object"
  );
}

export function readDrafts(): Draft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDraft);
  } catch {
    return [];
  }
}

export function writeDrafts(drafts: Draft[]): void {
  persist(DRAFTS_KEY, JSON.stringify(drafts));
}

function isDriveItem(value: unknown): value is DriveItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DriveItem>;
  return (
    typeof item.id === "string" &&
    typeof item.clientId === "string" &&
    (item.parentId === null || typeof item.parentId === "string") &&
    typeof item.name === "string" &&
    (item.kind === "folder" ||
      item.kind === "doc" ||
      item.kind === "sheet" ||
      item.kind === "pdf" ||
      item.kind === "image") &&
    typeof item.updatedAt === "string"
  );
}

export function readDriveUploads(): DriveItem[] {
  try {
    const raw = localStorage.getItem(DRIVE_UPLOADS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDriveItem);
  } catch {
    return [];
  }
}

export function writeDriveUploads(items: DriveItem[]): void {
  persist(DRIVE_UPLOADS_KEY, JSON.stringify(items));
}

export function readRemovedDriveIds(): string[] {
  try {
    const raw = localStorage.getItem(DRIVE_REMOVED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function writeRemovedDriveIds(ids: string[]): void {
  persist(DRIVE_REMOVED_KEY, JSON.stringify(ids));
}

function isClient(value: unknown): value is Client {
  if (!value || typeof value !== "object") return false;
  const client = value as Partial<Client>;
  return (
    typeof client.id === "string" &&
    typeof client.name === "string" &&
    typeof client.website === "string" &&
    typeof client.initials === "string" &&
    typeof client.color === "string"
  );
}

export function readCustomClients(): Client[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CLIENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isClient);
  } catch {
    return [];
  }
}

export function writeCustomClients(items: Client[]): void {
  persist(CUSTOM_CLIENTS_KEY, JSON.stringify(items));
}

export function readClientOverrides(): Record<string, Partial<Client>> {
  try {
    const raw = localStorage.getItem(CLIENT_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, Partial<Client>> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const patch = value as Partial<Client>;
      const next: Partial<Client> = {};
      if (typeof patch.name === "string") next.name = patch.name;
      if (typeof patch.website === "string") next.website = patch.website;
      if (typeof patch.industry === "string") next.industry = patch.industry;
      if (typeof patch.city === "string") next.city = patch.city;
      if (typeof patch.summary === "string") next.summary = patch.summary;
      if (typeof patch.preferredToneId === "string") {
        next.preferredToneId = patch.preferredToneId;
      }
      if (Object.keys(next).length > 0) out[id] = next;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeClientOverrides(
  overrides: Record<string, Partial<Client>>,
): void {
  persist(CLIENT_OVERRIDES_KEY, JSON.stringify(overrides));
}

function isBlog(value: unknown): value is BlogPost {
  if (!value || typeof value !== "object") return false;
  const blog = value as Partial<BlogPost>;
  return (
    typeof blog.id === "string" &&
    typeof blog.clientId === "string" &&
    typeof blog.title === "string" &&
    typeof blog.body === "string" &&
    Array.isArray(blog.keywords)
  );
}

function normalizeBlog(blog: BlogPost): BlogPost {
  const keywords = Array.isArray(blog.keywords) ? blog.keywords : [];
  return {
    ...blog,
    seoTitle: blog.seoTitle ?? blog.title.slice(0, 60),
    seoMeta: blog.seoMeta ?? "",
    qualityChecks: Array.isArray(blog.qualityChecks) ? blog.qualityChecks : [],
    status: blog.status ?? "draft",
    targetAudience: blog.targetAudience ?? "B2B buyers",
    primaryKeyword: blog.primaryKeyword || keywords[0] || "",
    secondaryKeywords: Array.isArray(blog.secondaryKeywords)
      ? blog.secondaryKeywords
      : keywords.slice(1),
    approvedOutline: blog.approvedOutline ?? null,
    sections: Array.isArray(blog.sections) ? blog.sections : [],
    lede: typeof blog.lede === "string" ? blog.lede : "",
    closing: typeof blog.closing === "string" ? blog.closing : "",
    versions: Array.isArray(blog.versions) ? blog.versions : [],
    articlePhase: blog.articlePhase ?? (blog.body ? "draft" : "outline"),
    generationToken: typeof blog.generationToken === "number" ? blog.generationToken : 0,
    outlineDirtyAfterDraft: Boolean(blog.outlineDirtyAfterDraft),
    ideaNotes: blog.ideaNotes ?? "",
    research: blog.research ?? "",
    outline: blog.outline ?? "",
    toneId: blog.toneId ?? "",
    toneName: blog.toneName ?? "",
    topicMode: blog.topicMode ?? "manual",
    topic: blog.topic ?? blog.title,
    targetWords: blog.targetWords ?? 800,
    calendarDate: blog.calendarDate || blog.updatedAt || blog.createdAt,
    contentType: blog.contentType,
    urlSlug: blog.urlSlug,
    relatedKeywords: Array.isArray(blog.relatedKeywords)
      ? blog.relatedKeywords
      : undefined,
    suggestedInternalLinks: Array.isArray(blog.suggestedInternalLinks)
      ? blog.suggestedInternalLinks
      : undefined,
    seoChecklist: Array.isArray(blog.seoChecklist) ? blog.seoChecklist : undefined,
    faqs: Array.isArray(blog.faqs) ? blog.faqs : undefined,
    linkedinPost: blog.linkedinPost,
    featuredImageBrief: blog.featuredImageBrief,
    featuredImageCaption: blog.featuredImageCaption,
    featuredImageId:
      typeof blog.featuredImageId === "string" ? blog.featuredImageId : undefined,
    generationStatus: blog.generationStatus,
  };
}

export function readBlogs(): BlogPost[] {
  try {
    const raw = localStorage.getItem(BLOGS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBlog).map(normalizeBlog);
  } catch {
    return [];
  }
}

export function writeBlogs(items: BlogPost[]): void {
  persist(BLOGS_KEY, JSON.stringify(items));
}

export function readRemovedBlogIds(): string[] {
  try {
    const raw = localStorage.getItem(REMOVED_BLOGS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function writeRemovedBlogIds(ids: string[]): void {
  persist(REMOVED_BLOGS_KEY, JSON.stringify(ids));
}

export function readLastClientId(): string | null {
  try {
    return localStorage.getItem(LAST_CLIENT_KEY);
  } catch {
    return null;
  }
}

export function writeLastClientId(id: string): void {
  persist(LAST_CLIENT_KEY, id);
}

export function readToneOverrides(): unknown {
  try {
    const raw = localStorage.getItem(TONES_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeToneOverrides(value: unknown): void {
  persist(TONES_KEY, JSON.stringify(value));
}

function isNurtureEmail(value: unknown): value is NurtureEmail {
  if (!value || typeof value !== "object") return false;
  const email = value as Partial<NurtureEmail>;
  return (
    typeof email.id === "string" &&
    typeof email.order === "number" &&
    typeof email.subject === "string" &&
    typeof email.previewText === "string" &&
    typeof email.body === "string" &&
    typeof email.cta === "string" &&
    (email.status === "draft" ||
      email.status === "review" ||
      email.status === "approved")
  );
}

function isEmailCampaign(value: unknown): value is EmailCampaign {
  if (!value || typeof value !== "object") return false;
  const campaign = value as Partial<EmailCampaign>;
  return (
    typeof campaign.id === "string" &&
    typeof campaign.clientId === "string" &&
    typeof campaign.name === "string" &&
    typeof campaign.objective === "string" &&
    typeof campaign.audience === "string" &&
    typeof campaign.emailCount === "number" &&
    Array.isArray(campaign.emails) &&
    campaign.emails.every(isNurtureEmail) &&
    (campaign.status === "draft" ||
      campaign.status === "review" ||
      campaign.status === "approved" ||
      campaign.status === "scheduled")
  );
}

export function readEmailCampaigns(): EmailCampaign[] {
  try {
    const raw = localStorage.getItem(EMAIL_CAMPAIGNS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEmailCampaign);
  } catch {
    return [];
  }
}

export function writeEmailCampaigns(campaigns: EmailCampaign[]): void {
  persist(EMAIL_CAMPAIGNS_KEY, JSON.stringify(campaigns));
}
