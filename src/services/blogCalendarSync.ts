import type { BlogPost } from "../types";
import {
  blogCalendarDate,
  dateInputToIso,
  localDateKey,
  toDateInputValue,
} from "./calendar";

/** Stable demo seed ids use the `cal-` prefix (see calendarSeed.ts). */
export function isCalendarSeedId(id: string): boolean {
  return id.startsWith("cal-");
}

/** Normalize titles for duplicate detection. */
export function normalizeBlogTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function blogDateKey(blog: BlogPost): string {
  return toDateInputValue(blogCalendarDate(blog));
}

/** True when this record is a lightweight calendar stub (not a real draft yet). */
export function isCalendarStub(blog: BlogPost): boolean {
  // Full showcase / generated articles are not stubs even with cal-* ids.
  if ((blog.sections?.length ?? 0) > 0 && (blog.lede?.trim()?.length ?? 0) > 40) {
    return false;
  }
  if ((blog.body?.length ?? 0) >= 500) return false;
  if (isCalendarSeedId(blog.id)) return true;
  const notes = blog.ideaNotes?.toLowerCase() ?? "";
  if (notes.includes("created from content calendar pin")) return true;
  if (blog.generationStatus === "Scheduled" && (blog.body?.length ?? 0) < 280) {
    return true;
  }
  return false;
}

function contentScore(blog: BlogPost): number {
  let score = 0;
  score += Math.min(blog.body?.length ?? 0, 5000);
  score += (blog.sections?.length ?? 0) * 200;
  score += blog.approvedOutline ? 150 : 0;
  score += blog.research?.trim() ? 100 : 0;
  score += blog.calendarPinned ? 50 : 0;
  if (!isCalendarSeedId(blog.id)) score += 500;
  if (!isCalendarStub(blog)) score += 300;
  return score;
}

/**
 * Prefer the richest blog when collapsing duplicates.
 * Same client + same calendar day + (same title OR both stubs) → one record.
 */
export function dedupeSyncedBlogs(blogs: BlogPost[]): BlogPost[] {
  const byId = new Map<string, BlogPost>();
  for (const blog of blogs) {
    const prev = byId.get(blog.id);
    if (!prev || contentScore(blog) >= contentScore(prev)) {
      byId.set(blog.id, blog);
    }
  }

  const list = [...byId.values()];
  const kept: BlogPost[] = [];
  const used = new Set<string>();

  // Group by client + date; collapse stubs / identical titles.
  const groups = new Map<string, BlogPost[]>();
  for (const blog of list) {
    const key = `${blog.clientId}::${blogDateKey(blog)}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(blog);
    groups.set(key, bucket);
  }

  for (const bucket of groups.values()) {
    if (bucket.length === 1) {
      kept.push(bucket[0]);
      used.add(bucket[0].id);
      continue;
    }

    const byTitle = new Map<string, BlogPost[]>();
    const stubs: BlogPost[] = [];
    for (const blog of bucket) {
      if (isCalendarStub(blog)) {
        stubs.push(blog);
        continue;
      }
      const titleKey = normalizeBlogTitle(blog.title);
      const titleBucket = byTitle.get(titleKey) ?? [];
      titleBucket.push(blog);
      byTitle.set(titleKey, titleBucket);
    }

    for (const titleBucket of byTitle.values()) {
      const winner = titleBucket.reduce((best, item) =>
        contentScore(item) >= contentScore(best) ? item : best,
      );
      kept.push(ensureCalendarFields(winner));
      used.add(winner.id);
    }

    // Keep at most one stub per client/day when no richer title match exists.
    if (stubs.length > 0) {
      const stubWinner = stubs.reduce((best, item) =>
        contentScore(item) >= contentScore(best) ? item : best,
      );
      // Drop stub if a real article already covers that day for this client.
      const hasReal = bucket.some((b) => !isCalendarStub(b) && used.has(b.id));
      if (!hasReal) {
        kept.push(ensureCalendarFields(stubWinner));
        used.add(stubWinner.id);
      }
    }

    // Keep remaining non-stub, non-duplicate-title blogs on that day.
    for (const blog of bucket) {
      if (used.has(blog.id)) continue;
      if (isCalendarStub(blog)) continue;
      kept.push(ensureCalendarFields(blog));
      used.add(blog.id);
    }
  }

  return kept.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Every blog that appears in Library also has a stable calendar date. */
export function ensureCalendarFields(blog: BlogPost): BlogPost {
  const calendarDate =
    blog.calendarDate || blog.updatedAt || blog.createdAt || new Date().toISOString();
  return {
    ...blog,
    calendarDate,
    // Real content stays on the calendar; seeds re-anchor unless pinned.
    calendarPinned:
      blog.calendarPinned ||
      (!isCalendarSeedId(blog.id) && !isCalendarStub(blog)),
  };
}

/**
 * Skip injecting a seed when the user already has a matching article
 * (same client + same title) so Library/Calendar do not show duplicates.
 */
export function shouldSkipSeed(
  seed: BlogPost,
  existing: BlogPost[],
): boolean {
  const seedTitle = normalizeBlogTitle(seed.title);
  return existing.some(
    (blog) =>
      !isCalendarSeedId(blog.id) &&
      blog.clientId === seed.clientId &&
      normalizeBlogTitle(blog.title) === seedTitle,
  );
}

/**
 * Find a calendar pin to reuse for this client on a YYYY-MM-DD day.
 * Reuses stubs, or an existing blog with the same title — never blocks a
 * second distinct article on the same day.
 */
export function findBlogPinForDay(
  blogs: BlogPost[],
  clientId: string,
  dateKey: string,
  title?: string,
): BlogPost | undefined {
  const onDay = blogs.filter(
    (blog) => blog.clientId === clientId && blogDateKey(blog) === dateKey,
  );
  if (onDay.length === 0) return undefined;
  const stub = onDay.find(isCalendarStub);
  if (stub) return stub;
  if (title?.trim()) {
    const needle = normalizeBlogTitle(title);
    return onDay.find((blog) => normalizeBlogTitle(blog.title) === needle);
  }
  return undefined;
}

/** Find a reusable calendar stub for this client (any day) with little content. */
export function findReusableCalendarStub(
  blogs: BlogPost[],
  clientId: string,
): BlogPost | undefined {
  const stubs = blogs.filter(
    (blog) =>
      blog.clientId === clientId &&
      isCalendarStub(blog) &&
      !isCalendarSeedId(blog.id) &&
      (blog.body?.length ?? 0) < 280,
  );
  if (stubs.length === 0) return undefined;
  return stubs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function pinDateIso(dateKey: string): string {
  return dateInputToIso(dateKey);
}

export function todayPinDateIso(now = new Date()): string {
  return dateInputToIso(localDateKey(now));
}
