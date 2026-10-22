import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

type JsonValue = null | boolean | number | string | JsonValue[] | {
  [key: string]: JsonValue;
};

interface DeadlineStore {
  generatedAt: string | null;
  deadlines: JsonValue[];
  byClient: JsonValue[];
  overdue: JsonValue[];
  today: JsonValue[];
  upcoming: JsonValue[];
  lastSync: {
    at: string | null;
    count: number;
    calendarId: string;
    mode: "demo" | "live";
  };
}

const store: DeadlineStore = {
  generatedAt: null,
  deadlines: [],
  byClient: [],
  overdue: [],
  today: [],
  upcoming: [],
  lastSync: {
    at: null,
    count: 0,
    calendarId: "primary",
    mode: "demo",
  },
};

function sendJson(res: ServerResponse, status: number, body: JsonValue) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function splitDeadlines(deadlines: Array<Record<string, JsonValue>>) {
  const overdue: JsonValue[] = [];
  const today: JsonValue[] = [];
  const upcoming: JsonValue[] = [];
  for (const item of deadlines) {
    const timing = String(item.timing ?? "");
    if (timing === "past") overdue.push(item);
    else if (timing === "today") today.push(item);
    else upcoming.push(item);
  }
  return { overdue, today, upcoming };
}

function groupByClient(deadlines: Array<Record<string, JsonValue>>) {
  const map = new Map<
    string,
    {
      clientId: string;
      clientName: string;
      clientColor: string;
      deadlines: JsonValue[];
      nextDeadlineAt: string | null;
    }
  >();

  for (const item of deadlines) {
    const clientId = String(item.clientId ?? "unknown");
    const existing = map.get(clientId) ?? {
      clientId,
      clientName: String(item.clientName ?? "Client"),
      clientColor: String(item.clientColor ?? "#555672"),
      deadlines: [],
      nextDeadlineAt: null as string | null,
    };
    existing.deadlines.push(item);
    map.set(clientId, existing);
  }

  return Array.from(map.values()).map((row) => {
    const sorted = [...row.deadlines].sort((a, b) =>
      String((a as { deadlineAt?: string }).deadlineAt ?? "").localeCompare(
        String((b as { deadlineAt?: string }).deadlineAt ?? ""),
      ),
    );
    const next =
      sorted.find((d) => (d as { timing?: string }).timing === "today") ??
      sorted.find((d) => (d as { timing?: string }).timing === "future") ??
      sorted[0] ??
      null;
    return {
      ...row,
      deadlines: sorted,
      nextDeadlineAt: next
        ? String((next as { deadlineAt?: string }).deadlineAt ?? "")
        : null,
    };
  });
}

/**
 * Local API for agency deadline management + Google Calendar sync shape.
 *
 * GET  /api/calendar/deadlines   → dashboard feed
 * POST /api/calendar/deadlines   → publish snapshot from the SPA
 * POST /api/calendar/google/sync → demo push to Google Calendar
 * GET  /api/calendar/google/status → connection status
 */
export function calendarApiPlugin(): Plugin {
  return {
    name: "nim-calendar-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/api/calendar")) return next();

        if (url === "/api/calendar/google/status" && req.method === "GET") {
          return sendJson(res, 200, {
            ok: true,
            connected: Boolean(store.lastSync.at),
            mode: store.lastSync.mode,
            calendarId: store.lastSync.calendarId,
            lastSyncedAt: store.lastSync.at,
            lastEventCount: store.lastSync.count,
            liveOAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
            endpoints: {
              deadlines: "/api/calendar/deadlines",
              sync: "/api/calendar/google/sync",
            },
            note: process.env.GOOGLE_CLIENT_ID
              ? "GOOGLE_CLIENT_ID detected - wire OAuth token exchange for live inserts."
              : "Demo Mode. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET for live Google Calendar.",
          });
        }

        if (url === "/api/calendar/deadlines" && req.method === "GET") {
          return sendJson(res, 200, {
            ok: true,
            source: "api",
            mode: store.lastSync.mode,
            generatedAt: store.generatedAt ?? new Date().toISOString(),
            overdue: store.overdue,
            today: store.today,
            upcoming: store.upcoming,
            byClient: store.byClient,
            google: {
              connected: Boolean(store.lastSync.at),
              calendarId: store.lastSync.calendarId,
              lastSyncedAt: store.lastSync.at,
              exportPath: "client:.ics download",
              syncPath: "/api/calendar/google/sync",
            },
          });
        }

        if (url === "/api/calendar/deadlines" && req.method === "POST") {
          try {
            const raw = await readBody(req);
            const body = JSON.parse(raw || "{}") as {
              deadlines?: Array<Record<string, JsonValue>>;
              generatedAt?: string;
            };
            const deadlines = Array.isArray(body.deadlines) ? body.deadlines : [];
            const buckets = splitDeadlines(deadlines);
            store.deadlines = deadlines;
            store.overdue = buckets.overdue;
            store.today = buckets.today;
            store.upcoming = buckets.upcoming;
            store.byClient = groupByClient(deadlines);
            store.generatedAt = body.generatedAt ?? new Date().toISOString();
            return sendJson(res, 200, {
              ok: true,
              stored: deadlines.length,
              generatedAt: store.generatedAt,
            });
          } catch {
            return sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
          }
        }

        if (url === "/api/calendar/google/sync" && req.method === "POST") {
          try {
            const raw = await readBody(req);
            const body = JSON.parse(raw || "{}") as {
              calendarId?: string;
              events?: JsonValue[];
              deadlines?: Array<Record<string, JsonValue>>;
            };
            const events = Array.isArray(body.events) ? body.events : [];
            const deadlines = Array.isArray(body.deadlines) ? body.deadlines : [];
            if (deadlines.length) {
              const buckets = splitDeadlines(deadlines);
              store.deadlines = deadlines;
              store.overdue = buckets.overdue;
              store.today = buckets.today;
              store.upcoming = buckets.upcoming;
              store.byClient = groupByClient(deadlines);
              store.generatedAt = new Date().toISOString();
            }
            store.lastSync = {
              at: new Date().toISOString(),
              count: events.length || deadlines.length,
              calendarId: body.calendarId || "primary",
              mode: process.env.GOOGLE_CLIENT_ID ? "live" : "demo",
            };
            return sendJson(res, 200, {
              ok: true,
              mode: store.lastSync.mode,
              synced: store.lastSync.count,
              calendarId: store.lastSync.calendarId,
              syncedAt: store.lastSync.at,
              message: process.env.GOOGLE_CLIENT_ID
                ? "Live credentials present - replace demo handler with events.insert."
                : "Demo sync stored. Dashboard /api/calendar/deadlines is updated. Export .ics to add events in Google Calendar.",
              googleEventShape: events[0] ?? null,
            });
          } catch {
            return sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
          }
        }

        return sendJson(res, 404, {
          ok: false,
          error: "Unknown calendar API route",
          routes: [
            "GET /api/calendar/deadlines",
            "POST /api/calendar/deadlines",
            "POST /api/calendar/google/sync",
            "GET /api/calendar/google/status",
          ],
        });
      });
    },
  };
}
