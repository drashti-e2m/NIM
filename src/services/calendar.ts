import type { BlogPost, Client, DraftStatus } from "../types";

export type CalendarTiming = "past" | "today" | "future";

export interface CalendarEvent {
  id: string;
  blogId: string;
  clientId: string;
  name: string;
  initials: string;
  short: string;
  color: string;
  href: string;
  title: string;
  status: DraftStatus;
  timing: CalendarTiming;
  at: string;
  timingLabel: string;
}

export interface CalendarCell {
  day: number | null;
  today: boolean;
  timing: CalendarTiming | null;
  dateKey: string | null;
  events: CalendarEvent[];
}

export interface CalendarBuckets {
  past: CalendarEvent[];
  today: CalendarEvent[];
  future: CalendarEvent[];
}

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** Local calendar day key (YYYY-MM-DD) — rolls over at local midnight. */
export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function blogCalendarDate(blog: BlogPost): Date {
  const raw = blog.calendarDate || blog.updatedAt || blog.createdAt;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function classifyTiming(date: Date, now = new Date()): CalendarTiming {
  const day = startOfLocalDay(date).getTime();
  const today = startOfLocalDay(now).getTime();
  if (day < today) return "past";
  if (day > today) return "future";
  return "today";
}

export function timingLabel(timing: CalendarTiming): string {
  if (timing === "past") return "Done";
  if (timing === "today") return "Today";
  return "Upcoming";
}

export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
}

function toEvent(
  blog: BlogPost,
  clients: Client[],
  now: Date,
): CalendarEvent {
  const atDate = blogCalendarDate(blog);
  const timing = classifyTiming(atDate, now);
  const client = clients.find((c) => c.id === blog.clientId);
  return {
    id: blog.id,
    blogId: blog.id,
    clientId: blog.clientId,
    name: client?.name ?? "Client",
    initials: client?.initials ?? (client?.name ?? "CL").slice(0, 2).toUpperCase(),
    short: (client?.name ?? "Draft").slice(0, 10),
    color: client?.color ?? "#555672",
    href: `/clients/${blog.clientId}/blog/${blog.id}`,
    title: blog.title,
    status: blog.status,
    timing,
    at: atDate.toISOString(),
    timingLabel: timingLabel(timing),
  };
}

/** Local YYYY-MM-DD for date inputs / cell keys. */
export function toDateInputValue(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Noon local ISO from a YYYY-MM-DD value so day stays stable across TZ. */
export function dateInputToIso(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return new Date().toISOString();
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  return date.toISOString();
}

export function buildMonthGrid(input: {
  year: number;
  month: number;
  blogs: BlogPost[];
  clients: Client[];
  now?: Date;
}): { label: string; cells: CalendarCell[]; buckets: CalendarBuckets } {
  const { year, month, blogs, clients } = input;
  const now = input.now ?? new Date();
  const label = monthLabel(year, month);
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate =
    now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;

  const monthEvents: CalendarEvent[] = [];
  const byDay = new Map<number, CalendarEvent[]>();

  for (const blog of blogs) {
    const date = blogCalendarDate(blog);
    if (date.getFullYear() !== year || date.getMonth() !== month) continue;
    const event = toEvent(blog, clients, now);
    monthEvents.push(event);
    const day = date.getDate();
    const list = byDay.get(day) ?? [];
    list.push(event);
    byDay.set(day, list);
  }

  const cells: CalendarCell[] = [];
  for (let i = 0; i < startPad; i++) {
    cells.push({
      day: null,
      today: false,
      timing: null,
      dateKey: null,
      events: [],
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(year, month, day);
    const timing = classifyTiming(cellDate, now);
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({
      day,
      today: day === todayDate,
      timing,
      dateKey,
      events: (byDay.get(day) ?? []).sort((a, b) => a.at.localeCompare(b.at)),
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({
      day: null,
      today: false,
      timing: null,
      dateKey: null,
      events: [],
    });
  }

  const buckets: CalendarBuckets = {
    past: monthEvents
      .filter((event) => event.timing === "past")
      .sort((a, b) => b.at.localeCompare(a.at)),
    today: monthEvents
      .filter((event) => event.timing === "today")
      .sort((a, b) => a.title.localeCompare(b.title)),
    future: monthEvents
      .filter((event) => event.timing === "future")
      .sort((a, b) => a.at.localeCompare(b.at)),
  };

  return { label, cells, buckets };
}

/** All blogs bucketed for overview (not limited to one month). */
export function bucketAllBlogs(
  blogs: BlogPost[],
  clients: Client[],
  now = new Date(),
): CalendarBuckets {
  const events = blogs.map((blog) => toEvent(blog, clients, now));
  return {
    past: events
      .filter((event) => event.timing === "past")
      .sort((a, b) => b.at.localeCompare(a.at)),
    today: events
      .filter((event) => event.timing === "today")
      .sort((a, b) => a.title.localeCompare(b.title)),
    future: events
      .filter((event) => event.timing === "future")
      .sort((a, b) => a.at.localeCompare(b.at)),
  };
}
