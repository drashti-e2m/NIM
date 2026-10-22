import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

interface StudioStore {
  revision: number;
  updatedAt: string;
  data: Record<string, string>;
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const storePath = resolve(rootDir, ".nim-shared-store.json");

function emptyStore(): StudioStore {
  return {
    revision: 0,
    updatedAt: new Date().toISOString(),
    data: {},
  };
}

function loadStore(): StudioStore {
  try {
    if (!existsSync(storePath)) return emptyStore();
    const raw = readFileSync(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StudioStore>;
    return {
      revision: typeof parsed.revision === "number" ? parsed.revision : 0,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
      data:
        parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
          ? (parsed.data as Record<string, string>)
          : {},
    };
  } catch {
    return emptyStore();
  }
}

function saveStore(store: StudioStore) {
  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

function sendJson(res: ServerResponse, status: number, body: JsonValue) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

let store = loadStore();

export function studioStorePlugin(): Plugin {
  return {
    name: "nim-studio-shared-store",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/api/studio/state")) {
          next();
          return;
        }

        try {
          if (req.method === "GET") {
            store = loadStore();
            sendJson(res, 200, {
              ok: true,
              revision: store.revision,
              updatedAt: store.updatedAt,
              data: store.data,
            });
            return;
          }

          if (req.method === "PUT") {
            const raw = await readBody(req);
            const body = JSON.parse(raw) as {
              data?: Record<string, string>;
              clientRevision?: number;
            };
            const incoming =
              body.data && typeof body.data === "object" ? body.data : null;
            if (!incoming) {
              sendJson(res, 400, { ok: false, error: "Missing data map" });
              return;
            }

            store = loadStore();
            store = {
              revision: store.revision + 1,
              updatedAt: new Date().toISOString(),
              data: { ...incoming },
            };
            saveStore(store);
            sendJson(res, 200, {
              ok: true,
              revision: store.revision,
              updatedAt: store.updatedAt,
            });
            return;
          }

          sendJson(res, 405, { ok: false, error: "Method not allowed" });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : "Store error",
          });
        }
      });
    },
  };
}
