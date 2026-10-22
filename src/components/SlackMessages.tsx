import { useEffect, useState, type FormEvent } from "react";
import {
  fetchSlackMessages,
  relativeSlackTime,
  sendSlackMessage,
  type SlackMessage,
} from "../services/slack";

export function SlackMessagesPanel() {
  const [messages, setMessages] = useState<SlackMessage[]>([]);
  const [channel, setChannel] = useState("#nim-studio");
  const [connected, setConnected] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const feed = await fetchSlackMessages();
        if (!alive) return;
        setMessages(feed.messages);
        setChannel(feed.channel);
        setConnected(feed.connected);
      } catch {
        if (!alive) return;
        setError("Slack feed unavailable. Restart the Vite server.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function onSend(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await sendSlackMessage(text);
      setMessages(result.messages);
      setNotice(result.message);
      if (result.ok) setDraft("");
      else setError(result.message);
    } catch {
      setError("Could not reach the Slack API route.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="dash-card slack-panel">
      <div className="dash-card-head">
        <h2>Slack messages</h2>
        <span
          className={`slack-status${connected ? " live" : ""}`}
          title={
            connected
              ? "Posting via SLACK_WEBHOOK_URL"
              : "Local feed — set SLACK_WEBHOOK_URL for live Slack"
          }
        >
          {connected ? "Live" : "Demo"} · {channel}
        </span>
      </div>

      <ul className="slack-feed" aria-label="Slack conversation">
        {messages.length === 0 ? (
          <li className="muted">No messages yet. Send one to your Slack channel.</li>
        ) : (
          messages.map((item) => (
            <li
              key={item.id}
              className={`slack-msg slack-${item.direction}`}
            >
              <div className="slack-msg-meta">
                <strong>{item.author}</strong>
                <time>{relativeSlackTime(item.at)}</time>
              </div>
              <p>{item.text}</p>
            </li>
          ))
        )}
      </ul>

      <form className="slack-compose" onSubmit={(e) => void onSend(e)}>
        <label className="sr-only" htmlFor="slack-draft">
          Message to Slack
        </label>
        <textarea
          id="slack-draft"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message for your team on Slack…"
          maxLength={3000}
        />
        <div className="slack-compose-row">
          <p className="muted slack-hint">
            {connected
              ? "Sends to your Slack incoming webhook."
              : "Demo until you add SLACK_WEBHOOK_URL in .env"}
          </p>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={busy || !draft.trim()}
          >
            {busy ? "Sending…" : "Send to Slack"}
          </button>
        </div>
      </form>

      {notice && !error ? <p className="slack-notice">{notice}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </article>
  );
}
