import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDrafts } from "../context/DraftsContext";
import { useBlogs } from "../context/BlogsContext";
import { useClients } from "../context/ClientsContext";
import { usePageTitle } from "../usePageTitle";
import { formatDate } from "../format";
import { statusLabel } from "../labels";
import type { DraftStatus } from "../types";
import { EmptyState, SearchField } from "../components/ui";
import { DropdownSelect } from "../components/DropdownSelect";

type LibraryItem = {
  id: string;
  kind: "blog" | "draft";
  clientId: string;
  title: string;
  body: string;
  status: DraftStatus;
  updatedAt: string;
  tone: string;
  words: string;
  href: string;
};

export function LibraryPage() {
  usePageTitle("Generated Drafts");
  const { drafts, updateDraft } = useDrafts();
  const { blogs, updateBlog } = useBlogs();
  const { clients } = useClients();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const status = params.get("status") ?? "all";
  const clientFilter = params.get("client") ?? "all";

  const items = useMemo<LibraryItem[]>(() => {
    const blogItems: LibraryItem[] = blogs.map((blog) => ({
      id: `blog-${blog.id}`,
      kind: "blog",
      clientId: blog.clientId,
      title: blog.title,
      body: blog.body,
      status: blog.status,
      updatedAt: blog.updatedAt,
      tone: blog.toneName || "—",
      words: `${blog.targetWords || 0} words`,
      href: `/clients/${blog.clientId}/blog/${blog.id}`,
    }));
    const draftItems: LibraryItem[] = drafts.map((draft) => ({
      id: `draft-${draft.id}`,
      kind: "draft",
      clientId: draft.clientId,
      title: draft.title,
      body: draft.body,
      status: draft.status,
      updatedAt: draft.updatedAt,
      tone: draft.brief?.format || "—",
      words: "Draft",
      href: `/library/${draft.id}`,
    }));
    return [...blogItems, ...draftItems].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }, [blogs, drafts]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items
      .filter((item) => {
        if (status === "all") return true;
        if (status === "progress") {
          return item.status === "draft" || item.status === "in_review";
        }
        return item.status === status;
      })
      .filter((item) =>
        clientFilter === "all" ? true : item.clientId === clientFilter,
      )
      .filter((item) => {
        if (!needle) return true;
        const client = clients.find((c) => c.id === item.clientId);
        return `${item.title} ${item.body} ${client?.name ?? ""}`
          .toLowerCase()
          .includes(needle);
      });
  }, [items, query, status, clientFilter, clients]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === "all" || (key === "q" && value === "")) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  const filtersActive = query !== "" || status !== "all" || clientFilter !== "all";

  function setStatus(item: LibraryItem, next: DraftStatus) {
    if (item.kind === "blog") {
      updateBlog(item.id.replace(/^blog-/, ""), { status: next });
      return;
    }
    updateDraft(item.id.replace(/^draft-/, ""), { status: next });
  }

  return (
    <div className="library-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Generated Drafts</p>
          <h1>Saved drafts</h1>
          <p className="lede">
            Search, filter, and reopen drafts tied to a client.
          </p>
        </div>
      </header>

      <div className="library-tools">
        <SearchField
          label="Search drafts"
          value={query}
          onChange={(value) => setParam("q", value)}
          placeholder="Search titles and copy"
        />
        <DropdownSelect
          className="field field-inline"
          label="Client"
          value={clientFilter}
          options={[
            { value: "all", label: "All clients" },
            ...clients.map((client) => ({
              value: client.id,
              label: client.name,
            })),
          ]}
          searchable
          searchPlaceholder="Type client name…"
          placeholder="All clients"
          emptyMessage="No client matches that name"
          onChange={(next) => setParam("client", next)}
        />
        <div className="segmented" role="group" aria-label="Status">
          {(["all", "draft", "in_review", "approved"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setParam("status", value)}
            >
              {value === "all" ? "All" : statusLabel(value)}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No saved drafts"
          body="Generate a blog from a client workspace. It is saved as a draft automatically."
          action={
            <Link className="btn btn-primary" to="/clients">
              Go to Client Hub
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No drafts match"
          body="Clear the search or status filter to see the rest of this browser’s drafts."
          action={
            filtersActive ? (
              <button type="button" className="btn btn-secondary" onClick={() => setParams({})}>
                Clear filters
              </button>
            ) : null
          }
        />
      ) : (
        <ul className="draft-list">
          {visible.map((item) => {
            const client = clients.find((c) => c.id === item.clientId);
            return (
              <li key={item.id} className="draft-row">
                <Link to={item.href} className="draft-main">
                  <span className="draft-title">{item.title}</span>
                  <span className="draft-meta">
                    <span
                      className="swatch sm"
                      style={{ background: client?.color ?? "#888" }}
                      title={client?.name ?? "Unknown client"}
                    >
                      {client?.initials ?? "?"}
                    </span>
                    <span>{item.tone}</span>
                    <span aria-hidden>·</span>
                    <span>{item.words}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDate(item.updatedAt)}</span>
                  </span>
                </Link>
                <DropdownSelect
                  className="status-edit"
                  label={`Status for ${item.title}`}
                  labelHidden
                  selectClassName={`status-select status-${item.status}`}
                  value={item.status}
                  options={[
                    { value: "draft", label: "Draft" },
                    { value: "in_review", label: "In Review" },
                    { value: "approved", label: "Approved" },
                  ]}
                  onChange={(next) => setStatus(item, next as DraftStatus)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
