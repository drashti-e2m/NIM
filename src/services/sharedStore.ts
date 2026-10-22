import {
  ACTIVITY_KEY,
  BLOGS_KEY,
  CLIENT_OVERRIDES_KEY,
  CUSTOM_CLIENTS_KEY,
  DRAFTS_KEY,
  DRIVE_REMOVED_KEY,
  DRIVE_UPLOADS_KEY,
  GOOGLE_SYNC_KEY,
  LAST_CLIENT_KEY,
  REMOVED_BLOGS_KEY,
  SIDEBAR_COLLAPSE_KEY,
  TONES_KEY,
} from "./storageKeys";

/** Fired after remote studio state is applied to localStorage. */
export const STUDIO_SYNC_EVENT = "nim-studio-sync";

const SYNC_KEYS = [
  ACTIVITY_KEY,
  BLOGS_KEY,
  CLIENT_OVERRIDES_KEY,
  CUSTOM_CLIENTS_KEY,
  DRAFTS_KEY,
  DRIVE_UPLOADS_KEY,
  DRIVE_REMOVED_KEY,
  REMOVED_BLOGS_KEY,
  TONES_KEY,
  LAST_CLIENT_KEY,
  GOOGLE_SYNC_KEY,
  SIDEBAR_COLLAPSE_KEY,
] as const;

let revision = 0;
let suppressPush = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let started = false;

function snapshotLocal(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of SYNC_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    } catch {
      // ignore
    }
  }
  return data;
}

function applyRemote(data: Record<string, string>) {
  suppressPush = true;
  try {
    for (const key of SYNC_KEYS) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        localStorage.setItem(key, data[key]);
      } else {
        localStorage.removeItem(key);
      }
    }
    window.dispatchEvent(new Event(STUDIO_SYNC_EVENT));
  } finally {
    // Let React providers rehydrate and rewrite localStorage without echoing a push.
    window.setTimeout(() => {
      suppressPush = false;
    }, 400);
  }
}

async function pull(): Promise<boolean> {
  try {
    const response = await fetch("/api/studio/state", { cache: "no-store" });
    if (!response.ok) return false;
    const payload = (await response.json()) as {
      ok?: boolean;
      revision?: number;
      data?: Record<string, string>;
    };
    if (!payload.ok || typeof payload.revision !== "number") return false;
    if (payload.revision === revision) return false;
    if (payload.revision < revision) return false;
    revision = payload.revision;
    if (payload.data) applyRemote(payload.data);
    return true;
  } catch {
    return false;
  }
}

async function pushNow() {
  if (suppressPush) return;
  try {
    const response = await fetch("/api/studio/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: snapshotLocal(),
        clientRevision: revision,
      }),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as {
      ok?: boolean;
      revision?: number;
    };
    if (payload.ok && typeof payload.revision === "number") {
      revision = payload.revision;
    }
  } catch {
    // Dev server may be restarting; keep local data.
  }
}

/** Queue a push of the current localStorage studio keys to the shared store. */
export function scheduleSharedPush() {
  if (suppressPush || !started) return;
  if (pushTimer) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    void pushNow();
  }, 250);
}

/**
 * Pull shared state once, then poll so Cursor browser and system browser stay aligned.
 */
export async function startSharedStoreSync() {
  if (started) return;
  started = true;

  // First load: prefer shared store if it already has data; otherwise seed it from local.
  try {
    const response = await fetch("/api/studio/state", { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as {
        ok?: boolean;
        revision?: number;
        data?: Record<string, string>;
      };
      const remoteKeys = payload.data ? Object.keys(payload.data).length : 0;
      if (payload.ok && typeof payload.revision === "number") {
        revision = payload.revision;
        if (remoteKeys > 0 && payload.data) {
          applyRemote(payload.data);
        } else {
          await pushNow();
        }
      }
    }
  } catch {
    // offline / no middleware — local-only
  }

  pollTimer = window.setInterval(() => {
    void pull();
  }, 1200);

  window.addEventListener("beforeunload", () => {
    if (pollTimer) window.clearInterval(pollTimer);
  });
}
