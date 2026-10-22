import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

interface SlackMessage {
  id: string;
  text: string;
  author: string;
  channel: string;
  direction: "inbound" | "outbound";
  at: string;
  status: "demo" | "sent" | "queued";
}

const channel = process.env.SLACK_CHANNEL ?? "#nim-studio";

const store: { messages: SlackMessage[] } = {
  messages: [
    {
      id: "seed-1",
      text: "PowerUp draft is ready for review - please flag any tone notes.",
      author: "Maya · NIM",
      channel,
      direction: "inbound",
      at: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
      status: "demo",
    },
    {
      id: "seed-2",
      text: "Calendar sync ran for this week’s deadlines. Overdue items are in the board.",
      author: "Slack Bot",
      channel,
      direction: "inbound",
      at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      status: "demo",
    },
  ],
};

function sendJson(res: ServerResponse, status: number, body: JsonValue) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function postToSlackWebhook(text: string): Promise<{
  ok: boolean;
  mode: "live" | "demo";
  detail: string;
}> {
  const webhook = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!webhook) {
    return {
      ok: true,
      mode: "demo",
      detail:
        "No SLACK_WEBHOOK_URL set - message kept in NIM Studio (demo Slack).",
    };
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.slice(0, 3000),
        username: "NIM Studio",
        icon_emoji: ":mega:",
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return {
        ok: false,
        mode: "live",
        detail: `Slack webhook failed (${response.status}): ${body.slice(0, 160)}`,
      };
    }
    return {
      ok: true,
      mode: "live",
      detail: `Posted to Slack channel ${channel}.`,
    };
  } catch (error) {
    return {
      ok: false,
      mode: "live",
      detail:
        error instanceof Error ? error.message : "Slack webhook request failed.",
    };
  }
}

export function slackApiPlugin(): Plugin {
  return {
    name: "nim-slack-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/api/slack")) return next();

        if (req.method === "GET" && url === "/api/slack/messages") {
          sendJson(res, 200, {
            channel,
            connected: Boolean(process.env.SLACK_WEBHOOK_URL?.trim()),
            messages: store.messages,
          });
          return;
        }

        if (req.method === "POST" && url === "/api/slack/send") {
          try {
            const raw = await readBody(req);
            const body = raw ? (JSON.parse(raw) as { text?: string }) : {};
            const text = String(body.text ?? "").trim();
            if (!text) {
              sendJson(res, 400, { ok: false, message: "Message text is required." });
              return;
            }

            const result = await postToSlackWebhook(text);
            const message: SlackMessage = {
              id: `msg-${Date.now()}`,
              text,
              author: "You · NIM Studio",
              channel,
              direction: "outbound",
              at: new Date().toISOString(),
              status: result.mode === "live" && result.ok ? "sent" : "queued",
            };
            store.messages = [message, ...store.messages].slice(0, 40);

            sendJson(res, result.ok ? 200 : 502, {
              ok: result.ok,
              mode: result.mode,
              message: result.detail,
              item: message,
              messages: store.messages,
            });
          } catch {
            sendJson(res, 400, { ok: false, message: "Invalid JSON body." });
          }
          return;
        }

        sendJson(res, 404, { ok: false, message: "Not found" });
      });
    },
  };
}
