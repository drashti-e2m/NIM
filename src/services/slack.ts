export interface SlackMessage {
  id: string;
  text: string;
  author: string;
  channel: string;
  direction: "inbound" | "outbound";
  at: string;
  status: "demo" | "sent" | "queued";
}

export interface SlackFeed {
  channel: string;
  connected: boolean;
  messages: SlackMessage[];
}

export async function fetchSlackMessages(): Promise<SlackFeed> {
  const response = await fetch("/api/slack/messages");
  if (!response.ok) {
    throw new Error("Could not load Slack messages.");
  }
  return (await response.json()) as SlackFeed;
}

export async function sendSlackMessage(text: string): Promise<{
  ok: boolean;
  mode: "live" | "demo";
  message: string;
  messages: SlackMessage[];
}> {
  const response = await fetch("/api/slack/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const payload = (await response.json()) as {
    ok: boolean;
    mode?: "live" | "demo";
    message?: string;
    messages?: SlackMessage[];
  };
  return {
    ok: payload.ok && response.ok,
    mode: payload.mode ?? "demo",
    message: payload.message ?? (response.ok ? "Sent." : "Send failed."),
    messages: payload.messages ?? [],
  };
}

export function relativeSlackTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
