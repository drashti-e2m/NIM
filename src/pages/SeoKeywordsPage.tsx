import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useBlogs } from "../context/BlogsContext";
import { useClients } from "../context/ClientsContext";
import { usePageTitle } from "../usePageTitle";
import { EmptyState, SearchField } from "../components/ui";
import { DropdownSelect } from "../components/DropdownSelect";

interface KeywordRow {
  keyword: string;
  count: number;
  clients: string[];
  blogs: { id: string; clientId: string; title: string }[];
}

export function SeoKeywordsPage() {
  usePageTitle("SEO Keywords");
  const { blogs } = useBlogs();
  const { clients, getClient } = useClients();
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");

  const rows = useMemo(() => {
    const map = new Map<string, KeywordRow>();
    for (const blog of blogs) {
      if (clientFilter !== "all" && blog.clientId !== clientFilter) continue;
      for (const raw of blog.keywords) {
        const keyword = raw.trim().toLowerCase();
        if (!keyword) continue;
        const existing = map.get(keyword) ?? {
          keyword,
          count: 0,
          clients: [],
          blogs: [],
        };
        existing.count += 1;
        if (!existing.clients.includes(blog.clientId)) {
          existing.clients.push(blog.clientId);
        }
        if (!existing.blogs.some((b) => b.id === blog.id)) {
          existing.blogs.push({
            id: blog.id,
            clientId: blog.clientId,
            title: blog.title,
          });
        }
        map.set(keyword, existing);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));
  }, [blogs, clientFilter]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (row) =>
        row.keyword.includes(needle) ||
        row.blogs.some((b) => b.title.toLowerCase().includes(needle)),
    );
  }, [rows, query]);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">SEO</p>
          <h1>SEO Keywords</h1>
          <p className="lede">
            Keywords collected from generated blog drafts across clients. Open a
            keyword to jump into the related article.
          </p>
        </div>
      </header>

      <div className="library-tools">
        <SearchField
          label="Search keywords"
          value={query}
          onChange={setQuery}
          placeholder="Search keywords or article titles"
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
          onChange={setClientFilter}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No keywords yet"
          body="Generate a blog with keywords in the wizard. They will appear here for SEO review."
          action={
            <Link className="btn btn-primary" to="/clients">
              Open Client Hub
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No keywords match"
          body="Try another search or clear the client filter."
        />
      ) : (
        <ul className="keyword-board">
          {visible.map((row) => (
            <li key={row.keyword} className="keyword-card">
              <div className="keyword-card-head">
                <h2>{row.keyword}</h2>
                <span className="keyword-count">{row.count} use{row.count === 1 ? "" : "s"}</span>
              </div>
              <p className="muted">
                Clients:{" "}
                {row.clients
                  .map((id) => getClient(id)?.name ?? id)
                  .join(", ")}
              </p>
              <ul className="keyword-blogs">
                {row.blogs.slice(0, 4).map((blog) => (
                  <li key={blog.id}>
                    <Link to={`/clients/${blog.clientId}/blog/${blog.id}`}>
                      {blog.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
