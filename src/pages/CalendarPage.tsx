import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useBlogs } from "../context/BlogsContext";
import { useClients } from "../context/ClientsContext";
import {
  buildMonthGrid,
  dateInputToIso,
  toDateInputValue,
  type CalendarEvent,
  type CalendarTiming,
} from "../services/calendar";
import { defaultQualityChecks } from "../services/blogGenerate";
import { usePageTitle } from "../usePageTitle";
import { statusLabel } from "../labels";
import { EmptyState } from "../components/ui";
import { DropdownSelect } from "../components/DropdownSelect";
import { useLocalTodayKey } from "../hooks/useLocalTodayKey";
import type { DraftStatus } from "../types";

export function CalendarPage() {
  usePageTitle("Content Calendar");
  const { blogs, getBlog, updateBlog, addBlog, deleteBlog } = useBlogs();
  const { clients } = useClients();
  const todayKey = useLocalTodayKey();
  const now = useMemo(() => new Date(), [todayKey]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [focus, setFocus] = useState<CalendarTiming | "all">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<DraftStatus>("draft");
  const [newClientId, setNewClientId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(() => toDateInputValue(new Date()));
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setNewDate(toDateInputValue(now));
  }, [todayKey, now]);

  const grid = useMemo(
    () =>
      buildMonthGrid({
        year: cursor.year,
        month: cursor.month,
        blogs,
        clients,
        now,
      }),
    [cursor, blogs, clients, now],
  );

  const selectedBlog = selectedId ? getBlog(selectedId) : undefined;
  const selectedClient = selectedBlog
    ? clients.find((client) => client.id === selectedBlog.clientId)
    : undefined;
  const addClient = clients.find((client) => client.id === newClientId);

  useEffect(() => {
    if (!selectedBlog) return;
    setEditTitle(selectedBlog.title);
    setEditDate(toDateInputValue(selectedBlog.calendarDate || selectedBlog.updatedAt));
    setEditStatus(selectedBlog.status);
  }, [selectedBlog]);

  useEffect(() => {
    if (!newClientId) return;
    if (!clients.some((client) => client.id === newClientId)) {
      setNewClientId("");
    }
  }, [clients, newClientId]);

  const monthCounts = {
    past: grid.buckets.past.length,
    today: grid.buckets.today.length,
    future: grid.buckets.future.length,
  };

  function shift(delta: number) {
    setCursor((current) => {
      const date = new Date(current.year, current.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  function selectEvent(event: CalendarEvent) {
    setSelectedId(event.blogId);
    setNotice("");
  }

  function pinToDate(dateKey: string) {
    if (!dateKey) return;
    if (selectedId) {
      updateBlog(selectedId, {
        calendarDate: dateInputToIso(dateKey),
      });
      setEditDate(dateKey);
      setNotice(`Moved pin to ${dateKey}.`);
      return;
    }
    // No pin selected - add a new client pin on that day
    const clientId = newClientId || (clientFilter !== "all" ? clientFilter : "");
    if (!clientId) {
      setNotice("Search and pick a client first, then click a day.");
      return;
    }
    createPin(clientId, dateKey);
  }

  function createPin(clientId: string, dateKey: string, title?: string) {
    const client = clients.find((item) => item.id === clientId);
    if (!client) {
      setNotice("Pick a client first.");
      return;
    }
    const pinTitle =
      title?.trim() ||
      newTitle.trim() ||
      `${client.name} blog · ${dateKey}`;
    const created = addBlog({
      clientId: client.id,
      title: pinTitle,
      body: `${pinTitle}\n\nCalendar pin for ${client.name}. Open Generate or Review to build the full draft.`,
      toneId: client.preferredToneId ?? "authoritative-plain",
      toneName: "Authoritative & Plain-Spoken",
      topicMode: "manual",
      topic: pinTitle,
      targetAudience: "B2B buyers",
      ideaNotes: "Created from Content Calendar pin.",
      keywords: ["content calendar", client.name.toLowerCase()],
      primaryKeyword: "content calendar",
      secondaryKeywords: [client.name.toLowerCase()],
      research: "",
      outline: `Outline - ${pinTitle}`,
      approvedOutline: null,
      sections: [],
      lede: "",
      closing: "",
      versions: [],
      articlePhase: "draft",
      generationToken: 1,
      outlineDirtyAfterDraft: false,
      targetWords: 800,
      seoTitle: pinTitle.slice(0, 60),
      seoMeta: `Scheduled pin for ${client.name}`,
      qualityChecks: defaultQualityChecks(),
      status: "draft",
      calendarDate: dateInputToIso(dateKey),
      contentType: "SEO blog post",
      generationStatus: "Scheduled",
    });
    setSelectedId(created.id);
    setNewTitle("");
    setNewDate(dateKey);
    setNewClientId(client.id);
    setNotice(`Added ${client.name} pin on ${dateKey}.`);
  }

  function handleAddPin() {
    if (!newClientId) {
      setNotice("Choose a client for the pin.");
      return;
    }
    if (!newDate) {
      setNotice("Pick a date for the pin.");
      return;
    }
    createPin(newClientId, newDate, newTitle);
  }

  function saveEdits() {
    if (!selectedBlog) return;
    if (!editTitle.trim()) {
      setNotice("Title cannot be empty.");
      return;
    }
    if (!editDate) {
      setNotice("Pick a calendar date.");
      return;
    }
    updateBlog(selectedBlog.id, {
      title: editTitle.trim(),
      status: editStatus,
      calendarDate: dateInputToIso(editDate),
      articlePhase:
        editStatus === "approved"
          ? "approved"
          : editStatus === "in_review"
            ? "in_review"
            : "draft",
    });
    setNotice("Pin saved.");
  }

  function handleDeletePin() {
    if (!selectedBlog) return;
    const ok = window.confirm(
      `Delete pin “${selectedBlog.title}”? This removes it from the calendar.`,
    );
    if (!ok) return;
    deleteBlog(selectedBlog.id);
    setSelectedId(null);
    setNotice("Pin deleted.");
  }

  function filterEvents(events: CalendarEvent[]): CalendarEvent[] {
    return events.filter((event) => {
      if (clientFilter !== "all" && event.clientId !== clientFilter) return false;
      if (focus !== "all" && event.timing !== focus) return false;
      return true;
    });
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Planning</p>
          <h1>Content Calendar</h1>
          <p className="lede">
            Same day cards across the month. Add a client pin, move it by
            clicking a day, or delete it from the side panel.
          </p>
        </div>
        <div className="workspace-actions">
          <button type="button" className="btn btn-secondary" onClick={() => shift(-1)}>
            ← Prev
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setCursor({ year: now.getFullYear(), month: now.getMonth() })
            }
          >
            Today
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => shift(1)}>
            Next →
          </button>
        </div>
      </header>

      <section className="cal-summary" aria-label="Calendar overview">
        <button
          type="button"
          className={`cal-summary-card${focus === "past" ? " active" : ""}`}
          onClick={() => setFocus((value) => (value === "past" ? "all" : "past"))}
        >
          <span className="cal-summary-label">Past / done</span>
          <strong>{monthCounts.past}</strong>
        </button>
        <button
          type="button"
          className={`cal-summary-card today${focus === "today" ? " active" : ""}`}
          onClick={() => setFocus((value) => (value === "today" ? "all" : "today"))}
        >
          <span className="cal-summary-label">Today</span>
          <strong>{monthCounts.today}</strong>
        </button>
        <button
          type="button"
          className={`cal-summary-card future${focus === "future" ? " active" : ""}`}
          onClick={() =>
            setFocus((value) => (value === "future" ? "all" : "future"))
          }
        >
          <span className="cal-summary-label">Upcoming</span>
          <strong>{monthCounts.future}</strong>
        </button>
      </section>

      <div className="cal-client-pins" role="toolbar" aria-label="Client pins">
        <button
          type="button"
          className={`cal-client-pin${clientFilter === "all" ? " active" : ""}`}
          onClick={() => setClientFilter("all")}
        >
          All clients
        </button>
        {clients.map((client) => (
          <button
            key={client.id}
            type="button"
            className={`cal-client-pin${clientFilter === client.id ? " active" : ""}`}
            style={{ ["--pin-color" as string]: client.color }}
            onClick={() => {
              setClientFilter((current) =>
                current === client.id ? "all" : client.id,
              );
              setNewClientId(client.id);
              setSelectedId(null);
            }}
            title={`Filter / add pins for ${client.name}`}
          >
            <span className="cal-client-pin-swatch" aria-hidden>
              {client.initials}
            </span>
            {client.name}
          </button>
        ))}
      </div>

      <div className="cal-board">
        <section className="dash-card cal-full">
          <div className="dash-card-head">
            <h2>{grid.label}</h2>
            <span className="muted">
              {monthCounts.past + monthCounts.today + monthCounts.future} pins
              {clientFilter !== "all"
                ? ` · ${clients.find((c) => c.id === clientFilter)?.name ?? ""}`
                : ""}
              {focus !== "all" ? ` · ${focus}` : ""}
            </span>
          </div>
          <p className="muted cal-board-hint">
            {selectedId
              ? "Click a day to move this pin."
              : "Click a day to add a pin for the selected client, or use Add pin on the right."}
          </p>
          <div className="cal-preview cal-preview-lg">
            <div className="cal-grid" role="grid" aria-label={grid.label}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <span key={d} className="cal-dow">
                  {d}
                </span>
              ))}
              {grid.cells.map((cell, index) => {
                const events = filterEvents(cell.events);
                const interactive = Boolean(cell.dateKey);
                return (
                  <div
                    key={index}
                    className={[
                      "cal-cell",
                      cell.day ? "" : "empty",
                      cell.today ? "today" : "",
                      interactive ? "interactive" : "",
                      selectedId && cell.dateKey ? "droppable" : "",
                      !selectedId && cell.dateKey ? "addable" : "",
                      cell.dateKey && editDate === cell.dateKey ? "pin-target" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      if (cell.dateKey) pinToDate(cell.dateKey);
                    }}
                  >
                    {cell.day ? <span className="cal-day">{cell.day}</span> : null}
                    <div className="cal-pin-stack">
                      {events.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          className={`cal-pin${selectedId === ev.blogId ? " selected" : ""}`}
                          style={{ ["--pin-color" as string]: ev.color }}
                          title={`${ev.name} · ${ev.title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            selectEvent(ev);
                          }}
                        >
                          <span className="cal-pin-mark" aria-hidden>
                            {ev.initials}
                          </span>
                          <span className="cal-pin-copy">
                            <strong>{ev.short}</strong>
                            <em>{ev.title}</em>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="cal-detail dash-card" aria-label="Pin details">
          {selectedBlog && selectedClient ? (
            <>
              <div className="cal-detail-head">
                <span
                  className="cal-detail-avatar"
                  style={{ background: selectedClient.color }}
                  aria-hidden
                >
                  {selectedClient.initials}
                </span>
                <div>
                  <p className="eyebrow">Editable pin</p>
                  <h2>{selectedClient.name}</h2>
                </div>
              </div>

              <label className="field">
                <span className="field-label">Blog title</span>
                <input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                />
              </label>

              <label className="field">
                <span className="field-label">Pin date</span>
                <input
                  type="date"
                  value={editDate}
                  onChange={(event) => setEditDate(event.target.value)}
                />
              </label>

              <DropdownSelect
                className="field"
                label="Status"
                value={editStatus}
                options={[
                  { value: "draft", label: statusLabel("draft") },
                  { value: "in_review", label: statusLabel("in_review") },
                  { value: "approved", label: statusLabel("approved") },
                ]}
                onChange={(next) => setEditStatus(next as DraftStatus)}
              />

              {notice ? <p className="drive-upload-msg">{notice}</p> : null}

              <div className="form-actions cal-detail-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveEdits}
                >
                  Save pin
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleDeletePin}
                >
                  Delete pin
                </button>
                <Link
                  className="btn btn-ghost"
                  to={`/clients/${selectedBlog.clientId}/blog/${selectedBlog.id}`}
                >
                  Open review
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setSelectedId(null);
                    setNotice("");
                  }}
                >
                  Deselect
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="cal-detail-head">
                <span
                  className="cal-detail-avatar"
                  style={{
                    background: addClient?.color ?? "var(--brand-primary)",
                  }}
                  aria-hidden
                >
                  {addClient?.initials ?? "+"}
                </span>
                <div>
                  <p className="eyebrow">New pin</p>
                  <h2>Add to calendar</h2>
                </div>
              </div>

              <DropdownSelect
                className="field cal-client-search"
                label="Client"
                labelHidden
                value={newClientId}
                searchable
                searchPlaceholder="Search clients…"
                placeholder="Search clients…"
                options={clients.map((client) => ({
                  value: client.id,
                  label: client.name,
                }))}
                onChange={(next) => {
                  setNewClientId(next);
                  if (next) setClientFilter(next);
                }}
              />

              <label className="field">
                <span className="field-label">Blog title</span>
                <input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Optional - defaults to client + date"
                />
              </label>

              <label className="field">
                <span className="field-label">Pin date</span>
                <input
                  type="date"
                  value={newDate}
                  onChange={(event) => setNewDate(event.target.value)}
                />
              </label>

              {notice ? <p className="drive-upload-msg">{notice}</p> : null}

              <div className="form-actions cal-detail-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddPin}
                  disabled={!newClientId || !newDate}
                >
                  Add pin
                </button>
              </div>

              <EmptyState
                title="Or click a day"
                body="With a client chosen above, click any day on the calendar to drop a matching color pin there."
              />
            </>
          )}
        </aside>
      </div>
    </>
  );
}
