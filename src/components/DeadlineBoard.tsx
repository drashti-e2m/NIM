import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { BlogPost, Client } from "../types";
import {
  buildDeadlineBoard,
  type ContentDeadline,
} from "../services/deadlines";
import { formatDate } from "../format";
import { useLocalTodayKey } from "../hooks/useLocalTodayKey";

function DeadlineRows({
  items,
  empty,
  dateMode = "deadline",
}: {
  items: ContentDeadline[];
  empty: string;
  /** Show calendar due date (not last-edited). */
  dateMode?: "deadline" | "today";
}) {
  if (items.length === 0) {
    return <p className="muted">{empty}</p>;
  }
  return (
    <ul className="deadline-list">
      {items.map((item) => (
        <li key={item.id}>
          <span
            className="swatch xs"
            style={{ background: item.clientColor }}
            title={item.clientName}
          >
            {item.clientName.slice(0, 2).toUpperCase()}
          </span>
          <div className="deadline-copy">
            <Link to={item.href}>
              <strong>{item.title}</strong>
            </Link>
            <span className="muted deadline-meta-line">
              <span>{item.clientName}</span>
              <span aria-hidden>·</span>
              <span>{item.toneName}</span>
              <span aria-hidden>·</span>
              <span>{item.targetWords} words</span>
              <span aria-hidden>·</span>
              <time dateTime={item.deadlineAt}>
                {dateMode === "today" ? "Today" : formatDate(item.deadlineAt)}
              </time>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DeadlineBoardPanel({
  blogs,
  clients,
}: {
  blogs: BlogPost[];
  clients: Client[];
}) {
  const todayKey = useLocalTodayKey();
  const board = useMemo(
    () => buildDeadlineBoard(blogs, clients, new Date()),
    [blogs, clients, todayKey],
  );
  const [view, setView] = useState<"today" | "upcoming" | "past">("today");

  return (
    <section className="deadline-board" aria-label="Content deadline management">
      <div className="dash-card-head">
        <div>
          <h2>Daily &amp; content deadlines</h2>
        </div>
        <div className="deadline-actions">
          <Link className="btn btn-ghost btn-sm" to="/calendar">
            Full calendar →
          </Link>
        </div>
      </div>

      <div className="deadline-view-bar" role="tablist" aria-label="Deadline view">
        <button
          type="button"
          role="tab"
          aria-selected={view === "today"}
          className={`deadline-view-btn${view === "today" ? " active" : ""}`}
          onClick={() => setView("today")}
        >
          Due today <span>{board.today.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "upcoming"}
          className={`deadline-view-btn${view === "upcoming" ? " active" : ""}`}
          onClick={() => setView("upcoming")}
        >
          Upcoming <span>{board.upcoming.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "past"}
          className={`deadline-view-btn${view === "past" ? " active" : ""}`}
          onClick={() => setView("past")}
        >
          Past / done <span>{board.overdue.length}</span>
        </button>
      </div>

      <article
        className={`deadline-col deadline-col-single ${view === "today" ? "today" : view === "upcoming" ? "upcoming" : "overdue"}`}
      >
        <h3>
          {view === "today"
            ? "Due today"
            : view === "upcoming"
              ? "Upcoming"
              : "Past / done"}{" "}
          <span>
            {view === "today"
              ? board.today.length
              : view === "upcoming"
                ? board.upcoming.length
                : board.overdue.length}
          </span>
        </h3>
        <DeadlineRows
          dateMode={view === "today" ? "today" : "deadline"}
          items={
            view === "today"
              ? board.today.slice(0, 8)
              : view === "upcoming"
                ? board.upcoming.slice(0, 8)
                : board.overdue.slice(0, 8)
          }
          empty={
            view === "today"
              ? "Nothing due today."
              : view === "upcoming"
                ? "No upcoming deadlines scheduled."
                : "No past or overdue deadlines."
          }
        />
      </article>

      <div className="deadline-clients">
        <h3>By client</h3>
        <div className="deadline-client-grid">
          {board.byClient.map((row) => (
            <Link
              key={row.clientId}
              className="deadline-client-card"
              to={`/clients/${row.clientId}`}
            >
              <span
                className="swatch xs"
                style={{ background: row.clientColor }}
              >
                {row.clientName.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{row.clientName}</strong>
                <span className="muted">
                  {row.nextDeadlineAt
                    ? `Next ${formatDate(row.nextDeadlineAt)}`
                    : "No upcoming"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
