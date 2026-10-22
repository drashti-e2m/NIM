import type { ActivityItem, BlogPost } from "../types";
import { ACTIVITY_KEY } from "./storageKeys";
import { scheduleSharedPush } from "./sharedStore";
import { statusLabel } from "../labels";

const MAX_EVENTS = 120;
export const ACTIVITY_CHANGED_EVENT = "nim-activity-changed";

function persist(items: ActivityItem[]): void {
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(items.slice(0, MAX_EVENTS)));
    scheduleSharedPush();
  } catch {
    // quota / private mode - ignore
  }
  window.dispatchEvent(new Event(ACTIVITY_CHANGED_EVENT));
}

function isActivityItem(value: unknown): value is ActivityItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ActivityItem>;
  return (
    typeof item.id === "string" &&
    typeof item.kind === "string" &&
    typeof item.title === "string" &&
    typeof item.detail === "string" &&
    typeof item.at === "string" &&
    (item.clientId === null || typeof item.clientId === "string")
  );
}

export function readActivityLog(): ActivityItem[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isActivityItem)
      .map((item) => ({
        ...item,
        action: typeof item.action === "string" && item.action ? item.action : item.detail,
      }))
      .sort((a, b) => b.at.localeCompare(a.at));
  } catch {
    return [];
  }
}

export function logActivity(
  input: Omit<ActivityItem, "id" | "at" | "action"> & {
    action: string;
    at?: string;
  },
): ActivityItem {
  const event: ActivityItem = {
    id: `act-${crypto.randomUUID()}`,
    clientId: input.clientId,
    blogId: input.blogId,
    kind: input.kind,
    action: input.action,
    title: input.title,
    detail: input.detail,
    at: input.at ?? new Date().toISOString(),
  };
  const next = [event, ...readActivityLog()].slice(0, MAX_EVENTS);
  persist(next);
  return event;
}

/** One-time backfill so Activity isn't empty for existing blogs. */
export function seedActivityFromBlogs(blogs: BlogPost[]): void {
  if (readActivityLog().length > 0) return;
  const seeded: ActivityItem[] = [];
  for (const blog of blogs) {
    seeded.push({
      id: `seed-created-${blog.id}`,
      clientId: blog.clientId,
      blogId: blog.id,
      kind: "Blog",
      action: "Created article",
      title: blog.title,
      detail: phaseDetail(blog),
      at: blog.createdAt,
    });
    for (const version of [...(blog.versions ?? [])].reverse()) {
      seeded.push({
        id: `seed-ver-${version.id}`,
        clientId: blog.clientId,
        blogId: blog.id,
        kind: "Blog",
        action: version.label || "Saved version",
        title: version.title || blog.title,
        detail: phaseDetail(blog),
        at: version.createdAt,
      });
    }
    if (blog.updatedAt !== blog.createdAt) {
      seeded.push({
        id: `seed-updated-${blog.id}`,
        clientId: blog.clientId,
        blogId: blog.id,
        kind: "Blog",
        action: actionFromPhase(blog.articlePhase, blog.status),
        title: blog.title,
        detail: phaseDetail(blog),
        at: blog.updatedAt,
      });
    }
  }
  if (seeded.length === 0) return;
  persist(seeded.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_EVENTS));
}

function phaseDetail(blog: BlogPost): string {
  const words = blog.targetWords ? `${blog.targetWords} words` : "";
  const tone = blog.toneName?.trim() || "";
  const status = statusLabel(blog.status);
  return [words, tone || status].filter(Boolean).join(" · ");
}

function actionFromPhase(
  phase: BlogPost["articlePhase"],
  status: BlogPost["status"],
): string {
  if (status === "approved") return "Approved article";
  if (status === "in_review") return "Sent to review";
  switch (phase) {
    case "outline":
      return "Worked on outline";
    case "outline_approved":
      return "Approved outline";
    case "draft":
      return "Updated draft";
    case "in_review":
      return "Sent to review";
    case "approved":
      return "Approved article";
    case "review_outdated":
      return "Edited after review";
    default:
      return "Updated article";
  }
}

export function describeBlogUpdate(
  prev: BlogPost,
  next: BlogPost,
  options?: { snapshot?: boolean; snapshotLabel?: string },
): string | null {
  if (prev.articlePhase !== next.articlePhase) {
    switch (next.articlePhase) {
      case "outline":
        return "Started outline";
      case "outline_approved":
        return "Approved outline";
      case "draft":
        return prev.articlePhase === "outline_approved" ||
          prev.articlePhase === "outline"
          ? "Generated draft"
          : "Updated draft";
      case "in_review":
        return "Sent to review";
      case "approved":
        return "Approved article";
      case "review_outdated":
        return "Edited after review";
      default:
        return "Updated article";
    }
  }

  if (prev.status !== next.status) {
    return `Status → ${statusLabel(next.status)}`;
  }

  if (prev.featuredImageId !== next.featuredImageId) {
    return next.featuredImageId ? "Added cover image" : "Removed cover image";
  }

  if (options?.snapshot) {
    return options.snapshotLabel?.trim() || "Saved draft version";
  }

  const bodyChanged =
    prev.body !== next.body ||
    JSON.stringify(prev.sections ?? []) !== JSON.stringify(next.sections ?? []) ||
    prev.lede !== next.lede ||
    prev.closing !== next.closing;

  if (bodyChanged) {
    return "Edited draft";
  }

  if (
    prev.approvedOutline?.approved !== next.approvedOutline?.approved &&
    next.approvedOutline?.approved
  ) {
    return "Approved outline";
  }

  if (
    prev.outline !== next.outline ||
    JSON.stringify(prev.approvedOutline) !== JSON.stringify(next.approvedOutline)
  ) {
    return "Updated outline";
  }

  if (prev.research !== next.research && next.research.trim()) {
    return "Updated research";
  }

  if (
    prev.keywords.join("|") !== next.keywords.join("|") ||
    prev.primaryKeyword !== next.primaryKeyword
  ) {
    return "Updated keywords";
  }

  if (prev.topic !== next.topic && next.topic.trim()) {
    return "Updated topic";
  }

  if (prev.toneId !== next.toneId || prev.toneName !== next.toneName) {
    return `Tone → ${next.toneName || "updated"}`;
  }

  if (prev.calendarDate !== next.calendarDate) {
    return "Scheduled on calendar";
  }

  // Ignore title-only typing and token-only / silent sync patches
  return null;
}

export function logBlogCreated(blog: BlogPost): void {
  logActivity({
    clientId: blog.clientId,
    blogId: blog.id,
    kind: "Blog",
    action:
      blog.articlePhase === "outline" || !blog.body
        ? "Created article"
        : "Created article",
    title: blog.title || "Untitled article",
    detail: phaseDetail(blog),
    at: blog.createdAt,
  });
}

export function logBlogUpdated(
  prev: BlogPost,
  next: BlogPost,
  options?: { snapshot?: boolean; snapshotLabel?: string },
): void {
  const action = describeBlogUpdate(prev, next, options);
  if (!action) return;
  logActivity({
    clientId: next.clientId,
    blogId: next.id,
    kind: "Blog",
    action,
    title: next.title || prev.title || "Untitled article",
    detail: phaseDetail(next),
    at: next.updatedAt,
  });
}

export function logBlogDeleted(blog: BlogPost): void {
  logActivity({
    clientId: blog.clientId,
    blogId: blog.id,
    kind: "Blog",
    action: "Deleted article",
    title: blog.title || "Untitled article",
    detail: phaseDetail(blog),
  });
}
