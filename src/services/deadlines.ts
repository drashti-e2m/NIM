import type { BlogPost, Client, DraftStatus } from "../types";
import {
  blogCalendarDate,
  classifyTiming,
  localDateKey,
  timingLabel,
  type CalendarTiming,
} from "./calendar";

export type DeadlineKind = "draft" | "review" | "publish";

export interface ContentDeadline {
  id: string;
  blogId: string;
  clientId: string;
  clientName: string;
  clientColor: string;
  title: string;
  topic: string;
  toneName: string;
  targetWords: number;
  status: DraftStatus;
  timing: CalendarTiming;
  timingLabel: string;
  /** ISO datetime used as the content deadline */
  deadlineAt: string;
  /** Blog last edited timestamp */
  updatedAt: string;
  kind: DeadlineKind;
  href: string;
  /** Ready for Google Calendar API insert */
  googleEvent: GoogleCalendarEventPayload;
}

/** Subset of Google Calendar API event resource used by sync/export. */
export interface GoogleCalendarEventPayload {
  id: string;
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
  extendedProperties: {
    private: {
      nimBlogId: string;
      nimClientId: string;
      nimStatus: string;
      nimKind: string;
    };
  };
}

export interface DeadlineBoard {
  overdue: ContentDeadline[];
  today: ContentDeadline[];
  upcoming: ContentDeadline[];
  byClient: {
    clientId: string;
    clientName: string;
    clientColor: string;
    deadlines: ContentDeadline[];
    nextDeadlineAt: string | null;
  }[];
  generatedAt: string;
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function deadlineKind(status: DraftStatus): DeadlineKind {
  if (status === "approved") return "publish";
  if (status === "in_review") return "review";
  return "draft";
}

function kindLabel(kind: DeadlineKind): string {
  if (kind === "publish") return "Publish / handoff";
  if (kind === "review") return "Internal review";
  return "Draft due";
}

export function buildContentDeadlines(
  blogs: BlogPost[],
  clients: Client[],
  now = new Date(),
): ContentDeadline[] {
  return blogs
    .map((blog) => {
      const client = clients.find((c) => c.id === blog.clientId);
      const deadline = blogCalendarDate(blog);
      const timing = classifyTiming(deadline, now);
      const kind = deadlineKind(blog.status);
      const dateKey = toDateKey(deadline);
      const clientName = client?.name ?? "Client";
      const summary = `[${clientName}] ${kindLabel(kind)}: ${blog.title}`;

      return {
        id: `deadline-${blog.id}`,
        blogId: blog.id,
        clientId: blog.clientId,
        clientName,
        clientColor: client?.color ?? "#555672",
        title: blog.title,
        topic: blog.topic || blog.title,
        toneName: blog.toneName || "-",
        targetWords: blog.targetWords || 0,
        status: blog.status,
        timing,
        timingLabel: timingLabel(timing),
        deadlineAt: deadline.toISOString(),
        updatedAt: blog.updatedAt,
        kind,
        href: `/clients/${blog.clientId}/blog/${blog.id}`,
        googleEvent: {
          id: `nim-${blog.id}`.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 1024),
          summary,
          description: [
            `NIM Content Studio deadline`,
            `Client: ${clientName}`,
            `Topic: ${blog.topic || blog.title}`,
            `Status: ${blog.status}`,
            `Type: ${kindLabel(kind)}`,
            `Open in NIM: ${typeof window !== "undefined" ? window.location.origin : ""}${`/clients/${blog.clientId}/blog/${blog.id}`}`,
          ].join("\n"),
          start: { date: dateKey },
          end: { date: addDays(dateKey, 1) },
          extendedProperties: {
            private: {
              nimBlogId: blog.id,
              nimClientId: blog.clientId,
              nimStatus: blog.status,
              nimKind: kind,
            },
          },
        },
      } satisfies ContentDeadline;
    })
    .sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt));
}

export function buildDeadlineBoard(
  blogs: BlogPost[],
  clients: Client[],
  now = new Date(),
): DeadlineBoard {
  const deadlines = buildContentDeadlines(blogs, clients, now);
  const todayKey = localDateKey(now);
  // Bucket strictly by local calendar day of the due date (not last-edited).
  const overdue = deadlines.filter(
    (item) => localDateKey(new Date(item.deadlineAt)) < todayKey,
  );
  const today = deadlines.filter(
    (item) => localDateKey(new Date(item.deadlineAt)) === todayKey,
  );
  const upcoming = deadlines.filter(
    (item) => localDateKey(new Date(item.deadlineAt)) > todayKey,
  );

  const byClient = clients
    .map((client) => {
      const list = deadlines.filter((item) => item.clientId === client.id);
      // Only today / upcoming count as "next" - past dates must never surface here.
      const next =
        list.find((item) => item.timing === "today") ??
        list.find((item) => item.timing === "future") ??
        null;
      return {
        clientId: client.id,
        clientName: client.name,
        clientColor: client.color,
        deadlines: list,
        nextDeadlineAt: next?.deadlineAt ?? null,
      };
    })
    .sort((a, b) => {
      if (a.nextDeadlineAt && b.nextDeadlineAt) {
        return a.nextDeadlineAt.localeCompare(b.nextDeadlineAt);
      }
      if (a.nextDeadlineAt) return -1;
      if (b.nextDeadlineAt) return 1;
      return a.clientName.localeCompare(b.clientName);
    });

  return {
    overdue: overdue.sort((a, b) => b.deadlineAt.localeCompare(a.deadlineAt)),
    today,
    upcoming,
    byClient,
    generatedAt: now.toISOString(),
  };
}
