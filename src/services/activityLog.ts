import type { ActivityItem, BlogPost } from "../types";
import { ACTIVITY_KEY } from "./storageKeys";
import { scheduleSharedPush } from "./sharedStore";
import { statusLabel } from "../labels";
import { toDateInputValue } from "./calendar";

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

function dueFromBlog(blog: BlogPost): string | undefined {
  const raw = blog.calendarDate || blog.updatedAt || blog.createdAt;
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : raw;
}

function isCalendarPinBlog(blog: BlogPost): boolean {
  const notes = blog.ideaNotes?.toLowerCase() ?? "";
  if (notes.includes("created from content calendar pin")) return true;
  if (blog.calendarPinned && blog.generationStatus === "Scheduled") return true;
  if (blog.id.startsWith("cal-")) return true;
  return false;
}

function formatDay(iso?: string): string {
  if (!iso) return "—";
  const key = toDateInputValue(iso);
  return key || "—";
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
        action:
          typeof item.action === "string" && item.action
            ? item.action
            : item.detail,
        dueDate: typeof item.dueDate === "string" ? item.dueDate : undefined,
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
    dueDate: input.dueDate,
  };
  const next = [event, ...readActivityLog()].slice(0, MAX_EVENTS);
  persist(next);
  return event;
}

/** Current status label for a blog — Draft / In Review / Approved (or phase). */
export function activityLabelForBlog(blog: BlogPost): string {
  if (
    blog.articlePhase === "outline" ||
    blog.articlePhase === "outline_approved" ||
    blog.articlePhase === "review_outdated"
  ) {
    return actionFromPhase(blog.articlePhase, blog.status);
  }
  if (blog.research?.trim() && !blog.body?.trim() && blog.status === "draft") {
    return "Researched";
  }
  return statusLabel(blog.status);
}

function isPlaceholderActivityId(id: string): boolean {
  return (
    id.startsWith("seed-") ||
    id.startsWith("state-") ||
    id.startsWith("draft-")
  );
}

/**
 * Backfill Activity for blogs that have never been logged, without wiping
 * real event history (pin moves, deletes, edits, etc.).
 */
export function seedActivityFromBlogs(blogs: BlogPost[]): void {
  const raw = readActivityLog();
  // Drop legacy seed/state placeholders only; keep every real event.
  const existing = raw.filter((item) => !isPlaceholderActivityId(item.id));
  const covered = new Set(
    existing.map((item) => item.blogId).filter(Boolean) as string[],
  );

  const backfill: ActivityItem[] = [];
  for (const blog of blogs) {
    if (covered.has(blog.id)) continue;
    backfill.push({
      id: `act-backfill-${blog.id}`,
      clientId: blog.clientId,
      blogId: blog.id,
      kind: "Blog",
      action: isCalendarPinBlog(blog)
        ? "Pin created"
        : activityLabelForBlog(blog),
      title: blog.title || "Untitled article",
      detail: phaseDetail(blog),
      at: blog.updatedAt || blog.createdAt,
      dueDate: dueFromBlog(blog),
    });
  }

  const cleanedPlaceholders = raw.length !== existing.length;
  if (backfill.length === 0 && !cleanedPlaceholders) return;
  persist(
    [...backfill, ...existing]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, MAX_EVENTS),
  );
}

function phaseDetail(blog: BlogPost): string {
  const words = blog.targetWords ? `${blog.targetWords} words` : "";
  const tone = blog.toneName?.trim() || "";
  const status = statusLabel(blog.status);
  const due = blog.calendarDate
    ? `Due ${formatDay(blog.calendarDate)}`
    : "";
  return [words, tone || status, due].filter(Boolean).join(" · ");
}

function actionFromPhase(
  phase: BlogPost["articlePhase"],
  status: BlogPost["status"],
): string {
  if (status === "approved") return "Approved";
  if (status === "in_review") return "In Review";
  switch (phase) {
    case "outline":
      return "Worked on outline";
    case "outline_approved":
      return "Approved outline";
    case "draft":
      return "Draft";
    case "in_review":
      return "In Review";
    case "approved":
      return "Approved";
    case "review_outdated":
      return "Edited after review";
    default:
      return "Updated article";
  }
}

/** All notable changes between two blog versions (can be multiple). */
export function describeBlogUpdates(
  prev: BlogPost,
  next: BlogPost,
  options?: { snapshot?: boolean; snapshotLabel?: string },
): string[] {
  const actions: string[] = [];

  const prevDay = formatDay(prev.calendarDate || prev.updatedAt);
  const nextDay = formatDay(next.calendarDate || next.updatedAt);
  if (prev.calendarDate !== next.calendarDate) {
    if (!prev.calendarDate && next.calendarDate) {
      actions.push("Pin created");
    } else if (prevDay !== nextDay) {
      actions.push(`Pin moved · ${prevDay} → ${nextDay}`);
    } else {
      actions.push("Pin updated");
    }
  }

  if (prev.articlePhase !== next.articlePhase) {
    switch (next.articlePhase) {
      case "outline":
        actions.push("Started outline");
        break;
      case "outline_approved":
        actions.push("Approved outline");
        break;
      case "draft":
        actions.push(
          prev.articlePhase === "outline_approved" ||
            prev.articlePhase === "outline"
            ? "Generated draft"
            : "Updated draft",
        );
        break;
      case "in_review":
        actions.push("Sent to review");
        break;
      case "approved":
        actions.push("Approved");
        break;
      case "review_outdated":
        actions.push("Edited after review");
        break;
      default:
        actions.push("Updated article");
    }
  }

  if (prev.status !== next.status) {
    actions.push(`Status → ${statusLabel(next.status)}`);
  }

  if (prev.featuredImageId !== next.featuredImageId) {
    actions.push(
      next.featuredImageId ? "Added cover image" : "Removed cover image",
    );
  }

  if (options?.snapshot) {
    actions.push(options.snapshotLabel?.trim() || "Saved draft version");
  }

  const bodyChanged =
    prev.body !== next.body ||
    JSON.stringify(prev.sections ?? []) !==
      JSON.stringify(next.sections ?? []) ||
    prev.lede !== next.lede ||
    prev.closing !== next.closing;

  if (bodyChanged) {
    actions.push("Edited draft");
  }

  if (
    prev.approvedOutline?.approved !== next.approvedOutline?.approved &&
    next.approvedOutline?.approved
  ) {
    actions.push("Approved outline");
  } else if (
    prev.outline !== next.outline ||
    JSON.stringify(prev.approvedOutline) !==
      JSON.stringify(next.approvedOutline)
  ) {
    actions.push("Updated outline");
  }

  if (prev.research !== next.research && next.research.trim()) {
    actions.push("Updated research");
  }

  if (
    prev.keywords.join("|") !== next.keywords.join("|") ||
    prev.primaryKeyword !== next.primaryKeyword
  ) {
    actions.push("Updated keywords");
  }

  if (prev.topic !== next.topic && next.topic.trim()) {
    actions.push("Updated topic");
  }

  if (prev.toneId !== next.toneId || prev.toneName !== next.toneName) {
    actions.push(`Tone → ${next.toneName || "updated"}`);
  }

  if (prev.title !== next.title && next.title.trim()) {
    if (isCalendarPinBlog(next) || isCalendarPinBlog(prev)) {
      actions.push("Pin renamed");
    } else {
      actions.push("Renamed article");
    }
  }

  // De-dupe while preserving order
  return [...new Set(actions)];
}

/** @deprecated use describeBlogUpdates — kept for callers expecting one label */
export function describeBlogUpdate(
  prev: BlogPost,
  next: BlogPost,
  options?: { snapshot?: boolean; snapshotLabel?: string },
): string | null {
  return describeBlogUpdates(prev, next, options)[0] ?? null;
}

export function logBlogCreated(blog: BlogPost): void {
  const pin = isCalendarPinBlog(blog);
  logActivity({
    clientId: blog.clientId,
    blogId: blog.id,
    kind: "Blog",
    action: pin ? "Pin created" : "Created article",
    title: blog.title || "Untitled article",
    detail: pin
      ? `Calendar pin · Due ${formatDay(blog.calendarDate)}`
      : phaseDetail(blog),
    at: blog.createdAt,
    dueDate: dueFromBlog(blog),
  });
}

export function logBlogUpdated(
  prev: BlogPost,
  next: BlogPost,
  options?: { snapshot?: boolean; snapshotLabel?: string },
): void {
  const actions = describeBlogUpdates(prev, next, options);
  if (actions.length === 0) return;
  const at = next.updatedAt;
  const dueDate = dueFromBlog(next);
  const title = next.title || prev.title || "Untitled article";
  for (const action of actions) {
    logActivity({
      clientId: next.clientId,
      blogId: next.id,
      kind: "Blog",
      action,
      title,
      detail: phaseDetail(next),
      at,
      dueDate,
    });
  }
}

export function logBlogDeleted(blog: BlogPost): void {
  const pin = isCalendarPinBlog(blog);
  logActivity({
    clientId: blog.clientId,
    blogId: blog.id,
    kind: "Blog",
    action: pin ? "Pin deleted" : "Deleted article",
    title: blog.title || "Untitled article",
    detail: pin
      ? `Removed from calendar · was due ${formatDay(blog.calendarDate)}`
      : phaseDetail(blog),
    dueDate: dueFromBlog(blog),
  });
}
