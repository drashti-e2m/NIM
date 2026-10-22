import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useClients } from "../context/ClientsContext";
import { useBlogs } from "../context/BlogsContext";
import { useDrafts } from "../context/DraftsContext";
import { usePageTitle } from "../usePageTitle";
import { EmptyState, SearchField } from "../components/ui";
import { DropdownSelect } from "../components/DropdownSelect";

type SortKey = "newest" | "oldest" | "name";

function isSortKey(value: string | null): value is SortKey {
  return value === "newest" || value === "oldest" || value === "name";
}

export function ClientHubPage() {
  usePageTitle("Client Hub");
  const { clients, addClient } = useClients();
  const { blogs } = useBlogs();
  const { drafts } = useDrafts();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const sort: SortKey = isSortKey(params.get("sort"))
    ? (params.get("sort") as SortKey)
    : "newest";
  const adding = params.get("add") === "1";

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!adding) {
      setName("");
      setWebsite("");
      setIndustry("");
      setFormError("");
    }
  }, [adding]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = clients;
    if (needle) {
      list = clients.filter((client) =>
        `${client.name} ${client.website} ${client.industry}`
          .toLowerCase()
          .includes(needle),
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [clients, query, sort]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (
      !value ||
      (key === "sort" && value === "newest") ||
      (key === "q" && value === "") ||
      (key === "add" && value !== "1")
    ) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  function setAdding(open: boolean) {
    setParam("add", open ? "1" : "");
  }

  function submitClient(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setFormError("Client name is required.");
      return;
    }
    if (!website.trim()) {
      setFormError("Website is required.");
      return;
    }
    addClient({ name, website, industry: industry.trim() || undefined });
    setName("");
    setWebsite("");
    setIndustry("");
    setFormError("");
    setAdding(false);
  }

  function countsFor(clientId: string) {
    const clientBlogs = blogs.filter((blog) => blog.clientId === clientId);
    const clientDrafts = drafts.filter((draft) => draft.clientId === clientId);
    const draft =
      clientBlogs.filter((b) => b.status === "draft").length +
      clientDrafts.filter((d) => d.status === "draft").length;
    const inReview =
      clientBlogs.filter((b) => b.status === "in_review").length +
      clientDrafts.filter((d) => d.status === "in_review").length;
    const published =
      clientBlogs.filter((b) => b.status === "approved").length +
      clientDrafts.filter((d) => d.status === "approved").length;
    return { draft, inReview, published };
  }

  const clientCountLabel =
    clients.length === 1 ? "1 client" : `${clients.length} clients`;

  return (
    <div className="client-hub">
      <header className="hub-intro">
        <p className="eyebrow">Client Hub</p>
        <h1>Your Clients</h1>
      </header>

      <div className="hub-controls" role="toolbar" aria-label="Client filters">
        <span className="hub-count" aria-live="polite">
          {clientCountLabel}
        </span>
        <SearchField
          label="Search clients"
          value={query}
          onChange={(value) => setParam("q", value)}
          placeholder="Search by client name or website…"
        />
        <DropdownSelect
          className="field field-inline hub-sort"
          label="Sort"
          labelHidden
          value={sort}
          options={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "name", label: "Name A–Z" },
          ]}
          onChange={(next) => setParam("sort", next)}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setAdding(!adding)}
        >
          {adding ? "Close" : "+ Add Client"}
        </button>
      </div>

      {adding ? (
        <form className="panel hub-add-form" onSubmit={submitClient}>
          <h2>Add Client</h2>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Name *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>
            <label className="field">
              <span className="field-label">Website *</span>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="example.com"
              />
            </label>
            <label className="field field-wide">
              <span className="field-label">Industry (optional)</span>
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </label>
          </div>
          {formError ? <p className="field-error">{formError}</p> : null}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save client
            </button>
          </div>
        </form>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title={
            query.trim()
              ? `No clients match “${query.trim()}”`
              : "No clients yet"
          }
          body={
            query.trim()
              ? "Try another name or website, or clear the search."
              : "Add a client to open a workspace."
          }
          action={
            !query.trim() ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setAdding(true)}
              >
                + Add Client
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="client-grid client-grid-3">
          {visible.map((client) => {
            const counts = countsFor(client.id);
            return (
              <li key={client.id}>
                <Link
                  className="client-flash"
                  to={`/clients/${client.id}`}
                  title={client.name}
                >
                  <span
                    className="client-flash-mark"
                    style={{ background: client.color }}
                    aria-hidden
                  >
                    {client.initials}
                  </span>
                  <span className="client-flash-body">
                    <strong className="client-flash-name">{client.name}</strong>
                    <span className="client-flash-site">{client.website}</span>
                    <span className="client-flash-stats">
                      <span>
                        <i className="stat-dot draft" aria-hidden />
                        {counts.draft} drafts
                      </span>
                      <span>
                        <i className="stat-dot review" aria-hidden />
                        {counts.inReview} in review
                      </span>
                      <span>
                        <i className="stat-dot published" aria-hidden />
                        {counts.published} published
                      </span>
                    </span>
                  </span>
                  <span className="client-flash-chevron" aria-hidden>
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
