import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useClients } from "../context/ClientsContext";
import { useBlogs } from "../context/BlogsContext";
import {
  ACTIVITY_CHANGED_EVENT,
  readActivityLog,
  seedActivityFromBlogs,
} from "../services/activityLog";
import {
  activityStatusForBlog,
  resumeHrefForBlog,
} from "../services/activityResume";
import { STUDIO_SYNC_EVENT } from "../services/sharedStore";
import { usePageTitle } from "../usePageTitle";
import { formatDate, relativeTime } from "../format";
import type { ActivityItem } from "../types";
import { EmptyState } from "../components/ui";

type ActivityRow = {
  id: string;
  blogId: string;
  clientId: string;
  title: string;
  status: string;
  dueDate?: string;
  at: string;
  href: string;
  statusKey: "draft" | "in_review" | "approved";
};

export function ActivityPage() {
  usePageTitle("Activity");
  const { getClient } = useClients();
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

  const rows = useMemo(() => {
    void tick;
    const log = readActivityLog();
    const latestByBlog = new Map<string, ActivityItem>();
    for (const item of log) {
      if (!item.blogId) continue;
      if (!latestByBlog.has(item.blogId)) {
        latestByBlog.set(item.blogId, item);
      }
    }

    const live: ActivityRow[] = blogs.map((blog) => {
      const latest = latestByBlog.get(blog.id) ?? null;
      const status = activityStatusForBlog(blog, latest);
      return {
        id: `blog-${blog.id}`,
        blogId: blog.id,
        clientId: blog.clientId,
        title: blog.title || "Untitled article",
        status,
        dueDate: blog.calendarDate || blog.updatedAt,
        at: blog.updatedAt || blog.createdAt,
        href: resumeHrefForBlog(blog),
        statusKey:
          blog.status === "approved" || blog.status === "in_review"
            ? blog.status
            : "draft",
      };
    });

    // Keep deleted pins/articles visible so history isn’t lost
    const deleted: ActivityRow[] = [];
    for (const item of log) {
      if (item.action !== "Pin deleted" && item.action !== "Deleted article") {
        continue;
      }
      if (!item.blogId || !item.clientId) continue;
      if (blogs.some((blog) => blog.id === item.blogId)) continue;
      deleted.push({
        id: item.id,
        blogId: item.blogId,
        clientId: item.clientId,
        title: item.title,
        status: item.action,
        dueDate: item.dueDate,
        at: item.at,
        href: `/clients/${item.clientId}?tab=drafts`,
        statusKey: "draft",
      });
    }

    return [...live, ...deleted]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 80);
  }, [blogs, tick]);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Activity</h1>
          <p className="lede">
            Blogs and calendar pins in one place — title, client, and status.
            Click a row to resume where you left off.
          </p>
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="No activity yet"
          body="Start a blog, leave mid-way, or place a calendar pin — it will show up here so you can continue later."
        />
      ) : (
        <ul className="activity-list">
          {rows.map((row) => {
            const client = getClient(row.clientId);
            return (
              <li key={row.id} className="activity-row">
                <Link to={row.href} className="activity-copy activity-resume">
                  <div className="activity-title-row">
                    <strong className="activity-blog-title">{row.title}</strong>
                    <span className={`activity-action status-${row.statusKey}`}>
                      {row.status}
                    </span>
                  </div>
                  <div className="activity-meta">
                    {client ? (
                      <span className="activity-client">
                        <span
                          className="activity-client-logo"
                          style={{ background: client.color }}
                          aria-hidden
                        >
                          {client.initials}
                        </span>
                        <span className="activity-client-name">{client.name}</span>
                      </span>
                    ) : (
                      <span className="activity-client muted">
                        <span className="activity-client-logo" aria-hidden>
                          —
                        </span>
                        <span className="activity-client-name">Workspace</span>
                      </span>
                    )}
                    <span className="activity-due muted">
                      Due{" "}
                      {row.dueDate ? (
                        <time dateTime={row.dueDate}>
                          {formatDate(row.dueDate)}
                        </time>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="activity-resume-hint muted">
                      Click to resume
                    </span>
                  </div>
                </Link>
                <time
                  className="muted activity-time"
                  dateTime={row.at}
                  title={formatDate(row.at)}
                >
                  {relativeTime(row.at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
