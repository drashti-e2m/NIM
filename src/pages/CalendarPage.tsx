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
import {
  findBlogPinForDay,
  pinDateIso,
} from "../services/blogCalendarSync";
import { defaultQualityChecks } from "../services/blogGenerate";
import { usePageTitle } from "../usePageTitle";
import { STATUS_OPTIONS } from "../labels";
import { DropdownSelect } from "../components/DropdownSelect";
import { useLocalTodayKey } from "../hooks/useLocalTodayKey";
import type { DraftStatus } from "../types";
import { blogStatusPatch } from "../services/blogStatus";

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
  const [editContentStatus, setEditContentStatus] = useState<"sorted" | "to_sort">(
    "to_sort",
  );
  const [editNotes, setEditNotes] = useState("");
  const [addingPin, setAddingPin] = useState(false);
  const [newClientId, setNewClientId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(() => toDateInputValue(new Date()));
  const [newStatus, setNewStatus] = useState<DraftStatus>("draft");
  const [newContentStatus, setNewContentStatus] = useState<"sorted" | "to_sort">(
    "to_sort",
  );
  const [newNotes, setNewNotes] = useState("");
  const [notice, setNotice] = useState("");

  function contentStatusFromBlog(blog: {
    generationStatus?: string;
    sections?: unknown[];
    body?: string;
    lede?: string;
  }): "sorted" | "to_sort" {
    const raw = (blog.generationStatus || "").toLowerCase();
    if (raw === "sorted" || raw === "to sort" || raw === "to_sort") {
      return raw === "sorted" ? "sorted" : "to_sort";
    }
    const hasContent =
      (blog.sections?.length ?? 0) > 0 ||
      (blog.lede?.trim().length ?? 0) > 40 ||
      (blog.body?.length ?? 0) >= 500;
    return hasContent ? "sorted" : "to_sort";
  }

  useEffect(() => {
    setNewDate(toDateInputValue(now));
  }, [todayKey, now]);

  const selectedBlog = selectedId ? getBlog(selectedId) : undefined;
  const selectedClient = selectedBlog
    ? clients.find((client) => client.id === selectedBlog.clientId)
    : undefined;
  const addClient = clients.find((client) => client.id === newClientId);

  // While a pin is selected, preview it on editDate so placement is visible
  // before Save. Deselect without Save restores the stored calendarDate.
  const displayBlogs = useMemo(() => {
    if (!selectedId || !editDate) return blogs;
    const iso = dateInputToIso(editDate);
    return blogs.map((blog) =>
      blog.id === selectedId ? { ...blog, calendarDate: iso } : blog,
    );
  }, [blogs, selectedId, editDate]);

  const grid = useMemo(
    () =>
      buildMonthGrid({
        year: cursor.year,
        month: cursor.month,
        blogs: displayBlogs,
        clients,
        now,
      }),
    [cursor, displayBlogs, clients, now],
  );

  useEffect(() => {
    if (!selectedBlog) return;
    setEditTitle(selectedBlog.title);
    setEditDate(toDateInputValue(selectedBlog.calendarDate || selectedBlog.updatedAt));
    setEditStatus(selectedBlog.status);
    setEditContentStatus(contentStatusFromBlog(selectedBlog));
    setEditNotes(selectedBlog.ideaNotes || "");
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
    setAddingPin(false);
    setSelectedId((current) =>
      current === event.blogId ? null : event.blogId,
    );
    setNotice("");
  }

  function startAddPin(dateKey?: string) {
    setSelectedId(null);
    setAddingPin(true);
    setNewTitle("");
    setNewDate(dateKey || toDateInputValue(now));
    setNewStatus("draft");
    setNewContentStatus("to_sort");
    setNewNotes("");
    if (clientFilter !== "all") setNewClientId(clientFilter);
    setNotice("");
  }

  function cancelAddPin() {
    setAddingPin(false);
    setNotice("");
  }

  function pinToDate(dateKey: string) {
    if (!dateKey) return;
    if (selectedId) {
      // Pending placement only — persist on Save so Deselect cannot move it.
      setEditDate(dateKey);
      setNotice(`Pin placed on ${dateKey}. Click Save pin to keep it there.`);
      return;
    }
    // Calendar only until Add pin — if already adding, just set the date.
    if (addingPin) setNewDate(dateKey);
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
    const calendarDate = pinDateIso(dateKey);
    const notes = newNotes.trim() || "Created from Content Calendar pin.";
    const contentStatus =
      newContentStatus === "sorted" ? "Sorted" : "To sort";

    // Upsert: reuse the existing pin for this client+day so Library/Calendar stay synced.
    const existing = findBlogPinForDay(
      blogs,
      client.id,
      dateKey,
      title?.trim() || newTitle.trim() || undefined,
    );
    if (existing) {
      const patchTitle =
        title?.trim() || newTitle.trim() ? pinTitle : existing.title;
      updateBlog(existing.id, {
        title: patchTitle,
        topic: patchTitle,
        calendarDate,
        calendarPinned: true,
        ideaNotes: notes,
        generationStatus: contentStatus,
        ...blogStatusPatch(newStatus),
      });
      setSelectedId(existing.id);
      setAddingPin(false);
      setNewTitle("");
      setNewNotes("");
      setNewDate(dateKey);
      setNewClientId(client.id);
      setNotice(`Synced existing ${client.name} pin on ${dateKey}.`);
      return;
    }

    const statusPatch = blogStatusPatch(newStatus);
    const created = addBlog({
      clientId: client.id,
      title: pinTitle,
      body: `${pinTitle}\n\nCalendar pin for ${client.name}. Open Generate or Review to build the full draft.`,
      toneId: client.preferredToneId ?? "authoritative-plain",
      toneName: "Authoritative & Plain-Spoken",
      topicMode: "manual",
      topic: pinTitle,
      targetAudience: "B2B buyers",
      ideaNotes: notes,
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
      generationToken: 1,
      outlineDirtyAfterDraft: false,
      targetWords: 800,
      seoTitle: pinTitle.slice(0, 60),
      seoMeta: `Scheduled pin for ${client.name}`,
      qualityChecks: defaultQualityChecks(),
      status: statusPatch.status,
      articlePhase: statusPatch.articlePhase,
      calendarDate,
      calendarPinned: true,
      contentType: "SEO blog post",
      generationStatus: contentStatus,
    });
    setSelectedId(created.id);
    setAddingPin(false);
    setNewTitle("");
    setNewNotes("");
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
    if (!newTitle.trim()) {
      setNotice("Enter a blog name.");
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
      ...blogStatusPatch(editStatus),
      calendarDate: dateInputToIso(editDate),
      calendarPinned: true,
      ideaNotes: editNotes.trim(),
      generationStatus: editContentStatus === "sorted" ? "Sorted" : "To sort",
    });
    setNotice("Pin saved. It will stay on this date when deselected.");
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

      <div
        className={`cal-board${selectedBlog || addingPin ? " has-detail" : " cal-board-full"}`}
      >
        <section className="dash-card cal-full">
          <div className="dash-card-head">
            <h2>{grid.label}</h2>
            <div className="cal-board-head-actions">
              <span className="muted">
                {monthCounts.past + monthCounts.today + monthCounts.future} pins
                {clientFilter !== "all"
                  ? ` · ${clients.find((c) => c.id === clientFilter)?.name ?? ""}`
                  : ""}
                {focus !== "all" ? ` · ${focus}` : ""}
              </span>
              {!addingPin && !selectedBlog ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => startAddPin()}
                >
                  Add pin
                </button>
              ) : null}
            </div>
          </div>
          {selectedId || addingPin ? (
            <p className="muted cal-board-hint">
              {selectedId
                ? "Click a day to place this pin, then Save pin to keep it there. Click the pin again to deselect."
                : "Fill the pin details on the right, or click a day to set the pin date."}
            </p>
          ) : null}
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
                          className={`cal-pin cal-pin-logo${selectedId === ev.blogId ? " selected" : ""}`}
                          style={{ ["--pin-color" as string]: ev.color }}
                          title={`${ev.name} · ${ev.title}`}
                          aria-label={`${ev.name}: ${ev.title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            selectEvent(ev);
                          }}
                        >
                          <span className="cal-pin-mark" aria-hidden>
                            {ev.initials}
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

        {selectedBlog && selectedClient ? (
          <aside className="cal-detail dash-card" aria-label="Pin details">
            <div className="cal-detail-head">
              <span
                className="cal-detail-avatar"
                style={{ background: selectedClient.color }}
                aria-hidden
              >
                {selectedClient.initials}
              </span>
              <div>
                <p className="eyebrow">{selectedClient.name}</p>
                <h2>Pin details</h2>
              </div>
            </div>

            <label className="field">
              <span className="field-label">Blog name</span>
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
              label="Content status"
              value={editContentStatus}
              options={[
                { value: "to_sort", label: "To sort" },
                { value: "sorted", label: "Sorted" },
              ]}
              onChange={(next) =>
                setEditContentStatus(next === "sorted" ? "sorted" : "to_sort")
              }
            />

            <DropdownSelect
              className="field"
              label="Blog status"
              value={editStatus}
              options={STATUS_OPTIONS.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
              onChange={(next) => {
                const value = next as DraftStatus;
                setEditStatus(value);
                if (selectedBlog) {
                  updateBlog(selectedBlog.id, blogStatusPatch(value));
                }
              }}
            />

            <label className="field">
              <span className="field-label">Notes</span>
              <textarea
                rows={4}
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
                placeholder="Add notes for this pin…"
              />
            </label>

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
            </div>
          </aside>
        ) : addingPin ? (
          <aside className="cal-detail dash-card" aria-label="Pin details">
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
                <p className="eyebrow">{addClient?.name ?? "New pin"}</p>
                <h2>Pin details</h2>
              </div>
            </div>

            <DropdownSelect
              className="field cal-client-search"
              label="Client"
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
              <span className="field-label">Blog name</span>
              <input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Enter blog name"
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

            <DropdownSelect
              className="field"
              label="Content status"
              value={newContentStatus}
              options={[
                { value: "to_sort", label: "To sort" },
                { value: "sorted", label: "Sorted" },
              ]}
              onChange={(next) =>
                setNewContentStatus(next === "sorted" ? "sorted" : "to_sort")
              }
            />

            <DropdownSelect
              className="field"
              label="Blog status"
              value={newStatus}
              options={STATUS_OPTIONS.map((option) => ({
                value: option.id,
                label: option.label,
              }))}
              onChange={(next) => setNewStatus(next as DraftStatus)}
            />

            <label className="field">
              <span className="field-label">Notes</span>
              <textarea
                rows={4}
                value={newNotes}
                onChange={(event) => setNewNotes(event.target.value)}
                placeholder="Add notes for this pin…"
              />
            </label>

            {notice ? <p className="drive-upload-msg">{notice}</p> : null}

            <div className="form-actions cal-detail-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddPin}
                disabled={!newClientId || !newDate || !newTitle.trim()}
              >
                Save pin
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cancelAddPin}
              >
                Cancel
              </button>
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );
}
