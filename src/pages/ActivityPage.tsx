import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useClients } from "../context/ClientsContext";
import { useDrafts } from "../context/DraftsContext";
import { useBlogs } from "../context/BlogsContext";
import {
  ACTIVITY_CHANGED_EVENT,
  readActivityLog,
  seedActivityFromBlogs,
} from "../services/activityLog";
import { STUDIO_SYNC_EVENT } from "../services/sharedStore";
import { usePageTitle } from "../usePageTitle";
import { formatDate, relativeTime } from "../format";
import { statusLabel } from "../labels";
import type { ActivityItem } from "../types";
import { EmptyState } from "../components/ui";

export function ActivityPage() {
  usePageTitle("Activity");
  const { getClient } = useClients();
  const { drafts } = useDrafts();
  const { blogs } = useBlogs();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    seedActivityFromBlogs(blogs);
  }, [blogs]);

  useEffect(() => {
    function refresh() {
      setTick((n) => n + 1);
    }
    window.addEventListener(ACTIVITY_CHANGED_EVENT, refresh);
    window.addEventListener(STUDIO_SYNC_EVENT, refresh);
    return () => {
      window.removeEventListener(ACTIVITY_CHANGED_EVENT, refresh);
      window.removeEventListener(STUDIO_SYNC_EVENT, refresh);
    };
  }, []);

  const items = useMemo(() => {
    void tick;
    const log = readActivityLog();
    const list: ActivityItem[] = [...log];

    // Include recent legacy draft edits that aren't blog articles yet.
    for (const draft of drafts) {
      const already = list.some(
        (item) =>
          item.kind === "Draft" &&
          item.title === draft.title &&
          item.at === draft.updatedAt,
      );
      if (already) continue;
      list.push({
        id: `draft-${draft.id}-${draft.updatedAt}`,
        clientId: draft.clientId,
        kind: "Draft",
        action: `Status → ${statusLabel(draft.status)}`,
        title: draft.title,
        detail: draft.brief.format,
        at: draft.updatedAt,
      });
    }

    return list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60);
  }, [blogs, drafts, tick]);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Activity</h1>
          <p className="lede">
            History of recent work on blogs — creates, outline approvals, drafts,
            edits, cover images, review, and status changes.
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="No activity yet"
          body="Generate or edit a blog for a client and the work will show up here."
        />
      ) : (
        <ul className="activity-list">
          {items.map((item) => {
            const client = item.clientId ? getClient(item.clientId) : undefined;
            const blogHref =
              item.kind === "Blog" && client && item.blogId
                ? item.action === "Deleted article"
                  ? `/clients/${client.id}?tab=drafts`
                  : `/clients/${client.id}/blog/${item.blogId}`
                : null;
            const editHref =
              item.kind === "Blog" &&
              client &&
              item.blogId &&
              item.action !== "Deleted article"
                ? `/clients/${client.id}/generate?article=${item.blogId}`
                : null;

            return (
              <li key={item.id} className="activity-row">
                <span className="activity-kind">{item.kind}</span>
                <div className="activity-copy">
                  <div className="activity-title-row">
                    {blogHref ? (
                      <Link to={blogHref}>
                        <strong>{item.title}</strong>
                      </Link>
                    ) : (
                      <strong>{item.title}</strong>
                    )}
                    <span className="activity-action">{item.action}</span>
                  </div>
                  <span className="muted">
                    {client ? (
                      <Link to={`/clients/${client.id}`}>{client.name}</Link>
                    ) : (
                      "Workspace"
                    )}
                    {item.detail ? <> · {item.detail}</> : null}
                    {editHref ? (
                      <>
                        {" · "}
                        <Link to={editHref}>Open in editor</Link>
                      </>
                    ) : null}
                  </span>
                </div>
                <time className="muted activity-time" dateTime={item.at} title={formatDate(item.at)}>
                  {relativeTime(item.at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
