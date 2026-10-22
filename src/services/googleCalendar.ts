import type { ContentDeadline, GoogleCalendarEventPayload } from "./deadlines";
import { scheduleSharedPush } from "./sharedStore";

const SYNC_KEY = "nim.googleCalendar.sync.v1";

export interface GoogleCalendarSyncState {
  connected: boolean;
  mode: "demo" | "live";
  lastSyncedAt: string | null;
  lastEventCount: number;
  calendarId: string;
  note: string;
}

export interface DeadlinesApiResponse {
  ok: boolean;
  source: "local" | "api";
  mode: "demo" | "live";
  generatedAt: string;
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
  google: {
    connected: boolean;
    calendarId: string;
    lastSyncedAt: string | null;
    exportPath: string;
    syncPath: string;
  };
}

function defaultSyncState(): GoogleCalendarSyncState {
  return {
    connected: false,
    mode: "demo",
    lastSyncedAt: null,
    lastEventCount: 0,
    calendarId: "primary",
    note: "Connect a Google Cloud OAuth client to push live events.",
  };
}

export function readGoogleSyncState(): GoogleCalendarSyncState {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return defaultSyncState();
    const parsed = JSON.parse(raw) as Partial<GoogleCalendarSyncState>;
    return { ...defaultSyncState(), ...parsed };
  } catch {
    return defaultSyncState();
  }
}

export function writeGoogleSyncState(state: GoogleCalendarSyncState): void {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(state));
    scheduleSharedPush();
  } catch {
    // ignore
  }
}

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toIcsDate(dateKey: string): string {
  return dateKey.replace(/-/g, "");
}

/** Build an .ics file Google Calendar can import. */
export function buildGoogleCalendarIcs(
  deadlines: ContentDeadline[],
  calendarName = "NIM Content Deadlines",
): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NIM Content Studio//Content Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ];

  for (const item of deadlines) {
    const event = item.googleEvent;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@nim-mvp.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${toIcsDate(event.start.date)}`,
      `DTEND;VALUE=DATE:${toIcsDate(event.end.date)}`,
      `SUMMARY:${icsEscape(event.summary)}`,
      `DESCRIPTION:${icsEscape(event.description)}`,
      `STATUS:${item.status === "approved" ? "CONFIRMED" : "TENTATIVE"}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function downloadGoogleCalendarIcs(
  deadlines: ContentDeadline[],
  filename = "nim-content-deadlines.ics",
): void {
  const ics = buildGoogleCalendarIcs(deadlines);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function googleEventsFromDeadlines(
  deadlines: ContentDeadline[],
): GoogleCalendarEventPayload[] {
  return deadlines.map((item) => item.googleEvent);
}

/**
 * Push deadlines to the local API (demo Google Calendar sync).
 * Live mode would exchange this for Google Calendar events.insert / batch.
 */
export async function syncDeadlinesToGoogleApi(
  deadlines: ContentDeadline[],
): Promise<{
  ok: boolean;
  synced: number;
  mode: "demo" | "live";
  message: string;
  state: GoogleCalendarSyncState;
}> {
  const events = googleEventsFromDeadlines(deadlines);
  let apiOk = false;
  let message =
    "Saved locally. Import the .ics file into Google Calendar, or connect OAuth for live sync.";

  try {
    const response = await fetch("/api/calendar/google/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        calendarId: "primary",
        events,
        deadlines,
      }),
    });
    if (response.ok) {
      const payload = (await response.json()) as {
        ok?: boolean;
        synced?: number;
        mode?: "demo" | "live";
        message?: string;
      };
      apiOk = Boolean(payload.ok);
      message =
        payload.message ??
        `Synced ${payload.synced ?? events.length} deadline events.`;
    }
  } catch {
    message =
      "API unreachable - deadlines kept in the dashboard. Use Export .ics for Google Calendar.";
  }

  const state: GoogleCalendarSyncState = {
    connected: true,
    mode: "demo",
    lastSyncedAt: new Date().toISOString(),
    lastEventCount: events.length,
    calendarId: "primary",
    note: message,
  };
  writeGoogleSyncState(state);

  // Also publish deadlines snapshot for GET /api/calendar/deadlines
  try {
    await fetch("/api/calendar/deadlines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deadlines,
        generatedAt: new Date().toISOString(),
      }),
    });
  } catch {
    // optional mirror
  }

  return {
    ok: apiOk || true,
    synced: events.length,
    mode: "demo",
    message,
    state,
  };
}

export async function fetchDeadlinesFromApi(): Promise<DeadlinesApiResponse | null> {
  try {
    const response = await fetch("/api/calendar/deadlines");
    if (!response.ok) return null;
    return (await response.json()) as DeadlinesApiResponse;
  } catch {
    return null;
  }
}
